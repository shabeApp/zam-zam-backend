import { hashPassword, hashToken, randomTokenHex, verifyPassword } from "../../utils/hash.utils"
import { sendEmail } from "../../utils/emailSend.utils"
import { getForgotPasswordEmail, getOtpEmail, getVerificationEmail, getForgotPasswordOtpEmail, getAdminDirectEmail } from "../../utils/emailTemplates.utils";
import { signAccessToken, verifyAccessToken } from "../../utils/token.utils";
import { apiStatusCode } from "../../lib/apiCode.lib";
import prisma from "../../prisma/client";
import { Role } from "@prisma/client";

// Custom errors
export class AuthError extends Error {
    constructor(message: string, public statusCode: number, public code?: string) {
        super(message);
        this.name = "AuthError";
    }
}

// Signup service
export const signup = async (username: string, email: string, password: string, role: string) => {
    const normalizedEmail = email.toLowerCase();
    const normalizedUsername = username.toLowerCase();
    try {
        if (!email || !password || !username || !role) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);

        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: normalizedEmail },
                    { username: normalizedUsername }
                ]
            }
        })
        if (existing) throw new Error("Email or Username already in use");

        // password hashing
        const passwordHash = await hashPassword(password);


        const user = await prisma.$transaction(async (tx) => {
            return await tx.user.create({
                data: {
                    username: normalizedUsername.trim(),
                    email: normalizedEmail.trim(),
                    password: passwordHash.trim(),
                    role: role.toUpperCase() as Role,
                },
                select: { 
                    id: true, 
                    username: true, 
                    email: true, 
                    role: true,
                    phoneNumber: true,
                    countryCode: true,
                    gender: true,
                    dateOfBirth: true
                },
            });
        });

        // Trigger OTP directly after transaction success
        if (user.id) {
            await createOtp(user.id);
        }

        // create refresh token
        if (!user.id) throw new AuthError("User ID is required", apiStatusCode.InternalServerError);
        const refreshPlain = randomTokenHex(64);
        const refreshHash = hashToken(refreshPlain);

        // Enforce ONE active refresh token per user globally
        await prisma.$transaction(async (tx) => {
            const existingRefreshToken = await tx.refreshToken.findFirst({
                where: { userId: user.id }
            });

            if (existingRefreshToken) {
                await tx.refreshToken.delete({
                    where: { id: existingRefreshToken.id }
                });
            }

            await tx.refreshToken.create({
                data: {
                    user: { connect: { id: user.id } },
                    tokenHash: refreshHash,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
                }
            });
        });

        // logger.info("User signed up, OTP sent and refresh token created", { userId: user.id, role });
        return { user };
    } catch (error: any) {
        // Log the error for debugging
        // logger.error("Signup failed", { email: normalizedEmail, error: (error as Error).message });
        if (error?.message) {
            console.error("Signup service error:", error.message);
        } else {
            console.error("Signup service error:", error);
        }

        // Re-throw clean errors
        if (error instanceof Error) {
            throw error;
        }

        // Fallback for unknown errors
        throw new Error("An error occurred during signup");
    }
}

// login service
export const login = async (email: string, password: string) => {
    if (!email || !password) throw new AuthError("Email and password are required", apiStatusCode.BadRequest);
    const normalizedEmail = email.toLowerCase();
    try {
        // console.log(email, password);

        const user = await prisma.user.findFirst({
            where: {
                email: normalizedEmail
            }
        });

        // password verification
        // To prevent user enumeration, we check for user existence and password validity
        // in a way that doesn't reveal which one failed.
        const isPasswordValid = user ? await verifyPassword(password, user.password) : false;
        // console.log("isPasswordValid", isPasswordValid);
        // console.log("user", user);
        if (!user || !isPasswordValid) throw new AuthError("Invalid email or password", apiStatusCode.Unauthorized, "INVALID_CREDENTIALS");

        if (user.isBlocked) {
            // logger.warn("Login attempt by blocked user", { userId: user.id });
            throw new AuthError("Your account has been blocked. Please contact support.", apiStatusCode.NotMatched, "USER_BLOCKED");
        }

        // create refresh token
        if (!user.id) throw new AuthError("User ID is required", apiStatusCode.InternalServerError);
        const refreshPlain = randomTokenHex(64);
        const refreshHash = hashToken(refreshPlain);

        // Enforce ONE active refresh token per user globally
        await prisma.$transaction(async (tx) => {
            const existingRefreshToken = await tx.refreshToken.findFirst({
                where: { userId: user.id }
            });

            if (existingRefreshToken) {
                await tx.refreshToken.delete({
                    where: { id: existingRefreshToken.id }
                });
            }

            await tx.refreshToken.create({
                data: {
                    user: { connect: { id: user.id } },
                    tokenHash: refreshHash,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
                }
            });
        });

         // access token
        const accessToken = signAccessToken({ id: user.id, users: user.username, role: user.role });

        // logger.info("User logged in", { userId: user.id });
        return { user, accessToken, refreshToken: refreshPlain };
    } catch (error: any) {
        // logger.error("Login failed", { email, error: error.message });
        if (!(error instanceof AuthError)) {
            console.error("Login service error:", error);
        }
        throw error;
    }
};

// logout service
export const logout = async (userId: string, refreshToken: string) => {
    try {
        if (!userId || !refreshToken) throw new AuthError("Missing userId or refreshToken", apiStatusCode.BadRequest);
        
        const tokenHash = hashToken(refreshToken);
        
        // Verify token exists and belongs to user
        const tokenExists = await prisma.refreshToken.findFirst({
            where: {
                userId,
                tokenHash,
                revoked: false
            }
        });
        
        if (!tokenExists) {
            throw new AuthError("Invalid or already revoked refresh token", apiStatusCode.Unauthorized, "INVALID_TOKEN");
        }
        
        // Revoke the token
        const result = await prisma.refreshToken.update({
            where: { id: tokenExists.id },
            data: { revoked: true }
        });
        
        // logger.info("User logged out", { userId, tokenId: result.id });
        return true;
    } catch (error) {
        if (error instanceof AuthError) {
            // logger.warn("Logout failed", { userId, error: (error as Error).message });
            throw error;
        }
        console.error("Logout service error:", error);
        // logger.error("Logout service error:", error);
        throw new AuthError("Failed to logout", apiStatusCode.BadRequest);
    }
};

// refresh token service
export const refreshTokens = async (refreshToken: string) => {
    try {
        if (!refreshToken) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);
        const tokenHash = hashToken(refreshToken);
        const found = await prisma.refreshToken.findFirst({ where: { tokenHash, revoked: false } });
        if (!found) throw new Error("Invalid refresh token");
        const userId = found.userId;
        if (!found || found.revoked || found.expiresAt < new Date()) throw new Error("Invalid refresh token");

        // Verify user still exists in the database
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.deletedAt) {
            // Revoke the orphaned refresh token
            await prisma.refreshToken.update({
                where: { id: found.id },
                data: { revoked: true }
            });
            throw new Error("User not found");
        }

        if (user.isBlocked) {
            // Revoke the token for blocked user
            await prisma.refreshToken.update({
                where: { id: found.id },
                data: { revoked: true }
            });
            // logger.warn("Token refresh attempt by blocked user", { userId: user.id });
            throw new Error("Your account has been blocked");
        }

        // issue new tokens
        const newplain = randomTokenHex(64);
        const newHash = hashToken(newplain);
        const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days


        // Update the token in place instead of creating a new record
        await prisma.refreshToken.update({
            where: {
                id: found.id
            },
            data: {
                tokenHash: newHash,
                expiresAt: newExpiry
            },
        });

        // Cleanup: Delete other expired tokens for this user
        await prisma.refreshToken.deleteMany({
            where: {
                userId,
                expiresAt: { lt: new Date() }
            }
        });


        const accessToken = signAccessToken({ id: userId, users: user.username, role: user.role });

        return { refreshToken: newplain, accessToken };
    } catch (error) {
        console.error("Refresh token service error:", error);
        throw error;
    }
};

// Forgot password service
export const requestForgotPassword = async (email: string) => {
    try {
        if (!email) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);

        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) throw new Error("User not found");

        // create forgot password OTP
        const otp = (Math.floor(100000 + Math.random() * 900000)).toString(); // 6-digit OTP
        await prisma.emailToken.create({
            data: {
                user: { connect: { id: user.id } },
                tokenHash: hashToken(otp),
                purpose: "FORGOT_PASSWORD",
                expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 mins
            }
        });

        // send forgot password email
        const link = `${process.env.FRONTEND_URL}/otp?uid=${user.id}`;
        sendEmail(
            user.email,
            "Reset your password",
            getForgotPasswordOtpEmail(user.username, otp, link)
        ).catch(console.error);
        return { user, tokenPlain: otp };
    } catch (error) {
        console.error("Request forgot password service error:", error);
        throw error;
    }
};

// Reset password service
export const resetPassword = async (userId: string, token: string, newPassword: string) => {
    try {
        if (!userId || !token || !newPassword) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);
        const tokenHash = hashToken(token);
        const entry = await prisma.emailToken.findFirst({
            where: {
                userId,
                tokenHash,
                purpose: "FORGOT_PASSWORD",
                used: false,
            }
        });
        if (!entry || entry.expiresAt < new Date()) throw new Error("Invalid or expired token");

        // update password
        const newPasswordHash = await hashPassword(newPassword);


        await prisma.$transaction(async (tx: any) => {
            await tx.user.update({
                where: {
                    id: userId
                },
                data: {
                    password: newPasswordHash
                }
            });
            await tx.emailToken.update({
                where: {
                    id: entry.id
                },
                data: {
                    used: true
                }
            });
        });
    } catch (error) {
        console.error("Reset password service error:", error);
        throw error;
    }
}

// Verify email service......not use any more ........
export const verifyEmailToken = async (userId: string, token: string) => {
    try {
        if (!userId || !token) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);
        const tokenHash = hashToken(token);
        const entry = await prisma.emailToken.findFirst({
            where: {
                userId,
                tokenHash,
                purpose: "VERIFY_EMAIL",
                used: false
            }
        });
        if (!entry || entry.expiresAt < new Date()) throw new Error("Invalid or expired token");

        // mark email as verified
        await prisma.$transaction(async (tx: any) => {
            await tx.user.update({
                where: {
                    id: userId
                },
                data: {
                    isEmailVerified: true
                }
            });
            await tx.emailToken.update({
                where: {
                    id: entry.id
                },
                data: {
                    used: true
                }
            })
        });
    } catch (error) {
        console.error("Verify email service error:", error);
        throw error;
    }
};

// create OTP service
export const createOtp = async (userId: string) => {
    try {
        if (!userId) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);
        const otp = (Math.floor(100000 + Math.random() * 900000)).toString(); // 6-digit OTP
        const otpHash = hashToken(otp);
        
        // Fetch user for name in template
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, email: true } });
        
        await prisma.$transaction(async (tx) => {
            const existingOtpToken = await tx.emailToken.findFirst({
                where: { userId: userId }
            });

            if (existingOtpToken) {
                await tx.emailToken.delete({
                    where: { id: existingOtpToken.id }
                });
            }

            await tx.emailToken.create({
                data: {
                    user: { connect: { id: userId } },
                    tokenHash: otpHash,
                    purpose: "OTP",
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
                }
            });
        });

        if (user) {
            sendEmail(user.email, "Your OTP Code", getOtpEmail(user.username, otp)).catch(console.error);
        }

        return otp;
    } catch (error) {
        console.error("Create OTP service error:", error);
        throw error;
    }
};

// verify OTP service
export const verifyOtp = async (userId: string, otp: string) => {
    try {
        if (!userId || !otp) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);
        const otpHash = hashToken(otp);
        const entry = await prisma.emailToken.findFirst({
            where: {
                userId,
                tokenHash: otpHash,
                purpose: { in: ["OTP", "FORGOT_PASSWORD"] },
                used: false
            }
        });
        if (!entry || entry.expiresAt < new Date()) throw new Error("Invalid or expired OTP");

        // If it is a forgot password OTP, we simply verify it is valid.
        // We DO NOT mark it as used yet; it will be marked used when they actually reset the password.
        if (entry.purpose === "FORGOT_PASSWORD") {
            return true;
        }

        // mark OTP as used and user email as verified
        await prisma.$transaction(async (tx: any) => {
            await tx.user.update({
                where: {
                    id: userId
                },
                data: {
                    isEmailVerified: true
                }
            });
            await tx.emailToken.update({
                where: {
                    id: entry.id
                },
                data: {
                    used: true
                }
            });
        });
        return true;
    } catch (error) {
        console.error("Verify OTP service error:", error);
        throw error;
    }
};

// get all user service
export const getAllUsers = async () => {
    try {
        return await prisma.user.findMany(
            {
                select: {
                    id: true,
                    username: true,
                    email: true,
                    phoneNumber: true,
                    countryCode: true,
                    gender: true,
                    dateOfBirth: true,
                    role: true,
                    isEmailVerified: true,
                    isBlocked: true,
                    lockedUntil: true,
                    createdAt: true,
                    updatedAt: true,
                }
            }
        );
    } catch (error) {
        console.error("Get all users service error:", error);
        throw error;
    };
};

// get user by id service
export const getUserById = async (userId: string) => {
    try {
        if (!userId) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);
        return await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                phoneNumber: true,
                countryCode: true,
                gender: true,
                dateOfBirth: true,
                role: true,
                isEmailVerified: true,
                isBlocked: true,
                lockedUntil: true,
                createdAt: true,
                updatedAt: true,
            }
        })
    } catch (error) {
        console.error("Get user by id service error:", error);
        throw error;
    }
};

// update user by id service
export const updateUserById = async (userId: string, adminId: string, data: any) => {
    try {
        if (!userId || !adminId) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);

        const [admin, user] = await Promise.all([
            prisma.user.findUnique({ where: { id: adminId } }),
            prisma.user.findUnique({ where: { id: userId } }),
        ]);
        if (!admin || admin.role !== "ADMIN") throw new AuthError("Admin required", 403);
        if (!user) throw new AuthError("User not found", 404);

        // Admin strictly whitelisted payload (NO password)
        const updatePayload: any = {};
        if (data.username !== undefined) updatePayload.username = data.username;
        if (data.email !== undefined) updatePayload.email = data.email;
        if (data.isBlocked !== undefined) updatePayload.isBlocked = data.isBlocked;
        if (data.lockedUntil !== undefined) updatePayload.lockedUntil = data.lockedUntil;
        if (data.role !== undefined) updatePayload.role = data.role;
        if (data.phoneNumber !== undefined) updatePayload.phoneNumber = data.phoneNumber;
        if (data.countryCode !== undefined) updatePayload.countryCode = data.countryCode;
        if (data.gender !== undefined) updatePayload.gender = data.gender;
        if (data.dateOfBirth !== undefined) updatePayload.dateOfBirth = data.dateOfBirth;

        return await prisma.user.update({
            where: { id: userId },
            data: updatePayload,
        });
    } catch (error) {
        console.error("Update user by id service error:", error);
        throw error;
    }
};

// update me service
export const updateMe = async (userId: string, data: any) => {
    try {
        if (!userId) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new AuthError("User not found", 404);

        // User strictly whitelisted payload (ONLY Email and Name, NO password)
        const updatePayload: any = {};
        if (data.username !== undefined) updatePayload.username = data.username;
        if (data.email !== undefined) updatePayload.email = data.email;
        if (data.phoneNumber !== undefined) updatePayload.phoneNumber = data.phoneNumber;
        if (data.countryCode !== undefined) updatePayload.countryCode = data.countryCode;
        if (data.gender !== undefined) updatePayload.gender = data.gender;
        if (data.dateOfBirth !== undefined) updatePayload.dateOfBirth = data.dateOfBirth;
        return await prisma.user.update({
            where: { id: userId },
            data: updatePayload,
            select: {
                id: true,
                username: true,
                email: true,
                phoneNumber: true,
                countryCode: true,
                gender: true,
                dateOfBirth: true,
                role: true,
                isEmailVerified: true,
                isBlocked: true,
                lockedUntil: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    } catch (error) {
        console.error("Update me service error:", error);
        throw error;
    }
};

// delete user by id service
export const deleteUserById = async (userId: string, adminId: string) => {
    try {
        if (!userId || !adminId) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);

        if (userId === adminId) throw new Error("Admin can't delete himself");

        const [admin, user] = await Promise.all([
            prisma.user.findUnique({ where: { id: adminId } }),
            prisma.user.findUnique({ where: { id: userId } }),
        ]);
        if (!admin || admin.role !== "ADMIN") throw new AuthError("Admin required", 403);
        if (!user) throw new AuthError("User not found", 404);
        if (user.role === "ADMIN") throw new AuthError("Cannot delete admin", 403, "ADMIN_DELETE");

        await prisma.$transaction(async (tx) => {
            await tx.emailToken.deleteMany({ where: { userId } });
            await tx.refreshToken.deleteMany({ where: { userId } });
            await tx.user.update({ where: { id: userId }, data: { deletedAt: new Date() } }); // Soft delete
        });
        return true;
    } catch (error) {
        console.error("Delete user by id service error:", error);
        throw error;
    }
};

// Smart frontend session verification service (Amazon/Flipkart grade sync check)
export const verifyFrontendSession = (accessToken: string | undefined) => {
    // 1. Check if token exists
    if (!accessToken) {
        return { isAuthorised: false, message: "noAccessToken" };
    }

    try {
        // 2. Verify token
        const payload = verifyAccessToken(accessToken) as { id: string; users: string; role: string };

        // 5. Success - returning exact payload needed for the client
        return {
            isAuthorised: true,
            user: { id: payload.id, username: payload.users, role: payload.role },
            message: "User access granted"
        };
    } catch (error) {
        // Token is invalid, expired, or malformed
        return { isAuthorised: false, message: "User not authorised sumthing went wrong function" };
    }
};

// send direct email to user (Admin action)
export const sendDirectEmail = async (adminId: string, userId: string, subject: string, message: string) => {
    try {
        if (!userId || !adminId) throw new Error(`Invalid request status code: ${apiStatusCode.NotFound}`);

        const [admin, user] = await Promise.all([
            prisma.user.findUnique({ where: { id: adminId } }),
            prisma.user.findUnique({ where: { id: userId } }),
        ]);

        if (!admin || admin.role !== "ADMIN") throw new AuthError("Admin required", 403);
        if (!user) throw new AuthError("User not found", 404);

        const html = getAdminDirectEmail(user.username, subject, message);

        await sendEmail(user.email, subject, html);
        return true;
    } catch (error) {
        console.error("Admin send email service error:", error);
        throw error;
    }
};