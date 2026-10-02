const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    totalStock: {
      type: Number,
      required: true,
      default: 10
    },
    currentStock: {
      type: Number,
      required: true,
      default: 10
    },
    soldCount: {
      type: Number,
      required: true,
      default: 0
    },
    lastPurchasedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inventory", inventorySchema);
