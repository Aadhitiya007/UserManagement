const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dns = require("dns");

require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("❌ CRITICAL SECURITY ERROR: JWT_SECRET is not set in your .env file!");
  process.exit(1);
}

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  console.warn("Could not override DNS servers:", err.message);
}
dns.setDefaultResultOrder("ipv4first");

const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const cartRoutes = require("./routes/cartRoutes");
const productRoutes = require("./routes/productRoutes");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || ["http://localhost:5173", "http://localhost:3000"],
  credentials: true
}));

app.use(express.json());

app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] 🌐 ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/products", productRoutes);
app.use("/uploads", express.static("uploads"));

app.use((err, req, res, next) => {
  console.error("❌ [SERVER ERROR]:", err.message || err);
  res.status(err.status || 400).json({
    message: err.message || "An error occurred on the server"
  });
});

mongoose
  .connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error("MongoDB Connection Error:", error);
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
