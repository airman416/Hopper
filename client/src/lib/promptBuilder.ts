/**
 * Dynamic Prompt Builder — conditional assembly based on model.
 *
 * Claude: Full complexity (Syntax Rulebook + Voice Vault + RAG + caching)
 * Llama:  Lightweight (persona + RAG only — rulebook/vault baked into LoRA weights)
 */

import { VOICE_VAULT } from "./voiceVault";
import { SYNTAX_RULEBOOK, CORE_PERSONA } from "./syntaxRulebook";
import { db } from "./db";
import type { RagResult } from "./oramaSearch";

// ──────────────────────────────────────────────────────────────
// Claude prompt (full complexity)
// ──────────────────────────────────────────────────────────────

export interface ClaudePromptPayload {
    /** System prompt blocks with cache_control on the last static block */
    systemBlocks: Array<{
        type: "text";
        text: string;
        cache_control?: { type: "ephemeral" };
    }>;
    userMessage: string;
}

/**
 * Build the full-complexity system prompt for Claude.
 * Includes Syntax Rulebook, Voice Vault, RAG results, Approved/Rejected vaults.
 * Static blocks get Anthropic prompt caching.
 */
export async function buildClaudePrompt(
    sourceText: string,
    platform: string,
    ragResults: RagResult[],
): Promise<ClaudePromptPayload> {
    // ── Positive Examples ──
    let positiveExamples: string[] = [];

    if (ragResults.length > 0) {
        positiveExamples.push(
            ...ragResults.map(
                (r) => `[${r.platform}]\n${r.content}`,
            ),
        );
    }

    const approvedEntries = await db.approved_vault
        .orderBy("timestamp")
        .reverse()
        .limit(3)
        .toArray();

    if (approvedEntries.length > 0) {
        positiveExamples.push(
            ...approvedEntries.map(
                (e) => `[approved - ${e.platform_format}]\n${e.final_text}`,
            ),
        );
    }

    if (positiveExamples.length === 0) {
        const shuffled = [...VOICE_VAULT].sort(() => Math.random() - 0.5);
        positiveExamples = shuffled.slice(0, 5);
    }

    // ── Negative Examples ──
    let negativeBlock = "";
    const rejectedCount = await db.rejected_vault.count();
    if (rejectedCount > 0) {
        const allRejected = await db.rejected_vault.toArray();
        const randomRejected =
            allRejected[Math.floor(Math.random() * allRejected.length)];
        negativeBlock = `
<negative_examples>
The following draft was REJECTED. Avoid similar issues.

${randomRejected.rejected_text}
</negative_examples>`;
    }

    // ── Voice Vault (Base Context) ──
    const vaultSubset = VOICE_VAULT.slice(0, 10).join("\n\n---\n\n");
    const voiceVaultBlock = `<voice_vault>
These are Sam Parr's actual high-performing posts. Study their tone, rhythm, sentence structure, and formatting:

${vaultSubset}
</voice_vault>`;

    // ── Assemble System Blocks (static blocks cached) ──
    const systemBlocks: ClaudePromptPayload["systemBlocks"] = [
        {
            type: "text" as const,
            text: CORE_PERSONA,
        },
        {
            type: "text" as const,
            text: SYNTAX_RULEBOOK,
        },
        {
            type: "text" as const,
            text: voiceVaultBlock,
            // cache_control on the last static block for prompt caching
            cache_control: { type: "ephemeral" },
        },
        {
            type: "text" as const,
            text: `<positive_examples>
Analyze the syntactic structure and tone of these examples. Format your output to perfectly match this exact style.

${positiveExamples.join("\n\n---\n\n")}
</positive_examples>

${negativeBlock}

<instruction>
Analyze the syntactic structure and tone of the positive examples. Format your output to perfectly match this exact style. Look at the negative examples and strictly avoid similar issues.

Target platform: ${platform}
</instruction>`,
        },
    ];

    const userMessage = `Write a ${platform} post based on the following source text. Return ONLY the final post text. No explanation. No preamble.\n\nSource text:\n${sourceText}`;

    return { systemBlocks, userMessage };
}

// ──────────────────────────────────────────────────────────────
// Llama prompt (lightweight — rulebook/vault baked into LoRA)
// ──────────────────────────────────────────────────────────────

export interface LlamaPromptPayload {
    systemPrompt: string;
    userMessage: string;
}

/**
 * Build the lightweight prompt for Sam-Llama-3 (fine-tuned).
 * Only passes persona + RAG context — the Syntax Rulebook and Voice Vault
 * are baked into the LoRA weights from training.
 */
export function buildLlamaPrompt(
    sourceText: string,
    platform: string,
    ragResults: RagResult[],
): LlamaPromptPayload {
    let ragContext = "";
    if (ragResults.length > 0) {
        const ragPosts = ragResults
            .map((r) => `[${r.platform}]\n${r.content}`)
            .join("\n\n---\n\n");
        ragContext = `\n\nPrevious posts for style reference:\n${ragPosts}`;
    }

    const systemPrompt = `You are ghostwriting as Sam Parr. Sam is the founder of The Hustle (sold to HubSpot), co-host of My First Million podcast, and a serial entrepreneur known for brutally honest, no-BS content. Write like a founder texting their co-founder — short, punchy, and real.${ragContext}`;

    const userMessage = `Write a ${platform} post based on the following source text. Return ONLY the final post text.\n\nSource text:\n${sourceText}`;

    return { systemPrompt, userMessage };
}
