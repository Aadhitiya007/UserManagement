const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dns = require("dns");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

require("dotenv").config();
const s3 = require("./config/s3");
const Order = require("./models/Order");

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
const couponRoutes = require("./routes/couponRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");

const app = express();
app.set("trust proxy", 1);
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

// 1. Socket.IO Connection Authentication Middleware (JWT)
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization &&
      socket.handshake.headers.authorization.split(" ")[1]) ||
    socket.handshake.query?.token;

  if (!token) {
    return next(new Error("Authentication error: Token required."));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new Error("Server error: JWT secret not configured."));
  }

  try {
    const decoded = jwt.verify(token, secret);
    socket.user = decoded; // { id, email, role, name }
    next();
  } catch (err) {
    return next(new Error("Authentication error: Invalid or expired token."));
  }
});

io.on("connection", (socket) => {
  // Scoped room for specific user notifications - authorized only for that user or an admin
  socket.on("joinUserRoom", (userId) => {
    if (!socket.user) {
      return socket.emit("error", { message: "Unauthenticated socket session." });
    }

    if (socket.user.id === userId || socket.user.role === "admin") {
      socket.join(`user_${userId}`);
    } else {
      socket.emit("error", { message: "Unauthorized to join user room." });
    }
  });

  // Scoped room for specific order notifications - authorized only if user owns the order or is admin
  socket.on("joinOrderRoom", async (orderId) => {
    if (!socket.user) {
      return socket.emit("error", { message: "Unauthenticated socket session." });
    }

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return socket.emit("error", { message: "Invalid order ID." });
    }

    try {
      const order = await Order.findById(orderId).select("userId");
      if (!order) {
        return socket.emit("error", { message: "Order not found." });
      }

      if (order.userId.toString() === socket.user.id || socket.user.role === "admin") {
        socket.join(`order_${orderId}`);
      } else {
        socket.emit("error", { message: "Unauthorized: Access denied to order room." });
      }
    } catch (err) {
      socket.emit("error", { message: "Failed to verify order ownership." });
    }
  });

  // Scoped room for admin dashboard notifications - authorized strictly for admin role
  socket.on("joinAdminRoom", () => {
    if (socket.user && socket.user.role === "admin") {
      socket.join("admins");
    } else {
      socket.emit("error", { message: "Unauthorized: Admin privileges required." });
    }
  });

  socket.on("disconnect", () => {});
});

app.use(cors(corsOptions));
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use((req, res, next) => {
  // Avoid logging sensitive authorization tokens or request bodies in production
  if (process.env.NODE_ENV !== "test") {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// Live System Health Check Endpoint
app.get("/api/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const bucketName =
    typeof s3.getBucketName === "function"
      ? s3.getBucketName()
      : (process.env.AWS_S3_BUCKET_NAME || "");

  const healthData = {
    status: isDbConnected ? "healthy" : "degraded",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: isDbConnected ? "connected" : "disconnected"
      },
      s3: {
        status: bucketName ? "configured" : "not_configured",
        bucket: bucketName || null,
        region: process.env.AWS_REGION || "ap-south-2"
      }
    }
  };

  res.status(isDbConnected ? 200 : 503).json(healthData);
});

// Primary API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/admin/logs", auditLogRoutes);

app.use((err, req, res, next) => {
  console.error("Server Error:", err.message || err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error"
  });
});

const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/student-ecommerce";
const PORT = process.env.PORT || 5000;

if (require.main === module) {
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
}

module.exports = { app, server, io };
