import { z } from 'zod';
// 知识分类相关类型
export const KnowledgeCategorySchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    sort_order: z.number().int().default(0),
    is_active: z.boolean().default(true),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
});
export const CreateKnowledgeCategorySchema = KnowledgeCategorySchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
});
export const UpdateKnowledgeCategorySchema = CreateKnowledgeCategorySchema.partial();
// 知识条目相关类型
export const KnowledgeArticleSchema = z.object({
    id: z.string().uuid().optional(),
    category_id: z.string().uuid(),
    title: z.string().min(1).max(255),
    content: z.string().min(1),
    summary: z.string().optional(),
    author: z.string().max(100).optional(),
    source: z.string().max(255).optional(),
    tags: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    view_count: z.number().int().default(0),
    like_count: z.number().int().default(0),
    is_featured: z.boolean().default(false),
    metadata: z.record(z.any()).optional(),
    created_by: z.string().uuid().optional(),
    updated_by: z.string().uuid().optional(),
    published_at: z.string().datetime().nullable().optional(),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
});
export const CreateKnowledgeArticleSchema = KnowledgeArticleSchema.omit({
    id: true,
    view_count: true,
    like_count: true,
    created_at: true,
    updated_at: true,
});
export const UpdateKnowledgeArticleSchema = CreateKnowledgeArticleSchema.partial();
// 用户互动相关类型
export const KnowledgeInteractionSchema = z.object({
    id: z.string().uuid().optional(),
    user_id: z.string().uuid(),
    article_id: z.string().uuid(),
    interaction_type: z.enum(['view', 'like', 'share', 'bookmark']),
    interaction_data: z.record(z.any()).optional(),
    created_at: z.string().datetime().optional(),
});
// 查询参数类型
export const KnowledgeQueryParamsSchema = z.object({
    category_id: z.string().uuid().optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    is_featured: z.boolean().optional(),
    tags: z.string().optional(), // 逗号分隔的标签
    search: z.string().optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sort_by: z.enum(['created_at', 'updated_at', 'published_at', 'title', 'view_count', 'like_count']).default('created_at'),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
});
// 搜索参数类型
export const KnowledgeSearchParamsSchema = z.object({
    q: z.string().min(1),
    category_id: z.string().uuid().optional(),
    tags: z.string().optional(),
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
});
//# sourceMappingURL=knowledge.types.js.map