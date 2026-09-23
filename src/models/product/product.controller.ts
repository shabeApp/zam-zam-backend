import { Response } from "express";
import { AuthRequest } from "../../types/express";
import * as productService from "../../Services/product.service";
import { apiStatusCode } from "../../lib/apiCode.lib";
import { redisClient } from "../../cache/redis.config";

// Cache keys
const CACHE_KEY_ALL = "products:all";
const CACHE_KEY_SINGLE = (id: string) => `product:${id}`;
const CACHE_KEY_FEATURED = (categoryId?: string, limit?: number) => {
    return `products:featured:${categoryId || "all"}${limit ? `:${limit}` : ""}`;
};
const CACHE_KEY_FEATURED_PREFIX = "products:featured*";
const CACHE_KEY_SEARCH = (query: string) => `products:search:${query}`;
const CACHE_KEY_SEARCH_PREFIX = "products:search:*";
const CACHE_KEY_SUBCATEGORY = (categoryId: string) => `products:subcategory:${categoryId}`;
const CACHE_KEY_SUBCATEGORY_PREFIX = "products:subcategory:*";
const CACHE_KEY_CATEGORY = (categoryId: string) => `products:category:${categoryId}`;
const CACHE_KEY_CATEGORY_PREFIX = "products:category:*";
const CACHE_KEY_PAGINATION_PREFIX = "products:pagination:*";
const CACHE_KEY_PAGINATION = (page?: string, limit?: string, categoryId?: string, featured?: boolean, search?: string, sortBy?: string, showDisabled?: boolean) => {
    const parts = ["products", "pagination"];
    if (page) parts.push(`page:${page}`);
    if (limit) parts.push(`limit:${limit}`);
    if (categoryId) parts.push(`cat:${categoryId}`);
    if (featured !== undefined) parts.push(`feat:${featured}`);
    if (search) parts.push(`search:${search}`);
    if (sortBy) parts.push(`sort:${sortBy}`);
    if (showDisabled) parts.push(`dis:${showDisabled}`);
    return parts.join(":");
};

//review cache keys
const CACHE_KEY_REVIEW = (productId: string) => `product:review:${productId}`;
const CACHE_KEY_REVIEW_PREFIX = "product:review:*";


// Helper to clear pattern-based caches
const clearCachePattern = async (pattern: string) => {
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
    } catch (error) {
        console.error("Cache clear error:", error);
    }
};



// Create Product
export const createProduct = async (req: AuthRequest, res: Response) => {
    try {
        const result = await productService.createProduct(req.body);
        await Promise.all([
            redisClient.del(CACHE_KEY_ALL),
            clearCachePattern(CACHE_KEY_FEATURED_PREFIX),
            clearCachePattern(CACHE_KEY_PAGINATION_PREFIX),
            clearCachePattern(CACHE_KEY_CATEGORY_PREFIX),
            clearCachePattern(CACHE_KEY_SUBCATEGORY_PREFIX),
            clearCachePattern(CACHE_KEY_SEARCH_PREFIX)
        ]);
        return res.status(result.statusCode || apiStatusCode.Created).json({
            ok: true,
            message: result.message,
            data: result.data,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to create product",
        });
    }
};

// Get All Products
export const getAllProducts = async (req: AuthRequest, res: Response) => {
    try {
        const { page, limit, categoryId, featured, search, sortBy, showDisabled } = req.query;
        const cacheKey = CACHE_KEY_PAGINATION(
            page as string,
            limit as string,
            categoryId as string,
            featured !== undefined ? featured === "true" : undefined,
            search as string,
            sortBy as any,
            showDisabled === "true"
        );
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            // console.log("Cache hit");
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Products fetched successfully",
                data: JSON.parse(cachedData),
            });
        }
        const result = await productService.getAllProducts({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            categoryId: categoryId as string,
            featured: featured !== undefined ? featured === "true" : undefined,
            search: search as string,
            sortBy: sortBy as any,
            showDisabled: showDisabled === "true",
        });
        await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
        // console.log("Cache miss");
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Products fetched successfully",
            data: result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch products",
        });
    }
};

export const getAllProductsByAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const { page, limit } = req.query;
        const result = await productService.getAllProductsByAdmin({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Products fetched successfully",
            data: result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch products",
        });
    }
};

// Get Product By ID
export const getProductById = async (req: AuthRequest, res: Response) => {
    try {
        const cacheKey = CACHE_KEY_SINGLE(req.params.id);
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Product fetched successfully",
                data: JSON.parse(cachedData),
            });
        }
        const result = await productService.getProductById(req.params.id);
        await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Product fetched successfully",
            data: result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch product",
        });
    }
};

// Get Product By Slug
export const getProductBySlug = async (req: AuthRequest, res: Response) => {
    try {
        const cacheKey = CACHE_KEY_SINGLE(req.params.slug);
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            // console.log("Cache hit");
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Product fetched successfully",
                data: JSON.parse(cachedData),
            });
        }
        const result = await productService.getProductBySlug(req.params.slug);
        // console.log("Cache miss");
        await redisClient.setEx(cacheKey, 200, JSON.stringify(result));
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Product fetched successfully",
            data: result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch product",
        });
    }
};

// Get Featured Products
export const getFeaturedProducts = async (req: AuthRequest, res: Response) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const categoryId = req.query.categoryId as string | undefined;

        const cacheKey = CACHE_KEY_FEATURED(categoryId, limit);
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            // console.log("Cache hit");
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Featured products fetched successfully",
                data: JSON.parse(cachedData),
            });
        }
        // console.log("Cache miss");
        const result = await productService.getFeaturedProducts(limit, categoryId);
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(result));
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Featured products fetched successfully",
            data: result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch featured products",
        });
    }
};

export const getFeaturedProductsBySlug = async (req: AuthRequest, res: Response) => {
    try {
        const slug = req.params.slug;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const result = await productService.getFeaturedProductsBySlug(slug, limit);
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Featured products fetched successfully",
            data: result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch featured products",
        });
    }
};

// Search Products
export const searchProducts = async (req: AuthRequest, res: Response) => {
    try {
        const { query, limit } = req.query;

        // Validate before cache lookup to avoid caching undefined keys
        if (!query || typeof query !== "string" || query.trim().length < 2) {
            return res.status(apiStatusCode.BadRequest).json({
                ok: false,
                message: "Search query must be at least 2 characters",
            });
        }

        const trimmedQuery = query.trim();
        const cacheKey = CACHE_KEY_SEARCH(trimmedQuery);
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Products searched successfully",
                data: JSON.parse(cachedData),
            });
        }
        const result = await productService.searchProducts(
            trimmedQuery,
            limit ? Number(limit) : 20
        );

        await redisClient.setEx(cacheKey, 300, JSON.stringify(result));

        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Products searched successfully",
            data: result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to search products",
        });
    }
};

// Update Product
export const updateProduct = async (req: AuthRequest, res: Response) => {
    try {
        const result = await productService.updateProduct(req.params.id, req.body);
        await Promise.all([
            redisClient.del(CACHE_KEY_ALL),
            redisClient.del(CACHE_KEY_SINGLE(req.params.id)),
            clearCachePattern(CACHE_KEY_FEATURED_PREFIX),
            clearCachePattern(CACHE_KEY_PAGINATION_PREFIX),
            clearCachePattern(CACHE_KEY_CATEGORY_PREFIX),
            clearCachePattern(CACHE_KEY_SUBCATEGORY_PREFIX),
            clearCachePattern(CACHE_KEY_SEARCH_PREFIX)
        ]);
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Product updated successfully",
            data: result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to update product",
        });
    }
};

// Delete Product (Soft Delete)
export const deleteProduct = async (req: AuthRequest, res: Response) => {
    try {
        const result = await productService.deleteProduct(req.params.id);
        await Promise.all([
            redisClient.del(CACHE_KEY_ALL),
            redisClient.del(CACHE_KEY_SINGLE(req.params.id)),
            clearCachePattern(CACHE_KEY_FEATURED_PREFIX),
            clearCachePattern(CACHE_KEY_PAGINATION_PREFIX),
            clearCachePattern(CACHE_KEY_CATEGORY_PREFIX),
            clearCachePattern(CACHE_KEY_SUBCATEGORY_PREFIX),
            clearCachePattern(CACHE_KEY_SEARCH_PREFIX)
        ]);
        return res.status(apiStatusCode.Success).json({
            ok: true,
            ...result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to delete product",
        });
    }
};

// Add Review
export const addReview = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Authentication required",
            });
        }

        const result = await productService.addProductReview(req.params.id, userId, req.body);
        await Promise.all([
            redisClient.del(CACHE_KEY_SINGLE(req.params.id)),
            clearCachePattern(CACHE_KEY_REVIEW_PREFIX),
            clearCachePattern(CACHE_KEY_ALL),
            clearCachePattern(CACHE_KEY_FEATURED_PREFIX),
            clearCachePattern(CACHE_KEY_PAGINATION_PREFIX),
            clearCachePattern(CACHE_KEY_CATEGORY_PREFIX),
            clearCachePattern(CACHE_KEY_SUBCATEGORY_PREFIX),
            clearCachePattern(CACHE_KEY_SEARCH_PREFIX)
        ]);
        return res.status(apiStatusCode.Created).json({
            ok: true,
            message: "Review added successfully",
            data: result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to add review",
        });
    }
};

// Admin route
export const getAllReviews = async (req: AuthRequest, res: Response) => {
    try {
        const cacheKey = CACHE_KEY_REVIEW_PREFIX;
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Reviews fetched successfully",
                data: JSON.parse(cachedData),
            });
        }
        const result = await productService.getAllReviews();
        await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Reviews fetched successfully",
            data: result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch reviews",
        });
    }
};

// Get Product Reviews
export const getProductReviews = async (req: AuthRequest, res: Response) => {
    try {
        const cacheKey = CACHE_KEY_REVIEW(req.params.id);
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(apiStatusCode.Success).json({
                ok: true,
                message: "Reviews fetched successfully",
                data: JSON.parse(cachedData),
            });
        }
        const result = await productService.getProductReviews(req.params.id);
        await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
        return res.status(apiStatusCode.Success).json({
            ok: true,
            message: "Reviews fetched successfully",
            data: result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch reviews",
        });
    }
};

// Update Review
export const updateReview = async (req: AuthRequest, res: Response) => {
    try {
        const result = await productService.updateReview(req.params.reviewId, req.body);
        await Promise.all([
            redisClient.del(CACHE_KEY_REVIEW(req.params.reviewId)),
            clearCachePattern(CACHE_KEY_REVIEW_PREFIX),
        ]);

        return res.status(apiStatusCode.Success).json({
            ok: true,
            ...result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to update review",
        });
    }
};

// Delete Review
export const deleteReview = async (req: AuthRequest, res: Response) => {
    try {
        const result = await productService.deleteReview(req.params.reviewId);
        await Promise.all([
            clearCachePattern(CACHE_KEY_REVIEW_PREFIX),
            clearCachePattern(CACHE_KEY_ALL),
            clearCachePattern(CACHE_KEY_FEATURED_PREFIX),
            clearCachePattern(CACHE_KEY_PAGINATION_PREFIX),
            clearCachePattern(CACHE_KEY_CATEGORY_PREFIX),
            clearCachePattern(CACHE_KEY_SUBCATEGORY_PREFIX),
            clearCachePattern(CACHE_KEY_SEARCH_PREFIX)
        ]);
        return res.status(apiStatusCode.Success).json({
            ok: true,
            ...result,
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to delete review",
        });
    }
};
