import prisma from "../../prisma/client";
import { apiStatusCode } from "../../lib/apiCode.lib";

// Custom error class
export class TopBarNotificationError extends Error {
    constructor(message: string, public statusCode: number, public code?: string) {
        super(message);
        this.name = "TopBarNotificationError";
    }
}

// ==================== CREATE OPERATIONS ====================

export const createTopBarNotification = async (data: {
    title: string;
    message: string;
    link?: string;
    isActive?: boolean;
}) => {
    try {
        if (!data.title || !data.message) {
            throw new TopBarNotificationError("Title and message are required", apiStatusCode.BadRequest);
        }

        const topBarNotification = await prisma.topBarNotification.create({
            data: {
                title: data.title,
                message: data.message,
                link: data.link,
                isActive: data.isActive ?? true,
            }
        });

        return {
            message: "Top bar notification created successfully",
            data: topBarNotification,
            statusCode: apiStatusCode.Created
        };
    } catch (error) {
        if (error instanceof TopBarNotificationError) throw error;
        console.error("Create top bar notification error:", error);
        throw new TopBarNotificationError("Failed to create top bar notification", apiStatusCode.InternalServerError);
    }
};

// ==================== READ OPERATIONS ====================

export const getTopBarNotifications = async () => {
    try {
        const topBarNotifications = await prisma.topBarNotification.findMany();
        return {
            message: "Top bar notifications fetched successfully",
            data: topBarNotifications,
            statusCode: apiStatusCode.Success
        };
    } catch (error) {
        if (error instanceof TopBarNotificationError) throw error;
        console.error("Get top bar notifications error:", error);
        throw new TopBarNotificationError("Failed to get top bar notifications", apiStatusCode.InternalServerError);
    }
};

export const getTopBarNotificationById = async (id: string) => {
    try {
        if (!id) {
            throw new TopBarNotificationError("ID is required", apiStatusCode.BadRequest);
        }

        const topBarNotification = await prisma.topBarNotification.findUnique({
            where: { id }
        });

        if (!topBarNotification) {
            throw new TopBarNotificationError("Top bar notification not found", apiStatusCode.NotFound);
        }

        return {
            message: "Top bar notification fetched successfully",
            data: topBarNotification,
            statusCode: apiStatusCode.Success
        };
    } catch (error) {
        if (error instanceof TopBarNotificationError) throw error;
        console.error("Get top bar notification error:", error);
        throw new TopBarNotificationError("Failed to get top bar notification", apiStatusCode.InternalServerError);
    }
};

// ==================== UPDATE OPERATIONS ====================

export const updateTopBarNotification = async (id: string, data: {
    title?: string;
    message?: string;
    link?: string;
    isActive?: boolean;
}) => {
    try {
        if (!id) {
            throw new TopBarNotificationError("ID is required", apiStatusCode.BadRequest);
        }

        const topBarNotification = await prisma.topBarNotification.update({
            where: { id },
            data: {
                ...(data.title !== undefined && { title: data.title }),
                ...(data.message !== undefined && { message: data.message }),
                ...(data.link !== undefined && { link: data.link }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            }
        });

        return {
            message: "Top bar notification updated successfully",
            data: topBarNotification,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof TopBarNotificationError) throw error;
        if (error.code === 'P2025') {
            throw new TopBarNotificationError("Top bar notification not found", apiStatusCode.NotFound);
        }
        console.error("Update top bar notification error:", error);
        throw new TopBarNotificationError("Failed to update top bar notification", apiStatusCode.InternalServerError);
    }
};

// ==================== DELETE OPERATIONS ====================

export const deleteTopBarNotification = async (id: string) => {
    try {
        if (!id) {
            throw new TopBarNotificationError("ID is required", apiStatusCode.BadRequest);
        }

        const topBarNotification = await prisma.topBarNotification.delete({
            where: { id }
        });

        return {
            message: "Top bar notification deleted successfully",
            data: topBarNotification,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof TopBarNotificationError) throw error;
        if (error.code === 'P2025') {
            throw new TopBarNotificationError("Top bar notification not found", apiStatusCode.NotFound);
        }
        console.error("Delete top bar notification error:", error);
        throw new TopBarNotificationError("Failed to delete top bar notification", apiStatusCode.InternalServerError);
    }
};
