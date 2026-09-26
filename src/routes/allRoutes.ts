import { Router } from "express";
import userRouter from "../models/auth/user.routes";
import couponRouter from "../models/coupon/coupon.routes";
import categoryRouter from "../models/category/category.routes";
// import categoryRouter from "./category.routes";
import bannerRouter from "../models/banner/banner.routes";
// import productRouter from "./product.routes";
// import vendorRouter from "./vendor.routes";
import reviewRouter from "../models/review/review.routes";
import addressRouter from "../models/address/address.routes";
import topBarNotificationRouter from "../models/topBarNotification/topBarNotification.routes";
// import topBarNotificationRouter from "./topBarNotification.routes";

const rootRouter: Router = Router();

rootRouter.use("/auth", userRouter);
rootRouter.use("/v1/coupons", couponRouter);
rootRouter.use("/v1/categories", categoryRouter);
rootRouter.use("/v1/banners", bannerRouter);
// rootRouter.use("/v1/products", productRouter);
// rootRouter.use("/vendor", vendorRouter);
rootRouter.use("/v1/reviews", reviewRouter);
rootRouter.use("/v1/addresses", addressRouter);
rootRouter.use("/v1/notification-bar", topBarNotificationRouter);

export default rootRouter;