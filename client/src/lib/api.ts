/**
 * Client-side API module — all requests via Netlify functions (no CORS).
 */

const IMAGE_PROXY = "https://wsrv.nl";
const FEED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FEED_CACHE_PREFIX = "hopper_feed_";

// --- API keys: localStorage (Settings) only — never baked into build (Netlify functions use env vars) ---
export function getClaudeApiKey(): string | null {
  return localStorage.getItem("claude_api_key") || null;
}

export function getApifyKey(): string | null {
  return localStorage.getItem("apify_api_key") || null;
}

export function getLinkedApiKey(): string | null {
  return localStorage.getItem("linkedapi_api_key") || null;
}

export function setApifyKey(key: string): void {
  localStorage.setItem("apify_api_key", key.trim());
}

export function setLinkedApiKey(key: string): void {
  localStorage.setItem("linkedapi_api_key", key.trim());
}

/** Proxied image URL for use in img src (avoids CORS on external images) */
export function proxyImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/") || url.startsWith("data:")) return url;
  return `${IMAGE_PROXY}/?url=${encodeURIComponent(url)}`;
}

/** Fetch image and return as data URL (for canvas/base64 export) */
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const proxied = url.startsWith("/") ? url : proxyImageUrl(url)!;
    const res = await fetch(proxied);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// --- Feed cache ---
function getCachedFeed<T>(platform: string): { data: T; ts: number } | null {
  try {
    const raw = localStorage.getItem(`${FEED_CACHE_PREFIX}${platform}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; ts: number };
    if (Date.now() - parsed.ts > FEED_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCachedFeed<T>(platform: string, data: T): void {
  try {
    localStorage.setItem(
      `${FEED_CACHE_PREFIX}${platform}`,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // quota exceeded, ignore
  }
}

// --- Feed APIs (via Netlify functions) ---

async function netlifyFeedFetch<T>(
  endpoint: string,
  headers: Record<string, string> = {}
): Promise<T> {
  const res = await fetch(`/.netlify/functions/${endpoint}`, {
    method: "GET",
    headers,
  });

  const data = (await res.json()) as T | { error?: string };
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(err.error || `Feed request failed: ${res.status}`);
  }
  return data as T;
}

export async function fetchTwitterFeed(bypassCache = false): Promise<unknown[]> {
  const cached = !bypassCache && getCachedFeed<unknown[]>("twitter");
  if (cached) return cached.data;

  const headers: Record<string, string> = {};
  const token = getApifyKey();
  if (token) headers["x-apify-api-key"] = token;

  const data = await netlifyFeedFetch<unknown[]>("feed-twitter", headers);
  setCachedFeed("twitter", data);
  return data;
}

export async function fetchLinkedInFeed(bypassCache = false): Promise<{ data?: { posts?: unknown[] }; posts?: unknown[] }> {
  const cached = !bypassCache && getCachedFeed<{ data?: { posts?: unknown[] }; posts?: unknown[] }>("linkedin");
  if (cached) return cached.data;

  const data = await netlifyFeedFetch<{ data?: { posts?: unknown[] }; posts?: unknown[] }>("feed-linkedin", {});
  setCachedFeed("linkedin", data);
  return data;
}

export async function fetchInstagramFeed(bypassCache = false): Promise<unknown[]> {
  const cached = !bypassCache && getCachedFeed<unknown[]>("instagram");
  if (cached) return cached.data;

  const headers: Record<string, string> = {};
  const token = getApifyKey();
  if (token) headers["x-apify-api-key"] = token;

  const data = await netlifyFeedFetch<unknown[]>("feed-instagram", headers);
  setCachedFeed("instagram", data);
  return data;
}

// --- AI (Anthropic Claude) — via Netlify functions (no CORS) ---

async function netlifyAiFetch(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ content: string }> {
  const apiKey = getClaudeApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["x-claude-api-key"] = apiKey;

  const res = await fetch(`/.netlify/functions/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { content?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || `AI request failed: ${res.status}`);
  }
  return { content: data.content ?? "" };
}

export async function aiGenerate(
  content: string,
  platform: string,
  sourceContent?: string
): Promise<{ content: string }> {
  return netlifyAiFetch("ai-generate", {
    content,
    platform,
    sourceContent,
  });
}

export async function aiPunchier(content: string): Promise<{ content: string }> {
  return netlifyAiFetch("ai-punchier", { content });
}

export async function aiHater(content: string): Promise<{ content: string }> {
  return netlifyAiFetch("ai-hater", { content });
}

export async function aiShaan(content: string): Promise<{ content: string }> {
  return netlifyAiFetch("ai-shaan", { content });
}

// Re-export the generation pipeline for use in components
export { runGeneration } from "./agenticPipeline";
export type { ModelChoice } from "./agenticPipeline";
