import { z } from 'zod';

export const createCouponSchema = z.object({
    body: z.object({
        code: z.string().min(3).max(20).toUpperCase(),
        description: z.string().max(255).optional(),
        discountType: z.enum(["PERCENTAGE", "FIXED"]),
        discountValue: z.number().positive(),
        maxDiscountAmount: z.number().positive().optional(),
        minPurchaseAmount: z.number().nonnegative().optional(),
        validFrom: z.string().datetime(),
        validUntil: z.string().datetime(),
        usageLimit: z.number().int().positive().optional(),
        perUserLimit: z.number().int().positive().optional(),
        isActive: z.boolean().optional(),
        applicableTo: z.enum(["ALL", "CATEGORY", "PRODUCT", "USER"]).optional(),
        userIds: z.array(z.string()).optional(),
        categoryId: z.string().optional(),
        productId: z.string().optional(),
    }).refine(data => new Date(data.validFrom) < new Date(data.validUntil), {
        message: "validFrom must be before validUntil",
        path: ["validFrom"]
    })
});

export const updateCouponSchema = z.object({
    body: z.object({
        code: z.string().min(3).max(20).toUpperCase().optional(),
        description: z.string().max(255).optional(),
        discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
        discountValue: z.number().positive().optional(),
        maxDiscountAmount: z.number().positive().optional(),
        minPurchaseAmount: z.number().nonnegative().optional(),
        validFrom: z.string().datetime().optional(),
        validUntil: z.string().datetime().optional(),
        usageLimit: z.number().int().positive().optional(),
        perUserLimit: z.number().int().positive().optional(),
        isActive: z.boolean().optional(),
        applicableTo: z.enum(["ALL", "CATEGORY", "PRODUCT", "USER"]).optional(),
        userIds: z.array(z.string()).optional(),
        categoryId: z.string().optional(),
        productId: z.string().optional(),
    })
});

export const validateCouponSchema = z.object({
    body: z.object({
        code: z.string().min(1).toUpperCase(),
        subtotal: z.number().nonnegative(),
        items: z.array(z.object({
            productId: z.string(),
            categoryId: z.string(),
            price: z.number().nonnegative(),
            quantity: z.number().int().positive(),
        })).optional().default([]),
    })
});
