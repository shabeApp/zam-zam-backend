import { Response } from "express";
import { AuthRequest } from "../../types/express";
import * as addressService from "../../Services/address.service";
import { apiStatusCode } from "../../lib/apiCode.lib";
import { verifyAccessToken } from "../../utils/token.utils";

// Create Address
export const createAddress = async (req: AuthRequest, res: Response) => {
    try {
        const token = req.cookies.accessToken;
        if (!token) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Authentication required"
            });
        }

        let userId: string;
        try {
            const payload = verifyAccessToken(token) as { id: string; role: string };
            userId = payload.id;
        } catch (error) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Invalid or expired token"
            });
        }

        const result = await addressService.createAddress(userId, req.body);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to create address"
        });
    }
};

// Get User Addresses
export const getAddressesByUser = async (req: AuthRequest, res: Response) => {
    try {
        const token = req.cookies.accessToken;
        if (!token) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Authentication required"
            });
        }

        let userId: string;
        try {
            const payload = verifyAccessToken(token) as { id: string; role: string };
            userId = payload.id;
        } catch (error) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Invalid or expired token"
            });
        }

        const result = await addressService.getAddressesByUser(userId);
        return res.status(result.statusCode).json({
            ok: true,
            message: "Addresses fetched successfully",
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch addresses"
        });
    }
};

// Get Address By ID
export const getAddressById = async (req: AuthRequest, res: Response) => {
    try {
        const token = req.cookies.accessToken;
        if (!token) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Authentication required"
            });
        }

        let userId: string;
        try {
            const payload = verifyAccessToken(token) as { id: string; role: string };
            userId = payload.id;
        } catch (error) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Invalid or expired token"
            });
        }

        const { id: addressId } = req.params;

        const result = await addressService.getAddressById(addressId, userId);
        return res.status(result.statusCode).json({
            ok: true,
            message: "Address fetched successfully",
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to fetch address"
        });
    }
};

// Update Address
export const updateAddress = async (req: AuthRequest, res: Response) => {
    try {
        const token = req.cookies.accessToken;
        if (!token) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Authentication required"
            });
        }

        let userId: string;
        try {
            const payload = verifyAccessToken(token) as { id: string; role: string };
            userId = payload.id;
        } catch (error) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Invalid or expired token"
            });
        }

        const { id: addressId } = req.params;

        const result = await addressService.updateAddress(addressId, userId, req.body);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message,
            data: result.data
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to update address"
        });
    }
};

// Set Default Address
export const setDefaultAddress = async (req: AuthRequest, res: Response) => {
    try {
        const token = req.cookies.accessToken;
        if (!token) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Authentication required"
            });
        }

        let userId: string;
        try {
            const payload = verifyAccessToken(token) as { id: string; role: string };
            userId = payload.id;
        } catch (error) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Invalid or expired token"
            });
        }

        const { id: addressId } = req.params;

        const result = await addressService.setDefaultAddress(addressId, userId);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to set default address"
        });
    }
};

// Delete Address
export const deleteAddress = async (req: AuthRequest, res: Response) => {
    try {
        const token = req.cookies.accessToken;
        if (!token) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Authentication required"
            });
        }

        let userId: string;
        try {
            const payload = verifyAccessToken(token) as { id: string; role: string };
            userId = payload.id;
        } catch (error) {
            return res.status(apiStatusCode.Unauthorized).json({
                ok: false,
                message: "Invalid or expired token"
            });
        }

        const { id: addressId } = req.params;

        const result = await addressService.deleteAddress(addressId, userId);
        return res.status(result.statusCode).json({
            ok: true,
            message: result.message
        });
    } catch (error: any) {
        const statusCode = error.statusCode || apiStatusCode.InternalServerError;
        return res.status(statusCode).json({
            ok: false,
            message: error.message || "Failed to delete address"
        });
    }
};
