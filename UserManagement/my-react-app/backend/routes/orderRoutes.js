const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleMiddleware");
const {
  createOrder,
  getUserOrders,
  getAllOrders,
  updateOrderStatus,
  getAdminStats
} = require("../controllers/orderController");

router.post("/", verifyToken, createOrder);
router.get("/my-orders", verifyToken, getUserOrders);
router.get("/", verifyToken, requireAdmin, getAllOrders);
router.get("/stats", verifyToken, requireAdmin, getAdminStats);
router.put("/:id/status", verifyToken, requireAdmin, updateOrderStatus);

module.exports = router;
