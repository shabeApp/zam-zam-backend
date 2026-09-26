import { Router } from "express";
import * as reviewController from "./review.controller";
import { validateZod } from "../../middleware/validate-zod.middleware";
import * as reviewZod from "./review.zod";
import { authGuard } from "../../middleware/auth.guard";
import {
    publicReadLimiter,
    reviewPostLimiter,
    adminWriteLimiter,
} from "../../middleware/rateLimiter.middleware";

const reviewRouter = Router();

// ====================== PUBLIC ROUTES ======================
reviewRouter.get("/product/:id", publicReadLimiter, reviewController.getReviewsByProduct);

// ====================== AUTHENTICATED USER ROUTES ======================
reviewRouter.get("/me",              authGuard(['USER', 'ADMIN', 'MODERATOR']),                                                                 reviewController.getReviewsByUser);
reviewRouter.post("/product/:id",    authGuard(['USER', 'ADMIN', 'MODERATOR']), reviewPostLimiter, validateZod(reviewZod.createReviewSchema),   reviewController.createReview);
reviewRouter.delete("/:id",          authGuard(['USER', 'ADMIN', 'MODERATOR']),                                                                 reviewController.deleteReview);

// ====================== ADMIN ROUTES ======================
reviewRouter.get("/admin/all",         authGuard(['ADMIN']), validateZod(reviewZod.reviewQuerySchema), reviewController.getAllReviews);
reviewRouter.put("/admin/approve/:id", authGuard(['ADMIN']), adminWriteLimiter,                        reviewController.approveReview);

export default reviewRouter;
