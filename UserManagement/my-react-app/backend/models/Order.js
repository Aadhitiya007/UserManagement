const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
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
    products: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending","Processing", "Shipped", "Delivered", "Cancelled"],
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
    ]
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
Order.collection.dropIndex("orderId_1").catch(() => { 
});

module.exports = Order;
