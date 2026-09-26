import { Response } from "express";
import { AuthRequest } from "../../types/express";
import * as reviewService from "./review.service";
import { apiStatusCode } from "../../lib/apiCode.lib";

// Create Review
export const createReview = async (req: AuthRequest, res: Response) => {
    try {
        const { id: productId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Authentication required to add review"
            });
        }
        const result = await reviewService.createReview(productId, userId, req.body);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to create review"
        });
    }
};

// Get Product Reviews
export const getReviewsByProduct = async (req: AuthRequest, res: Response) => {
    try {
        const { id: productId } = req.params;
        const { page, limit } = req.query as any;
        const result = await reviewService.getReviewsByProduct(productId, {
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            onlyApproved: true // Publicly show only approved reviews
        });
        return res.status(result.statusCode).json({
            ok: true,
            message: "Reviews fetched successfully",
            ...result
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch reviews"
        });
    }
};

// Get User Reviews
export const getReviewsByUser = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Authentication required"
            });
        }

        const result = await reviewService.getReviewsByUser(userId);
        return res.status(result.statusCode).json({
            ok: true,
            message: "Your reviews fetched successfully",
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch reviews"
        });
    }
};

// [ADMIN] Get All Reviews
export const getAllReviews = async (req: AuthRequest, res: Response) => {
    try {
        const { page, limit, status } = req.query as any;
        const result = await reviewService.getAllReviews({
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            status
        });
        return res.status(result.statusCode).json({
            ok: true,
            message: "All reviews fetched successfully",
            ...result
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch all reviews"
        });
    }
};

// [ADMIN] Approve Review
export const approveReview = async (req: AuthRequest, res: Response) => {
    try {
        const { id: reviewId } = req.params;
        const result = await reviewService.approveReview(reviewId);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to approve review"
        });
    }
};

// Delete Review (Unified)
export const deleteReview = async (req: AuthRequest, res: Response) => {
    try {
        const { id: reviewId } = req.params;
        const userId = req.user?.id;
        const role = req.user?.role;
        const isAdmin = role === 'ADMIN';

        if (!userId && !isAdmin) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Unauthorized"
            });
        }

        const result = await reviewService.deleteReview(reviewId, userId, isAdmin);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to delete review"
        });
    }
};
