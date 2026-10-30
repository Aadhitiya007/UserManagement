const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const Coupon = require("../models/Coupon");
const AuditLog = require("../models/AuditLog");
const { generateInvoicePDF } = require("../utils/invoiceGenerator");
const { calculateProductDiscount } = require("../utils/discountCalculator");
const { logActivity } = require("../utils/logger");

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
 * - Authoritative DB pricing only (evaluate product-level discount)
 * - Coupon validation & calculation inside transaction
 * - Store immutable historical price & discount snapshot
 * - Automatic rollback via transaction on any failure
 */
exports.createOrder = async (req, res) => {
  const { products, couponCode } = req.body;

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
  const outOfStockProducts = [];

  try {
    await session.withTransaction(async () => {
      let originalSubtotal = 0;
      let subtotalAfterProductDiscounts = 0;
      let productDiscountTotal = 0;
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

        if (updatedProduct.stock === 0) {
          outOfStockProducts.push({ id: updatedProduct._id, name: updatedProduct.name });
        }

        // Authoritative product discount calculation from database
        const discountInfo = calculateProductDiscount(updatedProduct);
        const itemOriginalPrice = discountInfo.originalPrice;
        const itemEffectivePrice = discountInfo.effectivePrice;
        const itemDiscountAmount = discountInfo.discountAmount * item.quantity;

        originalSubtotal += itemOriginalPrice * item.quantity;
        subtotalAfterProductDiscounts += itemEffectivePrice * item.quantity;
        productDiscountTotal += itemDiscountAmount;

        validatedProducts.push({
          productId: updatedProduct._id,
          name: updatedProduct.name,
          price: itemEffectivePrice,
          originalPrice: itemOriginalPrice,
          discountedPrice: itemEffectivePrice,
          itemDiscount: itemDiscountAmount,
          quantity: item.quantity,
          image: item.image || updatedProduct.image || ""
        });
      }

      // 4. Validate Coupon (if provided)
      let couponDiscount = 0;
      let validatedCouponCode = null;

      if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
        const cleanCode = couponCode.trim().toUpperCase();
        const coupon = await Coupon.findOne({ code: cleanCode }).session(session);

        if (!coupon) {
          const err = new Error(`Coupon code "${cleanCode}" does not exist.`);
          err.statusCode = 400;
          throw err;
        }

        if (!coupon.isActive) {
          const err = new Error(`Coupon "${cleanCode}" is no longer active.`);
          err.statusCode = 400;
          throw err;
        }

        const now = new Date();
        if (coupon.startDate && new Date(coupon.startDate) > now) {
          const err = new Error(`Coupon "${cleanCode}" is not active yet.`);
          err.statusCode = 400;
          throw err;
        }

        if (coupon.expirationDate && new Date(coupon.expirationDate) < now) {
          const err = new Error(`Coupon "${cleanCode}" has expired.`);
          err.statusCode = 400;
          throw err;
        }

        if (coupon.minOrderAmount && subtotalAfterProductDiscounts < coupon.minOrderAmount) {
          const err = new Error(
            `Coupon "${cleanCode}" requires a minimum order of ₹${coupon.minOrderAmount.toLocaleString("en-IN")}.`
          );
          err.statusCode = 400;
          throw err;
        }

        if (coupon.maxTotalUsage !== null && coupon.usageCount >= coupon.maxTotalUsage) {
          const err = new Error(`Coupon "${cleanCode}" has reached its maximum usage limit.`);
          err.statusCode = 400;
          throw err;
        }

        if (coupon.maxUsagePerCustomer && Array.isArray(coupon.customerUsage)) {
          const userCount = coupon.customerUsage.filter(
            (u) => u.userId && u.userId.toString() === req.user.id.toString()
          ).length;

          if (userCount >= coupon.maxUsagePerCustomer) {
            const err = new Error(`You have already redeemed coupon "${cleanCode}" the maximum number of times.`);
            err.statusCode = 400;
            throw err;
          }
        }

        // Calculate coupon discount
        if (coupon.discountType === "percentage") {
          couponDiscount = Math.round((subtotalAfterProductDiscounts * coupon.discountValue) / 100);
          if (coupon.maxDiscountAmount && couponDiscount > coupon.maxDiscountAmount) {
            couponDiscount = coupon.maxDiscountAmount;
          }
        } else if (coupon.discountType === "fixed") {
          couponDiscount = Math.min(coupon.discountValue, subtotalAfterProductDiscounts);
        }

        couponDiscount = Math.min(couponDiscount, subtotalAfterProductDiscounts);
        validatedCouponCode = coupon.code;
      }

      // Final payable amount (never negative)
      const calculatedTotal = Math.max(0, subtotalAfterProductDiscounts - couponDiscount);

      // 5. Create the order document with full discount snapshot inside active transaction
      const orders = await Order.create(
        [
          {
            userId: req.user.id,
            userName: req.user.name || "Customer",
            userEmail: req.user.email,
            products: validatedProducts,
            totalAmount: calculatedTotal,
            discountDetails: {
              originalSubtotal,
              productDiscountTotal,
              couponCode: validatedCouponCode,
              couponDiscount,
              deliveryFee: 0
            },
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

    // Audit Log: Order Placed
    await logActivity({
      action: "ORDER_CREATED",
      category: "ORDER",
      actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
      target: { entityType: "Order", entityId: createdOrder._id },
      status: "SUCCESS",
      details: {
        orderId: createdOrder._id,
        totalAmount: createdOrder.totalAmount,
        itemCount: createdOrder.products.length,
        couponCode: createdOrder.discountDetails?.couponCode,
        couponDiscount: createdOrder.discountDetails?.couponDiscount
      }
    });

    // Audit Log: Products that transitioned to Out of Stock
    for (const p of outOfStockProducts) {
      await logActivity({
        action: "PRODUCT_OUT_OF_STOCK",
        category: "INVENTORY",
        actor: { userId: req.user.id, email: req.user.email, role: req.user.role },
        target: { entityType: "Product", entityId: p.id, name: p.name },
        status: "WARNING",
        details: { reason: "Depleted after customer purchase", orderId: createdOrder._id }
      });
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
    let oldStatus = "";

    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session);
      if (!order) {
        const err = new Error("Order not found");
        err.statusCode = 404;
        throw err;
      }

      oldStatus = order.status;

      if (order.status === status) {
        if (status === "Cancelled") {
          const err = new Error("Order is already cancelled.");
          err.statusCode = 400;
          throw err;
        }
        updatedOrder = order;
        return;
      }

      const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];
      if (!allowedNext.includes(status)) {
        const err = new Error(
          `Invalid status transition from "${order.status}" to "${status}".`
        );
        err.statusCode = 400;
        throw err;
      }

      if (status !== "Cancelled" && order.paymentStatus !== "Paid") {
        const err = new Error(
          "Cannot advance status because payment is still Pending. Customer must complete payment first."
        );
        err.statusCode = 400;
        throw err;
      }

      if (status === "Cancelled") {
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
        order.status = status;
        await order.save({ session });
        updatedOrder = order;
      }
    });

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

    // Audit Log: Order Status Change
    await logActivity({
      action: status === "Cancelled" ? "ORDER_CANCELLED" : "ORDER_STATUS_UPDATED",
      category: "ORDER",
      actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
      target: { entityType: "Order", entityId: updatedOrder._id },
      status: "SUCCESS",
      details: {
        previousStatus: oldStatus,
        newStatus: status,
        paymentStatus: updatedOrder.paymentStatus
      }
    });

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
 * 5. Admin Comprehensive Dashboard Statistics
 * Returns real historical and current figures across Revenue, Orders, Products, Customers, Inventory, and Discounts.
 */
exports.getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalCustomers,
      totalProducts,
      totalOrders,
      pendingOrders,
      paidOrders,
      outOfStockCount,
      lowStockCount,
      activeCouponsCount,
      activeProductDiscountsCount,
      recentOrders,
      recentLogs
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: { $ne: "admin" } }),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: "Pending" }),
      Order.find({ paymentStatus: "Paid" }).select("totalAmount createdAt"),
      Product.countDocuments({ stock: 0 }),
      Product.countDocuments({ stock: { $gt: 0, $lte: 5 } }),
      Coupon.countDocuments({ isActive: true, expirationDate: { $gte: new Date() } }),
      Product.countDocuments({ "discount.isActive": true }),
      Order.find().sort({ createdAt: -1 }).limit(6),
      AuditLog.find().sort({ createdAt: -1 }).limit(6)
    ]);

    const totalRevenue = paidOrders.reduce((sum, ord) => sum + (Number(ord.totalAmount) || 0), 0);
    const paidOrdersCount = paidOrders.length;
    const activeDiscounts = activeCouponsCount + activeProductDiscountsCount;

    // Last 30 days revenue trend calculation from actual timestamps
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPaid = paidOrders.filter((o) => new Date(o.createdAt) >= last30Days);
    const recentRevenue = recentPaid.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    res.json({
      totalRevenue,
      totalOrders,
      totalCustomers: totalCustomers || totalUsers,
      totalUsers,
      totalProducts,
      pendingOrders,
      paidOrders: paidOrdersCount,
      outOfStockProducts: outOfStockCount,
      lowStockProducts: lowStockCount,
      activeDiscounts,
      activeCouponsCount,
      activeProductDiscountsCount,
      recentRevenue,
      recentOrders,
      recentLogs
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
      return res.status(400).json({ message: "Invalid order ID format." });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // Ownership or Admin authorization
    const isOwner = order.userId.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Access denied. Not your order." });
    }

    // Invoices are strictly restricted to Paid orders
    if (order.paymentStatus !== "Paid") {
      return res.status(400).json({ message: "Invoice is only available for paid orders." });
    }

    const user = await User.findById(order.userId).select("name email phone country");
    const pdfBuffer = await generateInvoicePDF(order, user);
    const invoiceNum = order.invoiceNumber || ("INV-" + order._id.toString().substring(18, 24).toUpperCase());

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="shopiee-invoice-${invoiceNum}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err) {
    console.error("[Invoice Download] Error:", err.message);
    return res.status(500).json({ message: "Failed to generate invoice PDF." });
  }
};
