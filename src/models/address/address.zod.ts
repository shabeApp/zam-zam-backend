import { z } from 'zod';

export const createAddressSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(100),
        phone: z.string().min(10).max(20),
        email: z.string().email().optional().nullable(),
        street: z.string().min(5),
        city: z.string().min(2),
        state: z.string().min(2),
        postalCode: z.string().min(3),
        country: z.string().min(2),
        label: z.string().optional().nullable(),
        isDefault: z.boolean().optional(),
        addressType: z.enum(["MY_ADDRESS", "GIFT_ADDRESS"]),
        friendName: z.string().optional().nullable(),
        friendPhone: z.string().optional().nullable(),
        giftDescription: z.string().optional().nullable(),
    })
});

export const updateAddressSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(100).optional(),
        phone: z.string().min(10).max(20).optional(),
        email: z.string().email().optional().nullable(),
        street: z.string().min(5).optional(),
        city: z.string().min(2).optional(),
        state: z.string().min(2).optional(),
        postalCode: z.string().min(3).optional(),
        country: z.string().min(2).optional(),
        label: z.string().optional().nullable(),
        isDefault: z.boolean().optional(),
        addressType: z.enum(["MY_ADDRESS", "GIFT_ADDRESS"]).optional(),
        friendName: z.string().optional().nullable(),
        friendPhone: z.string().optional().nullable(),
        giftDescription: z.string().optional().nullable(),
    })
});
