const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const {
  addToCart,
  updateQuantity,
  removeFromCart,
  checkout
} = require("../controllers/cartControllers");

router.post("/add", verifyToken, addToCart);
router.post("/update", verifyToken, updateQuantity);
router.delete("/remove/:productId", verifyToken, removeFromCart);
router.post("/checkout", verifyToken, checkout);

module.exports = router;
