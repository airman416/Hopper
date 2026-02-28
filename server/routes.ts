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
  app.get("/api/feed/twitter", async (req, res) => {
    try {
      const token = process.env.APIFY_API_KEY;
      if (!token) return res.status(500).json({ error: "APIFY_API_KEY not set" });

      const response = await fetch(
        `https://api.apify.com/v2/acts/kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest/run-sync-get-dataset-items?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "filter:blue_verified": false,
            "filter:consumer_video": false,
            "filter:has_engagement": false,
            "filter:hashtags": false,
            "filter:images": false,
            "filter:links": false,
            "filter:media": false,
            "filter:mentions": false,
            "filter:native_video": false,
            "filter:nativeretweets": false,
            "filter:news": false,
            "filter:pro_video": false,
            "filter:quote": false,
            "filter:replies": false,
            "filter:safe": false,
            "filter:spaces": false,
            "filter:twimg": false,
            "filter:videos": false,
            "filter:vine": false,
            "include:nativeretweets": false,
            lang: "en",
            maxItems: 20,
            queryType: "Top",
            twitterContent: "from:thesamparr since:2026-01-01 -filter:replies",
            min_retweets: 0,
            min_faves: 0,
            min_replies: 0,
            "-min_retweets": 0,
            "-min_faves": 0,
            "-min_replies": 0,
          }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("Apify Twitter error:", text);
        return res.status(response.status).json({ error: "Apify Twitter fetch failed" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Twitter feed error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/feed/instagram", async (req, res) => {
    try {
      const token = process.env.APIFY_API_KEY;
      if (!token) return res.status(500).json({ error: "APIFY_API_KEY not set" });

      const response = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=60&memory=512`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(75_000),
          body: JSON.stringify({
            addParentData: false,
            directUrls: ["https://www.instagram.com/thesamparr"],
            onlyPostsNewerThan: "2026-01-01",
            resultsLimit: 10,
            resultsType: "posts",
            searchLimit: 1,
            searchType: "hashtag",
          }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("Apify Instagram error:", text);
        return res.status(response.status).json({ error: "Apify Instagram fetch failed" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Instagram feed error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/feed/linkedin", async (req, res) => {
    try {
      const token = process.env.LINKEDAPI_API_KEY;
      if (!token) return res.status(500).json({ error: "LINKEDAPI_API_KEY not set" });

      const SAM_PARR_URN = "ACoAAAt8nxwBrEPNpBTNouIQJu8BAIje750mmC0";

      const response = await fetch(
        `https://linkdapi.com/api/v1/posts/all?urn=${SAM_PARR_URN}&start=0`,
        {
          headers: { "X-linkdapi-apikey": `li-${token}` },
        },
      );

      if (!response.ok) {
        const text = await response.text();
        console.error("LinkdAPI error:", text);
        return res.status(response.status).json({ error: "LinkdAPI fetch failed" });
      }

      const data = await response.json();
      const allPosts: any[] = data?.data?.posts ?? [];
      const top10 = allPosts
        .filter(
          (p) =>
            p.author?.urn === SAM_PARR_URN &&
            p.resharedPostContent == null,
        )
        .sort((a, b) => (b.postedAt?.timestamp ?? 0) - (a.postedAt?.timestamp ?? 0))
        .slice(0, 10);
      res.json({ ...data, data: { ...data.data, posts: top10 } });
    } catch (error: any) {
      console.error("LinkedIn feed error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/proxy/image", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).json({ error: "URL required" });

      const response = await fetch(url);
      if (!response.ok) return res.status(response.status).send("Failed to fetch image");

      const contentType = response.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");

      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch (error: any) {
      console.error("Image proxy error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { content, platform, sourceContent } = req.body;

      const platformInstructions: Record<string, string> = {
        linkedin: `Rewrite this social media post for LinkedIn. Make it professional but conversational. Use short paragraphs. Add line breaks between paragraphs. Keep it punchy and value-driven. No hashtags. No emojis.`,
        twitter: `Rewrite this social media post for Twitter/X. Keep it under 280 characters if possible, or make it a concise thread-worthy post. Make it sharp, witty, and direct. No hashtags. No emojis.`,
        instagram: `Rewrite this social media post for an Instagram carousel. Break it into 5-7 slide-worthy chunks, separated by ---. First slide should be a hook. Last slide should be a CTA. Keep each chunk to 2-3 short sentences max.`,
        newsletter: `Rewrite this social media post as a newsletter section. Expand on the ideas with more depth and examples. Use a conversational tone like you're writing to a friend. Add a compelling subject line at the top prefixed with "Subject: ".`,
        quote: `Extract the single most powerful, quotable sentence or idea from this post. If there isn't one clear sentence, distill the core idea into one punchy, standalone quote. Keep it under 30 words. Return ONLY the quote text, nothing else.`,
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
