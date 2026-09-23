import { Router } from "express";
import * as bannerController from "../../controllers/banner.controller";
import { validateZod } from "../../middleware/validate-zod.middleware";
import * as bannerZod from "../../validators/banner.zod";
import { authGuard } from "../../middleware/auth.guard";
import { publicReadLimiter, adminWriteLimiter } from "../../middleware/rateLimiter.middleware";

const bannerRouter = Router();

// ====================== PUBLIC ROUTES ======================
bannerRouter.get("/",    publicReadLimiter, bannerController.getAllBanners);
bannerRouter.get("/:id", publicReadLimiter, bannerController.getBannerById);

// ====================== ADMIN ROUTES ======================
bannerRouter.post("/",    authGuard(['ADMIN']), adminWriteLimiter, validateZod(bannerZod.createBannerSchema), bannerController.createBanner);
bannerRouter.put("/:id",  authGuard(['ADMIN']), adminWriteLimiter, validateZod(bannerZod.updateBannerSchema), bannerController.updateBanner);
bannerRouter.delete("/:id", authGuard(['ADMIN']), adminWriteLimiter,                                          bannerController.deleteBanner);

export default bannerRouter;
