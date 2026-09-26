import { Router } from "express";
import * as categoryController from "./category.controller";
import { validateZod } from "../../middleware/validate-zod.middleware";
import * as categoryZod from "./category.zod";
import { authGuard } from "../../middleware/auth.guard";
import { publicReadLimiter, adminWriteLimiter } from "../../middleware/rateLimiter.middleware";

const router = Router();

// ====================== PUBLIC ROUTES ======================
router.get("/",                publicReadLimiter, categoryController.getAllCategories);
router.get("/tree",            publicReadLimiter, categoryController.getCategoryTree);
router.get("/tree-short-data", publicReadLimiter, categoryController.getCategoryTreeShortData);
router.get("/slug/:slug",      publicReadLimiter, categoryController.getCategoryBySlug);

// ====================== ADMIN ROUTES ======================
router.get("/admin/stats", authGuard(['ADMIN']), categoryController.getCategoryStatistics);

// ✅ CREATE (IMPORTANT: BEFORE :id)
router.post("/main", authGuard(['ADMIN']), adminWriteLimiter, validateZod(categoryZod.createMainCategorySchema), categoryController.createMainCategory);
router.post("/sub",  authGuard(['ADMIN']), adminWriteLimiter, validateZod(categoryZod.createSubCategorySchema),  categoryController.createSubCategory);

// ====================== UPDATE + DELETE ======================
router.put("/:id",    authGuard(['ADMIN']), adminWriteLimiter, validateZod(categoryZod.updateCategorySchema), categoryController.updateCategory);
router.delete("/:id", authGuard(['ADMIN']), adminWriteLimiter,                                                 categoryController.hardDeleteCategory);

// ❗ ALWAYS LAST (dynamic params)
router.get("/sub/:id", publicReadLimiter, categoryController.getSubCategories);
router.get("/:id",     publicReadLimiter, categoryController.getCategoryById);

export default router;