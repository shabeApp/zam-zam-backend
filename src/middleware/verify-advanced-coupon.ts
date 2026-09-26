import * as CouponService from "../models/coupon/coupon.service";
import prisma from "../prisma/client";

async function verify() {
    // console.log("🚀 Starting Advanced Coupon Service Verification...");

    const testCategoryCode = `CATCOP${Math.floor(Math.random() * 10000)}`;
    const testProductCode = `PRDCOP${Math.floor(Math.random() * 10000)}`;
    
    // Dummy IDs for testing (look like ObjectIds)
    const dummyCatId = "60d5ecb8b4b7c82d8c8b0001";
    const dummyPrdId = "60d5ecb8b4b7c82d8c8b0002";
    const dummyUserId = "60d5ecb8b4b7c82d8c8b4567";

    let catCouponId = "";
    let prdCouponId = "";

    try {
        // 1. Create Category Coupon
        console.log(`\n1. Testing createCoupon (Category scope): ${testCategoryCode}`);
        const catRes = await CouponService.createCoupon({
            code: testCategoryCode,
            discountType: "PERCENTAGE",
            discountValue: 20,
            validFrom: new Date(),
            validUntil: new Date(Date.now() + 86400000),
            applicableTo: "CATEGORY",
            categoryId: dummyCatId
        });
        catCouponId = catRes.data.id;
        // console.log("✅ Category Coupon Created");

        // 2. Validate Category Coupon
        // console.log("\n2. Testing validateCoupon (Category scope)...");
        const items = [
            { productId: "p1", categoryId: dummyCatId, price: 100, quantity: 2 }, // Applicable: 200
            { productId: "p2", categoryId: "other", price: 50, quantity: 1 }      // Not applicable
        ];
        const valCatRes = await CouponService.validateCoupon(testCategoryCode, dummyUserId, 250, items);
        console.log("✅ Validation Success. Message:", valCatRes.message);
        // console.log("📊 Computed Discount:", valCatRes.data.computedDiscount); 
        
        if (valCatRes.data.computedDiscount !== 40) {
            console.error("❌ Expected 40 discount, got", valCatRes.data.computedDiscount);
        } else {
            console.log("✨ Discount correctly calculated (20% of 200 = 40)");
        }

        // 3. Create Product Coupon
        console.log(`\n3. Testing createCoupon (Product scope): ${testProductCode}`);
        const prdRes = await CouponService.createCoupon({
            code: testProductCode,
            discountType: "FIXED",
            discountValue: 15,
            validFrom: new Date(),
            validUntil: new Date(Date.now() + 86400000),
            applicableTo: "PRODUCT",
            productId: dummyPrdId
        });
        prdCouponId = prdRes.data.id;
        console.log("✅ Product Coupon Created");

        // 4. Validate Product Coupon
        // console.log("\n4. Testing validateCoupon (Product scope)...");
        const items2 = [
            { productId: dummyPrdId, categoryId: "c1", price: 100, quantity: 1 }, // Applicable: 100
            { productId: "p2", categoryId: "c1", price: 50, quantity: 1 }         // Not applicable
        ];
        const valPrdRes = await CouponService.validateCoupon(testProductCode, dummyUserId, 150, items2);
        console.log("✅ Validation Success. Message:", valPrdRes.message);
        // console.log("📊 Computed Discount:", valPrdRes.data.computedDiscount);
        
        if (valPrdRes.data.computedDiscount !== 15) {
            console.error("❌ Expected 15 discount, got", valPrdRes.data.computedDiscount);
        } else {
            console.log("✨ Discount correctly calculated (Fixed 15)");
        }

    } catch (error: any) {
        console.error("❌ Verification Failed:", error.message || error);
    } finally {
        if (catCouponId) await prisma.coupon.delete({ where: { id: catCouponId } }).catch(() => {});
        if (prdCouponId) await prisma.coupon.delete({ where: { id: prdCouponId } }).catch(() => {});
        await prisma.$disconnect();
        process.exit();
    }
}

verify();
