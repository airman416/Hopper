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
  usernames: ["thesamparr"],
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
    const url = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${token}&timeout=45&memory=512`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(INSTAGRAM_BODY),
      signal: AbortSignal.timeout(35_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Apify Instagram: ${text || res.statusText}`);
    }

    const data = await res.json();
    const profiles = Array.isArray(data) ? data : [];
    const allPosts = profiles.flatMap((p) =>
      (p?.latestPosts ?? []).map((post) => ({
        ...post,
        ownerUsername: p?.username ?? post?.ownerUsername,
        ownerFullName: p?.fullName ?? post?.ownerFullName,
        ownerProfilePicUrl: p?.profilePicUrl ?? post?.ownerProfilePicUrl,
      }))
    );
    const cutoff = new Date("2026-01-01").getTime();
    const filtered = allPosts.filter((p) => (p?.timestamp ? new Date(p.timestamp).getTime() : 0) >= cutoff);
    const sorted = [...filtered].sort((a, b) => {
      const ta = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta; // newest first
    });
    const posts = sorted.slice(0, 3);
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(posts),
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
