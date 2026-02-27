import Dexie, { type Table } from "dexie";

export interface SourcePost {
  id?: number;
  platform: "twitter" | "linkedin" | "instagram";
  content: string;
  author: string;
  timestamp: string;
  url?: string;
  metrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

export interface Draft {
  id?: number;
  sourcePostId: number;
  platform: "linkedin" | "twitter" | "instagram" | "newsletter";
  content: string;
  status: "draft" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface SwipeFileEntry {
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
  swipeFile!: Table<SwipeFileEntry>;

  constructor() {
    super("HopperDB");
    this.version(1).stores({
      sourcePosts: "++id, platform, timestamp",
      drafts: "++id, sourcePostId, platform, status, createdAt",
      swipeFile: "++id, draftId, sourcePostId, platform, rejectedAt",
    });
  }
}

export const db = new HopperDB();

export async function seedMockData() {
  const count = await db.sourcePosts.count();
  if (count > 0) return;

  const now = new Date();
  const posts: SourcePost[] = [
    {
      platform: "twitter",
      content:
        "The best founders I know don't pitch their product.\n\nThey describe the problem so clearly that the listener sells themselves on the solution.\n\nStop selling. Start storytelling.",
      author: "You",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      metrics: { likes: 2847, comments: 143, shares: 892 },
    },
    {
      platform: "linkedin",
      content:
        "I spent 6 months building a feature nobody asked for.\n\nThe result? Zero adoption.\n\nThen I spent 2 weeks talking to customers. Built exactly what they described in their own words.\n\nResult: 40% adoption in the first week.\n\nThe lesson isn't \"talk to customers.\" Everyone says that.\n\nThe real lesson: Your job isn't to be creative. Your job is to be a translator.\n\nTranslate pain into product. That's it.",
      author: "You",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      metrics: { likes: 12840, comments: 567, shares: 2100 },
    },
    {
      platform: "twitter",
      content:
        "Unpopular opinion: Most SaaS pricing pages are optimized for the company, not the customer.\n\nIf I have to schedule a call to learn your price, I'm already looking at your competitor.",
      author: "You",
      timestamp: new Date(
        now.getTime() - 1000 * 60 * 60 * 24 * 2,
      ).toISOString(),
      metrics: { likes: 5621, comments: 387, shares: 1243 },
    },
    {
      platform: "linkedin",
      content:
        "The 3 skills that made me a better leader than any MBA:\n\n1. Writing clearly - if you can't write it, you can't think it\n2. Saying no - the best strategy is knowing what you won't do\n3. Hiring slow - one great person beats three good ones\n\nNone of these were taught in school. All of them were learned through expensive mistakes.",
      author: "You",
      timestamp: new Date(
        now.getTime() - 1000 * 60 * 60 * 24 * 3,
      ).toISOString(),
      metrics: { likes: 8934, comments: 423, shares: 1567 },
    },
    {
      platform: "twitter",
      content:
        "Your startup doesn't have a marketing problem.\n\nIt has a clarity problem.\n\nIf a 12-year-old can't explain what you do after visiting your homepage, rewrite it.",
      author: "You",
      timestamp: new Date(
        now.getTime() - 1000 * 60 * 60 * 24 * 5,
      ).toISOString(),
      metrics: { likes: 9102, comments: 412, shares: 2890 },
    },
    {
      platform: "instagram",
      content:
        "Build in public they said.\n\nSo I shared my revenue numbers, my failures, my process.\n\nThe result wasn't more customers. It was better customers.\n\nPeople who already trusted the way I think before they ever bought.",
      author: "You",
      timestamp: new Date(
        now.getTime() - 1000 * 60 * 60 * 24 * 7,
      ).toISOString(),
      metrics: { likes: 4231, comments: 198, shares: 876 },
    },
  ];

  await db.sourcePosts.bulkAdd(posts);

  const allPosts = await db.sourcePosts.toArray();
  const drafts: Draft[] = [
    {
      sourcePostId: allPosts[0].id!,
      platform: "linkedin",
      content:
        "Stop pitching your product.\n\nThe best founders I know never open with features or benefits. They describe the problem so clearly, so viscerally, that the listener sells themselves on the solution.\n\nI watched a founder raise $4M in a single meeting. He never mentioned his product for the first 20 minutes. He just painted a picture of the world as it is - broken, frustrating, expensive.\n\nBy the time he said \"here's what we built,\" the investors were already nodding.\n\nStop selling. Start storytelling.\n\nThe product demo comes after the emotional hook, not before it.",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      sourcePostId: allPosts[0].id!,
      platform: "twitter",
      content:
        "Founders: stop opening with your product.\n\nDescribe the problem so clearly that the listener sells themselves.\n\nI watched someone raise $4M without mentioning their product for 20 min.\n\nHe painted the broken world. Investors were nodding before the demo.\n\nStorytelling > Selling.",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await db.drafts.bulkAdd(drafts);
}
