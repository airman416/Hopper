/**
 * Standalone Data Preparation Script
 *
 * Generates a training_data.jsonl for fine-tuning a Llama 3 8B model
 * via the Panza methodology (Reverse Instructions + RAFT Injection).
 *
 * Usage:
 *   node scripts/generate_dataset.js
 *
 * Requires:
 *   - APIFY_API_KEY in .env (for tweet scraping)
 *   - OPENROUTER_API_KEY in .env (for reverse instruction generation via Gemini)
 *
 * Output:
 *   - training_data.jsonl (in the project root)
 */

import "dotenv/config";
import { create, insert, search } from "@orama/orama";
import { writeFileSync } from "fs";

// ── Config ──
const APIFY_API_KEY = process.env.APIFY_API_KEY || process.env.VITE_APIFY_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TWEET_COUNT = 100;
const RAFT_PROBABILITY = 0.55;
const RAFT_CONTEXT_COUNT = 2;
const OUTPUT_FILE = "training_data.jsonl";

// Sam Parr's Twitter handle — change as needed
const TWITTER_HANDLE = "thesamparr";

if (!APIFY_API_KEY) {
    console.error("❌ APIFY_API_KEY not found in .env");
    process.exit(1);
}
if (!OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY not found in .env");
    process.exit(1);
}

// ──────────────────────────────────────────────────────────────
// Step 1: Fetch tweets via Apify
// ──────────────────────────────────────────────────────────────

/**
 * Build the base request body for the Apify actor (same filters as feed-twitter.ts).
 */
function buildApifyBody(twitterContent, maxItems = 100) {
    return {
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
        maxItems,
        queryType: "Latest",
        twitterContent,
        min_retweets: 0,
        min_faves: 0,
        min_replies: 0,
        "-min_retweets": 0,
        "-min_faves": 0,
        "-min_replies": 0,
    };
}

/**
 * Generate date-range windows to scrape across Sam's posting history.
 * Each window is a 6-month period going back from today.
 */
function getDateWindows(count = 10) {
    const windows = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
        const until = new Date(now);
        until.setMonth(until.getMonth() - i * 6);
        const since = new Date(until);
        since.setMonth(since.getMonth() - 6);
        const fmt = (d) => d.toISOString().split("T")[0];
        windows.push({ since: fmt(since), until: fmt(until) });
    }
    return windows;
}

async function fetchTweets() {
    console.log(`\n📥 Fetching ~${TWEET_COUNT} unique tweets from @${TWITTER_HANDLE} across multiple date ranges...`);

    const url = `https://api.apify.com/v2/acts/kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest/run-sync-get-dataset-items?token=${APIFY_API_KEY}`;
    const dateWindows = getDateWindows(10); // 5 years of 6-month windows
    const seen = new Set();
    const tweets = [];

    for (const { since, until } of dateWindows) {
        if (tweets.length >= TWEET_COUNT) break;

        const query = `from:${TWITTER_HANDLE} since:${since} until:${until} -filter:replies`;
        console.log(`   📆 Window ${since} → ${until}...`);

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildApifyBody(query, 150)),
                signal: AbortSignal.timeout(180_000),
            });

            if (!res.ok) {
                const errText = await res.text();
                console.log(`      ⚠️ Failed (${res.status}): ${errText.slice(0, 100)}`);
                continue;
            }

            const items = await res.json();
            let windowNew = 0;
            for (const item of items) {
                const text = item.full_text || item.text || "";
                if (text.length <= 20) continue;
                if (seen.has(text)) continue;
                seen.add(text);
                tweets.push(text);
                windowNew++;
                if (tweets.length >= TWEET_COUNT) break;
            }
            console.log(`      ✅ ${items.length} raw → ${windowNew} new unique (total: ${tweets.length})`);
        } catch (err) {
            console.log(`      ⚠️ Error: ${err.message}`);
        }
    }

    console.log(`\n   📝 Got ${tweets.length} unique usable tweets across ${dateWindows.length} date windows.`);
    return tweets;
}

// ──────────────────────────────────────────────────────────────
// Step 2: Build local Orama index
// ──────────────────────────────────────────────────────────────

async function buildIndex(tweets) {
    console.log("\n🔍 Building local Orama index...");

    const oramaDb = await create({
        schema: {
            id: "string",
            content: "string",
        },
    });

    for (let i = 0; i < tweets.length; i++) {
        await insert(oramaDb, {
            id: String(i),
            content: tweets[i],
        });
    }

    console.log(`   ✅ Indexed ${tweets.length} tweets.`);
    return oramaDb;
}

// ──────────────────────────────────────────────────────────────
// Step 3: Generate reverse instructions via OpenRouter (Gemini)
// ──────────────────────────────────────────────────────────────

async function generateInstruction(tweet) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
                {
                    role: "user",
                    content: `You are a synthetic data generation assistant. Given the following tweet, generate a short, natural instruction that someone might give to an AI to produce a tweet like this. The instruction should be 1-2 sentences and describe the topic, tone, and style.

Tweet:
"${tweet}"

Respond with ONLY the instruction, like this format:
"Instruction: Write a short punchy tweet about [topic] in a [tone] style."

Do not include any other text.`,
                },
            ],
            max_tokens: 150,
            temperature: 0.7,
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`   ⚠️ OpenRouter error: ${res.status} — ${errText}`);
        return null;
    }

    const data = await res.json();
    const instruction = data.choices?.[0]?.message?.content?.trim() || null;
    return instruction;
}

// ──────────────────────────────────────────────────────────────
// Step 4: RAFT injection — 55% chance of adding context posts
// ──────────────────────────────────────────────────────────────

async function applyRaft(oramaDb, instruction, currentTweetIndex) {
    if (Math.random() >= RAFT_PROBABILITY) {
        return instruction; // No RAFT injection
    }

    const results = await search(oramaDb, {
        term: instruction,
        limit: RAFT_CONTEXT_COUNT + 1, // +1 because the current tweet may be included
    });

    // Filter out the current tweet from context
    const contextDocs = results.hits
        .filter((hit) => hit.document.id !== String(currentTweetIndex))
        .slice(0, RAFT_CONTEXT_COUNT);

    if (contextDocs.length === 0) return instruction;

    const contextBlock = contextDocs
        .map((hit) => `- "${hit.document.content}"`)
        .join("\n");

    return `${instruction}\n\nPrevious posts for style reference:\n${contextBlock}`;
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────

async function main() {
    console.log("═══════════════════════════════════════════════");
    console.log(" Panza Dataset Generator — Reverse Instructions + RAFT");
    console.log("═══════════════════════════════════════════════");

    // Step 1: Fetch tweets
    const tweets = await fetchTweets();
    if (tweets.length === 0) {
        console.error("❌ No tweets fetched. Exiting.");
        process.exit(1);
    }

    // Step 2: Build Orama index
    const oramaDb = await buildIndex(tweets);

    // Step 3 + 4: Generate instructions with RAFT injection
    console.log(`\n🤖 Generating reverse instructions (with ${RAFT_PROBABILITY * 100}% RAFT injection)...\n`);

    const trainingPairs = [];
    let raftCount = 0;

    for (let i = 0; i < tweets.length; i++) {
        const tweet = tweets[i];
        process.stdout.write(`   [${i + 1}/${tweets.length}] Generating instruction... `);

        const instruction = await generateInstruction(tweet);
        if (!instruction) {
            console.log("⚠️ skipped (API error)");
            continue;
        }

        // Apply RAFT injection
        const enrichedInstruction = await applyRaft(oramaDb, instruction, i);
        const hasRaft = enrichedInstruction !== instruction;
        if (hasRaft) raftCount++;

        trainingPairs.push({
            instruction: enrichedInstruction,
            output: tweet,
        });

        console.log(`✅${hasRaft ? " +RAFT" : ""}`);

        // Small delay to respect rate limits
        await new Promise((r) => setTimeout(r, 200));
    }

    // Step 5: Write JSONL
    console.log(`\n📦 Writing ${trainingPairs.length} training pairs to ${OUTPUT_FILE}...`);
    console.log(`   RAFT injected: ${raftCount}/${trainingPairs.length} (${((raftCount / trainingPairs.length) * 100).toFixed(1)}%)`);

    const jsonlContent = trainingPairs
        .map((pair) => JSON.stringify(pair))
        .join("\n");

    writeFileSync(OUTPUT_FILE, jsonlContent, "utf-8");

    console.log(`\n✅ Done! ${OUTPUT_FILE} ready for Unsloth fine-tuning.`);
    console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
    console.error("\n❌ Fatal error:", err.message);
    process.exit(1);
});
