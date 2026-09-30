const express = require("express");
const router = express.Router();
const { verifyToken, optionalVerifyToken } = require("../middleware/authMiddleware");
const {
  addToCart,
  updateQuantity,
  removeFromCart,
  checkout
} = require("../controllers/cartControllers");

router.post("/add", optionalVerifyToken, addToCart);
router.post("/update", optionalVerifyToken, updateQuantity);
router.delete("/remove/:productId", optionalVerifyToken, removeFromCart);
router.post("/checkout", verifyToken, checkout);

module.exports = router;

