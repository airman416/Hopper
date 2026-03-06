/**
 * Client-side RAG using Orama — in-browser full-text search over
 * the user's historical posts, ranked purely by semantic relevance.
 */

import { create, insert, search, type AnyOrama } from "@orama/orama";
import { db, type SourcePost } from "./db";

let oramaDb: AnyOrama | null = null;
let indexedPostIds: Set<number> = new Set();

/** Schema for the local Orama index */
const SCHEMA = {
    id: "string",
    content: "string",
    platform: "string",
} as const;

/**
 * Initialize (or re-initialize) the Orama index with all source posts
 * currently stored in Dexie.
 */
export async function initOramaIndex(): Promise<void> {
    oramaDb = await create({ schema: SCHEMA });
    indexedPostIds = new Set();

    const posts = await db.sourcePosts.toArray();
    for (const post of posts) {
        if (!post.id || !post.content) continue;
        await insert(oramaDb, {
            id: String(post.id),
            content: post.content,
            platform: post.platform,
        });
        indexedPostIds.add(post.id);
    }
}

/**
 * Add a single post to the index (used after new posts are fetched).
 */
export async function addToIndex(post: SourcePost): Promise<void> {
    if (!oramaDb || !post.id || !post.content) return;
    if (indexedPostIds.has(post.id)) return;

    await insert(oramaDb, {
        id: String(post.id),
        content: post.content,
        platform: post.platform,
    });
    indexedPostIds.add(post.id);
}

export interface RagResult {
    postId: number;
    content: string;
    platform: string;
    relevance: number;
}

/**
 * Query the local Orama index for the top N most semantically similar
 * historical posts, ranked purely by relevance (cosine similarity).
 */
export async function queryRag(
    queryText: string,
    limit = 3,
): Promise<RagResult[]> {
    if (!oramaDb) {
        await initOramaIndex();
    }
    if (!oramaDb) return [];

    const results = await search(oramaDb, {
        term: queryText,
        limit,
    });

    return results.hits.map((hit) => {
        const doc = hit.document as {
            id: string;
            content: string;
            platform: string;
        };
        return {
            postId: parseInt(doc.id, 10),
            content: doc.content,
            platform: doc.platform,
            relevance: hit.score,
        };
    });
}

/**
 * Rebuild the entire index. Call after new posts are loaded.
 */
export async function rebuildIndex(): Promise<void> {
    await initOramaIndex();
}
