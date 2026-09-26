import { Router } from "express";
import * as productController from "./product.controller";
import { validateZod } from "../../middleware/validate-zod.middleware";
import * as productZod from "./product.zod";
import { authGuard } from "../../middleware/auth.guard";
import {
    productReadLimiter,
    searchLimiter,
    productWriteLimiter,
    reviewSubmitLimiter,
} from "../../middleware/rateLimiter.middleware";

const productRouter = Router();

// ====================== PUBLIC ROUTES ======================
productRouter.get("/",               productReadLimiter,  productController.getAllProducts);
productRouter.get("/featured",       productReadLimiter,  productController.getFeaturedProducts);
productRouter.get("/featured/:slug", productReadLimiter,  productController.getFeaturedProductsBySlug);
productRouter.get("/search",         searchLimiter,       productController.searchProducts);
productRouter.get("/slug/:slug",     productReadLimiter,  productController.getProductBySlug);

// ====================== ADMIN ROUTES ======================
productRouter.get("/reviews",             authGuard(["ADMIN"]),                                                                productController.getAllReviews);
productRouter.get("/admin",               authGuard(["ADMIN"]),                                                                productController.getAllProductsByAdmin);
productRouter.post("/",                   authGuard(["ADMIN"]), productWriteLimiter, validateZod(productZod.createProductSchema), productController.createProduct);
productRouter.put("/review/:reviewId",    authGuard(["ADMIN"]), productWriteLimiter,                                            productController.updateReview);
productRouter.delete("/review/:reviewId", authGuard(["ADMIN"]), productWriteLimiter,                                            productController.deleteReview);

// ====================== AUTHENTICATED USER ROUTES ======================
productRouter.post("/:id/review", authGuard(["USER", "ADMIN"]), reviewSubmitLimiter, validateZod(productZod.addReviewSchema), productController.addReview);

// ====================== DYNAMIC PUBLIC ROUTES (MUST BE LAST) ======================
productRouter.get("/:id/reviews", productReadLimiter, productController.getProductReviews);
productRouter.get("/:id",         productReadLimiter, productController.getProductById);

// ====================== DYNAMIC ADMIN ROUTES (MUST BE LAST) ======================
productRouter.put("/:id",    authGuard(["ADMIN"]), productWriteLimiter, validateZod(productZod.updateProductSchema), productController.updateProduct);
productRouter.delete("/:id", authGuard(["ADMIN"]), productWriteLimiter,                                              productController.deleteProduct);

export default productRouter;