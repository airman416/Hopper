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

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders };
  }

  const apiKey = getApiKey(event);
  if (!apiKey) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Claude API key required. Set CLAUDE_API_KEY in Netlify env vars or add in Settings." }),
    };
  }

  try {
    const { content } = JSON.parse(event.body || "{}");
    const userContent = `You are a cynical, skeptical internet commenter who has seen it all. Generate a sharp, witty opposing reply to this post. Be specific in your critique - don't just be generically negative. Point out logical flaws, missing nuance, or where the author is being self-serving. Keep it to 2-3 sentences. Be funny but not mean-spirited.

Post:
${content}`;

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [{ role: "user", content: userContent }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    };
  } catch (error: unknown) {
    console.error("AI hater error:", error);
    const message = error instanceof Error ? error.message : "AI hater failed";
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
