import prisma from "../../prisma/client";
import { apiStatusCode } from "../../lib/apiCode.lib";
 
// Custom error class
export class BannerError extends Error {
    constructor(message: string, public statusCode: number, public code?: string) {
        super(message);
        this.name = "BannerError";
    }
}

// ==================== CREATE OPERATIONS ====================

export const createBanner = async (data: {
    title: string;
    slug: string;
    description: string;
    image: string;
    link: string;
    type?: "HOME" | "CATEGORY" | "PRODUCT";
}) => {
    try {
        // validate the data
        if (!data.title || !data.slug || !data.description || !data.image || !data.link) {
            throw new BannerError("Title, slug, description, image, and link are required", apiStatusCode.BadRequest);
        }

        // Check if slug already exists
        const existingBanner = await prisma.banner.findUnique({
            where: { slug: data.slug }
        });

        if (existingBanner) {
            throw new BannerError("Banner with this slug already exists", apiStatusCode.Conflict);
        }

        //create the banner
        const banner = await prisma.banner.create({
            data: {
                title: data.title,
                slug: data.slug,
                description: data.description,
                image: data.image,
                link: data.link,
                ...(data.type && { type: data.type })
            }
        });

        return {
            message: "Banner created successfully",
            data: banner,
            statusCode: apiStatusCode.Created
        };
    } catch (error) {
        if (error instanceof BannerError) throw error;
        console.error("Create banner error:", error);
        throw new BannerError("Failed to create banner", apiStatusCode.InternalServerError);
    }
};

// ==================== READ OPERATIONS ====================

//get all banners
export const getBanners = async () => {
    try {
        const banners = await prisma.banner.findMany();
        return {
            message: "Banners fetched successfully",
            data: banners,
            statusCode: apiStatusCode.Success
        };
    } catch (error) {
        if (error instanceof BannerError) throw error;
        console.error("Get banners error:", error);
        throw new BannerError("Failed to get banners", apiStatusCode.InternalServerError);
    };
};

//get banner by id
export const getBannerById = async (id: string) => {
    try {
        // validate the id
        if (!id) {
            throw new BannerError("ID is required", apiStatusCode.BadRequest);
        }

        //get the banner
        const banner = await prisma.banner.findUnique({
            where: { id }
        });

        // Bugfix: Handle null when ID is not found
        if (!banner) {
            throw new BannerError("Banner not found", apiStatusCode.NotFound);
        }

        return {
            message: "Banner fetched successfully",
            data: banner,
            statusCode: apiStatusCode.Success
        };
    } catch (error) {
        if (error instanceof BannerError) throw error;
        console.error("Get banner error:", error);
        throw new BannerError("Failed to get banner", apiStatusCode.InternalServerError);
    };
};

// ==================== UPDATE OPERATIONS ====================

export const updateBanner = async (id: string, data: {
    title?: string;
    slug?: string;
    description?: string;
    image?: string;
    link?: string;
    type?: "HOME" | "CATEGORY" | "PRODUCT";
}) => {
    try {
        // validate the id
        if (!id) {
            throw new BannerError("ID is required", apiStatusCode.BadRequest);
        };

        // If slug is being updated, check if it already exists
        if (data.slug) {
            const existingBanner = await prisma.banner.findFirst({
                where: { 
                    slug: data.slug,
                    id: { not: id }
                }
            });

            if (existingBanner) {
                throw new BannerError("Banner with this slug already exists", apiStatusCode.Conflict);
            }
        }

        const banner = await prisma.banner.update({
            where: { id },
            data: {
                ...data
            }
        });

        return {
            message: "Banner updated successfully",
            data: banner,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof BannerError) throw error;

        // Bugfix: Handle Prismas "not found" record error on update
        if (error.code === 'P2025') {
            throw new BannerError("Banner not found", apiStatusCode.NotFound);
        }

        console.error("Update banner error:", error);
        throw new BannerError("Failed to update banner", apiStatusCode.InternalServerError);
    }
};

// ==================== DELETE OPERATIONS ====================

export const deleteBanner = async (id: string) => {
    try {
        const banner = await prisma.banner.delete({
            where: { id }
        });

        // Bugfix: Handle null when ID is not found
        if (!banner){
            throw new BannerError("Banner not found", apiStatusCode.NotFound);
        };

        return {
            message: "Banner deleted successfully",
            data: banner,
            statusCode: apiStatusCode.Success
        };
    } catch (error: any) {
        if (error instanceof BannerError) throw error;
        
        // Bugfix: Handle Prismas "not found" record error on delete
        if (error.code === 'P2025') {
            throw new BannerError("Banner not found", apiStatusCode.NotFound);
        }

        console.error("Delete banner error:", error);
        throw new BannerError("Failed to delete banner", apiStatusCode.InternalServerError);
    };
};
