import { z } from 'zod';

export const searchSchema = z.object({
  question: z.string().min(1, '搜索问题不能为空'),
  nResults: z.number().int().positive().max(20).default(5),
  language: z.enum(['en', 'zh', 'all']).default('all'),
});

export type SearchInput = z.infer<typeof searchSchema>;

export const searchResponseSchema = z.object({
  success: z.boolean(),
  question: z.string(),
  totalResults: z.number(),
  results: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      metadata: z.object({
        category: z.string().optional(),
        docType: z.string().optional(),
        sourceFile: z.string().optional(),
        language: z.string().optional(),
        chunkIndex: z.number().optional(),
        totalPages: z.number().optional(),
      }),
      distance: z.number().optional(),
    }),
  ),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const statsResponseSchema = z.object({
  success: z.boolean(),
  stats: z.object({
    totalChunks: z.number(),
    languageDistribution: z.record(z.string(), z.number()),
    categoryDistribution: z.record(z.string(), z.number()),
    fileTypeDistribution: z.record(z.string(), z.number()).optional(),
  }),
});

export type StatsResponse = z.infer<typeof statsResponseSchema>;

export const healthResponseSchema = z.object({
  success: z.boolean(),
  status: z.string(),
  collection: z.string(),
  totalChunks: z.number(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;