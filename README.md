<div align="center">

# 🛒 Shopiee - Full-Stack E-Commerce Platform

A production-ready, highly secure Full-Stack E-Commerce web application built with the **MERN Stack** (MongoDB, Express.js, React 19, Node.js), powered by **Real-Time WebSockets (Socket.io)** and **Private AWS S3 Cloud Storage with Presigned URLs**.

[![React 19](https://img.shields.io/badge/React-19-blue.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.2-purple.svg?logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey.svg?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen.svg?logo=mongodb)](https://www.mongodb.com/)
[![AWS S3](https://img.shields.io/badge/AWS-S3_Private_Bucket-orange.svg?logo=amazons3)](https://aws.amazon.com/s3/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-black.svg?logo=socketdotio)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📸 Application Screenshots

<div align="center">

### 🛍️ Storefront & Product Catalog
*Interactive product grid with instant search, category filtering, responsive cards, and stock status.*
<br/>
<img src="docs/screenshots/products-storefront.png" alt="Shopiee Storefront" width="90%" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />

<br/><br/>

### 📊 Admin Overview & Analytics Dashboard
*Real-time business performance analytics tracking Total Users, Products, Orders, and strictly Verified Revenue.*
<br/>
<img src="docs/screenshots/admin-dashboard.png" alt="Admin Dashboard" width="90%" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />

<br/><br/>

### 📦 Customer Order Management & Tracking
*Real-time order tracking with status badges (Pending, Processing, Shipped, Delivered) and payment verification.*
<br/>
<img src="docs/screenshots/order-tracking.png" alt="Order Tracking" width="90%" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />

<br/><br/>

### 🔐 Secure User Authentication Portal
*Clean authentication interface with rate-limiting protection, token authorization, and role enforcement.*
<br/>
<img src="docs/screenshots/user-login.png" alt="User Login" width="90%" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />

</div>

---

## 🌟 Key Features

### 🛍️ Storefront & Catalog Experience
- **Debounced Instant Search**: Sub-300ms product search with sanitized regex patterns to eliminate ReDoS vulnerabilities.
- **Product Specifications & Ratings**: Verified customer reviews, dynamic star calculations, and manufacturer warranty details.
- **Cart State Management**: Local client state synchronized with live server stock checks.

### 🛡️ Enterprise-Grade Security
- **Private S3 Storage (Zero Public Access)**: AWS S3 bucket maintains strict "Block All Public Access". Image retrieval uses short-lived **AWS SDK v3 Presigned GET URLs** (HMAC-SHA256 signatures with 1-hour expiration).
- **In-Database Price Enforcement**: Request body prices are completely ignored; order totals are authoritatively calculated directly from MongoDB, blocking client-side price manipulation.
- **Atomic Stock Decrement**: Uses MongoDB atomic operator `{ $inc: { stock: -qty } }` with condition `{ stock: { $gte: qty } }` to prevent race conditions and double-selling.
- **Privilege Escalation Protection**: User registration strictly forces `role: "user"`. Admin accounts cannot be created through public endpoints.
- **Brute-Force Rate Limiting**: Authentication endpoints are guarded by `express-rate-limit` (20 attempts per 15 minutes per IP).
- **Dynamic CORS Policy**: Regex-validated origin checks allowing secure communication across Vercel production and preview deployments (`*.vercel.app`).

### ⚡ Real-Time WebSockets (Socket.io)
- **Room-Scoped Messaging**: Clients are partitioned into scoped rooms (`admins`, `user_<id>`, `order_<id>`).
- **Instant Status Broadcasting**: Changing an order status immediately triggers real-time UI updates on both the customer's order tracker and the admin table without page reloads.

### 📋 Strict Order Finite State Machine (FSM)
- Enforces valid transition paths:  
  `Pending` ➔ `Processing` ➔ `Shipped` ➔ `Delivered` (or `Cancelled`).
- Fulfillments cannot bypass payment requirements (`paymentStatus === "Paid"`).
- Automated inventory restoral compensation upon order cancellation.

---

## 🏗️ System Architecture & Data Flow

### 1. Private Image Retrieval via S3 Presigning

```mermaid
flowchart TD
    A[Admin Client] -->|Upload image| B(Express API Server)
    B -->|PutObjectCommand| C[Private AWS S3 Bucket]
    B -->|Save Canonical Key: products/img.png| D[(MongoDB Atlas)]
    
    E[Customer Browser] -->|GET /api/products| B
    B -->|Fetch Products| D
    B -->|GetObjectCommand + getSignedUrl| C
    C -->|Return 1-Hour Presigned URL| B
    B -->|Response with imageUrl| E
    E -->|Direct GET to presigned URL| C
    C -->|200 OK Image Bytes| E
```

### 2. Order Processing & Inventory State Machine

```mermaid
stateDiagram-v2
    [*] --> Pending: Cart Checkout (Atomic Stock Decrement)
    Pending --> Processing: Payment Succeeded (Verified)
    Pending --> Cancelled: Customer/Admin Cancel (Stock Restored)
    Processing --> Shipped: Dispatch / Logistics
    Processing --> Cancelled: Cancellation (Stock Restored)
    Shipped --> Delivered: Final Customer Delivery
    Shipped --> Cancelled: Delivery Failure (Stock Restored)
    Delivered --> [*]
    Cancelled --> [*]
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, React Router DOM v7, Socket.io Client, Context API |
| **Backend** | Node.js, Express 5, Socket.io, Multer, Express Rate Limit |
| **Database** | MongoDB Atlas, Mongoose ORM |
| **Cloud Storage** | AWS S3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) |
| **Security & Auth** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, Node Crypto |
| **Deployment** | Vercel (Frontend SPA), Render (Backend Web Service) |

---

## 📁 Project Structure