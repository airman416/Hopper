/**
 * Single-step generation pipeline with conditional model routing.
 *
 * - Claude 3.5 Sonnet: Full Syntax Rulebook + Voice Vault + RAG + Prompt Caching
 * - Sam-Llama-3:       Persona only + RAG → routed to Together AI
 */

import { queryRag, type RagResult } from "./oramaSearch";
import { buildClaudePrompt, buildLlamaPrompt } from "./promptBuilder";
import { getClaudeApiKey } from "./api";

export type ModelChoice = "claude" | "sam-llama";

interface GenerationResult {
    /** The final drafted content */
    content: string;
    /** The post IDs used as RAG context */
    contextPostIds: number[];
}

/**
 * Run the single-step generation pipeline.
 * Routes to Claude or Together AI based on the selected model.
 */
export async function runGeneration(
    sourceText: string,
    platform: string,
    model: ModelChoice,
): Promise<GenerationResult> {
    // ── RAG Query ──
    const ragResults: RagResult[] = await queryRag(sourceText, 3);
    const contextPostIds = ragResults.map((r) => r.postId);

    if (model === "claude") {
        return generateWithClaude(sourceText, platform, ragResults, contextPostIds);
    } else {
        return generateWithLlama(sourceText, platform, ragResults, contextPostIds);
    }
}

/**
 * Claude path: Full complexity — Syntax Rulebook, Voice Vault, RAG, Prompt Caching
 */
async function generateWithClaude(
    sourceText: string,
    platform: string,
    ragResults: RagResult[],
    contextPostIds: number[],
): Promise<GenerationResult> {
    const apiKey = getClaudeApiKey();
    if (!apiKey) {
        throw new Error("Claude API key required. Add one in Settings.");
    }

    const prompt = await buildClaudePrompt(sourceText, platform, ragResults);

    const res = await fetch("/.netlify/functions/ai-writer", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-claude-api-key": apiKey,
        },
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
 * Sam-Llama-3 path: Lightweight — persona + RAG only, no rulebook/vault.
 * Routed to Together AI endpoint.
 */
async function generateWithLlama(
    sourceText: string,
    platform: string,
    ragResults: RagResult[],
    contextPostIds: number[],
): Promise<GenerationResult> {
    const prompt = buildLlamaPrompt(sourceText, platform, ragResults);

    const res = await fetch("/.netlify/functions/ai-together", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            systemPrompt: prompt.systemPrompt,
            userMessage: prompt.userMessage,
        }),
    });

    if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || `Sam-Llama generation failed: ${res.status}`);
    }

    const { content } = (await res.json()) as { content: string };
    return { content, contextPostIds };
}
