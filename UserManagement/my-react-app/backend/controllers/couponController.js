const Coupon = require("../models/Coupon");
const { logActivity } = require("../utils/logger");

/**
 * Normalizes coupon code to uppercase trimmed string
 */
function normalizeCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

/**
 * 1. Validate a coupon code for customer checkout
 * POST /api/coupons/validate
 * Protected: verifyToken
 */
exports.validateCoupon = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const cleanCode = normalizeCode(code);
    const orderSubtotal = Number(subtotal) || 0;

    if (!cleanCode) {
      return res.status(400).json({ valid: false, message: "Please enter a coupon code." });
    }

    if (orderSubtotal <= 0) {
      return res.status(400).json({ valid: false, message: "Order subtotal must be greater than zero." });
    }

    const coupon = await Coupon.findOne({ code: cleanCode });

    if (!coupon) {
      await logActivity({
        action: "COUPON_VALIDATION_FAILED",
        category: "DISCOUNT",
        actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
        target: { entityType: "Coupon", name: cleanCode },
        status: "WARNING",
        details: { reason: "Coupon code does not exist", inputCode: cleanCode }
      });
      return res.status(404).json({ valid: false, message: `Coupon "${cleanCode}" does not exist.` });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ valid: false, message: `Coupon "${cleanCode}" is no longer active.` });
    }

    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return res.status(400).json({ valid: false, message: `Coupon "${cleanCode}" is not active yet.` });
    }

    if (coupon.expirationDate && new Date(coupon.expirationDate) < now) {
      return res.status(400).json({ valid: false, message: `Coupon "${cleanCode}" has expired.` });
    }

    if (coupon.minOrderAmount && orderSubtotal < coupon.minOrderAmount) {
      return res.status(400).json({
        valid: false,
        message: `Coupon "${cleanCode}" requires a minimum order of ₹${coupon.minOrderAmount.toLocaleString("en-IN")}.`
      });
    }

    if (coupon.maxTotalUsage !== null && coupon.usageCount >= coupon.maxTotalUsage) {
      return res.status(400).json({
        valid: false,
        message: `Coupon "${cleanCode}" has reached its maximum global usage limit.`
      });
    }

    // Per-customer usage check
    if (coupon.maxUsagePerCustomer && Array.isArray(coupon.customerUsage)) {
      const userUsageCount = coupon.customerUsage.filter(
        (u) => u.userId && u.userId.toString() === req.user.id.toString()
      ).length;

      if (userUsageCount >= coupon.maxUsagePerCustomer) {
        return res.status(400).json({
          valid: false,
          message: `You have already used coupon "${cleanCode}" the maximum number of times (${coupon.maxUsagePerCustomer}).`
        });
      }
    }

    // Calculate discount amount authoritatively
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = Math.round((orderSubtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else if (coupon.discountType === "fixed") {
      discountAmount = Math.min(coupon.discountValue, orderSubtotal);
    }

    // Ensure payable never becomes negative
    discountAmount = Math.min(discountAmount, orderSubtotal);
    const finalAmount = Math.max(0, orderSubtotal - discountAmount);

    return res.json({
      valid: true,
      message: `Coupon "${cleanCode}" applied successfully!`,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description
      },
      discountAmount,
      finalAmount
    });
  } catch (error) {
    return res.status(500).json({ valid: false, message: error.message });
  }
};

/**
 * 2. Get all coupons (Admin only)
 * GET /api/coupons
 */
exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 3. Create a new coupon (Admin only)
 * POST /api/coupons
 */
exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      expirationDate,
      maxTotalUsage,
      maxUsagePerCustomer,
      isActive
    } = req.body;

    const cleanCode = normalizeCode(code);
    if (!cleanCode) {
      return res.status(400).json({ message: "Coupon code is required." });
    }

    if (!discountType || !["percentage", "fixed"].includes(discountType)) {
      return res.status(400).json({ message: "Discount type must be 'percentage' or 'fixed'." });
    }

    const val = Number(discountValue);
    if (isNaN(val) || val <= 0) {
      return res.status(400).json({ message: "Discount value must be a positive number." });
    }

    if (discountType === "percentage" && val > 100) {
      return res.status(400).json({ message: "Percentage discount cannot exceed 100%." });
    }

    if (!expirationDate) {
      return res.status(400).json({ message: "Expiration date is required." });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = new Date(expirationDate);
    if (end <= start) {
      return res.status(400).json({ message: "Expiration date must be after the start date." });
    }

    const existing = await Coupon.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ message: `Coupon with code "${cleanCode}" already exists.` });
    }

    const coupon = await Coupon.create({
      code: cleanCode,
      description: description || "",
      discountType,
      discountValue: val,
      minOrderAmount: minOrderAmount ? Number(minOrderAmount) : 0,
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
      startDate: start,
      expirationDate: end,
      maxTotalUsage: maxTotalUsage ? Number(maxTotalUsage) : null,
      maxUsagePerCustomer: maxUsagePerCustomer ? Number(maxUsagePerCustomer) : 1,
      isActive: isActive !== undefined ? Boolean(isActive) : true
    });

    await logActivity({
      action: "COUPON_CREATED",
      category: "DISCOUNT",
      actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
      target: { entityType: "Coupon", entityId: coupon._id, name: coupon.code },
      status: "SUCCESS",
      details: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        expirationDate: coupon.expirationDate
      }
    });

    res.status(201).json({
      message: "Coupon created successfully",
      coupon
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 4. Update coupon (Admin only)
 * PUT /api/coupons/:id
 */
exports.updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    const {
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      expirationDate,
      maxTotalUsage,
      maxUsagePerCustomer,
      isActive
    } = req.body;

    if (discountType && ["percentage", "fixed"].includes(discountType)) {
      coupon.discountType = discountType;
    }

    if (discountValue !== undefined) {
      const val = Number(discountValue);
      if (val > 0) {
        if (coupon.discountType === "percentage" && val > 100) {
          return res.status(400).json({ message: "Percentage discount cannot exceed 100%." });
        }
        coupon.discountValue = val;
      }
    }

    if (description !== undefined) coupon.description = description;
    if (minOrderAmount !== undefined) coupon.minOrderAmount = Number(minOrderAmount);
    if (maxDiscountAmount !== undefined) coupon.maxDiscountAmount = maxDiscountAmount ? Number(maxDiscountAmount) : null;
    if (startDate) coupon.startDate = new Date(startDate);
    if (expirationDate) coupon.expirationDate = new Date(expirationDate);
    if (maxTotalUsage !== undefined) coupon.maxTotalUsage = maxTotalUsage ? Number(maxTotalUsage) : null;
    if (maxUsagePerCustomer !== undefined) coupon.maxUsagePerCustomer = Number(maxUsagePerCustomer);
    if (isActive !== undefined) coupon.isActive = Boolean(isActive);

    await coupon.save();

    await logActivity({
      action: "COUPON_MODIFIED",
      category: "DISCOUNT",
      actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
      target: { entityType: "Coupon", entityId: coupon._id, name: coupon.code },
      status: "SUCCESS",
      details: {
        code: coupon.code,
        isActive: coupon.isActive,
        discountValue: coupon.discountValue
      }
    });

    res.json({ message: "Coupon updated successfully", coupon });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 5. Delete coupon (Admin only)
 * DELETE /api/coupons/:id
 */
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    const code = coupon.code;
    await Coupon.findByIdAndDelete(req.params.id);

    await logActivity({
      action: "COUPON_DELETED",
      category: "DISCOUNT",
      actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
      target: { entityType: "Coupon", entityId: req.params.id, name: code },
      status: "SUCCESS",
      details: { code }
    });

    res.json({ message: `Coupon "${code}" deleted successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

