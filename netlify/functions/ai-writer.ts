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

/**
 * Step 2 — The Writer.
 *
 * Receives the dynamically assembled system prompt (with cache_control)
 * and the user message containing the Architect's framework.
 *
 * Uses Anthropic Prompt Caching: the static system blocks (Persona,
 * Syntax Rulebook, Voice Vault) are marked with cache_control so
 * successive calls within a session hit the cache and cost 90% fewer
 * input tokens.
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
            body: JSON.stringify({ error: "Claude API key required." }),
        };
    }

    try {
        const { systemBlocks, userMessage } = JSON.parse(event.body || "{}");

        const anthropic = new Anthropic({ apiKey });

        // System blocks come pre-assembled from the client with cache_control
        // on the final static block, enabling Anthropic prompt caching.
        const message = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2048,
            system: systemBlocks,
            messages: [
                {
                    role: "user",
                    content: userMessage,
                },
            ],
        });

        const text = message.content[0].type === "text" ? message.content[0].text : "";
        return {
            statusCode: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ content: text }),
        };
    } catch (error: unknown) {
        console.error("AI writer error:", error);
        const errorMessage = error instanceof Error ? error.message : "Writer step failed";
        return {
            statusCode: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ error: errorMessage }),
        };
    }
};

export { handler };
