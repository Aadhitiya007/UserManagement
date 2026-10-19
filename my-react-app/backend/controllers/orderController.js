const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

// Valid status lifecycle transitions
const ALLOWED_TRANSITIONS = {
  Pending: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: []
};

exports.createOrder = async (req, res) => {
  const successfullyDeducted = [];
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // 1. Validate inputs and consolidate duplicate product IDs
    const consolidatedMap = new Map();
    for (const item of products) {
      if (!item.productId || !mongoose.Types.ObjectId.isValid(item.productId)) {
        return res.status(400).json({ message: "Invalid product ID in order items." });
      }

      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ message: "Product quantity must be a positive integer." });
      }

      const idStr = item.productId.toString();
      if (consolidatedMap.has(idStr)) {
        consolidatedMap.get(idStr).quantity += qty;
      } else {
        consolidatedMap.set(idStr, {
          productId: item.productId,
          quantity: qty,
          image: item.image || ""
        });
      }
    }

    let calculatedTotal = 0;
    const validatedProducts = [];

    // 2. Atomically check and deduct stock for each unique item with rollback compensation
    for (const item of consolidatedMap.values()) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );

      if (!updatedProduct) {
        // Rollback already deducted items in this request
        for (const rolled of successfullyDeducted) {
          await Product.findByIdAndUpdate(rolled.productId, {
            $inc: { stock: rolled.quantity }
          });
        }

        const existingProd = await Product.findById(item.productId);
        const prodName = existingProd ? existingProd.name : "Item";
        const availableStock = existingProd ? existingProd.stock : 0;

        return res.status(400).json({
          message: `Insufficient stock for "${prodName}". Only ${availableStock} available.`
        });
      }

      successfullyDeducted.push({
        productId: item.productId,
        quantity: item.quantity
      });

      // Price fetched directly from MongoDB database (never trusted from frontend)
      calculatedTotal += updatedProduct.price * item.quantity;
      validatedProducts.push({
        productId: updatedProduct._id,
        name: updatedProduct.name,
        price: updatedProduct.price,
        quantity: item.quantity,
        image: item.image || updatedProduct.image || ""
      });
    }

    // 3. Create order with initial pending status
    const order = await Order.create({
      userId: req.user.id,
      userName: req.user.name || "Customer",
      userEmail: req.user.email,
      products: validatedProducts,
      totalAmount: calculatedTotal,
      status: "Pending",
      paymentStatus: "Pending"
    });

    res.status(201).json({ message: "Order placed successfully", order });
  } catch (error) {
    // If an unexpected error occurs during order creation, roll back any stock deductions
    for (const rolled of successfullyDeducted) {
      await Product.findByIdAndUpdate(rolled.productId, {
        $inc: { stock: rolled.quantity }
      }).catch(() => {});
    }
    res.status(500).json({ message: error.message });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Validate lifecycle status transitions
    const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];
    if (order.status !== status && !allowedNext.includes(status)) {
      return res.status(400).json({
        message: `Invalid status transition from "${order.status}" to "${status}".`
      });
    }

    // Admin can only advance fulfillment status if the order is Paid (unless cancelling)
    if (order.paymentStatus !== "Paid" && status !== "Cancelled") {
      return res.status(400).json({
        message: "Cannot advance status because payment is still Pending. Customer must complete payment first."
      });
    }

    // If order is being cancelled, restore inventory exactly once
    if (status === "Cancelled" && order.status !== "Cancelled") {
      for (const item of order.products) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity }
        });
      }
    }

    order.status = status;
    await order.save();

    // Notify via Socket.io to scoped rooms and general listener
    const io = req.app.get("io");
    if (io) {
      const payload = {
        orderId: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus
      };
      io.to(`order_${order._id}`)
        .to(`user_${order.userId}`)
        .to("admins")
        .emit("orderStatusUpdated", payload);
      // Also emit generally for current active listeners
      io.emit("orderStatusUpdated", payload);
    }

    res.json({
      message: "Order status updated",
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    // Business Logic Fix: Total revenue must strictly sum orders where paymentStatus is "Paid"
    const paidOrders = await Order.find({ paymentStatus: "Paid" });
    const totalRevenue = paidOrders.reduce((sum, ord) => sum + (ord.totalAmount || 0), 0);

    res.json({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

