const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

exports.createOrder = async (req, res) => {
  try {
    const { products } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    let calculatedTotal = 0;
    const validatedProducts = [];

    // 1. Verify all products exist, have sufficient stock, and verify actual price
    for (const item of products) {
      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({
          message: `Product "${item.name || "Item"}" was not found.`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Only ${product.stock} available.`
        });
      }

      calculatedTotal += product.price * item.quantity;
      validatedProducts.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: item.image || product.image || ""
      });
    }

    // 2. Atomically deduct stock
    for (const item of validatedProducts) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      });
    }

    // 3. Create the order
    const order = await Order.create({
      userId: req.user.id,
      userName: req.user.name || "Customer",
      userEmail: req.user.email,
      products: validatedProducts,
      totalAmount: calculatedTotal,
      status: "Pending",
      paymentStatus: "Unpaid"
    });

    res.status(201).json({ message: "Order placed successfully", order });
  } catch (error) {
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

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    if (status) {
      // Admin can only advance fulfillment status if the order is Paid (unless cancelling)
      if (order.paymentStatus !== "Paid" && status !== "Cancelled") {
        return res.status(400).json({
          message: "Cannot update status because payment is still Pending. Customer must complete payment first."
        });
      }

      // If order is being cancelled, restore inventory
      if (status === "Cancelled" && order.status !== "Cancelled") {
        for (const item of order.products) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity }
          });
        }
      }

      // If a previously cancelled order is being reinstated, re-deduct stock
      if (order.status === "Cancelled" && status !== "Cancelled") {
        for (const item of order.products) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: -item.quantity }
          });
        }
      }

      order.status = status;
      await order.save();
      
      const io = req.app.get("io");

      io.emit("orderStatusUpdated", {
        orderId: order._id,
        status: order.status
      });
    }

    res.json({
      message: "Order status updated",
      order
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    const orders = await Order.find({ status: { $ne: "Cancelled" } });
    const totalRevenue = orders.reduce((sum, ord) => sum + (ord.totalAmount || 0), 0);

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

