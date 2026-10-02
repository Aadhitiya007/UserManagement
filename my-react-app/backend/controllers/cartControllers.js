const Product = require("../models/product");
const Inventory = require("../models/Inventory");

exports.addToCart = (req, res) => {
  const { productId, name, price } = req.body;
  console.log(`🛒 [BACKEND CART ADD] User: ${req.user ? req.user.email : "Guest"} | Added "${name}" (ID: ${productId}, Price: ₹${price})`);

  res.status(200).json({
    success: true,
    message: `Product "${name}" added to cart successfully.`,
    item: { productId, name, price }
  });
};

exports.updateQuantity = (req, res) => {
  const { productId, change, newQuantity } = req.body;
  console.log(`🔄 [BACKEND CART UPDATE] Product ID: ${productId} | Change: ${change} | New Quantity: ${newQuantity}`);

  res.status(200).json({
    success: true,
    message: `Cart item ${productId} quantity updated to ${newQuantity}.`,
    productId,
    newQuantity
  });
};

exports.removeFromCart = (req, res) => {
  const { productId } = req.params;
  console.log(`🗑️ [BACKEND CART REMOVE] Product ID: ${productId} removed from cart`);

  res.status(200).json({
    success: true,
    message: `Product ID ${productId} removed from cart.`,
    productId
  });
};

exports.checkout = async (req, res) => {
  const { items, totalPrice } = req.body;

  if (!items || items.length === 0) {
    console.error(`❌ [BACKEND CHECKOUT ERROR] Attempted checkout with an empty cart`);
    return res.status(400).json({
      success: false,
      message: "Cart is empty. Cannot place order."
    });
  }

  try {
    for (const item of items) {
      const targetId = item.id || item._id || item.productId;
      if (targetId) {
        const dbProduct = await Product.findById(targetId);
        const invDoc = await Inventory.findOne({ productId: targetId });

        let stockInDb = 10;
        if (invDoc !== null && invDoc !== undefined) {
          stockInDb = invDoc.currentStock;
        } else if (dbProduct && dbProduct.quantity !== undefined && dbProduct.quantity !== null) {
          stockInDb = dbProduct.quantity;
        }

        const reqQty = item.quantity || 1;
        if (stockInDb <= 0) {
          return res.status(400).json({
            success: false,
            message: dbProduct ? `Product "${dbProduct.name}" is out of stock!` : "Product is out of stock!"
          });
        }
        if (reqQty > stockInDb) {
          return res.status(400).json({
            success: false,
            message: `Only ${stockInDb} ${stockInDb === 1 ? "item is" : "items are"} available in stock!`
          });
        }
      }
    }
    
    const updatedProducts = [];
    for (const item of items) {
      const targetId = item.id || item._id || item.productId;
      if (targetId) {
        const dbProduct = await Product.findById(targetId);
        let invDoc = await Inventory.findOne({ productId: targetId });
        const reqQty = item.quantity || 1;

        let currentQty = 10;
        if (invDoc !== null && invDoc !== undefined) {
          currentQty = invDoc.currentStock;
        } else if (dbProduct && dbProduct.quantity !== undefined && dbProduct.quantity !== null) {
          currentQty = dbProduct.quantity;
        }

        const newQty = Math.max(0, currentQty - reqQty);

        if (dbProduct) {
          dbProduct.quantity = newQty;
          await dbProduct.save();
        }

        if (!invDoc && dbProduct) {
          invDoc = new Inventory({
            productId: dbProduct._id,
            productName: dbProduct.name,
            totalStock: 10,
            currentStock: newQty,
            soldCount: reqQty,
            lastPurchasedAt: new Date()
          });
        } else if (invDoc) {
          invDoc.currentStock = newQty;
          invDoc.soldCount = (invDoc.soldCount || 0) + reqQty;
          invDoc.lastPurchasedAt = new Date();
        }
        if (invDoc) {
          await invDoc.save();
        }

        console.log(`📊 [INVENTORY DB UPDATED] Product "${dbProduct ? dbProduct.name : targetId}": Remaining Stock = ${newQty} | Total Units Sold = ${invDoc ? invDoc.soldCount : reqQty}`);
        updatedProducts.push({ id: targetId, quantity: newQty });
      }
    }

    const orderId = `ORD-${Date.now()}`;
    console.log(`🎉 [BACKEND ORDER PLACED] Order ID: ${orderId} | User: ${req.user ? req.user.email : "Authenticated"} | Items: ${items.length} | Total: ₹${totalPrice}`);

    return res.status(201).json({
      success: true,
      message: `Order ${orderId} placed successfully!`,
      orderId,
      totalPrice,
      updatedProducts
    });
  } catch (err) {
    console.error("❌ [CHECKOUT ERROR]:", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error during checkout",
      error: err.message
    });
  }
};
