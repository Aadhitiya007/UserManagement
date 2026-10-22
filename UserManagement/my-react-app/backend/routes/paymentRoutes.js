const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const paymentController = require("../controllers/paymentController");

// Get payment status for verification
router.get("/:orderId", verifyToken, paymentController.getOrderPaymentStatus);

// Simulate payment outcome
router.post("/simulate", verifyToken, paymentController.simulatePayment);

// Retry payment on an existing unpaid order
router.post("/retry", verifyToken, paymentController.retryPayment);

// Cancel an unpaid checkout session and restore stock
router.post("/cancel", verifyToken, paymentController.cancelPendingPayment);

module.exports = router;