const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { verifyToken } = require("../middleware/authMiddleware");
const { adminLogin, userRegister, userLogout } = require("../controllers/authControllers");

// Protect login and signup endpoints against brute-force password guessing
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // Limit each IP to 15 login/signup attempts per 15 mins
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login/signup attempts from this IP, please try again after 15 minutes." }
});

router.post("/login", authLimiter, adminLogin);
router.post("/register", authLimiter, userRegister);
router.post("/logout", verifyToken, userLogout);

module.exports = router;