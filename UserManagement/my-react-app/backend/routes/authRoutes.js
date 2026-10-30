const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { register, login, forgotPassword, resetPassword } = require("../controllers/authController");

// General login/register rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per IP
  message: { message: "Too many authentication attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for forgot password requests (5 requests per 15 minutes per IP)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: "Too many password reset requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for reset password attempts (10 requests per 15 minutes per IP)
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many password reset attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.put("/reset-password/:token", resetPasswordLimiter, resetPassword);

module.exports = router;
