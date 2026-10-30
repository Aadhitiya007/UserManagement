const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { processOrderInvoiceAndEmail } = require("../utils/invoiceService");

/**
 * 1. Get Payment & Fulfillment Status for an Order
 * GET /api/payment/:orderId
 */
exports.getOrderPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Authorization: User owns the order or is an administrator
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
 * 2. Simulate Payment Outcome (Development / Testing Only)
 * POST /api/payment/simulate
 * Features:
 * - Strict ownership verification
 * - Rejection of cancelled orders
 * - Idempotent response if order is already paid
 * - Scoped real-time Socket.io notifications (no wide broadcasts)
 */
exports.simulatePayment = async (req, res) => {
  try {
    const { orderId, shouldSucceed, paymentMethod } = req.body;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Valid Order ID is required." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Ownership check
    if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    // Reject payment attempts for cancelled orders
    if (order.status === "Cancelled") {
      return res.status(400).json({
        message: "Cannot process payment for a cancelled order."
      });
    }

    // Idempotency: Prevent duplicate charge processing if already paid
    if (order.paymentStatus === "Paid") {
      return res.status(200).json({
        success: true,
        message: "Order is already paid",
        order
      });
    }

    const attemptId = `ATTEMPT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const selectedMethod = paymentMethod || "Card";

    // Outcome A: Simulated Success
    if (shouldSucceed) {
      order.paymentStatus = "Paid";
      // Advance fulfillment status from Pending to Processing
      if (order.status === "Pending") {
        order.status = "Processing";
      }
      order.paymentMethod = selectedMethod;
      order.paymentDetails = {
        transactionId: attemptId,
        paidAt: new Date()
      };

      order.paymentAttempts.push({
        attemptId,
        method: selectedMethod,
        status: "Success",
        createdAt: new Date()
      });

      await order.save();

      // Emit real-time Socket.io update ONLY to authorized scoped rooms
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
      }

      // Asynchronously trigger automated PDF invoice generation & email delivery
      processOrderInvoiceAndEmail(order._id).catch((err) =>
        console.error("[Payment] Invoice trigger error:", err.message)
      );

      return res.status(200).json({
        success: true,
        message: "Payment simulated successfully",
        attemptId,
        order
      });
    }

    // Outcome B: Simulated Failure
    const failureReason = "Simulated issuer decline (Test simulation failure)";
    order.paymentStatus = "Failed";
    order.paymentMethod = selectedMethod;
    order.paymentDetails = {
      transactionId: attemptId,
      failureReason
    };

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
 * 3. Production Payment Webhook Handler with HMAC-SHA256 Signature Verification
 * POST /api/payment/webhook
 * Headers: x-webhook-signature
 * Body: { event, orderId, transactionId, amount }
 */
exports.handlePaymentWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"] || req.headers["stripe-signature"];
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(500).json({ message: "Webhook secret is not configured on server." });
    }

    if (!signature) {
      return res.status(400).json({ message: "Missing webhook signature header." });
    }

    // Payload string for HMAC verification
    const payloadString = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(payloadString)
      .digest("hex");

    // Timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return res.status(401).json({ message: "Invalid webhook signature." });
    }

    const { event, orderId, transactionId, amount } = req.body;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid orderId in webhook payload." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // Idempotency: Ignore duplicate payment events if order is already Paid
    if (order.paymentStatus === "Paid") {
      return res.status(200).json({ received: true, message: "Order is already paid." });
    }

    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Cannot apply payment to a cancelled order." });
    }

    if (event === "payment.succeeded") {
      order.paymentStatus = "Paid";
      if (order.status === "Pending") {
        order.status = "Processing";
      }
      order.paymentDetails = {
        transactionId: transactionId || `TXN_${Date.now()}`,
        paidAt: new Date()
      };
      order.paymentAttempts.push({
        attemptId: transactionId || `TXN_${Date.now()}`,
        method: "Webhook",
        status: "Success",
        createdAt: new Date()
      });

      await order.save();

      // Scoped socket broadcast
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
      }

      processOrderInvoiceAndEmail(order._id).catch((err) => console.error("[Webhook] Invoice trigger error:", err.message));
      return res.status(200).json({ received: true, status: "Paid" });
    }

    if (event === "payment.failed") {
      order.paymentStatus = "Failed";
      order.paymentDetails = {
        transactionId: transactionId || `FAIL_${Date.now()}`,
        failureReason: "Payment failed at gateway"
      };
      order.paymentAttempts.push({
        attemptId: transactionId || `FAIL_${Date.now()}`,
        method: "Webhook",
        status: "Failed",
        failureReason: "Payment failed at gateway",
        createdAt: new Date()
      });

      await order.save();

      return res.status(200).json({ received: true, status: "Failed" });
    }

    return res.status(200).json({ received: true, message: "Unhandled event type." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 4. Retry an Unpaid or Failed Payment without creating duplicate orders
 * POST /api/payment/retry
 */
exports.retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Valid Order ID is required" });
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
 * 5. Cancel an unpaid checkout session and restore stock
 * POST /api/payment/cancel
 */
exports.cancelPendingPayment = async (req, res) => {
  const { orderId } = req.body;

  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({ message: "Valid Order ID is required." });
  }

  const session = await mongoose.startSession();

  try {
    let deletedOrder = null;

    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        return; // Idempotent: already deleted
      }

      // Verify ownership
      if (order.userId.toString() !== req.user.id && req.user.role !== "admin") {
        const err = new Error("Access denied. Not your order.");
        err.statusCode = 403;
        throw err;
      }

      // Do not allow cancelling if already Paid
      if (order.paymentStatus === "Paid") {
        const err = new Error("Cannot cancel an order that has already been paid.");
        err.statusCode = 400;
        throw err;
      }

      // Atomic delete ensuring status is still unpaid
      const removed = await Order.findOneAndDelete(
        { _id: orderId, paymentStatus: { $ne: "Paid" } },
        { session }
      );

      if (!removed) {
        return;
      }

      // Restore inventory stock atomically for each product
      if (Array.isArray(removed.products)) {
        for (const item of removed.products) {
          if (item.productId && item.quantity > 0) {
            await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { stock: item.quantity } },
              { session }
            );
          }
        }
      }

      deletedOrder = removed;
    });

    if (deletedOrder) {
      const io = req.app.get("io");
      if (io) {
        const payload = { orderId: deletedOrder._id, cancelled: true };
        io.to(`order_${deletedOrder._id}`)
          .to(`user_${deletedOrder.userId}`)
          .to("admins")
          .emit("orderStatusUpdated", payload);
      }
    }

    return res.json({
      success: true,
      message: "Pending order cancelled, inventory restored, and order removed successfully."
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message });
  } finally {
    await session.endSession();
  }
};

