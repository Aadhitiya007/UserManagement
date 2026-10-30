const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const { generateInvoicePDF } = require("../utils/invoiceGenerator");

// Valid status lifecycle transitions
const ALLOWED_TRANSITIONS = {
  Pending: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: []
};

/**
 * 1. Place a new Order using MongoDB Transactions
 * Requirements:
 * - Validate non-empty cart, valid ObjectId, positive integer quantity
 * - Consolidate duplicate product IDs
 * - Atomic conditional stock deduction inside session.withTransaction()
 * - Authoritative DB pricing only (never trust req.body.totalAmount)
 * - Automatic rollback via transaction on any failure (no manual compensation loops)
 */
exports.createOrder = async (req, res) => {
  const { products } = req.body;

  // 1. Validate inputs
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: "Cart is empty. Products array is required." });
  }

  // 2. Validate product IDs and positive integer quantities; consolidate duplicates
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
        productId: new mongoose.Types.ObjectId(idStr),
        quantity: qty,
        image: item.image || ""
      });
    }
  }

  const session = await mongoose.startSession();
  let createdOrder = null;

  try {
    await session.withTransaction(async () => {
      let calculatedTotal = 0;
      const validatedProducts = [];

      // 3. Process each consolidated product atomically inside the transaction
      for (const item of consolidatedMap.values()) {
        // Atomic conditional stock decrement: requires stock >= requestedQuantity
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session, returnDocument: "after" }
        );

        if (!updatedProduct) {
          // Find the product without decrement to give an exact reason
          const existingProduct = await Product.findById(item.productId).session(session);
          if (!existingProduct) {
            const err = new Error(`Product with ID ${item.productId} not found.`);
            err.statusCode = 404;
            throw err;
          }
          const err = new Error(
            `Insufficient stock for "${existingProduct.name}". Only ${existingProduct.stock} available.`
          );
          err.statusCode = 400;
          throw err;
        }

        // Price is authoritative from database; never accept client financial inputs
        calculatedTotal += updatedProduct.price * item.quantity;

        validatedProducts.push({
          productId: updatedProduct._id,
          name: updatedProduct.name,
          price: updatedProduct.price,
          quantity: item.quantity,
          image: item.image || updatedProduct.image || ""
        });
      }

      // 4. Create the order document inside the active transaction
      const orders = await Order.create(
        [
          {
            userId: req.user.id,
            userName: req.user.name || "Customer",
            userEmail: req.user.email,
            products: validatedProducts,
            totalAmount: calculatedTotal,
            status: "Pending",
            paymentStatus: "Pending"
          }
        ],
        { session }
      );

      createdOrder = orders[0];
    });

    // Notify connected admin rooms of new order placement
    const io = req.app.get("io");
    if (io && createdOrder) {
      const payload = {
        orderId: createdOrder._id,
        userId: createdOrder.userId,
        status: createdOrder.status,
        paymentStatus: createdOrder.paymentStatus,
        totalAmount: createdOrder.totalAmount
      };
      io.to("admins").to(`user_${createdOrder.userId}`).emit("orderCreated", payload);
    }

    return res.status(201).json({
      message: "Order placed successfully",
      order: createdOrder
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to process order."
    });
  } finally {
    await session.endSession();
  }
};

/**
 * 2. Get Orders for the authenticated user
 */
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 3. Get All Orders (Admin only)
 */
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 4. Update Order Status with Strict Lifecycle Validation & Atomic Cancellation
 * Admin only. Transitions:
 * - Pending -> Processing / Cancelled
 * - Processing -> Shipped / Cancelled
 * - Shipped -> Delivered / Cancelled
 * - Delivered / Cancelled -> Terminal (no further transitions)
 */
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  if (!status) {
    return res.status(400).json({ message: "Status is required." });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid order ID format." });
  }

  const session = await mongoose.startSession();

  try {
    let updatedOrder = null;

    await session.withTransaction(async () => {
      // Find order inside transaction
      const order = await Order.findById(id).session(session);
      if (!order) {
        const err = new Error("Order not found");
        err.statusCode = 404;
        throw err;
      }

      // If requested status is same as current status
      if (order.status === status) {
        if (status === "Cancelled") {
          const err = new Error("Order is already cancelled.");
          err.statusCode = 400;
          throw err;
        }
        updatedOrder = order;
        return;
      }

      // Check valid lifecycle transition
      const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];
      if (!allowedNext.includes(status)) {
        const err = new Error(
          `Invalid status transition from "${order.status}" to "${status}".`
        );
        err.statusCode = 400;
        throw err;
      }

      // Fulfillment transitions (Processing, Shipped, Delivered) require Paid status
      if (status !== "Cancelled" && order.paymentStatus !== "Paid") {
        const err = new Error(
          "Cannot advance status because payment is still Pending. Customer must complete payment first."
        );
        err.statusCode = 400;
        throw err;
      }

      // Case 1: Cancellation with atomic inventory restoration
      if (status === "Cancelled") {
        // Atomic conditional lock: ensures order is not already Cancelled or Delivered
        const lockedOrder = await Order.findOneAndUpdate(
          { _id: id, status: { $in: ["Pending", "Processing", "Shipped"] } },
          { $set: { status: "Cancelled" } },
          { session, returnDocument: "after" }
        );

        if (!lockedOrder) {
          const err = new Error("Order cannot be cancelled in its current state.");
          err.statusCode = 400;
          throw err;
        }

        // Restore inventory stock atomically inside the transaction
        for (const item of lockedOrder.products) {
          if (item.productId && item.quantity > 0) {
            await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { stock: item.quantity } },
              { session }
            );
          }
        }

        updatedOrder = lockedOrder;
      } else {
        // Case 2: Advancement to Processing, Shipped, or Delivered
        order.status = status;
        await order.save({ session });
        updatedOrder = order;
      }
    });

    // Notify strictly authorized scoped rooms via Socket.io (no broad broadcast)
    const io = req.app.get("io");
    if (io && updatedOrder) {
      const payload = {
        orderId: updatedOrder._id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus
      };
      io.to(`order_${updatedOrder._id}`)
        .to(`user_${updatedOrder.userId}`)
        .to("admins")
        .emit("orderStatusUpdated", payload);
    }

    return res.json({
      message: "Order status updated successfully",
      order: updatedOrder
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to update order status."
    });
  } finally {
    await session.endSession();
  }
};

/**
 * 5. Admin Dashboard Statistics
 */
exports.getAdminStats = async (req, res) => {
  try {
    const [totalUsers, totalProducts, totalOrders, paidOrders] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.find({ paymentStatus: "Paid" }).select("totalAmount")
    ]);

    // Revenue strictly sums verified Paid orders
    const totalRevenue = paidOrders.reduce((sum, ord) => sum + (Number(ord.totalAmount) || 0), 0);

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

/**
 * 6. Authenticated Invoice Download
 * GET /api/orders/:id/invoice
 */
exports.downloadInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid order ID format.' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    // Ownership or Admin authorization
    const isOwner = order.userId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied. Not your order.' });
    }

    // Invoices are strictly restricted to Paid orders
    if (order.paymentStatus !== 'Paid') {
      return res.status(400).json({ message: 'Invoice is only available for paid orders.' });
    }

    const user = await User.findById(order.userId).select('name email phone country');
    const pdfBuffer = await generateInvoicePDF(order, user);
    const invoiceNum = order.invoiceNumber || ('INV-' + order._id.toString().substring(18, 24).toUpperCase());

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="shopiee-invoice-${invoiceNum}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err) {
    console.error('[Invoice Download] Error:', err.message);
    return res.status(500).json({ message: 'Failed to generate invoice PDF.' });
  }
};
