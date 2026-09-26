import { Request, Response } from "express";
import * as authService from "./auth.service";
import { CONFIG } from "../../config/constants";
import { apiStatusCode } from "../../lib/apiCode.lib";
import { AuthRequest } from "../../types/express";

// signup controller
export const signup = async (req: Request, res: Response) => {
    try {
        const { username, email, password, role } = req.body;
        if (!username || !email || !password || !role) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Missing field" });
        }

        const { user } = await authService.signup(username, email, password, role);
        return res.status(apiStatusCode.Created).json({
            ok: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                phoneNumber: user.phoneNumber || null,
                countryCode: user.countryCode || null,
                gender: user.gender || null,
                dateOfBirth: user.dateOfBirth || null
            }
        });
    } catch (error: any) {
        const message = error?.message || "An error occurred during signup";
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message });
    }
};

// login controller
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }

        const { user, accessToken, refreshToken } = await authService.login(email, password);
        if (!refreshToken || !user || !accessToken) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }

        res.cookie(CONFIG.REFRESH_COOKIE_NAME, refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
            maxAge: 30 * 60 * 1000
        });

        return res.status(apiStatusCode.Success).json({
            ok: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                phoneNumber: user.phoneNumber || null,
                countryCode: user.countryCode || null,
                gender: user.gender || null,
                dateOfBirth: user.dateOfBirth || null
            }
        });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// logout controller
export const logout = async (req: AuthRequest, res: Response) => {
    try {
        const cookie = req.cookies[CONFIG.REFRESH_COOKIE_NAME];
        const userId = req.user?.id || req.body?.id;

        res.clearCookie(CONFIG.REFRESH_COOKIE_NAME, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/"
        });
        res.clearCookie("accessToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/"
        });

        if (!cookie || !userId) {
            return res.status(apiStatusCode.Success).json({ ok: true, message: "Logged out from client" });
        }

        try {
            await authService.logout(userId, cookie);
        } catch (error: any) {
            console.warn("Logout DB revocation issue:", error.message);
        }

        return res.status(apiStatusCode.Success).json({ ok: true, message: "Logged out successfully" });
    } catch (error: any) {
        const statusCode = error?.statusCode || apiStatusCode.BadRequest;
        const message = error?.message || "Failed to logout";
        return res.status(statusCode).json({ ok: false, message });
    }
};

// refresh token controller
export const refresh = async (req: Request, res: Response) => {
    try {
        const cookie = req.cookies[CONFIG.REFRESH_COOKIE_NAME];
        if (!cookie) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }

        const { accessToken, refreshToken } = await authService.refreshTokens(cookie);

        res.cookie(CONFIG.REFRESH_COOKIE_NAME, refreshToken, {
            httpOnly: true,
            secure: CONFIG.NODE_ENV === "production",
            sameSite: CONFIG.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
            maxAge: 30 * 24 * 60 * 60 * 1000
        });
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: CONFIG.NODE_ENV === "production",
            sameSite: CONFIG.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
            maxAge: 30 * 60 * 1000
        });

        return res.status(apiStatusCode.Success).json({ ok: true });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// forgot password controller
export const requestForgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }

        const { user } = await authService.requestForgotPassword(email);
        return res.status(apiStatusCode.Success).json({ ok: true, message: "OTP sent to your email", uid: user.id });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// reset password controller
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { uid, token, password, confirmPassword } = req.body;
        if (!uid || !token || !password || !confirmPassword) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }

        if (password !== confirmPassword) {
            return res.status(apiStatusCode.NotMatched).json({ ok: false, message: "Passwords do not match" });
        }

        if (password.length < 6) {
            return res.status(apiStatusCode.NotMatched).json({ ok: false, message: "Password must be at least 6 characters long" });
        }

        if (confirmPassword.length < 6) {
            return res.status(apiStatusCode.NotMatched).json({ ok: false, message: "Confirm password must be at least 6 characters long" });
        }

        await authService.resetPassword(uid, token, password);
        return res.status(apiStatusCode.Success).json({ ok: true, message: "Password reset successfully" });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// verify email controller
export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { uid, token } = req.body;
        if (!uid || !token) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }

        await authService.verifyEmailToken(uid, token);
        return res.status(apiStatusCode.Success).json({ ok: true, message: "Email verified successfully" });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// send otp controller
export const sendOtp = async (req: Request, res: Response) => {
    try {
        const { uid } = req.body;
        if (!uid) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }

        const otp = await authService.createOtp(uid);
        return res.status(apiStatusCode.Success).json({ ok: true, otp, message: "OTP sent successfully" });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// verify otp controller
export const verifyOtp = async (req: Request, res: Response) => {
    try {
        const { uid, otp } = req.body;
        if (!uid || !otp) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }

        if (otp.length < 3) {
            return res.status(apiStatusCode.NotMatched).json({ ok: false, message: "Invalid OTP" });
        }

        await authService.verifyOtp(uid, otp);
        return res.status(apiStatusCode.Success).json({ ok: true, message: "OTP verified successfully" });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// get all users only admin controller
export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const users = await authService.getAllUsers();
        return res.status(apiStatusCode.Success).json({ ok: true, users, message: "Users fetched successfully" });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// get me controller
export const getMe = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }

        const user = await authService.getUserById(userId);
        return res.status(apiStatusCode.Success).json({ ok: true, user, message: "User fetched successfully" });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// update user by id only admin controller
export const updateUserById = async (req: AuthRequest, res: Response) => {
    try {
        const adminId = req.user?.id;
        const { id: userId } = req.params;
        const data = req.body;
        if (!adminId || !userId) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }
        const updatedUser = await authService.updateUserById(userId, adminId, data);
        return res.status(apiStatusCode.Success).json({ ok: true, user: updatedUser, message: "User updated successfully" });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// update me controller
export const updateMe = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const data = req.body;
        if (!userId) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }
        const updatedUser = await authService.updateMe(userId, data);
        return res.status(apiStatusCode.Success).json({ ok: true, user: updatedUser, message: "Profile updated successfully" });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// delete user by id only admin controller
export const deleteUserById = async (req: AuthRequest, res: Response) => {
    try {
        const adminId = req.user?.id;
        const { id: userId } = req.params;
        if (!adminId || !userId) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }

        await authService.deleteUserById(userId, adminId);
        return res.status(apiStatusCode.Success).json({ ok: true, message: "User deleted successfully" });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// send direct email only admin controller
export const sendDirectEmail = async (req: AuthRequest, res: Response) => {
    try {
        const adminId = req.user?.id;
        const { id: userId } = req.params;
        const { subject, message } = req.body;
        if (!adminId || !userId) {
            return res.status(apiStatusCode.NotFound).json({ ok: false, message: "Invalid request" });
        }
        if (!subject || !message) {
            return res.status(apiStatusCode.BadRequest).json({ ok: false, message: "Subject and message are required" });
        }
        await authService.sendDirectEmail(adminId, userId, subject, message);
        return res.status(apiStatusCode.Success).json({ ok: true, message: "Email sent successfully" });
    } catch (error: any) {
        return res.status(apiStatusCode.BadRequest).json({ ok: false, message: error.message });
    }
};

// check user guard controller
export const checkUserGuard = async (req: Request, res: Response) => {
    try {
        const accessToken = req.cookies.accessToken;
        const refreshToken = req.cookies[CONFIG.REFRESH_COOKIE_NAME];
        if (!refreshToken) {
            return res.status(200).json({ isAuthorised: false, message: "noRefreshToken" });
        }
        if (!accessToken) {
            return res.status(200).json({ isAuthorised: false, message: "noAccessToken" });
        }
        const data = authService.verifyFrontendSession(accessToken);
        return res.status(200).json(data);
    } catch (error: any) {
        return res.status(200).json({ isAuthorised: false, message: error.message });
    }
};