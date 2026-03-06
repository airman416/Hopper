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

export interface ArchitectResult {
    coreInsight: string;
    framework: string;
}

/**
 * Build the full-complexity system prompt for Claude.
 * Includes Syntax Rulebook, Voice Vault, RAG results, Approved/Rejected vaults.
 * Static blocks get Anthropic prompt caching.
 * If architectResult is provided (from Step 1), the Writer uses that framework.
 */
export async function buildClaudePrompt(
    sourceText: string,
    platform: string,
    ragResults: RagResult[],
    architectResult?: ArchitectResult,
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
The following draft was REJECTED. Reason: "${randomRejected.reason}". Strictly avoid this specific issue.

${randomRejected.rejected_text}
</negative_examples>`;
    }

    // ── Voice Vault (Base Context) ──
    // Top 50 training examples by weight_score (PRD); fall back to static vault
    const allHistorical = await db.historical_posts.toArray();
    const topWeighted = allHistorical
        .sort((a, b) => (b.weight_score ?? 1000) - (a.weight_score ?? 1000))
        .slice(0, 50);

    const vaultContent =
        topWeighted.length > 0
            ? topWeighted
                  .filter((p) => p.output?.trim())
                  .map((p) => p.output)
                  .join("\n\n---\n\n")
            : VOICE_VAULT.slice(0, 10).join("\n\n---\n\n");

    const voiceVaultBlock = `<voice_vault>
These are Sam Parr's actual high-performing posts. Study their tone, rhythm, sentence structure, and formatting:

${vaultContent}
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

${platform === "linkedin" ? `LINKEDIN RULES:
- Professional but conversational. Short paragraphs with line breaks.
- Punchy and value-driven. Hyperspecific numbers. No hashtags. No emojis.
- One-sentence paragraphs. One-word hook when it fits.
- Apply the Syntax Rulebook: slang, hyperspecificity, humble/arrogant contrast.` : ""}
${platform === "twitter" ? `TWITTER/X RULES:
- Under 280 characters if possible, or a tight thread-worthy post.
- Match the formatting and tone of the positive examples. Sharp, direct. No hashtags. No emojis.
- One-sentence paragraphs. One-word hook when it fits.
- Apply the Syntax Rulebook: slang, hyperspecificity, humble/arrogant contrast.` : ""}
${platform === "newsletter" ? `NEWSLETTER RULES:
- Add depth and examples. Conversational, like writing to a smart friend.
- Add a subject line prefixed with "Subject: ".
- One-sentence paragraphs. One-word hook when it fits.
- Apply the Syntax Rulebook: slang, hyperspecificity, humble/arrogant contrast.` : ""}
${platform === "quote" ? `QUOTE RULES:
- Extract the single most powerful quotable idea. One punchy standalone sentence under 30 words.
- Apply the Syntax Rulebook: hyperspecificity, slang where natural.` : ""}
${platform === "instagram" ? `INSTAGRAM CAROUSEL FORMAT RULES:
- Use as many words and phrases from the original post as possible. Preserve the author's exact wording where it works; only restructure for carousel format.
- Output in TWO parts. First the caption, then the slides. Format exactly:
  CAPTION:
  [1-3 sentences for the Instagram caption. Punchy, can include CTA or hashtags. Use words from the source.]
  
  ---
  [slides follow]
- Do NOT write any intro. Start directly with CAPTION:
- Separate each slide with a line containing only: ---
- Each slide MUST have two parts separated by a blank line:
  HEADING: Title Case (capitalize each major word). Short, punchy title (1 line, 3-8 words)
  (blank line)
  BODY: Sentence case. 2-3 short sentences expanding on the heading
- Slide 1 = strong hook that makes people want to swipe
- Last slide = clear CTA (follow, share, reply, etc.)
- Use as few slides as needed to cover the topic well (up to 10 max). Most topics need 4-7 slides. Do not pad to 10.

Example of correct format:
CAPTION:
Scraped 1,000+ founders for 18 months. Here's what they're actually reading.

---
Everyone Thinks Founders Read Business Books

Scraped 1,000+ founders for 18 months. Turns out they're reading psychology and fiction instead.
---
The Data Doesn't Lie

18 months of book recs from founders doing $3M-25M revenue. Only 1 pure business book made the list.` : ""}
</instruction>`,
        },
    ];

    const architectContext = architectResult
        ? `\n\nFRAMEWORK (use this structure): ${architectResult.framework}\nCORE INSIGHT (the main idea to convey): ${architectResult.coreInsight}\n\n`
        : "";

    const userMessage = platform === "instagram"
        ? `Create an Instagram carousel based on the source text below.${architectContext}Use as many words from the source as possible. Output CAPTION: first, then ---, then the slides. No intro text, no remarks, no explanations. Start directly with CAPTION: No em dashes (—).\n\nSource text:\n${sourceText}`
        : `Write a ${platform} post based on the following source text.${architectContext}Return ONLY the final post text. No explanation. No preamble. No em dashes (—).\n\nSource text:\n${sourceText}`;

    return { systemBlocks, userMessage };
}

// ──────────────────────────────────────────────────────────────
// Llama prompt (lightweight — rulebook/vault baked into LoRA)
// ──────────────────────────────────────────────────────────────

export interface LlamaPromptPayload {
    systemPrompt: string;
    userMessage: string;
}

const INSTAGRAM_FORMAT = `Format: Instagram carousel.
- Use as many words and phrases from the original post as possible. Preserve the author's exact wording where it works.
- Output in TWO parts. First the caption, then the slides. Start with CAPTION: followed by 1-3 sentences for the Instagram caption. Then a line with ---. Then the slides.
- DO NOT write any intro, preamble, or remarks. Start directly with CAPTION:
- NO EM DASHES (—). Never use an em dash.
- Separate slides with a line containing only: ---
- Each slide has TWO parts separated by a blank line:
  1. HEADING: short punchy title (3-8 words)
  2. BODY: 2-3 short sentences expanding on it
- Slide 1 = hook that makes people swipe. Last slide = CTA.
- Use as few slides as needed (up to 10 max). Most topics need 4-7. Do not pad to 10.

Example:
CAPTION:
Punchy caption here. Can include CTA or hashtags.

---
Your hook heading here

First body sentence. Second body sentence.
---
Next slide heading

Expand here. Keep it punchy.`;

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
    linkedin: `Rewrite this for LinkedIn. Professional but conversational. One-sentence paragraphs. Punchy and value-driven. Hyperspecific numbers. No hashtags. No emojis. NO EM DASHES (—). Return ONLY the post text, no intro or remarks.`,
    twitter: `Rewrite this for Twitter/X. Under 280 characters if possible, or a tight thread-worthy post. Match the formatting of the style examples. One-sentence paragraphs. Sharp, direct. No hashtags. No emojis. NO EM DASHES (—). Return ONLY the tweet text, no intro.`,
    instagram: INSTAGRAM_FORMAT,
    newsletter: `Rewrite this as a newsletter section. Add depth and examples. One-sentence paragraphs. Conversational, like writing to a smart friend. Add a subject line prefixed with "Subject: ". NO EM DASHES (—). Return ONLY the newsletter content, no intro remarks.`,
    quote: `Extract the single most powerful quotable idea from this. One punchy standalone sentence under 30 words. Hyperspecific numbers where relevant. NO EM DASHES (—). Return ONLY the quote, nothing else.`,
};

/**
 * Build the lightweight prompt for Ollama (fine-tuned local model).
 * The model already sounds like Sam — just give it clear platform
 * instructions and RAG context. Keep the system prompt minimal.
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
        ragContext = `\n\nStyle reference from previous posts:\n${ragPosts}`;
    }

    // Fine-tuned model has Sam's voice baked in, just set the role
    const systemPrompt = `You are ghostwriting as Sam Parr. Write exactly like him: short, punchy, no BS, founder energy. No em dashes (—).\n${ragContext}`;

    const platformInstruction =
        PLATFORM_INSTRUCTIONS[platform] ?? `Rewrite this as a ${platform} post. NO EM DASHES (—).`;

    const userMessage = platform === "instagram"
        ? `${platformInstruction}\n\nSource:\n${sourceText}\n\nBegin your response immediately with the first slide heading. Do not write "Here is", "Sure", or any other preamble.`
        : `${platformInstruction}\n\nSource:\n${sourceText}`;

    return { systemPrompt, userMessage };
}

// ──────────────────────────────────────────────────────────────
// Haiku formatter prompt (Step 2 of the Ollama pipeline)
// ──────────────────────────────────────────────────────────────

/**
 * Build the formatting-only prompt for Claude Haiku.
 * Receives raw Sam-voiced content from Ollama and restructures it
 * for the target platform. Voice is already correct — only structure matters.
 */
export function buildHaikuFormatterPrompt(
    samVoiceContent: string,
    platform: string,
): ClaudePromptPayload {
    const platformFormatRules = platform === "instagram"
        ? INSTAGRAM_FORMAT
        : PLATFORM_INSTRUCTIONS[platform] ?? `Format this as a ${platform} post.`;

    const systemBlocks: ClaudePromptPayload["systemBlocks"] = [
        {
            type: "text" as const,
            text: `You are a content formatter. You receive raw content written in Sam Parr's voice and your ONLY job is to restructure it for the target platform. Do not change the voice, words, or ideas, only the structure and format. Never add explanations, preamble, or remarks. ABSOLUTELY NO EM DASHES (—). Provide the output without em dashes.`,
        },
    ];

    const userMessage = platform === "instagram"
        ? `${platformFormatRules}\n\nBegin your response immediately with the first slide heading. Do not write any intro.\n\nRaw content to format:\n${samVoiceContent}`
        : `${platformFormatRules}\n\nReturn ONLY the formatted post.\n\nRaw content to format:\n${samVoiceContent}`;

    return { systemBlocks, userMessage };
}
