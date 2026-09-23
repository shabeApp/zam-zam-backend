import prisma from "../../prisma/client";
import { apiStatusCode } from "../../lib/apiCode.lib";

// Custom error class
export class ReviewError extends Error {
    constructor(message: string, public statusCode: number, public code?: string) {
        super(message);
        this.name = "ReviewError";
    }
}

// ==================== CREATE OPERATIONS ====================

export const createReview = async (productId: string, userId: string, data: {
    rating: number;
    comment: string;
}) => {
    try {
        if (!productId && !userId) {
            throw new ReviewError("Product ID and User ID are required", apiStatusCode.BadRequest);
        }

        // Check if product exists
        const product = await prisma.product.findUnique({
            where: { id: productId, deletedAt: null } as any
        });
        if (!product) {
            throw new ReviewError("Product not found", apiStatusCode.NotFound);
        }

        // Check if user already reviewed this product
        const existingReview = await prisma.productReview.findFirst({
            where: { productId, userId }
        });
        if (existingReview) {
            throw new ReviewError("You have already reviewed this product", apiStatusCode.Conflict);
        }

        // Check if user is blocked
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isBlocked: true }
        });

        if (!user) throw new ReviewError("User not found", apiStatusCode.NotFound);
        if (user.isBlocked) throw new ReviewError("Your account has been blocked", apiStatusCode.NotMatched);

        const review = await prisma.productReview.create({
            data: {
                product: { connect: { id: productId } },
                user: { connect: { id: userId } },
                rating: Math.round(data.rating * 2) / 2,
                comment: data.comment.trim(),
                isApproved: false // Requires admin approval by default
            },
            include: {
                user: {
                    select: { id: true, username: true }
                }
            }
        });

        return {
            message: "Review submitted successfully and is pending approval",
            data: review,
            statusCode: apiStatusCode.Created
        };
    } catch (error: any) {
        if (error instanceof ReviewError) throw error;
        console.error("Create review error:", error);
        throw new ReviewError(error?.message || "Failed to create review", apiStatusCode.InternalServerError);
    }
};

// ==================== READ OPERATIONS ====================

export const getReviewsByProduct = async (productId: string, options: {
    page?: number;
    limit?: number;
    onlyApproved?: boolean;
}) => {
    try {
        const page = Math.max(1, options.page || 1);
        const limit = Math.min(50, Math.max(1, options.limit || 10));
        const skip = (page - 1) * limit;

        const where = {
            productId,
            ...(options.onlyApproved && { isApproved: true })
        };

        const [reviews, total] = await Promise.all([
            prisma.productReview.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: { id: true, username: true }
                    }
                }
            }),
            prisma.productReview.count({ where })
        ]);

        return {
            data: reviews,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            },
            statusCode: apiStatusCode.Success
        };
    } catch (error) {
        console.error("Get reviews by product error:", error);
        throw new ReviewError("Failed to fetch reviews", apiStatusCode.InternalServerError);
    }
};

export const getReviewsByUser = async (userId: string) => {
    try {
        const reviews = await prisma.productReview.findMany({
            where: { userId },
            include: {
                product: {
                    select: {
                        id: true, title: true, slug: true,
                        // images: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });
        return {
            data: reviews,
            statusCode: apiStatusCode.Success
        };
    } catch (error) {
        console.error("Get reviews by user error:", error);
        throw new ReviewError("Failed to fetch your reviews", apiStatusCode.InternalServerError);
    }
};

export const getAllReviews = async (options: {
    page?: number;
    limit?: number;
    status?: "pending" | "approved";
}) => {
    try {
        const page = Math.max(1, options.page || 1);
        const limit = Math.min(50, Math.max(1, options.limit || 20));
        const skip = (page - 1) * limit;

        const where = {
            ...(options.status === "pending" && { isApproved: false }),
            ...(options.status === "approved" && { isApproved: true })
        };

        const [reviews, total] = await Promise.all([
            prisma.productReview.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    user: { select: { id: true, username: true, email: true } },
                    product: { select: { id: true, title: true } }
                }
            }),
            prisma.productReview.count({ where })
        ]);

        return {
            data: reviews,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            },
            statusCode: apiStatusCode.Success
        };
    } catch (error) {
        console.error("Get all reviews error:", error);
        throw new ReviewError("Failed to fetch all reviews", apiStatusCode.InternalServerError);
    }
};

// ==================== UPDATE OPERATIONS ====================

export const approveReview = async (reviewId: string) => {
    try {
        const review = await prisma.productReview.findUnique({
            where: { id: reviewId }
        });
        if (!review) throw new ReviewError("Review not found", apiStatusCode.NotFound);

        const updated = await prisma.productReview.update({
            where: { id: reviewId },
            data: { isApproved: true }
        });

        // Update product rating after approval
        await updateProductRating(review.productId);

        return {
            message: "Review approved successfully",
            data: updated,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof ReviewError) throw error;
        throw new ReviewError(error?.message || "Failed to approve review", apiStatusCode.InternalServerError);
    }
};

// ==================== DELETE OPERATIONS ====================

export const deleteReview = async (reviewId: string, userId?: string, isAdmin: boolean = false) => {
    try {
        const review = await prisma.productReview.findUnique({
            where: { id: reviewId }
        });
        if (!review) throw new ReviewError("Review not found", apiStatusCode.NotFound);

        // Check ownership if not admin
        if (!isAdmin && review.userId !== userId) {
            throw new ReviewError("You can only delete your own reviews", apiStatusCode.Unauthorized);
        }

        await prisma.productReview.delete({
            where: { id: reviewId }
        });

        // Update product rating after deletion
        await updateProductRating(review.productId);

        return {
            message: "Review deleted successfully",
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof ReviewError) throw error;
        throw new ReviewError(error?.message || "Failed to delete review", apiStatusCode.InternalServerError);
    }
};

// ==================== HELPERS ====================

const updateProductRating = async (productId: string) => {
    try {
        const reviews = await prisma.productReview.findMany({
            where: { productId, isApproved: true },
            select: { rating: true }
        });

        if (reviews.length === 0) {
            await prisma.product.update({
                where: { id: productId },
                data: { rating: 0, numReviews: 0 }
            });
            return;
        }

        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        await prisma.product.update({
            where: { id: productId },
            data: {
                rating: Math.round(avgRating * 2) / 2,
                numReviews: reviews.length
            }
        });
    } catch (error) {
        console.error("Update product rating error:", error);
    }
};
