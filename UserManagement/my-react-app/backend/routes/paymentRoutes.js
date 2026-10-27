const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const paymentController = require("../controllers/paymentController");

// 1. Get payment status for verification
router.get("/:orderId", verifyToken, paymentController.getOrderPaymentStatus);

// 2. Production payment webhook (HMAC-SHA256 signature verified inside controller)
router.post("/webhook", paymentController.handlePaymentWebhook);

// 3. Simulate payment outcome (Dev / Testing)
router.post("/simulate", verifyToken, paymentController.simulatePayment);

// 4. Retry payment on an existing unpaid order
router.post("/retry", verifyToken, paymentController.retryPayment);

// 5. Cancel an unpaid checkout session and restore stock
router.post("/cancel", verifyToken, paymentController.cancelPendingPayment);

module.exports = router;
