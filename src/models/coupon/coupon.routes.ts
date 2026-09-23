import { Router } from "express";
import * as couponController from "../../controllers/coupon.controller";
import { validateZod } from "../../middleware/validate-zod.middleware";
import * as couponZod from "../../validators/coupon.zod";
import { authGuard } from "../../middleware/auth.guard";
import {
    couponValidateLimiter,
    adminWriteLimiter,
} from "../../middleware/rateLimiter.middleware";

const couponRouter = Router();

// ====================== USER ROUTES ======================
couponRouter.post("/validate", authGuard(['USER', 'ADMIN', 'MODERATOR']), couponValidateLimiter, validateZod(couponZod.validateCouponSchema), couponController.validateCoupon);

// ====================== ADMIN ROUTES ======================
couponRouter.get("/admin/stats", authGuard(['ADMIN']),                                                          couponController.getCouponStats);
couponRouter.post("/",           authGuard(['ADMIN']), adminWriteLimiter, validateZod(couponZod.createCouponSchema), couponController.createCoupon);
couponRouter.get("/",            authGuard(['ADMIN']),                                                          couponController.getAllCoupons);
couponRouter.get("/:id",         authGuard(['ADMIN']),                                                          couponController.getCouponById);
couponRouter.put("/:id",         authGuard(['ADMIN']), adminWriteLimiter, validateZod(couponZod.updateCouponSchema), couponController.updateCoupon);
couponRouter.delete("/:id",      authGuard(['ADMIN']), adminWriteLimiter,                                       couponController.deleteCoupon);

export default couponRouter;
