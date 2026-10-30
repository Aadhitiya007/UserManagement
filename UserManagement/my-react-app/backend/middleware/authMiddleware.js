const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "Server authentication configuration error." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Token Version Invalidation Check
    const user = await User.findById(decoded.id).select("role tokenVersion");
    if (!user) {
      return res.status(401).json({ message: "User account no longer exists." });
    }

    // If token has a tokenVersion and it does not match user's current tokenVersion, reject it
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.tokenVersion || 0)) {
      return res.status(401).json({ message: "Session expired due to password reset. Please log in again." });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};

module.exports = { verifyToken };
