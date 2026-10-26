const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dns = require("dns");
const http =require("http");
const{ Server } = require("socket.io");

require("dotenv").config();
const s3 = require("./config/s3");


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
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((url) => url.trim().replace(/\/$/, ""))
    : [])
];

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Automatically permit all Vercel production & preview deployments
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*onrender\.com$/.test(origin)) return true;
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Socket CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST"]
  }
});
app.set("io", io);

io.on("connection", (socket) => {
  // Scoped room for specific user notifications
  socket.on("joinUserRoom", (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
    }
  });

  // Scoped room for specific order notifications
  socket.on("joinOrderRoom", (orderId) => {
    if (orderId) {
      socket.join(`order_${orderId}`);
    }
  });

  // Scoped room for admin notifications
  socket.on("joinAdminRoom", () => {
    socket.join("admins");
  });

  socket.on("disconnect", () => {
  });
});

app.use(cors(corsOptions));
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
app.use("/api/payment", paymentRoutes);

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
  .then(async () => {
    console.log("MongoDB connected successfully");
    await s3.checkConnection();

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
  });

 