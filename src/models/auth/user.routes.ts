import { Router } from "express";
import * as userController from "./auth.controller";
import { validateZod } from "../../middleware/validate-zod.middleware"
import * as z from "./user.zod"
import { authGuard } from "../../middleware/auth.guard"
import {
    signupLimiter,
    loginLimiter,
    refreshLimiter,
    forgotPasswordLimiter,
    resetPasswordLimiter,
    otpSendLimiter,
    otpVerifyLimiter,
} from "../../middleware/rateLimiter.middleware";

const userRouter = Router();

// ====================== PUBLIC AUTH ROUTES ======================
userRouter.post("/signup",  signupLimiter,          validateZod(z.signupSchema),  userController.signup);
userRouter.post("/login",   loginLimiter,           validateZod(z.loginSchema),   userController.login);
userRouter.post("/logout",                                                         userController.logout);
userRouter.post("/refresh", refreshLimiter,                                        userController.refresh);
userRouter.post("/forgot",  forgotPasswordLimiter,  validateZod(z.forgotSchema),  userController.requestForgotPassword);
userRouter.post("/reset",   resetPasswordLimiter,   validateZod(z.resetSchema),   userController.resetPassword);
userRouter.post("/verify",                          validateZod(z.verifySchema),  userController.verifyEmail);
userRouter.post("/otp/send",   otpSendLimiter,      validateZod(z.otpSendSchema), userController.sendOtp);
userRouter.post("/otp/verify", otpVerifyLimiter,    validateZod(z.otpVerifySchema), userController.verifyOtp);

// ====================== AUTHENTICATED USER ROUTES ======================
userRouter.get("/me",  authGuard(),                                                userController.getMe);
userRouter.put("/me",  authGuard(), validateZod(z.updateUserSchema),               userController.updateMe);

// ====================== ADMIN ROUTES ======================
userRouter.get("/users",            authGuard(['ADMIN']),                           userController.getAllUsers);
userRouter.delete("/user/:id",      authGuard(['ADMIN']),                           userController.deleteUserById);
userRouter.put("/user/:id",         authGuard(['ADMIN']), validateZod(z.updateUserSchema), userController.updateUserById);
userRouter.post("/user/:id/email",  authGuard(['ADMIN']),                           userController.sendDirectEmail);

// ====================== SMART FRONTEND GUARD ======================
userRouter.get("/auth-guard", userController.checkUserGuard);

export default userRouter;
