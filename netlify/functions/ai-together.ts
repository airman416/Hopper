import type { Handler } from "@netlify/functions";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Together AI inference endpoint for the Sam-Llama-3 fine-tuned model.
 *
 * Accepts a lightweight system prompt (persona + RAG only) and user message.
 * Routes to Together AI's chat completions API using the configured LoRA adapter.
 */
const handler: Handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: corsHeaders };
    }

    const togetherApiKey = process.env.TOGETHER_API_KEY;
    if (!togetherApiKey) {
        return {
            statusCode: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({
                error: "TOGETHER_API_KEY not configured in environment variables.",
            }),
        };
    }

    try {
        const { systemPrompt, userMessage } = JSON.parse(event.body || "{}");

        // The LoRA adapter ID will be configured here once fine-tuning is complete.
        // For now, use the base Llama 3 8B Instruct model as a placeholder.
        const modelId =
            process.env.TOGETHER_MODEL_ID ||
            "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo";

        const response = await fetch(
            "https://api.together.xyz/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${togetherApiKey}`,
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userMessage },
                    ],
                    max_tokens: 2048,
                    temperature: 0.7,
                    top_p: 0.9,
                }),
            },
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Together AI error:", errorText);
            return {
                statusCode: response.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({
                    error: `Together AI request failed: ${response.status}`,
                }),
            };
        }

        const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content ?? "";

        return {
            statusCode: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ content: text }),
        };
    } catch (error: unknown) {
        console.error("Together AI error:", error);
        const errorMessage =
            error instanceof Error ? error.message : "Together AI inference failed";
        return {
            statusCode: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ error: errorMessage }),
        };
    }
};

export { handler };
