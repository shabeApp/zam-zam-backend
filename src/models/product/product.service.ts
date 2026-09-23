import prisma from "../../prisma/client";
import { apiStatusCode } from "../../lib/apiCode.lib";
import { Prisma } from "@prisma/client";
import { getMongoDb } from "../../searchdb/mongodb.searchdb";

// ====================== CUSTOM ERROR CLASS ======================
export class ProductError extends Error {
    constructor(
        message: string,
        public statusCode: number = apiStatusCode.InternalServerError,
        public code?: string
    ) {
        super(message);
        this.name = "ProductError";
    }
}

// ====================== TYPES ======================
export interface ProductFilterOptions {
    page?: number;
    limit?: number;
    categoryId?: string;
    featured?: boolean | string;
    search?: string;
    sortBy?: "newest" | "oldest" | "rating" | "sold" | "discount" | "price_asc" | "price_desc";
    minPrice?: number;
    maxPrice?: number;
    isAvailable?: boolean | string;
    // vendorId?: string;
    showDisabled?: boolean | string;
    disableProduct?: boolean | string;
}

// ====================== CREATE OPERATIONS ======================
/**
 * Create a new product
 */
export const createProduct = async (data: {
    title: string;
    slug: string;
    description: string;
    longDescription?: string;
    // vendorId: string;
    sku: string;
    discount?: number;
    categoryId: string;
    featured?: boolean;
    generalImages: Array<{ url?: string; public_url?: string } | string>;
    descriptionImages?: Array<{ url?: string; public_url?: string } | string>;
    subProducts: Array<{ sku: string; type: string; qty: number; price: number; images: string[]; size: string[] }>;
    ingredients?: any;
    benefits?: string[];
    brand?: string;
    subcategory?: string;
    disableProduct?: boolean;
    disableProductDate?: Date;
}) => {
    try {
        // Validation
        if (!data.title || !data.slug || !data.description || !data.sku || !data.categoryId  || !data.generalImages || !data.subProducts) {
            throw new ProductError("All fields are required", apiStatusCode.BadRequest, "MISSING_FIELD");
        }

        // Check if category exists
        const category = await prisma.category.findUnique({
            where: { id: data.categoryId } as any
        });
        if (!category) {
            throw new ProductError("Category not found or inactive", apiStatusCode.NotFound, "CATEGORY_NOT_FOUND");
        }

        // Validate subProducts
        if (!Array.isArray(data.subProducts) || data.subProducts.length === 0) {
            throw new ProductError("At least one sub-product is required", apiStatusCode.BadRequest, "INVALID_SUBPRODUCTS");
        }

        data.subProducts.forEach(s => {
            if (!s.sku || !s.type || s.qty < 0 || s.price <= 0 || !Array.isArray(s.images) || s.images.length === 0) {
                throw new ProductError("Invalid sub-product data: price > 0, qty >= 0 and at least one image required", apiStatusCode.BadRequest);
            }
        });

        // Slug and SKU uniqueness
        const slug = data.slug.toLowerCase().trim();
        const sku = data.sku.toUpperCase().trim();

        const existing = await prisma.product.findFirst({
            where: {
                OR: [{ slug }, { sku }]
            }
        });

        if (existing) {
            const conflict = existing.slug === slug ? "slug" : "SKU";
            throw new ProductError(`Product ${conflict} already exists`, apiStatusCode.Conflict, "DUPLICATE_PRODUCT");
        }

        // Process images
        const processImages = (imgs: any[]) => imgs?.map(img =>
            typeof img === 'string' ? img : (img?.url || img?.public_url)
        ).filter(Boolean) as string[] || [];

        const product = await prisma.product.create({
            data: {
                title: data.title.trim(),
                slug,
                description: data.description.trim(),
                longDescription: data.longDescription?.trim() || "",
                // vendorId: data.vendorId,
                sku,
                categoryId: data.subcategory || data.categoryId,
                featured: data.featured || false,
                discount: data.discount || 0,
                generalImages: processImages(data.generalImages),
                descriptionImages: processImages(data.descriptionImages || []),
                subProducts: data.subProducts.map(s => ({
                    sku: s.sku.toUpperCase().trim(),
                    type: s.type,
                    qty: s.qty,
                    price: s.price,
                    images: s.images,
                    size: s.size,
                    sold: 0
                })),
                ingredients: {
                    details: data.ingredients || {},
                    benefits: data.benefits || [],
                    brand: data.brand || "",
                    subcategory: data.subcategory || ""
                },
                disableProduct: data.disableProduct || false,
                disableProductDate: data.disableProduct ? (data.disableProductDate || new Date()) : null,
            },
            include: {
                category: { select: { id: true, name: true, slug: true } },
                // vendor: { select: { id: true, name: true } }
            }
        });

        return {
            message: "Product created successfully",
            data: product,
            statusCode: apiStatusCode.Created
        };
    } catch (error: any) {
        if (error instanceof ProductError) throw error;
        console.error("Create product error:", error);
        throw new ProductError(error?.message || "Internal server error during product creation");
    }
};

// ====================== READ OPERATIONS ======================
/**
 * Get all products with advanced filtering and pagination
 */
export const getAllProducts = async (options: ProductFilterOptions = {}) => {
    try {
        const page = Math.max(1, Number(options.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
        const skip = (page - 1) * limit;

        const where: Prisma.ProductWhereInput = {
            ...(options.categoryId && { categoryId: options.categoryId }),
            // ...(options.vendorId && { vendorId: options.vendorId }),
            ...(options.featured !== undefined && {
                featured: options.featured === "true" || options.featured === true
            }),
            ...(options.isAvailable !== undefined && {
                productIsAvailable: options.isAvailable === "true" || options.isAvailable === true
            }),
            ...(options.search && {
                OR: [
                    { title: { contains: options.search, mode: "insensitive" } },
                    { description: { contains: options.search, mode: "insensitive" } },
                    { sku: { contains: options.search, mode: "insensitive" } },
                ]
            }),
            ...(options.showDisabled !== "true" && options.showDisabled !== true && { disableProduct: false })
        };

        if (options.minPrice || options.maxPrice) {
            where.subProducts = {
                some: {
                    price: {
                        ...(options.minPrice && { gte: Number(options.minPrice) }),
                        ...(options.maxPrice && { lte: Number(options.maxPrice) }),
                    }
                }
            };
        }

        let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };

        switch (options.sortBy) {
            case "oldest": orderBy = { createdAt: "asc" }; break;
            case "rating": orderBy = { rating: "desc" }; break;
            case "sold": orderBy = { sold: "desc" }; break;
            case "discount": orderBy = { discount: "desc" }; break;
            case "price_asc": orderBy = { subProducts: { _count: "asc" } as any }; break;
            case "price_desc": orderBy = { subProducts: { _count: "desc" } as any }; break;
            case "newest": default: orderBy = { createdAt: "desc" };
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    subProducts: {
                        select: {
                            sku: true,
                            type: true,
                            qty: true,
                            price: true,
                            images: true
                        }
                    },
                    category: { select: { id: true, name: true, slug: true } }
                }
            }),
            prisma.product.count({ where })
        ]);
        if (!products) {
            throw new ProductError("Products not found", apiStatusCode.NotFound, "NOT_FOUND");
        }
        return {
            data: products,
            message: "Products fetched successfully",
            statusCode: apiStatusCode.Success,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        };
    } catch (error: any) {
        console.error("Get all products error:", error);
        throw new ProductError(error?.message || "Failed to fetch products");
    }
};

//admin get all products
export const getAllProductsByAdmin = async (options: ProductFilterOptions = {}) => {
    try {
        const page = Math.max(1, Number(options.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
        const skip = (page - 1) * limit;

        const where: Prisma.ProductWhereInput = {
            ...(options.categoryId && { categoryId: options.categoryId }),
            // ...(options.vendorId && { vendorId: options.vendorId }),
            ...(options.featured !== undefined && {
                featured: options.featured === "true" || options.featured === true
            }),
            ...(options.isAvailable !== undefined && {
                productIsAvailable: options.isAvailable === "true" || options.isAvailable === true
            }),
            ...(options.search && {
                OR: [
                    { title: { contains: options.search, mode: "insensitive" } },
                    { description: { contains: options.search, mode: "insensitive" } },
                    { sku: { contains: options.search, mode: "insensitive" } },
                ]
            }),
            // ...(options.disableProduct !== undefined ? {
            //     disableProduct: options.disableProduct === "true" || options.disableProduct === true
            // } : (options.showDisabled !== "true" && options.showDisabled !== true && { disableProduct: false }))
        };

        if (options.minPrice || options.maxPrice) {
            where.subProducts = {
                some: {
                    price: {
                        ...(options.minPrice && { gte: Number(options.minPrice) }),
                        ...(options.maxPrice && { lte: Number(options.maxPrice) }),
                    }
                }
            };
        }

        let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };

        switch (options.sortBy) {
            case "oldest": orderBy = { createdAt: "asc" }; break;
            case "rating": orderBy = { rating: "desc" }; break;
            case "sold": orderBy = { sold: "desc" }; break;
            case "discount": orderBy = { discount: "desc" }; break;
            case "price_asc": orderBy = { subProducts: { _count: "asc" } as any }; break;
            case "price_desc": orderBy = { subProducts: { _count: "desc" } as any }; break;
            case "newest": default: orderBy = { createdAt: "desc" };
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                include: {
                    category: { select: { id: true, name: true, slug: true, parentCategory: { select: { id: true, name: true, slug: true } } } },
                    // vendor: { select: { id: true, name: true } },
                }
            }),
            prisma.product.count({ where })
        ]);
        if (!products) {
            throw new ProductError("Products not found", apiStatusCode.NotFound, "NOT_FOUND");
        }
        return {
            data: products,
            message: "Products fetched successfully",
            statusCode: apiStatusCode.Success,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        };
    } catch (error: any) {
        console.error("Get all products error:", error);
        throw new ProductError(error?.message || "Failed to fetch products");
    }
}

/**
 * Get featured products
 */
export const getFeaturedProducts = async (limit?: number, categoryId?: string) => {
    try {
        return await prisma.product.findMany({
            where: {
                featured: true,
                disableProduct: false,
                ...(categoryId ? { categoryId } : {})
            },
            ...(limit && { take: limit }),
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                title: true,
                slug: true,
                subProducts: {
                    select: {
                        sku: true,
                        type: true,
                        qty: true,
                        price: true,
                        images: true
                    }
                },
                category: { select: { id: true, name: true, slug: true } }
            }
        });
    } catch (error: any) {
        throw new ProductError(error?.message || "Failed to fetch featured products");
    }
};

export const getFeaturedProductsBySlug = async (slug: string, limit?: number) => {
    try {
        return await prisma.product.findMany({
            where: {
                featured: true,
                disableProduct: false,
                category: {
                    slug
                }
            },
            ...(limit && { take: limit }),
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                title: true,
                slug: true,
                subProducts: {
                    select: {
                        sku: true,
                        type: true,
                        qty: true,
                        price: true,
                        images: true
                    }
                },
                category: { select: { id: true, name: true, slug: true } }
            }
        });
    } catch (error: any) {
        throw new ProductError(error?.message || "Failed to fetch featured products");
    }
};


/**
 * Search products
 * 
 * This function uses MongoDB Atlas Search for efficient full-text searching across multiple fields (title, SKU, description) with support for fuzzy matching and relevance-based ranking. It also ensures that only available and non-disabled products are returned.
 */

export const searchProducts = async (query: string, limit: number = 20) => {
    try {
        if (!query || query.trim().length < 2) {
            throw new ProductError("Search query must be at least 2 characters", apiStatusCode.BadRequest);
        }

        const db = await getMongoDb();

        const products = await db
            .collection("products")
            .aggregate([
                {
                    $search: {
                        index: "product_search",
                        text: {
                            query,
                            path: [
                                "title",
                                "sku",
                                "slug"
                            ],
                            fuzzy: {
                                maxEdits: 2
                            }
                        }
                    }
                },
                {
                    $match: {
                        disableProduct: false,
                        productIsAvailable: true
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        slug: 1,
                        sku: 1,
                    }
                },
                {
                    $limit: limit
                }
            ])
            .toArray()

        return products;

    } catch (error: any) {
        if (error instanceof ProductError) throw error;
        console.error("Search products error:", error);
        throw new ProductError(error?.message || "Failed to search products");
    }
}

/**
 * Get single product by ID
 */
export const getProductById = async (id: string) => {
    if (!id) throw new ProductError("Product ID is required", apiStatusCode.BadRequest);

    const product = await prisma.product.findFirst({
        where: { id },
        include: {
            category: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    subCategories: { select: { id: true, name: true, slug: true, products: { select: { id: true, slug: true, title: true, subProducts: true } } } }
                }
            },
            // vendor: { select: { id: true, name: true } },
            productReviews: {
                where: { isApproved: true },
                include: { user: { select: { id: true, username: true, email: true } } },
                orderBy: { createdAt: "desc" },
                take: 10
            }
        }
    });

    if (!product) throw new ProductError("Product not found", apiStatusCode.NotFound);
    return product;
};

/**
 * Get product by slug
 */
export const getProductBySlug = async (slug: string) => {
    if (!slug) throw new ProductError("Product slug is required", apiStatusCode.BadRequest);

    const product = await prisma.product.findFirst({
        where: { slug: slug.toLowerCase() },
        include: {
            category: {
                select: {
                    id: true,
                    parentCategory: {
                        select: {
                            id: true,
                            subCategories: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                    products: {
                                        select: { id: true, slug: true, title: true, subProducts: true }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            // vendor: { select: { id: true, name: true } },
            productReviews: {
                where: { isApproved: true },
                include: { user: { select: { id: true, username: true } } },
                orderBy: { createdAt: "desc" }
            }
        }
    });

    if (!product) throw new ProductError("Product not found", apiStatusCode.NotFound);

    // ── Fetch related products (same subcategory/category) in the same API call ──
    const ingredients = product.ingredients as any;
    const subcategoryId = product.category?.parentCategory
        ? product.categoryId                          // product is already in a subcategory
        : ingredients?.subcategory || null;            // fallback to ingredients.subcategory
    const parentCategoryId = product.category?.parentCategory?.id || product.categoryId;

    let relatedProducts: any[] = [];

    // Try subcategory first
    if (subcategoryId) {
        relatedProducts = await prisma.product.findMany({
            where: { categoryId: subcategoryId, slug: { not: slug } },
            select: {
                id: true, title: true, slug: true, discount: true,
                generalImages: true, subProducts: true,
                category: { select: { id: true, name: true, slug: true } }
            },
            take: 8
        });
    }

    // If not enough, supplement from parent category
    if (relatedProducts.length < 4 && parentCategoryId && parentCategoryId !== subcategoryId) {
        const existingIds = relatedProducts.map(p => p.id);
        const parentProducts = await prisma.product.findMany({
            where: {
                categoryId: parentCategoryId,
                slug: { not: slug },
                id: { notIn: existingIds }
            },
            select: {
                id: true, title: true, slug: true, discount: true,
                generalImages: true, subProducts: true,
                category: { select: { id: true, name: true, slug: true } }
            },
            take: 8 - relatedProducts.length
        });
        relatedProducts = [...relatedProducts, ...parentProducts];
    }

    return { ...product, relatedProducts };
};

// ====================== UPDATE OPERATIONS ======================
/**
 * Update product
 */
export const updateProduct = async (id: string, data: Partial<{
    title: string;
    slug: string;
    description: string;
    longDescription?: string;
    // vendorId: string;
    discount: number;
    featured: boolean;
    productIsAvailable: boolean;
    categoryId: string;
    generalImages: any[];
    descriptionImages: any[];
    subProducts: any[];
    ingredients: any;
    benefits: string[];
    brand: string;
    subcategory: string;
    disableProduct: boolean;
    disableProductDate: Date;
}>) => {
    try {
        if (!id) throw new ProductError("Product ID is required", apiStatusCode.BadRequest);

        const product = await prisma.product.findFirst({ where: { id } });
        if (!product) throw new ProductError("Product not found", apiStatusCode.NotFound);

        const processImages = (imgs: any[]) => imgs?.map(img =>
            typeof img === 'string' ? img : (img?.url || img?.public_url)
        ).filter(Boolean);

        const updateData: any = {
            ...(data.title && { title: data.title.trim() }),
            ...(data.slug && { slug: data.slug.toLowerCase().trim() }),
            ...(data.description && { description: data.description.trim() }),
            ...(data.longDescription && { longDescription: data.longDescription.trim() }),
            // ...(data.vendorId && { vendorId: data.vendorId }),
            ...((data.subcategory || data.categoryId) && { categoryId: data.subcategory || data.categoryId }),
            ...(data.featured !== undefined && { featured: data.featured }),
            ...(data.productIsAvailable !== undefined && { productIsAvailable: data.productIsAvailable }),
            ...(data.discount !== undefined && { discount: Math.max(0, Math.min(100, data.discount)) }),
            ...(data.generalImages && { generalImages: processImages(data.generalImages) }),
            ...(data.descriptionImages && { descriptionImages: processImages(data.descriptionImages) }),
            ...(data.subProducts && { subProducts: data.subProducts }),
            ...((data.ingredients || data.benefits || data.brand || data.subcategory) && {
                ingredients: {
                    ...(typeof product.ingredients === 'object' ? (product.ingredients as any) : {}),
                    ...(data.ingredients && { details: data.ingredients }),
                    ...(data.benefits && { benefits: data.benefits }),
                    ...(data.brand && { brand: data.brand }),
                    ...(data.subcategory && { subcategory: data.subcategory }),
                }
            }),
            ...(data.disableProduct !== undefined && {
                disableProduct: data.disableProduct,
                disableProductDate: data.disableProduct ? new Date() : null
            })
        };

        // Standard validation checks
        if (data.slug && data.slug.toLowerCase().trim() !== product.slug) {
            const existing = await prisma.product.findFirst({ where: { slug: data.slug.toLowerCase().trim(), id: { not: id } } });
            if (existing) throw new ProductError("Slug already in use", apiStatusCode.Conflict);
        }

        if (data.categoryId) {
            const cat = await prisma.category.findUnique({ where: { id: data.categoryId } as any });
            if (!cat) throw new ProductError("Category not found", apiStatusCode.NotFound);
        }

        if (data.subProducts) {
            data.subProducts.forEach(s => {
                if (!s.sku || !s.type || s.qty < 0 || s.price <= 0) throw new ProductError("Invalid sub-product data", apiStatusCode.BadRequest);
            });
        }


        return await prisma.product.update({
            where: { id },
            data: updateData,
        });
    } catch (error: any) {
        if (error instanceof ProductError) throw error;
        console.error("Update product error:", error);
        throw new ProductError(error?.message || "Failed to update product");
    }
};

// ====================== DELETE OPERATIONS ======================
/**
 * Soft delete product
 */
export const deleteProduct = async (id: string) => {
    try {
        const product = await prisma.product.findFirst({ where: { id } });
        if (!product) throw new ProductError("Product not found", apiStatusCode.NotFound);

        await prisma.product.delete({
            where: { id }
        });

        return { success: true, message: "Product deleted successfully" };
    } catch (error: any) {
        throw new ProductError(error?.message || "Failed to delete product");
    }
};

// ====================== REVIEW OPERATIONS ======================
export const addProductReview = async (productId: string, userId: string, data: {
    rating: number;
    comment: string;
}) => {
    try {
        if (!productId || !userId) throw new ProductError("Missing IDs", apiStatusCode.BadRequest);

        const [product, user] = await Promise.all([
            prisma.product.findFirst({ where: { id: productId } }),
            prisma.user.findFirst({ where: { id: userId } })
        ]);

        if (!product) throw new ProductError("Product not found", apiStatusCode.NotFound);
        if (!user) throw new ProductError("User not found", apiStatusCode.NotFound);
        if (user.isBlocked) throw new ProductError("User blocked", apiStatusCode.Locked);

        const existing = await prisma.productReview.findFirst({ where: { productId, userId } });
        if (existing) throw new ProductError("Already reviewed", apiStatusCode.Conflict);

        const review = await prisma.productReview.create({
            data: {
                productId,
                userId,
                rating: data.rating,
                comment: data.comment.trim(),
                isApproved: true
            }
        });

        await updateProductRating(productId);
        return review;
    } catch (error: any) {
        if (error instanceof ProductError) throw error;
        throw new ProductError(error?.message || "Failed to add review");
    }
};

// ====================== REVIEW OPERATIONS ======================
export const getProductReviews = async (productId: string) => {
    try {
        if (!productId) throw new ProductError("Missing IDs", apiStatusCode.BadRequest);

        const reviews = await prisma.productReview.findMany({
            where: { productId },
            include: {
                user: {
                    select: { id: true, username: true },
                },
                product: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        generalImages: true,
                        subProducts: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return reviews;
    } catch (error: any) {
        throw new ProductError(error?.message || "Failed to fetch reviews");
    }
};

export const getAllReviews = async () => {
    try {
        const reviews = await prisma.productReview.findMany({
            include: {
                user: {
                    select: { id: true, username: true, email: true },
                },
                product: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        generalImages: true,
                        subProducts: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return reviews;
    } catch (error: any) {
        throw new ProductError(error?.message || "Failed to fetch reviews");
    }
};

export const updateReview = async (reviewId: string, data: { rating: number; comment: string }) => {
    try {
        if (!reviewId) throw new ProductError("Missing IDs", apiStatusCode.BadRequest);

        const review = await prisma.productReview.findFirst({ where: { id: reviewId } });
        if (!review) throw new ProductError("Review not found", apiStatusCode.NotFound);

        await prisma.productReview.update({
            where: { id: reviewId },
            data: {
                rating: data.rating,
                comment: data.comment.trim(),
                isApproved: true
            }
        });

        await updateProductRating(review.productId);
        return { success: true, message: "Review updated successfully" };
    } catch (error: any) {
        throw new ProductError(error?.message || "Failed to update review");
    }
};

export const deleteReview = async (reviewId: string) => {
    try {
        if (!reviewId) throw new ProductError("Missing IDs", apiStatusCode.BadRequest);

        const review = await prisma.productReview.findFirst({ where: { id: reviewId } });
        if (!review) throw new ProductError("Review not found", apiStatusCode.NotFound);

        await prisma.productReview.delete({
            where: { id: reviewId }
        });

        await updateProductRating(review.productId);
        return { success: true, message: "Review deleted successfully" };
    } catch (error: any) {
        throw new ProductError(error?.message || "Failed to delete review");
    }
};

// ====================== HELPERS ======================
const updateProductRating = async (productId: string) => {
    const reviews = await prisma.productReview.findMany({
        where: { productId, isApproved: true },
        select: { rating: true }
    });

    const numReviews = reviews.length;
    const rating = numReviews > 0
        ? Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / numReviews) * 10) / 10
        : 0;

    await prisma.product.update({
        where: { id: productId },
        data: { rating, numReviews }
    });
};

export const updateProductSoldCount = async (productId: string, quantity: number) => {
    await prisma.product.update({
        where: { id: productId },
        data: { sold: { increment: quantity } }
    });
};

/**
 * Get products by category with pagination
 */
export const getProductsByCategory = async (categoryId: string, options: ProductFilterOptions = {}) => {
    return getAllProducts({ ...options, categoryId });
};

/**
 * Get product statistics
 */
export const getProductStatistics = async () => {
    const [total, featured, outOfStock, reviews] = await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { featured: true } }),
        prisma.product.count({ where: { productIsAvailable: false } }),
        prisma.productReview.count()
    ]);

    return {
        totalProducts: total,
        featuredProducts: featured,
        outOfStockProducts: outOfStock,
        totalReviews: reviews
    };
};

// ====================== EXPORT ======================
export default {
    createProduct,
    getAllProducts,
    getFeaturedProducts,
    // searchProducts, 
    getProductById,
    getProductBySlug,
    updateProduct,
    deleteProduct,
    addProductReview,
    updateProductSoldCount,
    getProductsByCategory,
    getProductStatistics
};