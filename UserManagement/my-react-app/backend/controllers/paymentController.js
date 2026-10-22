const Order = require("../models/Order");
const Product = require("../models/Product");

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
      paymentAttempts: order.paymentAttempts || [],
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

    // Rule: Reject payment attempts for cancelled orders
    if (order.status === "Cancelled") {
      return res.status(400).json({
        message: "Cannot process payment for a cancelled order."
      });
    }

    // Rule: Idempotency - Prevent duplicate successful processing of an already paid order
    if (order.paymentStatus === "Paid") {
      return res.status(200).json({
        success: true,
        message: "Order is already paid",
        order
      });
    }

    // Generate a unique internal payment-attempt ID
    const attemptId = `ATTEMPT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const selectedMethod = paymentMethod || "Card";

    // Outcome 1: Payment Succeeded
    if (shouldSucceed) {
      order.paymentStatus = "Paid";
      order.status = "Processing"; // Advance from Pending to Processing
      order.paymentMethod = selectedMethod;
      order.paymentDetails = {
        transactionId: attemptId,
        paidAt: new Date()
      };

      // Record in attempt history
      order.paymentAttempts.push({
        attemptId,
        method: selectedMethod,
        status: "Success",
        createdAt: new Date()
      });

      await order.save();

      // Emit real-time Socket.io update to scoped rooms
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
        io.emit("orderStatusUpdated", payload);
      }

      return res.status(200).json({
        success: true,
        message: "Payment simulated successfully",
        attemptId,
        order
      });
    }

    // Outcome 2: Payment Failed
    const failureReason = "Simulated issuer decline (Test simulation failure)";
    order.paymentStatus = "Failed";
    order.paymentMethod = selectedMethod;
    order.paymentDetails = {
      transactionId: attemptId,
      failureReason
    };

    // Preserve the order and record failed attempt in attempt history
    order.paymentAttempts.push({
      attemptId,
      method: selectedMethod,
      status: "Failed",
      failureReason,
      createdAt: new Date()
    });

    await order.save();

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
      io.emit("orderStatusUpdated", payload);
    }

    return res.status(400).json({
      success: false,
      message: "Payment failed as requested in simulation",
      attemptId,
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

    // Reject retry if order is cancelled
    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Cannot retry payment for a cancelled order." });
    }

    // Reject retry if order is already paid
    if (order.paymentStatus === "Paid") {
      return res.status(400).json({ message: "Cannot retry an order that is already paid." });
    }

    // Reset status to Pending for retry (preserving existing paymentAttempts history)
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

/**
 * 4. Cancel & delete an uncompleted/pending checkout session, restoring stock
 * POST /api/payment/cancel
 */
exports.cancelPendingPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.json({ success: true, message: "Order already cancelled or removed." });
    }

    // Verify ownership
    if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    // Do not allow cancelling if already Paid
    if (order.paymentStatus === "Paid") {
      return res.status(400).json({ message: "Cannot cancel an order that has already been paid." });
    }

    // Restore inventory stock for each product in this order
    if (Array.isArray(order.products)) {
      for (const item of order.products) {
        if (item.productId && item.quantity) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity }
          });
        }
      }
    }

    // Completely delete the pending order document so it doesn't appear in My Orders
    await Order.findByIdAndDelete(order._id);

    // Emit socket event to notify any open order lists
    const io = req.app.get("io");
    if (io) {
      const payload = { orderId: order._id, cancelled: true };
      io.to(`order_${order._id}`)
        .to(`user_${order.userId}`)
        .to("admins")
        .emit("orderStatusUpdated", payload);
      io.emit("orderStatusUpdated", payload);
    }

    res.json({
      success: true,
      message: "Pending order cancelled, inventory restored, and order removed successfully."
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};