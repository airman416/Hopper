import type { Handler } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-claude-api-key",
};

function getApiKey(event: { headers?: Record<string, string | undefined> }): string | null {
    const headerKey = event.headers?.["x-claude-api-key"] ?? event.headers?.["X-Claude-Api-Key"];
    if (headerKey?.trim()) return headerKey.trim();
    return process.env.CLAUDE_API_KEY || null;
}

/** PRD: Sam Parr frameworks for the Architect step */
const FRAMEWORKS = [
    "Deep Dive Story",
    "Listicle/Flex",
    "Personal Rant",
] as const;

const FRAMEWORK_DESCRIPTIONS: Record<string, string> = {
    "Deep Dive Story": "Start with a hook, explain a historical or business figure, extract a game-theory lesson.",
    "Listicle/Flex": "Staccato list of revenue numbers, ages, achievements of a specific group.",
    "Personal Rant": "Exasperated or mushy take on life, dieting, or business culture.",
};

/**
 * Step 1 — The Architect.
 *
 * Identifies the core insight and chooses a Sam Parr framework
 * for the Writer to use when drafting.
 */
const handler: Handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: corsHeaders };
    }

    const apiKey = getApiKey(event);
    if (!apiKey) {
        return {
            statusCode: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Claude API key required. Set CLAUDE_API_KEY in Netlify env vars." }),
        };
    }

    try {
        const { sourceText } = JSON.parse(event.body || "{}");
        if (!sourceText || typeof sourceText !== "string") {
            return {
                statusCode: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ error: "sourceText required." }),
            };
        }

        const anthropic = new Anthropic({ apiKey });

        const systemPrompt = `You are an editor for Sam Parr's content. Your job is to analyze raw source text and output a JSON object with exactly two keys:
- coreInsight: The single most compelling, contrarian, or actionable idea in the text. One sentence, punchy.
- framework: One of these exact strings: ${FRAMEWORKS.join(" | ")}

Choose the framework that best fits how this idea should be presented in a viral post. Output ONLY valid JSON, no markdown, no explanation.`;

        const message = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 256,
            system: systemPrompt,
            messages: [
                {
                    role: "user",
                    content: `Analyze this source text and output the JSON:\n\n${sourceText}`,
                },
            ],
        });

        const text = message.content[0].type === "text" ? message.content[0].text : "";
        let parsed: { coreInsight?: string; framework?: string };
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : "{}") as { coreInsight?: string; framework?: string };
        } catch {
            parsed = {};
        }

        const coreInsight = parsed.coreInsight ?? "A sharp, contrarian take that stops the scroll.";
        const frameworkKey = parsed.framework && FRAMEWORKS.includes(parsed.framework as (typeof FRAMEWORKS)[number])
            ? parsed.framework
            : FRAMEWORKS[0];
        const framework = `${frameworkKey}: ${FRAMEWORK_DESCRIPTIONS[frameworkKey] ?? ""}`;

        return {
            statusCode: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ coreInsight, framework }),
        };
    } catch (error: unknown) {
        console.error("AI architect error:", error);
        const errorMessage = error instanceof Error ? error.message : "Architect step failed";
        return {
            statusCode: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ error: errorMessage }),
        };
    }
};

export { handler };
