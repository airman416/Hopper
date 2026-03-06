/**
 * Generation pipeline with conditional model routing.
 *
 * - claude:           Full Syntax Rulebook + Voice Vault + RAG + Prompt Caching (Sonnet)
 * - ollama:<model>:   Two-step pipeline:
 *     Step 1 — Ollama (fine-tuned): generate raw content in Sam's voice
 *     Step 2 — Claude Haiku:        enforce platform formatting structure
 */

import { queryRag, type RagResult } from "./oramaSearch";
import { buildClaudePrompt, buildHaikuFormatterPrompt, type ArchitectResult } from "./promptBuilder";
import { getClaudeApiKey } from "./api";

export type ModelChoice = "claude" | `ollama:${string}`;

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export function getOllamaUrl(): string {
    return localStorage.getItem("ollama_url") || DEFAULT_OLLAMA_URL;
}

export function setOllamaUrl(url: string): void {
    localStorage.setItem("ollama_url", url.trim().replace(/\/$/, ""));
}

/** Fetch available Ollama models from the local Ollama instance */
export async function fetchOllamaModels(): Promise<string[]> {
    const base = getOllamaUrl();
    try {
        const res = await fetch(`${base}/api/tags`, {
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { models?: Array<{ name: string }> };
        return (data.models ?? []).map((m) => m.name);
    } catch {
        return [];
    }
}

interface GenerationResult {
    /** The final drafted content */
    content: string;
    /** The post IDs used as RAG context */
    contextPostIds: number[];
}

/**
 * Run the generation pipeline.
 * - "claude" → full Claude Sonnet path (rulebook + vault + RAG)
 * - "ollama:X" → Step 1: Ollama generates Sam-voiced raw content
 *               Step 2: Claude Haiku enforces platform formatting
 */
export async function runGeneration(
    sourceText: string,
    platform: string,
    model: ModelChoice,
): Promise<GenerationResult> {
    const ragResults: RagResult[] = await queryRag(sourceText, 3);
    const contextPostIds = ragResults.map((r) => r.postId);

    if (model === "claude") {
        return generateWithClaude(sourceText, platform, ragResults, contextPostIds);
    } else {
        const ollamaModel = model.startsWith("ollama:") ? model.slice("ollama:".length) : model;
        return generateWithOllamaThenHaiku(sourceText, platform, ragResults, contextPostIds, ollamaModel);
    }
}

/**
 * Step 1 — Architect: Identify core insight and choose Sam Parr framework.
 * Uses Netlify function; API key comes from CLAUDE_API_KEY env var (no client-side key needed).
 */
async function runArchitect(sourceText: string): Promise<ArchitectResult> {
    const apiKey = getClaudeApiKey();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["x-claude-api-key"] = apiKey;

    const res = await fetch("/.netlify/functions/ai-architect", {
        method: "POST",
        headers,
        body: JSON.stringify({ sourceText }),
    });

    if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `Architect step failed: ${res.status}`);
    }

    return res.json() as Promise<ArchitectResult>;
}

/**
 * Claude path: Two-step pipeline — Architect → Writer.
 * Full complexity: Syntax Rulebook, Voice Vault, RAG, Prompt Caching.
 */
async function generateWithClaude(
    sourceText: string,
    platform: string,
    ragResults: RagResult[],
    contextPostIds: number[],
): Promise<GenerationResult> {
    const apiKey = getClaudeApiKey();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["x-claude-api-key"] = apiKey;

    const architectResult = await runArchitect(sourceText);
    const prompt = await buildClaudePrompt(sourceText, platform, ragResults, architectResult);

    const res = await fetch("/.netlify/functions/ai-writer", {
        method: "POST",
        headers,
        body: JSON.stringify({
            systemBlocks: prompt.systemBlocks,
            userMessage: prompt.userMessage,
        }),
    });

    if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `Claude generation failed: ${res.status}`);
    }

    const { content } = (await res.json()) as { content: string };
    return { content, contextPostIds };
}

/**
 * Ollama two-step pipeline:
 *
 * Step 1 — Ollama (fine-tuned local model)
 *   Prompt: minimal. Just "be Sam Parr, write about this topic".
 *   Output: raw content in Sam's authentic voice, no format constraints.
 *
 * Step 2 — Claude Haiku (claude-haiku-4-5-20251001)
 *   Prompt: "take this Sam Parr content and reformat it for {platform}".
 *   Output: correctly structured post (carousel slides, etc.).
 */
async function generateWithOllamaThenHaiku(
    sourceText: string,
    platform: string,
    ragResults: RagResult[],
    contextPostIds: number[],
    ollamaModel: string,
): Promise<GenerationResult> {
    const apiKey = getClaudeApiKey();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["x-claude-api-key"] = apiKey;

    // ── Step 1: Ollama — voice generation ──
    const base = getOllamaUrl();

    // Give Ollama freedom to write in Sam's voice without format constraints.
    // Haiku will handle structure in Step 2.
    const voiceSystemPrompt = `You are ghostwriting as Sam Parr. Write in his exact voice: short, punchy, brutally honest, founder energy. No fluff. ABSOLUTELY NO EM DASHES (—).`;
    const voiceUserMessage = `Write about this topic in Sam Parr's voice. Don't worry about formatting, just capture his authentic perspective. Do not use any em dashes (—).\n\nSource:\n${sourceText}`;

    const ollamaRes = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: ollamaModel,
            messages: [
                { role: "system", content: voiceSystemPrompt },
                { role: "user", content: voiceUserMessage },
            ],
            stream: false,
        }),
    });

    if (!ollamaRes.ok) {
        const err = (await ollamaRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `Ollama generation failed: ${ollamaRes.status}`);
    }

    const ollamaData = (await ollamaRes.json()) as { message?: { content?: string } };
    const samVoiceContent = ollamaData.message?.content ?? "";

    if (!samVoiceContent.trim()) {
        throw new Error("Ollama returned empty content.");
    }

    // ── Step 2: Claude Haiku — platform formatting ──
    const haikuPrompt = buildHaikuFormatterPrompt(samVoiceContent, platform);

    const haikuRes = await fetch("/.netlify/functions/ai-writer", {
        method: "POST",
        headers,
        body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            systemBlocks: haikuPrompt.systemBlocks,
            userMessage: haikuPrompt.userMessage,
        }),
    });

    if (!haikuRes.ok) {
        const err = (await haikuRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `Haiku formatting failed: ${haikuRes.status}`);
    }

    const { content } = (await haikuRes.json()) as { content: string };
    return { content, contextPostIds };
}
