import { z } from "zod";

export const sourcePostSchema = z.object({
  id: z.number().optional(),
  platform: z.enum(["twitter", "linkedin", "instagram"]),
  content: z.string(),
  author: z.string(),
  timestamp: z.string(),
  url: z.string().optional(),
  metrics: z
    .object({
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
    })
    .optional(),
});

export const draftSchema = z.object({
  id: z.number().optional(),
  sourcePostId: z.number(),
  platform: z.enum(["linkedin", "twitter", "instagram", "newsletter"]),
  content: z.string(),
  status: z.enum(["draft", "approved", "rejected"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const aiRequestSchema = z.object({
  content: z.string(),
  platform: z.string().optional(),
  sourceContent: z.string().optional(),
});

export type SourcePost = z.infer<typeof sourcePostSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type AiRequest = z.infer<typeof aiRequestSchema>;
