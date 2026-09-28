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

exports.checkout = (req, res) => {
  const { items, totalPrice } = req.body;

  if (!items || items.length === 0) {
    console.error(`❌ [BACKEND CHECKOUT ERROR] Attempted checkout with an empty cart`);
    return res.status(400).json({
      success: false,
      message: "Cart is empty. Cannot place order."
    });
  }

  const orderId = `ORD-${Date.now()}`;
  console.log(`🎉 [BACKEND ORDER PLACED] Order ID: ${orderId} | Items: ${items.length} | Total: ₹${totalPrice}`);

  res.status(201).json({
    success: true,
    message: `Order ${orderId} placed successfully!`,
    orderId,
    totalPrice
  });
};
