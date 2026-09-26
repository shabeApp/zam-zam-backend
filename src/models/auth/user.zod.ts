import { z } from "zod";

export const signupSchema = z.object({
    body: z.object({
        username: z.string().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters").toLowerCase(),
        email: z.string().email("Invalid email format").toLowerCase(),
        password: z.string().min(6, "Password must be at least 6 characters"),
        role: z.enum(["user", "admin", "USER", "ADMIN"]).default("user").transform((val) => val.toUpperCase())
    })
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format").toLowerCase(),
        password: z.string().min(1, "Password is required"),
    })
});

export const verifySchema = z.object({
    body: z.object({
        uid: z.string().min(1, "User ID is required"),
        token: z.string().min(1, "Token is required")
    })
});

export const forgotSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email format").toLowerCase()
    })
});

export const resetSchema = z.object({
    body: z.object({
        uid: z.string().min(1, "User ID is required"),
        token: z.string().min(1, "Token is required"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters")
    }).refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"]
    })
});

export const otpSendSchema = z.object({
    body: z.object({
        uid: z.string().min(1, "User ID is required")
    })
});

export const otpVerifySchema = z.object({
    body: z.object({
        uid: z.string().min(1, "User ID is required"),
        otp: z.string().min(3, "OTP is required")
    })
});

export const updateUserSchema = z.object({
    body: z.object({
        username: z.string().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters").toLowerCase().optional(),
        email: z.string().email("Invalid email format").toLowerCase().optional(),
        phoneNumber: z.string().optional(),
        countryCode: z.string().optional(),
        gender: z.enum(["male", "female", "other", "MALE", "FEMALE", "OTHER", ""]).transform((val) => val.toUpperCase()).optional(),
        dateOfBirth: z.string().optional(),
        role: z.enum(["user", "admin", "USER", "ADMIN"]).transform((val) => val.toUpperCase()).optional(),
        isBlocked: z.boolean().optional(),
        lockedUntil: z.string().datetime().optional().nullable(),
    })
});
