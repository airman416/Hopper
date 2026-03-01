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
    const userContent = `Rewrite this post in the style of Shaan Puri. Rules:
1. Use highly conversational language - like texting a smart friend
2. Use slang naturally ("bro", "insane", "wild", "ngl")
3. Break down ideas using frameworks and numbered lists
4. Use concrete dollar amounts and specific examples
5. Keep sentences short and punchy
6. Start with something surprising or contrarian
7. End with a "here's the move:" type actionable takeaway
8. No corporate speak, no emojis, no hashtags

Return ONLY the rewritten text.

Original:
${content}`;

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      messages: [{ role: "user", content: userContent }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    };
  } catch (error: unknown) {
    console.error("AI shaan error:", error);
    const message = error instanceof Error ? error.message : "AI shaan rewrite failed";
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
