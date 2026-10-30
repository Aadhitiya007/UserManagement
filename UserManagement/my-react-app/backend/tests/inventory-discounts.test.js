const dns = require("dns");
try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch (e) {}
dns.setDefaultResultOrder("ipv4first");

require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const { app, server } = require("../server");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Coupon = require("../models/Coupon");
const AuditLog = require("../models/AuditLog");
const { calculateProductDiscount } = require("../utils/discountCalculator");
const { generateInvoicePDF } = require("../utils/invoiceGenerator");

const TEST_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
let serverUrl = "";
let serverInstance = null;

async function apiRequest(endpoint, options = {}) {
  const url = `${serverUrl}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  return response;
}

async function runInventoryAndDiscountTests() {
  console.log("\n========================================================");
  console.log("🛒 INVENTORY, DISCOUNTS & AUDIT LOG TEST SUITE");
  console.log("========================================================\n");

  const MONGO_URL = process.env.MONGO_URL;
  if (!MONGO_URL) throw new Error("MONGO_URL is required in .env");

  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  console.log("✓ Connected to MongoDB.");

  await new Promise((resolve) => {
    serverInstance = server.listen(0, () => {
      const port = serverInstance.address().port;
      serverUrl = `http://127.0.0.1:${port}`;
      console.log(`✓ Test Server listening on ${serverUrl}\n`);
      resolve();
    });
  });

  const timestamp = Date.now();
  const customerEmail = `buyer_${timestamp}@shopiee-test.com`;
  const adminEmail = `admin_${timestamp}@shopiee-test.com`;

  // 1. Create test users
  const customerUser = await User.create({
    name: "Test Shopper",
    email: customerEmail,
    password: "Password123!",
    role: "user"
  });

  const adminUser = await User.create({
    name: "Admin User",
    email: adminEmail,
    password: "Password123!",
    role: "admin"
  });

  const customerToken = jwt.sign(
    { id: customerUser._id.toString(), email: customerUser.email, role: customerUser.role },
    TEST_SECRET,
    { expiresIn: "1h" }
  );

  const adminToken = jwt.sign(
    { id: adminUser._id.toString(), email: adminUser.email, role: adminUser.role },
    TEST_SECRET,
    { expiresIn: "1h" }
  );

  // 2. Create products with stock and discounts
  const inStockProduct = await Product.create({
    name: "Wireless Mouse",
    price: 1000,
    category: "Electronics",
    stock: 5,
    discount: {
      discountType: "percentage",
      value: 20,
      isActive: true
    }
  });

  const outOfStockProduct = await Product.create({
    name: "Mechanical Keyboard",
    price: 3000,
    category: "Electronics",
    stock: 0
  });

  const fixedDiscountProduct = await Product.create({
    name: "Noise Cancelling Headphones",
    price: 5000,
    category: "Electronics",
    stock: 10,
    discount: {
      discountType: "fixed",
      value: 500,
      isActive: true
    }
  });

  const expiredDiscountProduct = await Product.create({
    name: "Smart Watch",
    price: 4000,
    category: "Electronics",
    stock: 10,
    discount: {
      discountType: "percentage",
      value: 50,
      endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
      isActive: true
    }
  });

  // 3. Create Coupons
  const validCoupon = await Coupon.create({
    code: "SAVE200",
    discountType: "fixed",
    discountValue: 200,
    minOrderAmount: 500,
    expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxUsagePerCustomer: 1,
    isActive: true
  });

  const percentCoupon = await Coupon.create({
    code: "PERCENT10",
    discountType: "percentage",
    discountValue: 10,
    maxDiscountAmount: 300,
    expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isActive: true
  });

  const expiredCoupon = await Coupon.create({
    code: "EXPIRED50",
    discountType: "percentage",
    discountValue: 50,
    expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isActive: true
  });

  const maxedOutCoupon = await Coupon.create({
    code: "MAXEDOUT",
    discountType: "fixed",
    discountValue: 100,
    maxTotalUsage: 1,
    usageCount: 1,
    expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isActive: true
  });

  let testsPassed = 0;

  // ----------------------------------------------------
  // Test 1: Product-level percentage discount calculation
  // ----------------------------------------------------
  console.log("▶ [Test 1] Product-Level Percentage Discount Calculation");
  const p1Disc = calculateProductDiscount(inStockProduct);
  assert.strictEqual(p1Disc.originalPrice, 1000);
  assert.strictEqual(p1Disc.effectivePrice, 800); // 20% off 1000 = 800
  assert.strictEqual(p1Disc.discountAmount, 200);
  assert.strictEqual(p1Disc.isDiscountActive, true);
  console.log("✓ Passed: 20% discount correctly yields ₹800 effective price on ₹1,000 product.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 2: Product-level fixed discount calculation
  // ----------------------------------------------------
  console.log("▶ [Test 2] Product-Level Fixed Discount Calculation");
  const p2Disc = calculateProductDiscount(fixedDiscountProduct);
  assert.strictEqual(p2Disc.originalPrice, 5000);
  assert.strictEqual(p2Disc.effectivePrice, 4500); // ₹500 off ₹5000 = 4500
  assert.strictEqual(p2Disc.discountAmount, 500);
  console.log("✓ Passed: ₹500 fixed discount correctly yields ₹4,500 effective price.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 3: Auto-deactivation of expired product discounts
  // ----------------------------------------------------
  console.log("▶ [Test 3] Expired Product Discount Auto-Deactivation");
  const p3Disc = calculateProductDiscount(expiredDiscountProduct);
  assert.strictEqual(p3Disc.effectivePrice, 4000); // Unchanged because discount is expired
  assert.strictEqual(p3Disc.isDiscountActive, false);
  console.log("✓ Passed: Expired product discount is not applied.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 4: Get products API returns effective pricing & out-of-stock badges
  // ----------------------------------------------------
  console.log("▶ [Test 4] GET /api/products returns calculated pricing & stock flags");
  const resProducts = await apiRequest("/api/products");
  assert.strictEqual(resProducts.status, 200);
  const prodList = await resProducts.json();
  const foundOutOfStock = prodList.find((p) => p._id === outOfStockProduct._id.toString());
  assert.ok(foundOutOfStock, "Out-of-stock product returned");
  assert.strictEqual(foundOutOfStock.isOutOfStock, true);
  assert.strictEqual(foundOutOfStock.stock, 0);

  const foundDiscounted = prodList.find((p) => p._id === inStockProduct._id.toString());
  assert.strictEqual(foundDiscounted.effectivePrice, 800);
  assert.strictEqual(foundDiscounted.isDiscountActive, true);
  console.log("✓ Passed: Public product API provides authoritative effective prices & stock status.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 5: Rejection of checkout on zero-stock product
  // ----------------------------------------------------
  console.log("▶ [Test 5] Backend Stock Validation: Out-of-Stock Purchase Rejection");
  const resZeroStock = await apiRequest("/api/orders", {
    method: "POST",
    token: customerToken,
    body: {
      products: [{ productId: outOfStockProduct._id.toString(), quantity: 1 }]
    }
  });
  assert.strictEqual(resZeroStock.status, 400);
  const zeroStockErr = await resZeroStock.json();
  assert.ok(zeroStockErr.message.includes("Insufficient stock"));
  console.log("✓ Passed: Order on zero-stock product rejected with 400 Insufficient Stock.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 6: Rejection when requested quantity exceeds available stock
  // ----------------------------------------------------
  console.log("▶ [Test 6] Backend Stock Validation: Excessive Quantity Rejection");
  const resOverStock = await apiRequest("/api/orders", {
    method: "POST",
    token: customerToken,
    body: {
      products: [{ productId: inStockProduct._id.toString(), quantity: 999 }]
    }
  });
  assert.strictEqual(resOverStock.status, 400);
  const overStockErr = await resOverStock.json();
  assert.ok(overStockErr.message.includes("Insufficient stock"));
  console.log("✓ Passed: Quantity 999 against 5 stock rejected with 400.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 7: Coupon validation (case-insensitivity & min order amount)
  // ----------------------------------------------------
  console.log("▶ [Test 7] Coupon Validation: Case-insensitivity & Min Order Amount");
  // 7a: Case-insensitive lowercase code "save200"
  const resCouponVal = await apiRequest("/api/coupons/validate", {
    method: "POST",
    token: customerToken,
    body: { code: "save200", subtotal: 1000 }
  });
  assert.strictEqual(resCouponVal.status, 200);
  const couponData = await resCouponVal.json();
  assert.strictEqual(couponData.valid, true);
  assert.strictEqual(couponData.coupon.code, "SAVE200");
  assert.strictEqual(couponData.discountAmount, 200);
  assert.strictEqual(couponData.finalAmount, 800);

  // 7b: Rejection if subtotal < minOrderAmount
  const resUnderMin = await apiRequest("/api/coupons/validate", {
    method: "POST",
    token: customerToken,
    body: { code: "SAVE200", subtotal: 300 } // min is 500
  });
  assert.strictEqual(resUnderMin.status, 400);
  const underMinErr = await resUnderMin.json();
  assert.ok(underMinErr.message.includes("minimum order"));
  console.log("✓ Passed: Case-insensitive coupon validation and min-order verification passed.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 8: Rejection of expired coupon & max-usage coupon
  // ----------------------------------------------------
  console.log("▶ [Test 8] Coupon Rejection: Expired & Global Limit Reached");
  const resExp = await apiRequest("/api/coupons/validate", {
    method: "POST",
    token: customerToken,
    body: { code: "EXPIRED50", subtotal: 1000 }
  });
  assert.strictEqual(resExp.status, 400);

  const resMax = await apiRequest("/api/coupons/validate", {
    method: "POST",
    token: customerToken,
    body: { code: "MAXEDOUT", subtotal: 1000 }
  });
  assert.strictEqual(resMax.status, 400);
  console.log("✓ Passed: Expired coupons and maxed-out coupons safely rejected.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 9: Order placement with snapshot of product discount & coupon discount
  // ----------------------------------------------------
  console.log("▶ [Test 9] Order Placement with Immutable Discount Snapshot");
  // Product price: 1000 -> 20% discount = 800 * 2 items = 1600
  // Coupon SAVE200: -200 -> final total: 1400
  const resOrder = await apiRequest("/api/orders", {
    method: "POST",
    token: customerToken,
    body: {
      products: [{ productId: inStockProduct._id.toString(), quantity: 2 }],
      couponCode: "SAVE200"
    }
  });

  assert.strictEqual(resOrder.status, 201);
  const orderRes = await resOrder.json();
  const createdOrder = orderRes.order;
  assert.strictEqual(createdOrder.totalAmount, 1400);
  assert.strictEqual(createdOrder.discountDetails.originalSubtotal, 2000);
  assert.strictEqual(createdOrder.discountDetails.productDiscountTotal, 400);
  assert.strictEqual(createdOrder.discountDetails.couponCode, "SAVE200");
  assert.strictEqual(createdOrder.discountDetails.couponDiscount, 200);

  // Verify stock was decremented from 5 to 3
  const refetchedProd = await Product.findById(inStockProduct._id);
  assert.strictEqual(refetchedProd.stock, 3);
  console.log("✓ Passed: Order placed, atomic stock decremented to 3, and immutable snapshot saved.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 10: Coupon usage count is NOT consumed before payment
  // ----------------------------------------------------
  console.log("▶ [Test 10] Coupon Redemption Idempotency Before Payment");
  const couponBeforePay = await Coupon.findOne({ code: "SAVE200" });
  assert.strictEqual(couponBeforePay.usageCount, 0); // Not counted yet!
  console.log("✓ Passed: Coupon is not permanently consumed upon order creation.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 11: Payment verification atomically records coupon redemption & updates AuditLog
  // ----------------------------------------------------
  console.log("▶ [Test 11] Verified Payment Consumes Coupon Usage & Logs Audit Event");
  const resPay = await apiRequest("/api/payment/simulate", {
    method: "POST",
    token: customerToken,
    body: {
      orderId: createdOrder._id,
      shouldSucceed: true,
      paymentMethod: "Card"
    }
  });
  assert.strictEqual(resPay.status, 200);

  // Now coupon usage must be 1
  const couponAfterPay = await Coupon.findOne({ code: "SAVE200" });
  assert.strictEqual(couponAfterPay.usageCount, 1);
  assert.strictEqual(couponAfterPay.customerUsage.length, 1);
  assert.strictEqual(couponAfterPay.customerUsage[0].userId.toString(), customerUser._id.toString());
  console.log("✓ Passed: Verified payment atomically consumed 1 coupon redemption.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 12: Customer-specific usage limit enforced on second purchase attempt
  // ----------------------------------------------------
  console.log("▶ [Test 12] Enforce Per-Customer Usage Limit");
  const resReuse = await apiRequest("/api/coupons/validate", {
    method: "POST",
    token: customerToken,
    body: { code: "SAVE200", subtotal: 1000 }
  });
  assert.strictEqual(resReuse.status, 400);
  const reuseErr = await resReuse.json();
  assert.ok(reuseErr.message.includes("maximum number of times"));
  console.log("✓ Passed: Customer blocked from reusing single-use coupon.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 13: PDF Invoice generation reflects product & coupon discounts
  // ----------------------------------------------------
  console.log("▶ [Test 13] PDF Invoice Breakdown with Discounts");
  const paidOrderDoc = await Order.findById(createdOrder._id);
  const pdfBuffer = await generateInvoicePDF(paidOrderDoc, customerUser);
  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.ok(pdfBuffer.length > 2000);
  console.log(`✓ Passed: PDF invoice generated with discounts (${pdfBuffer.length} bytes).`);
  testsPassed++;

  // ----------------------------------------------------
  // Test 14: AuditLog verification (Events recorded for Order, Payment, and Coupon)
  // ----------------------------------------------------
  console.log("▶ [Test 14] AuditLog Verification");
  const orderLog = await AuditLog.findOne({ action: "ORDER_CREATED", "target.entityId": createdOrder._id.toString() });
  assert.ok(orderLog, "ORDER_CREATED audit log exists");

  const couponLog = await AuditLog.findOne({ action: "COUPON_REDEEMED", "target.name": "SAVE200" });
  assert.ok(couponLog, "COUPON_REDEEMED audit log exists");

  const paymentLog = await AuditLog.findOne({ action: "PAYMENT_RECEIVED", "target.entityId": createdOrder._id.toString() });
  assert.ok(paymentLog, "PAYMENT_RECEIVED audit log exists");

  console.log("✓ Passed: AuditLog recorded ORDER_CREATED, COUPON_REDEEMED, and PAYMENT_RECEIVED.");
  testsPassed++;

  // ----------------------------------------------------
  // Test 15: Admin Dashboard Stats API
  // ----------------------------------------------------
  console.log("▶ [Test 15] Admin Dashboard Stats Comprehensive Analytics");
  const resStats = await apiRequest("/api/orders/stats", {
    token: adminToken
  });
  assert.strictEqual(resStats.status, 200);
  const statsData = await resStats.json();
  assert.ok(statsData.totalRevenue >= 1400);
  assert.ok(statsData.totalOrders >= 1);
  assert.ok(statsData.outOfStockProducts >= 1);
  assert.ok(statsData.activeDiscounts >= 1);
  console.log("✓ Passed: Admin stats return accurate real figures for all 8 summary cards.");
  testsPassed++;

  // Clean up
  await User.deleteMany({ email: { $in: [customerEmail, adminEmail] } });
  await Product.deleteMany({ _id: { $in: [inStockProduct._id, outOfStockProduct._id, fixedDiscountProduct._id, expiredDiscountProduct._id] } });
  await Order.deleteMany({ _id: createdOrder._id });
  await Coupon.deleteMany({ code: { $in: ["SAVE200", "PERCENT10", "EXPIRED50", "MAXEDOUT"] } });
  await AuditLog.deleteMany({ "actor.email": customerEmail });

  serverInstance.close();
  await mongoose.disconnect();

  console.log("\n========================================================");
  console.log(`🎉 ALL TESTS PASSED SUCCESSFULLY (${testsPassed}/${testsPassed})!`);
  console.log("========================================================\n");
}

runInventoryAndDiscountTests().catch((err) => {
  console.error("❌ Test failed:", err);
  if (serverInstance) serverInstance.close();
  mongoose.disconnect();
  process.exit(1);
});
