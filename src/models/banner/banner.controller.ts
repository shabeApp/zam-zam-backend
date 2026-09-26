import { Request, Response } from "express";
import * as bannerService from "./banner.service";
import { apiStatusCode } from "../../lib/apiCode.lib";
import { redisClient } from "../../cache/redis.config";

// Cache keys
const CACHE_KEY_ALL = "banners:all";
const CACHE_KEY_SINGLE = (id: string) => `banner:${id}`;

// Create Banner
export const createBanner = async (req: Request, res: Response) => {
    try {
        const result = await bannerService.createBanner(req.body);

        // Invalidate cache
        await redisClient.del(CACHE_KEY_ALL);

        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to create banner"
        });
    }
};

// Get All Banners
export const getAllBanners = async (req: Request, res: Response) => {
    try {
        // Try to get from cache
        const cachedData = await redisClient.get(CACHE_KEY_ALL);
        if (cachedData) {
            // console.log("hit cache");
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Fetched from cache",
                data: JSON.parse(cachedData)
            });
        }
        // console.log("miss cache");
        const result = await bannerService.getBanners();

        // Save to cache
        if (result.data) {
            await redisClient.setEx(CACHE_KEY_ALL, 3600, JSON.stringify(result.data));
        }
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch banners"
        });
    }
};

// Get Banner By ID
export const getBannerById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Try to get from cache
        const cachedData = await redisClient.get(CACHE_KEY_SINGLE(id));
        if (cachedData) {
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Fetched from cache",
                data: JSON.parse(cachedData)
            });
        }
        const result = await bannerService.getBannerById(id);

        // Save to cache
        if (result.data) {
            await redisClient.setEx(CACHE_KEY_SINGLE(id), 3600, JSON.stringify(result.data));
        }
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch banner"
        });
    }
};

// Update Banner
export const updateBanner = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await bannerService.updateBanner(id, req.body);

        // Invalidate cache
        await Promise.all([
            redisClient.del(CACHE_KEY_ALL),
            redisClient.del(CACHE_KEY_SINGLE(id))
        ]);

        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to update banner"
        });
    }
};

// Delete Banner
export const deleteBanner = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await bannerService.deleteBanner(id);

        // Invalidate cache
        await Promise.all([
            redisClient.del(CACHE_KEY_ALL),
            redisClient.del(CACHE_KEY_SINGLE(id))
        ]);

        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to delete banner"
        });
    }
};
