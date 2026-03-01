import type { Handler } from "@netlify/functions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-apify-api-key",
};

function getApiKey(event: { headers?: Record<string, string | undefined> }): string | null {
  const headerKey = event.headers?.["x-apify-api-key"] ?? event.headers?.["X-Apify-Api-Key"];
  if (headerKey?.trim()) return headerKey.trim();
  return process.env.APIFY_API_KEY || null;
}

const INSTAGRAM_BODY = {
  addParentData: false,
  directUrls: ["https://www.instagram.com/thesamparr"],
  onlyPostsNewerThan: "2026-01-01",
  resultsLimit: 10,
  resultsType: "posts",
  searchLimit: 1,
  searchType: "hashtag",
};

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders };
  }

  const token = getApiKey(event);
  if (!token) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "APIFY_API_KEY not set. Add one in Settings or set in Netlify env vars." }),
    };
  }

  try {
    const url = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=60&memory=512`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(INSTAGRAM_BODY),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Apify Instagram: ${text || res.statusText}`);
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (error: unknown) {
    console.error("Instagram feed error:", error);
    const message = error instanceof Error ? error.message : "Instagram feed failed";
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
