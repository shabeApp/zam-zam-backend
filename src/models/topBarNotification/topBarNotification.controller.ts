import { Response } from "express";
import * as topBarNotificationService from "./topBarNotification.service";
import { apiStatusCode } from "../../lib/apiCode.lib";
import { AuthRequest } from "../../types/express";
import { redisClient } from "../../cache/redis.config";

// Cache keys
const CACHE_KEY_ALL = "topBarNotifications:all";
const CACHE_KEY_SINGLE = (id: string) => `topBarNotification:${id}`;

// Create TopBarNotification
export const createTopBarNotification = async (req: AuthRequest, res: Response) => {
    try {
        const { title, message, link, isActive } = req.body;
        if (req.user!.role !== "ADMIN") {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Unauthorized"
            });
        }
        if (!title || !message) {
            return res.status(apiStatusCode.BadRequest).json({
                ok: false,
                message: "Title and message are required"
            });
        }
        const data = {
            title,
            message,
            link: link ?? undefined,
            isActive: isActive ?? undefined
        }
        const result = await topBarNotificationService.createTopBarNotification(data);
        
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
            message: error.message || "Failed to create top bar notification"
        });
    }
};

// Get All TopBarNotifications
export const getAllTopBarNotifications = async (req: AuthRequest, res: Response) => {
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
        // console.log("hit database");
        const result = await topBarNotificationService.getTopBarNotifications();
        
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
            message: error.message || "Failed to fetch top bar notifications"
        });
    }
};

// Get TopBarNotification By ID
export const getTopBarNotificationById = async (req: AuthRequest, res: Response) => {
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

        const result = await topBarNotificationService.getTopBarNotificationById(id);

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
            message: error.message || "Failed to fetch top bar notification"
        });
    }
};

// Update TopBarNotification
export const updateTopBarNotification = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, slug, message, link, isActive } = req.body;
        if (req.user!.role !== "ADMIN") {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Unauthorized"
            });
        }
        const data = {
            title: title ?? undefined,
            slug: slug ?? undefined,
            message: message ?? undefined,
            link: link ?? undefined,
            isActive: isActive ?? undefined
        }
        const result = await topBarNotificationService.updateTopBarNotification(id, data);

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
            message: error.message || "Failed to update top bar notification"
        });
    }
};

// Delete TopBarNotification
export const deleteTopBarNotification = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        if (req.user!.role !== "ADMIN") {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Unauthorized"
            });
        }
        const result = await topBarNotificationService.deleteTopBarNotification(id);

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
            message: error.message || "Failed to delete top bar notification"
        });
    }
};
