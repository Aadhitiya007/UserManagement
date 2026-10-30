const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true
    },
    category: {
      type: String,
      enum: ["INVENTORY", "DISCOUNT", "ORDER", "PAYMENT", "AUTH", "EMAIL", "SYSTEM"],
      default: "SYSTEM",
      index: true
    },
    actor: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      email: { type: String },
      role: { type: String, default: "system" },
      ipAddress: { type: String }
    },
    target: {
      entityType: { type: String }, // "Product", "Coupon", "Order", "User"
      entityId: { type: String },
      name: { type: String }
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "WARNING", "INFO"],
      default: "SUCCESS",
      index: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

// Performance indexes & 90-day automatic TTL expiration to prevent infinite database growth
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("AuditLog", auditLogSchema);

