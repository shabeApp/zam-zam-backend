import { z } from 'zod';

export const createReviewSchema = z.object({
    body: z.object({
        rating: z.number().min(1).max(5),
        comment: z.string().min(5).max(1000),
    })
});

export const reviewQuerySchema = z.object({
    query: z.object({
        page: z.string().optional().transform(v => v ? parseInt(v) : undefined),
        limit: z.string().optional().transform(v => v ? parseInt(v) : undefined),
        status: z.enum(["pending", "approved"]).optional(),
    })
});
