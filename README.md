# 🛒 Full-Stack E-Commerce Platform

A feature-packed, production-ready Full-Stack E-Commerce web application built with the **MERN Stack** (MongoDB, Express.js, React 19, Node.js), featuring **Real-time WebSockets (Socket.io)** and **AWS S3 Image Cloud Storage**.

---

## 🌟 Key Features

### 👤 Authentication & User Management
- **JWT-Based Authentication**: Secure registration and login using JSON Web Tokens.
- **Password Security**: Passwords hashed securely using `bcryptjs`.
- **Role-Based Access Control**: Separate privileges for **Customers** and **Admins**.

### 🛍️ Product Catalog & Image Management
- **Product Management**: Full CRUD operations for managing products.
- **AWS S3 Storage Integration**: Direct cloud image uploads using `@aws-sdk/client-s3` and `multer`.
- **Local Fallback Uploads**: Flexible file upload support for local development environments.

### 💳 Cart & Order Processing
- **Shopping Cart**: Interactive cart state management for adding, updating, and removing items.
- **Order Tracking**: Comprehensive order status lifecycle management (Pending, Processing, Shipped, Delivered).
- **Interactive Modals**: Seamless feedback with interactive success and confirmation popups.

### ⚡ Real-Time Features & Security
- **Real-Time WebSockets**: Live order notifications and inventory updates via `Socket.io`.
- **API Rate Limiting**: Protection against brute-force attacks using `express-rate-limit`.
- **Environment Protection**: Strict `.env` handling pre-configured with `.gitignore`.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Real-Time**: [Socket.io Client](https://socket.io/)
- **Styling**: Custom CSS Modules / Responsive Web Design

### **Backend**
- **Runtime**: [Node.js](https://nodejs.org/) & [Express 5](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose ORM](https://mongoosejs.com/)
- **Authentication**: JWT (`jsonwebtoken`) & `bcryptjs`
- **File Uploads**: `multer` + AWS S3 SDK (`@aws-sdk/client-s3`)
- **Real-Time Engine**: [Socket.io](https://socket.io/)
- **Data Utilities**: `pdf-parse` & `csv-parser`

---

## 📁 Repository Structure

```
my-react-app/
├── backend/                  # Express API Server & Database Models
│   ├── config/               # Database & AWS S3 Configurations
│   ├── controllers/          # Business logic handlers
│   ├── middleware/           # Authentication, Rate Limiting & File Uploads
│   ├── models/               # Mongoose Schemas (User, Product, Order)
│   ├── routes/               # API Endpoint Routes
│   ├── uploads/              # Local storage fallback for uploaded images
│   ├── .env.example          # Sample environment variables template
│   ├── package.json
│   └── server.js             # Application entry point & Socket.io setup
│
├── frontend/                 # React Frontend (Vite)
│   ├── src/
│   │   ├── components/       # Reusable UI components & Modals
│   │   ├── context/          # React Context (Auth, Cart, Socket)
│   │   ├── pages/            # Page Views (Products, Detail, Orders, Cart, Admin)
│   │   ├── App.jsx           # Routing & App Root
│   │   └── main.jsx          # Vite Entry point
│   ├── package.json
│   └── vite.config.js
│
└── README.md                 # Project Documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
Make sure you have the following installed on your system:
- **[Node.js](https://nodejs.org/)** (v18 or higher)
- **[MongoDB](https://www.mongodb.com/)** (Local instance or MongoDB Atlas URI)
- **Git**

---

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/your-username/your-repo-name.git
cd my-react-app
```

---

### 2️⃣ Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your values:
   ```env
   PORT=5000
   MONGO_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/ecommerce
   JWT_SECRET=your_super_secret_jwt_key
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=admin123

   # Optional AWS S3 settings
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_REGION=ap-southeast-2
   AWS_S3_BUCKET_NAME=your_s3_bucket_name
   ```

4. **Start the backend server**:
   ```bash
   # Development mode with Nodemon auto-reload
   npm run dev

   # Production mode
   npm start
   ```
   The backend server will start at `http://localhost:5000`.

---

### 3️⃣ Frontend Setup

1. **Open a new terminal and navigate to frontend**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the Vite development server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

---

## 📡 Key API Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | Register a new user | ❌ |
| **POST** | `/api/auth/login` | User login & JWT issuance | ❌ |
| **GET** | `/api/products` | Fetch all products | ❌ |
| **GET** | `/api/products/:id` | Fetch single product details | ❌ |
| **POST** | `/api/products` | Create a product (with image upload) | 🔒 Admin |
| **POST** | `/api/orders` | Place a new order | 🔒 User |
| **GET** | `/api/orders` | Fetch user/admin orders | 🔒 User/Admin |
| **PUT** | `/api/orders/:id` | Update order status | 🔒 Admin |

---

## 🔒 Security Best Practices Implemented

- **Secrets Isolation**: All sensitive database credentials, API keys, and JWT secrets are stored in `.env` and strictly excluded from Git tracking via `.gitignore`.
- **Rate Limiting**: API routes are protected using `express-rate-limit` to mitigate denial-of-service and brute-force attempts.
- **Data Validation**: Request validation across user authentication and order creation.

---

## 🤝 Contributing

Contributions are always welcome!
1. Fork the project repository.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
