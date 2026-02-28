import Dexie, { type Table } from "dexie";

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
  };
  isThread?: boolean;
  threadContent?: string[];
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

class HopperDB extends Dexie {
  sourcePosts!: Table<SourcePost>;
  drafts!: Table<Draft>;
  trash!: Table<TrashEntry>;

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
  }
}

export const db = new HopperDB();

export async function loadLiveFeed(platform?: "twitter" | "linkedin" | "instagram"): Promise<{
  posts: SourcePost[];
  profilePhoto: string | null;
}> {
  const allPosts: SourcePost[] = [];
  let profilePhoto: string | null = null;

  if (!platform || platform === "twitter") {
    try {
      const twitterRes = await fetch("/api/feed/twitter");
      if (twitterRes.ok) {
        const tweets = await twitterRes.json();
        if (Array.isArray(tweets)) {
          for (const tweet of tweets.slice(0, 10)) {
            const text = tweet.text || tweet.full_text || tweet.tweet_text || "";
            if (!text) continue;
            const photo = tweet.author?.profilePicture || tweet.author_profile_image_url || tweet.profile_image_url || tweet.user?.profile_image_url_https;
            if (!profilePhoto && photo) {
              profilePhoto = photo;
            }
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
              },
            });
          }
        }
      }
    } catch (e) {
      console.error("Twitter feed error:", e);
    }
  }

  if (!platform || platform === "linkedin") {
    try {
      const linkedinRes = await fetch("/api/feed/linkedin");
      if (linkedinRes.ok) {
        const data = await linkedinRes.json();
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
          });
        }
      }
    } catch (e) {
      console.error("LinkedIn feed error:", e);
    }
  }

  if (!platform || platform === "instagram") {
    try {
      const igRes = await fetch("/api/feed/instagram");
      if (igRes.ok) {
        const igPosts = await igRes.json();
        if (Array.isArray(igPosts)) {
          for (const post of igPosts.slice(0, 10)) {
            const text = post.caption || post.text || "";
            if (!text) continue;
            if (!profilePhoto && post.ownerProfilePicUrl) {
              profilePhoto = post.ownerProfilePicUrl;
            }
            allPosts.push({
              platform: "instagram",
              content: text,
              author: post.ownerFullName || post.ownerUsername || "Sam Parr",
              authorHandle: post.ownerUsername || "thesamparr",
              profilePhoto: post.ownerProfilePicUrl || undefined,
              timestamp: post.timestamp || new Date().toISOString(),
              url: post.url || undefined,
              metrics: {
                likes: post.likesCount || 0,
                comments: post.commentsCount || 0,
                shares: 0,
              },
            });
          }
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

export async function seedMockData(platforms?: Array<"twitter" | "linkedin" | "instagram">) {
  const targetPlatforms = platforms ?? ["twitter", "linkedin", "instagram"];
  const existingByPlatform = await Promise.all(
    targetPlatforms.map(async (p) => ({
      platform: p,
      count: await db.sourcePosts.where("platform").equals(p).count(),
    }))
  );
  const platformsToSeed = existingByPlatform.filter((e) => e.count === 0).map((e) => e.platform);
  if (platformsToSeed.length === 0) return;

  const now = new Date();
  const posts: SourcePost[] = [
    {
      platform: "twitter",
      content: "The best founders I know don't pitch their product.\n\nThey describe the problem so clearly that the listener sells themselves on the solution.\n\nStop selling. Start storytelling.",
      author: "Sam Parr",
      authorHandle: "thesamparr",
      profilePhoto: "/x-profile.jpg",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      metrics: { likes: 2847, comments: 143, shares: 892 },
    },
    {
      platform: "linkedin",
      content: "I spent 6 months building a feature nobody asked for.\n\nThe result? Zero adoption.\n\nThen I spent 2 weeks talking to customers. Built exactly what they described in their own words.\n\nResult: 40% adoption in the first week.\n\nThe lesson isn't \"talk to customers.\" Everyone says that.\n\nThe real lesson: Your job isn't to be creative. Your job is to be a translator.\n\nTranslate pain into product. That's it.",
      author: "Sam Parr",
      authorHandle: "thesamparr",
      profilePhoto: "/linkedin-profile.jpeg",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      metrics: { likes: 12840, comments: 567, shares: 2100 },
    },
    {
      platform: "twitter",
      content: "Unpopular opinion: Most SaaS pricing pages are optimized for the company, not the customer.\n\nIf I have to schedule a call to learn your price, I'm already looking at your competitor.",
      author: "Sam Parr",
      authorHandle: "thesamparr",
      profilePhoto: "/x-profile.jpg",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      metrics: { likes: 5621, comments: 387, shares: 1243 },
    },
    {
      platform: "linkedin",
      content: "The 3 skills that made me a better leader than any MBA:\n\n1. Writing clearly - if you can't write it, you can't think it\n2. Saying no - the best strategy is knowing what you won't do\n3. Hiring slow - one great person beats three good ones\n\nNone of these were taught in school. All of them were learned through expensive mistakes.",
      author: "Sam Parr",
      authorHandle: "thesamparr",
      profilePhoto: "/linkedin-profile.jpeg",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      metrics: { likes: 8934, comments: 423, shares: 1567 },
    },
    {
      platform: "twitter",
      content: "Your startup doesn't have a marketing problem.\n\nIt has a clarity problem.\n\nIf a 12-year-old can't explain what you do after visiting your homepage, rewrite it.",
      author: "Sam Parr",
      authorHandle: "thesamparr",
      profilePhoto: "/x-profile.jpg",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      metrics: { likes: 9102, comments: 412, shares: 2890 },
    },
    {
      platform: "instagram",
      content: "Build in public they said.\n\nSo I shared my revenue numbers, my failures, my process.\n\nThe result wasn't more customers. It was better customers.\n\nPeople who already trusted the way I think before they ever bought.",
      author: "Sam Parr",
      authorHandle: "thesamparr",
      profilePhoto: "/ig-profile.jpg",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      metrics: { likes: 4231, comments: 198, shares: 876 },
    },
  ];

  const postsToSeed = posts.filter((p) => platformsToSeed.includes(p.platform));
  await db.sourcePosts.bulkAdd(postsToSeed);
}
