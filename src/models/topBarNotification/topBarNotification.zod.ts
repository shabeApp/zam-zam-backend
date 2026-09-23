import { z } from 'zod';

export const createTopBarNotificationSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(100),
        message: z.string().min(3).max(500),
        link: z.string().optional(),
        isActive: z.coerce.boolean().optional(),
    })
});

export const updateTopBarNotificationSchema = z.object({
    body: z.object({
        title: z.string().min(3).max(100).optional(),
        message: z.string().min(3).max(500).optional(),
        link: z.string().optional(),
        isActive: z.coerce.boolean().optional(),
    })
});

