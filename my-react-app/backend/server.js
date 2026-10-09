const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dns = require("dns");
const http =require("http");
const{ Server } = require("socket.io");

require("dotenv").config();


try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  console.warn("DNS warning:", err.message);
}
dns.setDefaultResultOrder("ipv4first");

const uploadDir = path.join(__dirname, "uploads", "products");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();

const server = http.createServer(app);

const io = new Server(server,{
  cors:{
    origin: process.env.CLIENT_URL||[
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    credentials: true
  }
});
app.set("io",io);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

app.use(cors({
  origin: process.env.CLIENT_URL || ["http://localhost:5173", "http://localhost:3000"],
  credentials: true
}));
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

app.use((err, req, res, next) => {
  console.error("Server Error:", err.message || err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error"
  });
});

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/student-ecommerce";
const PORT = process.env.PORT || 5000;

mongoose
  .connect(MONGO_URL, {
    serverSelectionTimeoutMS: 15000
  })
  .then(() => {
    console.log("MongoDB connected successfully");

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
  });

 