import Dexie, { type Table } from "dexie";
import {
  fetchTwitterFeed,
  fetchLinkedInFeed,
  fetchInstagramFeed,
} from "./api";

export interface SourcePost {
  id?: number;
  platform: "twitter" | "linkedin" | "instagram";
  content: string;
  author: string;
  authorHandle?: string;
  profilePhoto?: string;
  timestamp: string;
  url?: string;
  metrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    bookmarks?: number;
    views?: number;
  };
  mediaUrls?: string[];
  isThread?: boolean;
  threadContent?: string[];
  weight_score?: number;
}

export interface Draft {
  id?: number;
  sourcePostId: number;
  platform: "linkedin" | "twitter" | "instagram" | "newsletter" | "quote";
  content: string;
  status: "draft" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface TrashEntry {
  id?: number;
  draftId: number;
  sourcePostId: number;
  content: string;
  platform: string;
  rejectedAt: string;
  originalContent: string;
}

export interface ApprovedVaultEntry {
  id?: number;
  platform_format: string;
  final_text: string;
  timestamp: string;
}

export interface RejectedVaultEntry {
  id?: number;
  rejected_text: string;
  reason: string;
  timestamp: string;
}

/** Training data from training_data.jsonl — instruction/output pairs for RAG */
export interface HistoricalPost {
  id?: number;
  instruction: string;
  output: string;
  weight_score: number;
}

export interface AppSetting {
  key: string;
  value: string | number | boolean;
}

class HopperDB extends Dexie {
  sourcePosts!: Table<SourcePost>;
  historical_posts!: Table<HistoricalPost>;
  drafts!: Table<Draft>;
  trash!: Table<TrashEntry>;
  approved_vault!: Table<ApprovedVaultEntry>;
  rejected_vault!: Table<RejectedVaultEntry>;
  app_settings!: Table<AppSetting>;

  constructor() {
    super("HopperDB");
    this.version(1).stores({
      sourcePosts: "++id, platform, timestamp",
      drafts: "++id, sourcePostId, platform, status, createdAt",
      swipeFile: "++id, draftId, sourcePostId, platform, rejectedAt",
    });
    this.version(2).stores({
      sourcePosts: "++id, platform, timestamp",
      drafts: "++id, sourcePostId, platform, status, createdAt",
      trash: "++id, draftId, sourcePostId, platform, rejectedAt",
      swipeFile: null,
    }).upgrade(async (tx) => {
      const oldEntries = await tx.table("swipeFile").toArray();
      if (oldEntries.length > 0) {
        await tx.table("trash").bulkAdd(oldEntries);
      }
    });

    const platformPhotos: Record<string, string> = {
      twitter: "/x-profile.jpg",
      linkedin: "/linkedin-profile.jpeg",
      instagram: "/ig-profile.jpg",
    };

    this.version(3).stores({
      sourcePosts: "++id, platform, timestamp",
      drafts: "++id, sourcePostId, platform, status, createdAt",
      trash: "++id, draftId, sourcePostId, platform, rejectedAt",
    }).upgrade(async (tx) => {
      const posts = await tx.table("sourcePosts").toArray();
      for (const post of posts) {
        if (!post.profilePhoto && platformPhotos[post.platform]) {
          await tx.table("sourcePosts").update(post.id, {
            profilePhoto: platformPhotos[post.platform],
          });
        }
      }
    });

    // Version 4: Add Approved_Vault, Rejected_Vault; add weight_score to existing posts
    this.version(4).stores({
      sourcePosts: "++id, platform, timestamp",
      drafts: "++id, sourcePostId, platform, status, createdAt",
      trash: "++id, draftId, sourcePostId, platform, rejectedAt",
      approved_vault: "++id, platform_format, timestamp",
      rejected_vault: "++id, timestamp",
    }).upgrade(async (tx) => {
      const posts = await tx.table("sourcePosts").toArray();
      for (const post of posts) {
        if (post.weight_score === undefined) {
          await tx.table("sourcePosts").update(post.id, {
            weight_score: 1000,
          });
        }
      }
    });

    // Version 5: Add Historical_Posts (training_data.jsonl) for RAG
    this.version(5).stores({
      sourcePosts: "++id, platform, timestamp",
      historical_posts: "++id",
      drafts: "++id, sourcePostId, platform, status, createdAt",
      trash: "++id, draftId, sourcePostId, platform, rejectedAt",
      approved_vault: "++id, platform_format, timestamp",
      rejected_vault: "++id, timestamp",
    });

    // Version 6: Add app_settings for onboarding state
    this.version(6).stores({
      sourcePosts: "++id, platform, timestamp",
      historical_posts: "++id",
      drafts: "++id, sourcePostId, platform, status, createdAt",
      trash: "++id, draftId, sourcePostId, platform, rejectedAt",
      approved_vault: "++id, platform_format, timestamp",
      rejected_vault: "++id, timestamp",
      app_settings: "key",
    });
  }
}

export const db = new HopperDB();

export async function loadLiveFeed(
  platform?: "twitter" | "linkedin" | "instagram",
  bypassCache = false
): Promise<{
  posts: SourcePost[];
  profilePhoto: string | null;
}> {
  const allPosts: SourcePost[] = [];
  let profilePhoto: string | null = null;

  if (!platform || platform === "twitter") {
    try {
      const tweets = await fetchTwitterFeed(bypassCache);
      if (Array.isArray(tweets)) {
        for (const tweet of tweets.slice(0, 10)) {
            const rawText = tweet.full_text || tweet.text || tweet.tweet_text || "";
            if (!rawText) continue;
            const photo = tweet.author?.profilePicture || tweet.author_profile_image_url || tweet.profile_image_url || tweet.user?.profile_image_url_https;
            if (!profilePhoto && photo) {
              profilePhoto = photo;
            }

            // Extract image/video-thumbnail URLs from extended entities.
            // Each media item's `url` field is the t.co short link embedded in the
            // tweet text — strip those so the displayed text ends cleanly.
            const mediaItems: any[] = tweet.extendedEntities?.media ?? tweet.extended_entities?.media ?? [];
            const mediaUrls: string[] = mediaItems
              .map((m: any) => m.media_url_https || m.media_url)
              .filter(Boolean);

            // Remove t.co media URLs from the displayed text
            const mediaTcoUrls: string[] = mediaItems
              .map((m: any) => m.url)
              .filter(Boolean);
            let text = rawText;
            for (const tco of mediaTcoUrls) {
              text = text.replace(tco, "");
            }
            text = text.trimEnd();

            allPosts.push({
              platform: "twitter",
              content: text,
              author: tweet.author?.name || tweet.author_name || tweet.user?.name || "Sam Parr",
              authorHandle: tweet.author?.userName || tweet.author_username || tweet.user?.screen_name || "thesamparr",
              profilePhoto: photo || undefined,
              timestamp: tweet.createdAt || tweet.created_at || new Date().toISOString(),
              url: tweet.url || tweet.twitterUrl || tweet.tweet_url || undefined,
              metrics: {
                likes: tweet.likeCount ?? tweet.favorite_count ?? tweet.likes ?? 0,
                comments: tweet.replyCount ?? tweet.reply_count ?? tweet.replies ?? 0,
                shares: tweet.retweetCount ?? tweet.retweet_count ?? tweet.retweets ?? 0,
                bookmarks: tweet.bookmarkCount ?? tweet.bookmark_count ?? undefined,
                views: tweet.viewCount ?? tweet.view_count ?? undefined,
              },
              mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
              weight_score: 1000,
            });
        }
      }
    } catch (e) {
      console.error("Twitter feed error:", e);
    }
  }

  if (!platform || platform === "linkedin") {
    try {
      const data = await fetchLinkedInFeed(bypassCache);
      // Response shape: { success, data: { cursor, posts: [...] } }
      const posts = Array.isArray(data) ? data : (data.data?.posts || data.posts || []);
        for (const post of posts) {
          const text = post.text || post.commentary || post.content || "";
          if (!text) continue;
          const photo = post.author?.profilePictureURL || post.authorProfilePicture;
          if (!profilePhoto && photo) {
            profilePhoto = photo;
          }
          const ts = post.postedAt?.timestamp
            ? new Date(post.postedAt.timestamp).toISOString()
            : post.postedDate || post.created_at || new Date().toISOString();
          const mediaItems: any[] = Array.isArray(post.mediaContent) ? post.mediaContent : [];
          const mediaUrls: string[] = mediaItems
            .filter((m: any) => m?.type === "image" && m?.url)
            .map((m: any) => m.url);
          allPosts.push({
            platform: "linkedin",
            content: text,
            author: post.author?.name || post.authorName || "Sam Parr",
            authorHandle: post.author?.headline || post.authorHeadline || "",
            profilePhoto: photo || undefined,
            timestamp: ts,
            url: post.url || post.postUrl || undefined,
            metrics: {
              likes: post.engagements?.totalReactions ?? post.numLikes ?? post.likes ?? 0,
              comments: post.engagements?.commentsCount ?? post.numComments ?? post.comments ?? 0,
              shares: post.engagements?.repostsCount ?? post.numShares ?? post.shares ?? 0,
            },
            mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
            weight_score: 1000,
          });
        }
    } catch (e) {
      console.error("LinkedIn feed error:", e);
    }
  }

  if (!platform || platform === "instagram") {
    try {
      const igPosts = await fetchInstagramFeed(bypassCache);
      if (Array.isArray(igPosts)) {
          for (const post of igPosts.slice(0, 10)) {
            const text = post.caption || post.text || "";
            if (!text) continue;
            if (!profilePhoto && post.ownerProfilePicUrl) {
              profilePhoto = post.ownerProfilePicUrl;
            }
            // Extract media URLs: carousel uses images[] or childPosts[].displayUrl, single uses displayUrl
            let mediaUrls: string[] = [];
            if (Array.isArray(post.images) && post.images.length > 0) {
              mediaUrls = post.images;
            } else if (Array.isArray(post.childPosts) && post.childPosts.length > 0) {
              mediaUrls = post.childPosts
                .map((c: any) => c.displayUrl)
                .filter(Boolean);
            } else if (post.displayUrl) {
              mediaUrls = [post.displayUrl];
            }
            allPosts.push({
              platform: "instagram",
              content: text,
              author: post.ownerFullName || post.ownerUsername || "Sam Parr",
              authorHandle: post.ownerUsername || "thesamparr",
              profilePhoto: post.ownerProfilePicUrl || undefined,
              timestamp: post.timestamp || new Date().toISOString(),
              url: post.url || undefined,
              mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
              metrics: {
                likes: post.likesCount || 0,
                comments: post.commentsCount || 0,
                shares: 0,
              },
              weight_score: 1000,
            });
        }
      }
    } catch (e) {
      console.error("Instagram feed error:", e);
    }
  }

  allPosts.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return { posts: allPosts, profilePhoto };
}
