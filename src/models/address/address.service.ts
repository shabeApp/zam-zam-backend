import prisma from "../../prisma/client";
import { apiStatusCode } from "../../lib/apiCode.lib";

// Custom error class
export class AddressError extends Error {
    constructor(message: string, public statusCode: number, public code?: string) {
        super(message);
        this.name = "AddressError";
    }
}

// ==================== CREATE OPERATIONS ====================

export const createAddress = async (userId: string, data: {
    name: string;
    phone: string;
    email?: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    label?: string;
    isDefault?: boolean;
    addressType: "MY_ADDRESS" | "GIFT_ADDRESS";
    friendName?: string;
    friendPhone?: string;
    giftDescription?: string;
}) => {
    try {
        if (!userId) {
            throw new AddressError("User ID is required", apiStatusCode.BadRequest);
        }

        // If this is the first address, make it default
        const addressCount = await prisma.address.count({
            where: { userId, deletedAt: { isSet: false } }
        });

        const isDefault = data.isDefault || addressCount === 0;

        // If setting as default, unset other default addresses for this user
        if (isDefault) {
            await prisma.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            });
        }

        // Check if user is blocked
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isBlocked: true }
        });

        if (!user) throw new AddressError("User not found", apiStatusCode.NotFound);
        if (user.isBlocked) throw new AddressError("Your account has been blocked", apiStatusCode.NotMatched);

        const address = await prisma.address.create({
            data: {
                name: data.name,
                phone: data.phone,
                email: data.email,
                street: data.street,
                city: data.city,
                state: data.state,
                postalCode: data.postalCode,
                country: data.country,
                label: data.label,
                addressType: data.addressType,
                friendName: data.friendName,
                friendPhone: data.friendPhone,
                giftDescription: data.giftDescription,
                isDefault: isDefault,
                user: { connect: { id: userId } },
            }
        });

        return {
            message: "Address created successfully",
            data: address,
            statusCode: apiStatusCode.Created
        };
    } catch (error: any) {
        if (error instanceof AddressError) throw error;
        console.error("Create address error:", error);
        throw new AddressError(error?.message || "Failed to create address", apiStatusCode.InternalServerError);
    }
};

// ==================== READ OPERATIONS ====================

export const getAddressesByUser = async (userId: string) => {
    try {
        const addresses = await prisma.address.findMany({
            where: { userId, deletedAt: { isSet: false } },    // ✅ exclude soft-deleted addresses
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
        });
        return {
            data: addresses,
            statusCode: apiStatusCode.Success
        };
    } catch (error) {
        console.error("Get addresses error:", error);
        throw new AddressError("Failed to fetch addresses", apiStatusCode.InternalServerError);
    }
};


export const getAddressById = async (addressId: string, userId: string) => {
    try {
        const address = await prisma.address.findFirst({
            where: { id: addressId, userId, deletedAt: { isSet: false } }
        });
        if (!address) {
            throw new AddressError("Address not found", apiStatusCode.NotFound);
        }
        return {
            data: address,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof AddressError) throw error;
        throw new AddressError("Failed to fetch address", apiStatusCode.InternalServerError);
    }
};

// ==================== UPDATE OPERATIONS ====================

export const updateAddress = async (addressId: string, userId: string, data: Partial<any>) => {
    try {
        const existingAddress = await prisma.address.findFirst({
            where: { id: addressId, userId, deletedAt: { isSet: false } }
        });

        if (!existingAddress) {
            throw new AddressError("Address not found", apiStatusCode.NotFound);
        }

        // Handle default address switch
        if (data.isDefault === true && !existingAddress.isDefault) {
            await prisma.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            });
        }

        const updated = await prisma.address.update({
            where: { id: addressId },
            data: {
                name: data.name,
                phone: data.phone,
                email: data.email,
                street: data.street,
                city: data.city,
                state: data.state,
                postalCode: data.postalCode,
                country: data.country,
                label: data.label,
                addressType: data.addressType,
                friendName: data.friendName,
                friendPhone: data.friendPhone,
                giftDescription: data.giftDescription,
            }
        });

        return {
            message: "Address updated successfully",
            data: updated,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof AddressError) throw error;
        throw new AddressError("Failed to update address", apiStatusCode.InternalServerError);
    }
};

export const setDefaultAddress = async (addressId: string, userId: string) => {
    try {
        const address = await prisma.address.findFirst({
            where: { id: addressId, userId, deletedAt: { isSet: false } }
        });

        if (!address) {
            throw new AddressError("Address not found", apiStatusCode.NotFound);
        }

        await prisma.$transaction([
            prisma.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            }),
            prisma.address.update({
                where: { id: addressId },
                data: { isDefault: true }
            })
        ]);

        return {
            message: "Default address set successfully",
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof AddressError) throw error;
        throw new AddressError("Failed to set default address", apiStatusCode.InternalServerError);
    }
};

// ==================== DELETE OPERATIONS ====================

export const deleteAddress = async (addressId: string, userId: string) => {
    try {
        const address = await prisma.address.findFirst({
            where: { id: addressId, userId, deletedAt: { isSet: false } }
        });

        if (!address) {
            throw new AddressError("Address not found", apiStatusCode.NotFound);
        }

        await prisma.address.update({
            where: { id: addressId },
            data: { deletedAt: new Date(), isDefault: false }
        });

        // If was default, pick another one to be default if exists
        if (address.isDefault) {
             const another = await prisma.address.findFirst({
                 where: { userId, deletedAt: { isSet: false } },
                 orderBy: { createdAt: "desc" }
             });
             if (another) {
                 await prisma.address.update({
                     where: { id: another.id },
                     data: { isDefault: true }
                 });
             }
        }

        return {
            message: "Address deleted successfully",
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof AddressError) throw error;
        throw new AddressError("Failed to delete address", apiStatusCode.InternalServerError);
    }
};
