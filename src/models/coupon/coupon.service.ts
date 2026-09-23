import prisma from "../../prisma/client";
import { apiStatusCode } from "../../lib/apiCode.lib";

// Custom error class
export class CouponError extends Error {
    constructor(message: string, public statusCode: number, public code?: string) {
        super(message);
        this.name = "CouponError";
    }
}

// Interfaces
export interface CreateCouponInput {
    code: string;
    description?: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    maxDiscountAmount?: number;
    minPurchaseAmount?: number;
    validFrom: Date;
    validUntil: Date;
    usageLimit?: number;
    perUserLimit?: number;
    isActive?: boolean;
    applicableTo?: "ALL" | "CATEGORY" | "PRODUCT" | "USER";
    userIds?: string[];
    categoryId?: string;
    productId?: string;
}

export interface CartItemInput {
    productId: string;
    categoryId: string;
    price: number;
    quantity: number;
}

// ==================== CREATE OPERATIONS ====================

/**
 * Create a new coupon
 */
export const createCoupon = async (data: CreateCouponInput) => {
    try {
        if (!data.code || !data.discountType || data.discountValue === undefined || !data.validFrom || !data.validUntil) {
            throw new CouponError("Missing required fields: code, discountType, discountValue, validFrom, validUntil", apiStatusCode.BadRequest);
        }

        // Case-insensitive code uniqueness check
        const existing = await prisma.coupon.findUnique({
            where: { code: data.code.trim().toUpperCase() }
        });

        if (existing) {
            throw new CouponError("Coupon code already exists", apiStatusCode.Conflict);
        }

        const coupon = await prisma.coupon.create({
            data: {
                ...data,
                code: data.code.trim().toUpperCase(),
                validFrom: new Date(data.validFrom),
                validUntil: new Date(data.validUntil),
                isActive: data.isActive !== undefined ? data.isActive : true,
                usedCount: 0
            }
        });

        return {
            message: "Coupon created successfully",
            data: coupon,
            statusCode: apiStatusCode.Created
        };
    } catch (error: any) {
        if (error instanceof CouponError) throw error;
        console.error("Create coupon error:", error);
        throw new CouponError(error?.message || "Failed to create coupon", apiStatusCode.InternalServerError);
    }
};

// ==================== READ OPERATIONS ====================

/**
 * Get all coupons with optional filtering
 */
export const getCoupons = async (filters: { isActive?: boolean; code?: string; type?: string } = {}) => {
    try {
        const coupons = await prisma.coupon.findMany({
            where: {
                ...(filters.isActive !== undefined && { isActive: filters.isActive }),
                ...(filters.code && { code: { contains: filters.code.toUpperCase() } }),
                ...(filters.type && { discountType: filters.type as any })
            },
            orderBy: { createdAt: 'desc' }
        });

        return {
            message: "Coupons fetched successfully",
            data: coupons,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        console.error("Get coupons error:", error);
        throw new CouponError("Failed to fetch coupons", apiStatusCode.InternalServerError);
    }
};

/**
 * Get coupon by ID
 */
export const getCouponById = async (id: string) => {
    try {
        if (!id) throw new CouponError("Coupon ID is required", apiStatusCode.BadRequest);

        const coupon = await prisma.coupon.findUnique({
            where: { id }
        });

        if (!coupon) throw new CouponError("Coupon not found", apiStatusCode.NotFound);

        return {
            message: "Coupon fetched successfully",
            data: coupon,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof CouponError) throw error;
        throw new CouponError("Failed to fetch coupon", apiStatusCode.InternalServerError);
    }
};

/**
 * Get coupon by code
 */
export const getCouponByCode = async (code: string) => {
    try {
        if (!code) throw new CouponError("Coupon code is required", apiStatusCode.BadRequest);

        const coupon = await prisma.coupon.findUnique({
            where: { code: code.trim().toUpperCase() }
        });

        if (!coupon) throw new CouponError("Coupon not found", apiStatusCode.NotFound);

        return {
            message: "Coupon fetched successfully",
            data: coupon,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof CouponError) throw error;
        throw new CouponError("Failed to fetch coupon", apiStatusCode.InternalServerError);
    }
};

// ==================== UPDATE OPERATIONS ====================

/**
 * Update coupon details
 */
export const updateCoupon = async (id: string, data: Partial<CreateCouponInput>) => {
    try {
        if (!id) throw new CouponError("Coupon ID is required", apiStatusCode.BadRequest);

        const coupon = await prisma.coupon.update({
            where: { id },
            data: {
                ...data,
                ...(data.code && { code: data.code.trim().toUpperCase() }),
                ...(data.validFrom && { validFrom: new Date(data.validFrom) }),
                ...(data.validUntil && { validUntil: new Date(data.validUntil) })
            }
        });

        return {
            message: "Coupon updated successfully",
            data: coupon,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error.code === 'P2025') throw new CouponError("Coupon not found", apiStatusCode.NotFound);
        console.error("Update coupon error:", error);
        throw new CouponError("Failed to update coupon", apiStatusCode.InternalServerError);
    }
};

// ==================== DELETE OPERATIONS ====================

/**
 * Delete a coupon
 */
export const deleteCoupon = async (id: string) => {
    try {
        if (!id) throw new CouponError("Coupon ID is required", apiStatusCode.BadRequest);

        await prisma.coupon.delete({
            where: { id }
        });

        return {
            message: "Coupon deleted successfully",
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error.code === 'P2025') throw new CouponError("Coupon not found", apiStatusCode.NotFound);
        throw new CouponError("Failed to delete coupon", apiStatusCode.InternalServerError);
    }
};

// ==================== VALIDATION & USAGE ====================

/**
 * Validate a coupon for use
 */
export const validateCoupon = async (code: string, userId: string, subtotal: number, items: CartItemInput[] = []) => {
    try {
        if (!code) throw new CouponError("Coupon code is required", apiStatusCode.BadRequest);

        const coupon = await prisma.coupon.findUnique({
            where: { code: code.trim().toUpperCase() }
        });

        if (!coupon) throw new CouponError("Invalid coupon code", apiStatusCode.NotFound);
        if (!coupon.isActive) throw new CouponError("This coupon is currently inactive", apiStatusCode.BadRequest);

        const now = new Date();
        if (now < coupon.validFrom) throw new CouponError("Coupon validity hasn't started yet", apiStatusCode.BadRequest);
        if (now > coupon.validUntil) throw new CouponError("Coupon has expired", apiStatusCode.BadRequest);

        // Usage limit check
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            throw new CouponError("Coupon usage limit has been reached", apiStatusCode.BadRequest);
        }

        // Minimum purchase check
        if (coupon.minPurchaseAmount && subtotal < coupon.minPurchaseAmount) {
            throw new CouponError(`Minimum purchase of ${coupon.minPurchaseAmount} is required to use this coupon`, apiStatusCode.BadRequest);
        }

        // --- Scope Validation ---
        let discountableAmount = subtotal;

        if (coupon.applicableTo === "USER" && !coupon.userIds.includes(userId)) {
            throw new CouponError("This coupon is not available for your account", apiStatusCode.NotMatched);
        }

        if (coupon.applicableTo === "CATEGORY") {
            if (!coupon.categoryId) throw new CouponError("Misconfigured coupon: category missing", apiStatusCode.InternalServerError);
            const applicableItems = items.filter(item => item.categoryId === coupon.categoryId);
            if (applicableItems.length === 0) {
                throw new CouponError("This coupon is not applicable to any items in your category", apiStatusCode.BadRequest);
            }
            discountableAmount = applicableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        }

        if (coupon.applicableTo === "PRODUCT") {
            if (!coupon.productId) throw new CouponError("Misconfigured coupon: product missing", apiStatusCode.InternalServerError);
            const applicableItems = items.filter(item => item.productId === coupon.productId);
            if (applicableItems.length === 0) {
                throw new CouponError("This coupon is not applicable to any items in your cart", apiStatusCode.BadRequest);
            }
            discountableAmount = applicableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        }

        // Per-user limit check
        if (coupon.perUserLimit) {
            const userUsageCount = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    _count: {
                        select: { couponsUsed: { where: { id: coupon.id } } }
                    }
                }
            });

            if (userUsageCount && userUsageCount._count.couponsUsed >= coupon.perUserLimit) {
                throw new CouponError("You have reached the maximum usage limit for this coupon", apiStatusCode.BadRequest);
            }
        }

        // Calculate actual discount reward
        let discountAmount = 0;
        if (coupon.discountType === "PERCENTAGE") {
            discountAmount = (discountableAmount * coupon.discountValue) / 100;
            if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
                discountAmount = coupon.maxDiscountAmount;
            }
        } else {
            discountAmount = Math.min(coupon.discountValue, discountableAmount);
        }

        return {
            message: "Coupon is valid",
            data: {
                ...coupon,
                computedDiscount: discountAmount
            },
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof CouponError) throw error;
        console.error("Validate coupon error:", error);
        throw new CouponError(error?.message || "Failed to validate coupon", apiStatusCode.InternalServerError);
    }
};

/**
 * Increment coupon usage count and link to user
 */
export const incrementCouponUsage = async (couponId: string, userId: string) => {
    try {
        const coupon = await prisma.coupon.update({
            where: { id: couponId },
            data: {
                usedCount: { increment: 1 },
                users: { connect: { id: userId } }
            }
        });

        return {
            message: "Coupon usage incremented",
            data: coupon,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        console.error("Increment coupon usage error:", error);
        throw new CouponError("Failed to update coupon usage", apiStatusCode.InternalServerError);
    }
};
