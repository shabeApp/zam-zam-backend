import { z } from 'zod';

export const createBannerSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(100),
        slug: z.string().min(3).max(100),
        description: z.string().min(3).max(500),
        image: z.string().url(),
        link: z.string().url(),
        type: z.enum(["HOME", "CATEGORY", "PRODUCT"]).optional(),
    })
});

export const updateBannerSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(100).optional(),
        slug: z.string().min(3).max(100).optional(),
        description: z.string().min(3).max(500).optional(),
        image: z.string().url().optional(),
        link: z.string().url().optional(),
        type: z.enum(["HOME", "CATEGORY", "PRODUCT"]).optional(),
    })
});
