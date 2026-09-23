import { Response } from "express";
import { AuthRequest } from "../../types/express";
import * as couponService from "../../Services/coupon.service";
import { apiStatusCode } from "../../lib/apiCode.lib";
import prisma from "../../prisma/client";

// Get Coupon Statistics
export const getCouponStats = async (req: AuthRequest, res: Response) => {
    try {
        const coupons = await prisma.coupon.findMany({
            select: {
                usedCount: true,
                isActive: true,
                discountValue: true,
                discountType: true
            }
        });

        const totalUsage = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
        const activeCampaigns = coupons.filter(c => c.isActive).length;

        // Rough estimate of total savings (would need actual transaction data for accuracy)
        const totalSavings = coupons.reduce((sum, c) => {
            return sum + (c.discountType === "FIXED" ? (c.discountValue * (c.usedCount || 0)) : 0);
        }, 0);

        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Statistics fetched successfully",
            data: {
                totalUsage,
                activeCampaigns,
                totalSavings
            }
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch statistics"
        });
    }
};

// Create Coupon
export const createCoupon = async (req: AuthRequest, res: Response) => {
    try {
        const result = await couponService.createCoupon(req.body);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to create coupon"
        });
    }
};

// Get All Coupons
export const getAllCoupons = async (req: AuthRequest, res: Response) => {
    try {
        const { isActive, code, type } = req.query as any;
        const result = await couponService.getCoupons({
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            code: code as string,
            type: type as string
        });
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch coupons"
        });
    }
};

// Get Coupon By ID
export const getCouponById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const result = await couponService.getCouponById(id);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch coupon"
        });
    }
};

// Update Coupon
export const updateCoupon = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const result = await couponService.updateCoupon(id, req.body);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to update coupon"
        });
    }
};

// Delete Coupon
export const deleteCoupon = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const result = await couponService.deleteCoupon(id);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to delete coupon"
        });
    }
};

// Validate Coupon
export const validateCoupon = async (req: AuthRequest, res: Response) => {
    try {
        const { code, subtotal, items } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Authentication required to validate coupon"
            });
        }

        const result = await couponService.validateCoupon(code, userId, subtotal, items);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Coupon validation failed"
        });
    }
};
