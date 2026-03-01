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

const TWITTER_BODY = {
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
    const url = `https://api.apify.com/v2/acts/kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest/run-sync-get-dataset-items?token=${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(TWITTER_BODY),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Apify Twitter: ${text || res.statusText}`);
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (error: unknown) {
    console.error("Twitter feed error:", error);
    const message = error instanceof Error ? error.message : "Twitter feed failed";
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
