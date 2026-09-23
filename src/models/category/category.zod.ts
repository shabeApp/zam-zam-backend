import { z } from 'zod';

export const createMainCategorySchema = z.object({
    body: z.object({
        name: z.string().min(2).max(50),
        slug: z.string().min(2).max(50).toLowerCase(),
        image: z.string().optional(),
        featured: z.boolean().optional(),
    })
});

export const createSubCategorySchema = z.object({
    body: z.object({
        name: z.string().min(2).max(50),
        slug: z.string().min(2).max(50).toLowerCase(),
        image: z.string().optional(),
        parentCategoryId: z.string().min(1),
        featured: z.boolean().optional(),
    })
});

export const updateCategorySchema = z.object({
    body: z.object({
        name: z.string().min(2).max(50).optional(),
        slug: z.string().min(2).max(50).toLowerCase().optional(),
        image: z.string().optional(),
        featured: z.boolean().optional(),
        parentCategoryId: z.string().optional().nullable(),
    })
});

export const categoryQuerySchema = z.object({
    query: z.object({
        page: z.string().optional().transform(v => v ? parseInt(v) : undefined),
        limit: z.string().optional().transform(v => v ? parseInt(v) : undefined),
        featured: z.string().optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
        includeProducts: z.string().optional().transform(v => v === 'true'),
    })
});
