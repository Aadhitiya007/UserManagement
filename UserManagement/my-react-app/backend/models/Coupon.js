const mongoose = require("mongoose");

const customerUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    userEmail: {
      type: String
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order"
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: [true, "Discount type is required"],
      default: "percentage"
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0, "Discount value cannot be negative"]
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, "Minimum order amount cannot be negative"]
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: [0, "Maximum discount amount cannot be negative"]
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    expirationDate: {
      type: Date,
      required: [true, "Expiration date is required"]
    },
    maxTotalUsage: {
      type: Number,
      default: null, // null means unlimited
      min: [1, "Max total usage must be at least 1"]
    },
    usageCount: {
      type: Number,
      default: 0,
      min: [0, "Usage count cannot be negative"]
    },
    maxUsagePerCustomer: {
      type: Number,
      default: 1,
      min: [1, "Max usage per customer must be at least 1"]
    },
    customerUsage: [customerUsageSchema],
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

// Indexes for query optimization
couponSchema.index({ isActive: 1, expirationDate: 1 });

module.exports = mongoose.model("Coupon", couponSchema);

