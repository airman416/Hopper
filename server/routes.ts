import type { Express } from "express";
import { createServer, type Server } from "http";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { content, platform, sourceContent } = req.body;

      const platformInstructions: Record<string, string> = {
        linkedin: `Rewrite this social media post for LinkedIn. Make it professional but conversational. Use short paragraphs. Add line breaks between paragraphs. Keep it punchy and value-driven. No hashtags. No emojis.`,
        twitter: `Rewrite this social media post for Twitter/X. Keep it under 280 characters if possible, or make it a concise thread-worthy post. Make it sharp, witty, and direct. No hashtags. No emojis.`,
        instagram: `Rewrite this social media post for an Instagram carousel. Break it into 5-7 slide-worthy chunks, separated by ---. First slide should be a hook. Last slide should be a CTA. Keep each chunk to 2-3 short sentences max.`,
        newsletter: `Rewrite this social media post as a newsletter section. Expand on the ideas with more depth and examples. Use a conversational tone like you're writing to a friend. Add a compelling subject line at the top prefixed with "Subject: ".`,
      };

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `${platformInstructions[platform] || platformInstructions.linkedin}\n\nOriginal post:\n${sourceContent || content}`,
          },
        ],
      });

      const text =
        message.content[0].type === "text" ? message.content[0].text : "";
      res.json({ content: text });
    } catch (error: any) {
      console.error("AI generate error:", error);
      res.status(500).json({ error: error.message || "AI generation failed" });
    }
  });

  app.post("/api/ai/punchier", async (req, res) => {
    try {
      const { content } = req.body;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `Take this draft and make it punchier. Rules:\n1. Reduce word count by 20%\n2. Increase sentence contrast (mix very short sentences with medium ones)\n3. Remove filler words\n4. Make the opening line hit harder\n5. Keep the same core message\n6. Do NOT add any AI-sounding words like "delve", "tapestry", "robust", "leverage", "paradigm"\n\nReturn ONLY the rewritten text, no explanation.\n\nDraft:\n${content}`,
          },
        ],
      });

      const text =
        message.content[0].type === "text" ? message.content[0].text : "";
      res.json({ content: text });
    } catch (error: any) {
      console.error("AI punchier error:", error);
      res.status(500).json({ error: error.message || "AI punchier failed" });
    }
  });

  app.post("/api/ai/hater", async (req, res) => {
    try {
      const { content } = req.body;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are a cynical, skeptical internet commenter who has seen it all. Generate a sharp, witty opposing reply to this post. Be specific in your critique - don't just be generically negative. Point out logical flaws, missing nuance, or where the author is being self-serving. Keep it to 2-3 sentences. Be funny but not mean-spirited.\n\nPost:\n${content}`,
          },
        ],
      });

      const text =
        message.content[0].type === "text" ? message.content[0].text : "";
      res.json({ content: text });
    } catch (error: any) {
      console.error("AI hater error:", error);
      res.status(500).json({ error: error.message || "AI hater failed" });
    }
  });

  app.post("/api/ai/shaan", async (req, res) => {
    try {
      const { content } = req.body;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `Rewrite this post in the style of Shaan Puri. Rules:\n1. Use highly conversational language - like texting a smart friend\n2. Use slang naturally ("bro", "insane", "wild", "ngl")\n3. Break down ideas using frameworks and numbered lists\n4. Use concrete dollar amounts and specific examples\n5. Keep sentences short and punchy\n6. Start with something surprising or contrarian\n7. End with a "here's the move:" type actionable takeaway\n8. No corporate speak, no emojis, no hashtags\n\nReturn ONLY the rewritten text.\n\nOriginal:\n${content}`,
          },
        ],
      });

      const text =
        message.content[0].type === "text" ? message.content[0].text : "";
      res.json({ content: text });
    } catch (error: any) {
      console.error("AI shaan error:", error);
      res.status(500).json({ error: error.message || "AI shaan rewrite failed" });
    }
  });

  return httpServer;
}
