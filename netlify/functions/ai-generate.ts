import type { Handler } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";

const platformInstructions: Record<string, string> = {
  linkedin: `Rewrite this social media post for LinkedIn. Make it professional but conversational. Use short paragraphs. Add line breaks between paragraphs. Keep it punchy and value-driven. No hashtags. No emojis.`,
  twitter: `Rewrite this social media post for Twitter/X. Keep it under 280 characters if possible, or make it a concise thread-worthy post. Make it sharp, witty, and direct. No hashtags. No emojis.`,
  instagram: `Rewrite this social media post for an Instagram carousel. Output CAPTION: first (1-3 sentences for the IG caption), then ---, then the slides. Use as many words from the original as possible. Use as few slides as needed (up to 10 max). Most topics need 4-7. Separate slides with ---. First slide = hook. Last slide = CTA. Keep each chunk to 2-3 short sentences max.`,
  newsletter: `Rewrite this social media post as a newsletter section. Expand on the ideas with more depth and examples. Use a conversational tone like you're writing to a friend. Add a compelling subject line at the top prefixed with "Subject: ".`,
  quote: `Extract the single most powerful, quotable sentence or idea from this post. If there isn't one clear sentence, distill the core idea into one punchy, standalone quote. Keep it under 30 words. Return ONLY the quote text, nothing else.`,
};

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
      body: JSON.stringify({ error: "Claude API key required. Set CLAUDE_API_KEY in Netlify env vars." }),
    };
  }

  try {
    const { content, platform, sourceContent } = JSON.parse(event.body || "{}");
    const instruction = platformInstructions[platform] || platformInstructions.linkedin;
    const userContent = `${instruction}\n\nOriginal post:\n${sourceContent || content}`;

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
    console.error("AI generate error:", error);
    const message = error instanceof Error ? error.message : "AI generation failed";
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
