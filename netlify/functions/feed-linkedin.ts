import type { Handler } from "@netlify/functions";

const SAM_PARR_URN = "ACoAAAt8nxwBrEPNpBTNouIQJu8BAIje750mmC0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-linkedapi-api-key",
};

function getApiKey(event: { headers?: Record<string, string | undefined> }): string | null {
  const headerKey = event.headers?.["x-linkedapi-api-key"] ?? event.headers?.["X-Linkedapi-Api-Key"];
  if (headerKey?.trim()) return headerKey.trim();
  return process.env.LINKEDAPI_API_KEY || null;
}

const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders };
  }

  const token = getApiKey(event);
  if (!token) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "LINKEDAPI_API_KEY not set. Add one in Settings or set in Netlify env vars." }),
    };
  }

  try {
    const url = `https://linkdapi.com/api/v1/posts/all?urn=${SAM_PARR_URN}&start=0`;
    const res = await fetch(url, {
      headers: { "X-linkdapi-apikey": `li-${token}` },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkdAPI: ${text || res.statusText}`);
    }

    const data = (await res.json()) as { data?: { posts?: unknown[] } };
    const allPosts: { author?: { urn?: string }; resharedPostContent?: unknown; postedAt?: { timestamp?: number } }[] =
      data?.data?.posts ?? [];
    const top10 = allPosts
      .filter((p) => p.author?.urn === SAM_PARR_URN && p.resharedPostContent == null)
      .sort((a, b) => (b.postedAt?.timestamp ?? 0) - (a.postedAt?.timestamp ?? 0))
      .slice(0, 10);

    const result = { ...data, data: { ...data.data, posts: top10 } };
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    console.error("LinkedIn feed error:", error);
    const message = error instanceof Error ? error.message : "LinkedIn feed failed";
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: message }),
    };
  }
};

export { handler };
