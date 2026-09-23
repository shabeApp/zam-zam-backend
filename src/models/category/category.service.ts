import prisma from "../../prisma/client";
import { Prisma } from "@prisma/client";
import { apiStatusCode } from "../../lib/apiCode.lib";

// ================= TYPES =================
export interface CategoryFilterOptions {
  page?: number;
  limit?: number;
  featured?: boolean | string;
  includeProducts?: boolean | string;
  search?: string;
  parentId?: string | null;
}

// ================= ERROR =================
export class CategoryError extends Error {
  constructor(
    message: string,
    public statusCode: number = apiStatusCode.InternalServerError,
    public code?: string
  ) {
    super(message);
    this.name = "CategoryError";
  }
}

// ================= UTILS =================
const isValidObjectId = (id: string): boolean => /^[a-f0-9]{24}$/i.test(id);
const normalizeName = (value: string): string => value?.trim() || "";

const normalizeSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

// ================= CREATE =================
/**
 * Create a main category (root level)
 */
export const createMainCategory = async (data: {
  name: string;
  image?: string;
  slug: string;
  featured?: boolean;
}) => {
  try {
    if (!data.name || !data.slug) {
      throw new CategoryError("Name and slug are required", apiStatusCode.BadRequest);
    }

    const name = normalizeName(data.name);
    const slug = normalizeSlug(data.slug);

    // Global unique slug check
    const existingSlug = await prisma.category.findFirst({
      where: { slug },
    });
    if (existingSlug) throw new CategoryError("Slug already in use", apiStatusCode.Conflict);

    // Name unique among main categories
    const existingName = await prisma.category.findFirst({
      where: { name, parentCategoryId: null },
    });
    if (existingName) throw new CategoryError("Main category name already exists", apiStatusCode.Conflict);

    return await prisma.category.create({
      data: {
        name,
        image: data.image || "",
        slug,
        featured: data.featured ?? false,
        parentCategoryId: null,
      },
    });
  } catch (e: any) {
    if (e instanceof CategoryError) throw e;
    throw new CategoryError(e.message || "Failed to create main category");
  }
};

/**
 * Create a sub-category under a parent
 */
export const createSubCategory = async (data: {
  name: string;
  slug: string;
  image?: string;
  parentCategoryId: string;
  featured?: boolean;
}) => {
  try {
    if (!data.name || !data.slug || !data.parentCategoryId) {
      throw new CategoryError("Missing required fields", apiStatusCode.BadRequest);
    }

    const name = normalizeName(data.name);
    const slug = normalizeSlug(data.slug);

    const parent = await prisma.category.findUnique({
      where: { id: data.parentCategoryId },
    });
    if (!parent) {
      throw new CategoryError("Parent category not found", apiStatusCode.NotFound);
    }

    // Global unique slug check
    const existingSlug = await prisma.category.findFirst({
      where: { slug },
    });
    if (existingSlug) throw new CategoryError("Slug already in use", apiStatusCode.Conflict);

    // Name unique under this parent
    const existingName = await prisma.category.findFirst({
      where: {
        name,
        parentCategoryId: data.parentCategoryId,
      },
    });
    if (existingName) throw new CategoryError("Name already exists under this parent", apiStatusCode.Conflict);

    return await prisma.category.create({
      data: {
        name,
        slug,
        image: data.image || "",
        featured: data.featured ?? false,
        parentCategoryId: data.parentCategoryId,
      },
    });
  } catch (e: any) {
    if (e instanceof CategoryError) throw e;
    throw new CategoryError(e.message || "Failed to create sub-category");
  }
};

// ================= READ =================
/**
 * Get all categories with filtering and pagination
 */
export const getAllCategories = async (options: CategoryFilterOptions = {}) => {
  try {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Number(options.limit) || 10);
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {};

    if (options.featured !== undefined) {
      where.featured = options.featured === "true" || options.featured === true;
    }

    if (options.parentId !== undefined) {
      where.parentCategoryId =
        options.parentId === "null" ? null : options.parentId;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { slug: { contains: options.search, mode: "insensitive" } }
      ];
    }

    const [data, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          featured: true,
          parentCategoryId: true,
          createdAt: true,
          _count: {
            select: {
              products: true,
              subCategories: true
            }
          }
        }
      }),
      prisma.category.count({ where })
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };

  } catch (error: any) {
    throw new CategoryError(error.message || "Failed to fetch categories");
  }
};
/**
 * Get category tree (nested structure)
 */
export const getCategoryTree = async () => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        featured: true,
        parentCategoryId: true,
        _count: {
          select: {
            products: true,
            subCategories: true
          }
        }
      },
      orderBy: { name: "asc" }
    });

    const categoryMap = new Map<string, any>();
    const tree: any[] = [];

    // Initialize map
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, subCategories: [] });
    });

    // Build forest (multiple root trees)
    categoryMap.forEach(cat => {
      if (cat.parentCategoryId && cat.parentCategoryId !== cat.id) {
        const parent = categoryMap.get(cat.parentCategoryId);
        if (parent) {
          parent.subCategories.push(cat);
        } else {
          tree.push(cat);
        }
      } else {
        tree.push(cat);
      }
    });

    return tree;
  } catch (error: any) {
    console.error("Tree building error:", error.message);
    throw new CategoryError(error.message || "Failed to build category tree");
  }
};

//get short Data
export const getCategoryTreeShortData = async () => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        parentCategoryId: true,
      },
      orderBy: { name: "asc" }
    });

    const categoryMap = new Map<string, any>();
    const tree: any[] = [];

    // Initialize map
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, subCategories: [] });
    });

    // Build forest (multiple root trees)
    categoryMap.forEach(cat => {
      if (cat.parentCategoryId && cat.parentCategoryId !== cat.id) {
        const parent = categoryMap.get(cat.parentCategoryId);
        if (parent) {
          parent.subCategories.push(cat);
        } else {
          tree.push(cat);
        }
      } else {
        tree.push(cat);
      }
    });

    return tree;
  } catch (error: any) {
    console.error("Tree building error:", error.message);
    throw new CategoryError(error.message || "Failed to build category tree");
  }
};

/**
 * Get single category by ID
 */
export const getCategoryById = async (id: string) => {
  if (!id) throw new CategoryError("Category ID is required", apiStatusCode.BadRequest);
  if (!isValidObjectId(id)) throw new CategoryError("Invalid category ID format", apiStatusCode.BadRequest);

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      parentCategory: true,
      subCategories: true,
      _count: { select: { products: true } }
    }
  });

  if (!category) {
    throw new CategoryError("Category not found", apiStatusCode.NotFound);
  }

  return category;
};

export const getSubCategories = async (id: string) => {
  if (!id) throw new CategoryError("Category ID is required", apiStatusCode.BadRequest);
  if (!isValidObjectId(id)) throw new CategoryError("Invalid category ID format", apiStatusCode.BadRequest);

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      subCategories: true,
      parentCategory: true,
      products: true,
      _count: { select: { products: true } }
    }
  });

  if (!category) {
    throw new CategoryError("Category not found", apiStatusCode.NotFound);
  }

  return category;
};

/**
 * Get category by Slug
 */
export const getCategoryBySlug = async (slug: string) => {
  if (!slug) throw new CategoryError("Slug is required", apiStatusCode.BadRequest);

  const category = await prisma.category.findFirst({
    where: { slug: slug.toLowerCase().trim() },
    include: {
      subCategories: true,
      _count: { select: { products: true } }
    }
  });

  if (!category) throw new CategoryError("Category not found", apiStatusCode.NotFound);
  return category;
};

// ================= UPDATE =================
/**
 * Update existing category
 */
export const updateCategory = async (id: string, data: Partial<{
  name: string;
  slug: string;
  image: string;
  featured: boolean;
  parentCategoryId: string | null;
}>) => {
  try {
    if (!id) throw new CategoryError("ID required", apiStatusCode.BadRequest);

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new CategoryError("Category not found", apiStatusCode.NotFound);
    }

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = normalizeName(data.name);
    if (data.slug !== undefined) updateData.slug = normalizeSlug(data.slug);
    if (data.image !== undefined) updateData.image = data.image;
    if (data.featured !== undefined) updateData.featured = data.featured;
    
    if (data.parentCategoryId !== undefined) {
      // Prevent self-parenting
      if (data.parentCategoryId === id) {
        throw new CategoryError("Cannot set category as its own parent", apiStatusCode.BadRequest);
      }
      
      // Validate parent exists if not null
      if (data.parentCategoryId !== null) {
        const parent = await prisma.category.findUnique({ where: { id: data.parentCategoryId } });
        if (!parent) {
          throw new CategoryError("Parent category not found", apiStatusCode.NotFound);
        }
      }
      updateData.parentCategoryId = data.parentCategoryId;
    }

    // Duplicate checks
    if (updateData.name && updateData.name !== category.name) {
      const existing = await prisma.category.findFirst({
        where: {
          name: updateData.name,
          parentCategoryId: updateData.parentCategoryId ?? category.parentCategoryId,
          id: { not: id }
        }
      });
      if (existing) throw new CategoryError("Category name already exists at this level", apiStatusCode.Conflict);
    }

    if (updateData.slug && updateData.slug !== category.slug) {
      const existing = await prisma.category.findFirst({
        where: { slug: updateData.slug, id: { not: id } }
      });
      if (existing) throw new CategoryError("Slug already in use", apiStatusCode.Conflict);
    }

    return await prisma.category.update({
      where: { id },
      data: updateData,
    });
  } catch (e: any) {
    if (e instanceof CategoryError) throw e;
    throw new CategoryError(e.message || "Failed to update category");
  }
};

// ================= DELETE =================

/**
 * Hard delete a category (Cascades to subcategories and products)
 */
export const hardDeleteCategory = async (id: string) => {
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id } });
    if (!category) throw new CategoryError("Category not found", apiStatusCode.NotFound);

    const deleteRecursive = async (catId: string) => {
      const subs = await tx.category.findMany({
        where: { parentCategoryId: catId },
        select: { id: true }
      });

      for (const sub of subs) {
        await deleteRecursive(sub.id);
      }

      await tx.product.deleteMany({ where: { categoryId: catId } });
      await tx.category.delete({ where: { id: catId } });
    };

    await deleteRecursive(id);
    return { message: "Category and all its descendants deleted permanently" };
  });
};

// ================= STATS =================
export const getCategoryStatistics = async () => {
  const [total, main, sub, products] = await Promise.all([
    prisma.category.count(),
    prisma.category.count({ where: { parentCategoryId: null } }),
    prisma.category.count({ where: { parentCategoryId: { not: null } } }),
    prisma.product.count()
  ]);

  return {
    totalCategories: total,
    mainCategories: main,
    subCategories: sub,
    totalProductsInSystem: products
  };
};

export default {
  createMainCategory,
  createSubCategory,
  getAllCategories,
  getCategoryTree,
  getCategoryById,
  getSubCategories,
  getCategoryBySlug,
  updateCategory,
  hardDeleteCategory,
  getCategoryStatistics,
  getCategoryTreeShortData
};

