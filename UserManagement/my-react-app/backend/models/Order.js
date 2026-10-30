const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    name: { type: String, required: true },
    price: { 
      type: Number, 
      required: true,
      min: [0, "Item price cannot be negative"]
    },
    originalPrice: {
      type: Number,
      min: [0, "Original price cannot be negative"]
    },
    discountedPrice: {
      type: Number,
      min: [0, "Discounted price cannot be negative"]
    },
    itemDiscount: {
      type: Number,
      default: 0,
      min: [0, "Item discount cannot be negative"]
    },
    quantity: { 
      type: Number, 
      required: true,
      min: [1, "Quantity must be at least 1"],
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer"
      }
    },
    image: { type: String }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    userName: { type: String },
    userEmail: { type: String },
    products: {
      type: [orderItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Order must contain at least one product."
      }
    },
    totalAmount: { 
      type: Number, 
      required: true,
      min: [0, "Total amount cannot be negative"]
    },
    // Historical discount snapshot: preserves exact figures forever
    discountDetails: {
      originalSubtotal: { type: Number, default: 0 },
      productDiscountTotal: { type: Number, default: 0 },
      couponCode: { type: String, uppercase: true, trim: true },
      couponDiscount: { type: Number, default: 0 },
      deliveryFee: { type: Number, default: 0 }
    },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending"
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded", "Unpaid"],
      default: "Pending"
    },
    paymentMethod: {
      type: String,
      default: "Card"
    },
    paymentDetails: {
      transactionId: { type: String },
      paidAt: { type: Date },
      failureReason: { type: String }
    },
    paymentAttempts: [
      {
        attemptId: { type: String, required: true },
        method: { type: String, default: "Card" },
        status: { type: String, enum: ["Success", "Failed"], required: true },
        failureReason: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    // Automated Invoice Metadata & Idempotency tracking
    invoiceNumber: {
      type: String,
      sparse: true,
      index: true
    },
    invoiceGeneratedAt: {
      type: Date
    },
    invoiceEmailSentAt: {
      type: Date
    },
    invoiceEmailStatus: {
      type: String,
      enum: ["NotSent", "Sending", "Sent", "Failed"],
      default: "NotSent"
    }
  },
  { timestamps: true }
);

// Performance & Query Optimization Indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
