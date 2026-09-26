import { Router } from "express";
import * as addressController from "./address.controller";
import { validateZod } from "../../middleware/validate-zod.middleware";
import * as addressZod from "./address.zod";
import { authGuard } from "../../middleware/auth.guard";
import { addressWriteLimiter } from "../../middleware/rateLimiter.middleware";

const addressRouter = Router();

// All address routes require at least 'USER' role
addressRouter.use(authGuard(['USER', 'ADMIN', 'MODERATOR']));

// ====================== READ ROUTES ======================
addressRouter.get("/",    addressController.getAddressesByUser);
addressRouter.get("/:id", addressController.getAddressById);

// ====================== WRITE ROUTES ======================
addressRouter.post("/",           addressWriteLimiter, validateZod(addressZod.createAddressSchema), addressController.createAddress);
addressRouter.put("/:id",         addressWriteLimiter, validateZod(addressZod.updateAddressSchema), addressController.updateAddress);
addressRouter.patch("/:id/default",                                                                  addressController.setDefaultAddress);
addressRouter.delete("/:id",                                                                         addressController.deleteAddress);

export default addressRouter;
