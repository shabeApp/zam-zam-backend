import { Router } from "express";
import * as topBarNotificationController from "./topBarNotification.controller";
import { validateZod } from "../../middleware/validate-zod.middleware";
import * as topBarNotificationZod from "./topBarNotification.zod";
import { authGuard } from "../../middleware/auth.guard";
import { notificationReadLimiter, adminWriteLimiter } from "../../middleware/rateLimiter.middleware";

const topBarNotificationRouter = Router();

// ====================== PUBLIC ROUTES ======================
topBarNotificationRouter.get("/",    notificationReadLimiter, topBarNotificationController.getAllTopBarNotifications);
topBarNotificationRouter.get("/:id", notificationReadLimiter, topBarNotificationController.getTopBarNotificationById);

// ====================== ADMIN ROUTES ======================
topBarNotificationRouter.post("/",    authGuard(['ADMIN']), adminWriteLimiter, validateZod(topBarNotificationZod.createTopBarNotificationSchema), topBarNotificationController.createTopBarNotification);
topBarNotificationRouter.put("/:id",  authGuard(['ADMIN']), adminWriteLimiter, validateZod(topBarNotificationZod.updateTopBarNotificationSchema), topBarNotificationController.updateTopBarNotification);
topBarNotificationRouter.delete("/:id", authGuard(['ADMIN']), adminWriteLimiter,                                                                   topBarNotificationController.deleteTopBarNotification);

export default topBarNotificationRouter;
