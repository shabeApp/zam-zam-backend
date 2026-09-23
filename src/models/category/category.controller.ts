import { Request, Response } from "express";
import categoryService from "../../Services/category.service";
import { apiStatusCode } from "../../lib/apiCode.lib";
import { redisClient } from "../../cache/redis.config";

// Cache keys
const CACHE_KEY_ALL = "categories:all";
const CACHE_KEY_TREE = "categories:tree";
const CACHE_KEY_STATS = "categories:stats";
const CACHE_KEY_SINGLE = (id: string) => `category:${id}`;

// Create Main Category
export const createMainCategory = async (req: Request, res: Response) => {
    try {
        const category = await categoryService.createMainCategory(req.body);
        // Invalidate cache
        await Promise.all([
            redisClient.del(CACHE_KEY_ALL),
            redisClient.del(CACHE_KEY_TREE),
            redisClient.del(CACHE_KEY_SINGLE(category.id.toString()))
        ])
        return res.status(apiStatusCode.Created).json({
            ok: true,
            message: "Main category created successfully",
            data: category
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({ ok: false, message: error.message });
    }
};

// Create Sub-Category
export const createSubCategory = async (req: Request, res: Response) => {
    try {
        const category = await categoryService.createSubCategory(req.body);
        // Invalidate cache
        await Promise.all([
            redisClient.del(CACHE_KEY_ALL),
            redisClient.del(CACHE_KEY_TREE),
            redisClient.del(CACHE_KEY_SINGLE(category.id.toString()))
        ])
        return res.status(apiStatusCode.Created).json({
            ok: true,
            message: "Sub-category created successfully",
            data: category
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({ ok: false, message: error.message });
    }
};

// Get All Categories (with pagination and filters)
export const getAllCategories = async (req: Request, res: Response) => {
    try {
        const { page, limit, featured, includeProducts, search, parentId } = req.query as any;
        // Build a cache key that reflects query params to avoid serving wrong cached data
        const cacheKey = search || page || limit || featured || parentId
            ? `categories:all:${JSON.stringify({ page, limit, featured, includeProducts, search, parentId })}`
            : CACHE_KEY_ALL;
        // Try to get from cache
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            // console.log("hit cache");
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Categories fetched successfully",
                data: JSON.parse(cachedData)
            });
        }
        const result = await categoryService.getAllCategories({
            page,
            limit,
            featured,
            includeProducts,
            search,
            parentId
        });
        // Only cache the base (no-filter) request for a long time; filtered requests get a short TTL
        const ttl = (search || page || limit || featured || parentId) ? 60 : 3600;
        await redisClient.setEx(cacheKey, ttl, JSON.stringify(result));
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Categories fetched successfully",
            data: result // Result contains { data, pagination }
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({ ok: false, message: error.message });
    }
};

// Get Category By ID
export const getCategoryById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // Try to get from cache
        const cachedData = await redisClient.get(CACHE_KEY_SINGLE(id));
        if (cachedData) {
            // console.log("hit cache");
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Category fetched successfully",
                data: JSON.parse(cachedData)
            });
        }
        // console.log("miss cache");
        const category = await categoryService.getCategoryById(id);
        // Save to cache
        await redisClient.setEx(CACHE_KEY_SINGLE(id), 300, JSON.stringify(category));

        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Category fetched successfully",
            data: category
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({ ok: false, message: error.message });
    }
};

// Get Category By Slug
export const getCategoryBySlug = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        // Try to get from cache
        const cachedData = await redisClient.get(CACHE_KEY_SINGLE(slug));
        if (cachedData) {
            // console.log("hit cache");
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Category fetched successfully",
                data: JSON.parse(cachedData)
            });
        }
        // console.log("miss cache");
        const category = await categoryService.getCategoryBySlug(slug);
        // Save to cache
        await redisClient.setEx(CACHE_KEY_SINGLE(slug), 300, JSON.stringify(category));
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Category fetched successfully",
            data: category
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({ ok: false, message: error.message });
    }
};

export const getSubCategories = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // Try to get from cache
        const cachedData = await redisClient.get(CACHE_KEY_SINGLE(id));
        if (cachedData) {
            // console.log("hit cache");
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Category fetched successfully",
                data: JSON.parse(cachedData)
            });
        }
        // console.log("miss cache");
        const category = await categoryService.getSubCategories(id);
        // Save to cache
        await redisClient.setEx(CACHE_KEY_SINGLE(id), 300, JSON.stringify(category));
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Category fetched successfully",
            data: category
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({ ok: false, message: error.message });
    }
};

// Update Category
export const updateCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const category = await categoryService.updateCategory(id, req.body);
        // Invalidate cache
        await Promise.all([
            redisClient.del(CACHE_KEY_ALL),
            redisClient.del(CACHE_KEY_TREE),
            redisClient.del(CACHE_KEY_SINGLE(id))
        ])
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Category updated successfully",
            data: category
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({ ok: false, message: error.message });
    }
};

// Get Full Category Tree
export const getCategoryTree = async (req: Request, res: Response) => {
    try {
        // Try to get from cache
        const cachedData = await redisClient.get(CACHE_KEY_TREE);
        if (cachedData) {
            // console.log("hit cache");
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Category tree fetched successfully",
                data: JSON.parse(cachedData)
            });
        }
        // console.log("miss cache");
        const tree = await categoryService.getCategoryTree();
        // Save to cache
        await redisClient.setEx(CACHE_KEY_TREE, 3600, JSON.stringify(tree));
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Category tree fetched successfully",
            data: tree
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({ ok: false, message: error.message });
    }
};

//get short Data
export const getCategoryTreeShortData = async (req: Request, res: Response) => {
    try {
        // Try to get from cache
        const cachedData = await redisClient.get(CACHE_KEY_TREE);
        if (cachedData) {
            // console.log("hit cache");
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Category tree fetched successfully",
                data: JSON.parse(cachedData)
            });
        }
        // console.log("miss cache");
        const tree = await categoryService.getCategoryTreeShortData();
        // Save to cache
        await redisClient.setEx(CACHE_KEY_TREE, 3600, JSON.stringify(tree));
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Category tree fetched successfully",
            data: tree
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({ ok: false, message: error.message });
    }
};

// Get Category Statistics
export const getCategoryStatistics = async (req: Request, res: Response) => {
    try {
        // Try to get from cache
        const cachedData = await redisClient.get(CACHE_KEY_STATS);
        if (cachedData) {
            // console.log("hit cache");
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Category statistics fetched successfully",
                data: JSON.parse(cachedData)
            });
        }
        // console.log("miss cache");
        const stats = await categoryService.getCategoryStatistics();
        // Save to cache
        await redisClient.setEx(CACHE_KEY_STATS, 3600, JSON.stringify(stats));
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Category statistics fetched successfully",
            data: stats
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({ ok: false, message: error.message });
    }
};

// Hard Delete Category
export const hardDeleteCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await categoryService.hardDeleteCategory(id);
        // Invalidate cache
        await Promise.all([
            redisClient.del(CACHE_KEY_ALL),
            redisClient.del(CACHE_KEY_TREE),
            redisClient.del(CACHE_KEY_SINGLE(id))
        ])
        return res.status(apiStatusCode.Success).json({
            ok: true,
            ...result
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({ ok: false, message: error.message });
    }
};