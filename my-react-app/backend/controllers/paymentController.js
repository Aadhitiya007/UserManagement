const Order = require("../models/Order");

/**
 * 1. Get Payment & Order Status (for verification on Payment & Success pages)
 * GET /api/payment/:orderId
 */
exports.getOrderPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify ownership: customer can only access their own order, admin can access any
    if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    res.json({
      orderId: order._id,
      totalAmount: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus || "Pending",
      paymentMethod: order.paymentMethod || "Card",
      paymentDetails: order.paymentDetails || {},
      products: order.products,
      createdAt: order.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 2. Simulate Payment Outcome (Success or Failure)
 * POST /api/payment/simulate
 */
exports.simulatePayment = async (req, res) => {
  try {
    const { orderId, shouldSucceed, paymentMethod } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Ownership check
    if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    // Idempotency: Prevent re-processing an already paid order
    if (order.paymentStatus === "Paid") {
      return res.status(200).json({
        success: true,
        message: "Order is already paid",
        order
      });
    }

    // Outcome 1: Payment Succeeded
    if (shouldSucceed) {
      order.paymentStatus = "Paid";
      order.status = "Processing"; // Advance from Pending to Processing
      order.paymentMethod = paymentMethod || "Card";
      order.paymentDetails = {
        transactionId: `TXN_${Date.now()}`,
        paidAt: new Date()
      };
      await order.save();

      // Emit real-time Socket.io update
      const io = req.app.get("io");
      if (io) {
        io.emit("orderStatusUpdated", {
          orderId: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment simulated successfully",
        order
      });
    }

    // Outcome 2: Payment Failed
    order.paymentStatus = "Failed";
    order.paymentMethod = paymentMethod || "Card";
    order.paymentDetails = {
      failureReason: "Simulated test decline (Bank server rejected payment)"
    };
    await order.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("orderStatusUpdated", {
        orderId: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus
      });
    }

    return res.status(400).json({
      success: false,
      message: "Payment failed as requested in simulation",
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 3. Retry an Unpaid or Failed Payment without creating duplicate orders
 * POST /api/payment/retry
 */
exports.retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Ownership check
    if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    if (order.paymentStatus === "Paid") {
      return res.status(400).json({ message: "Cannot retry an order that is already paid" });
    }

    // Reset status to Pending for retry
    order.paymentStatus = "Pending";
    await order.save();

    res.json({
      success: true,
      message: "Order ready for payment retry",
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};