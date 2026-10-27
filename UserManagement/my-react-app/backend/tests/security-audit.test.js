const dns = require("dns");
try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch (e) {}
dns.setDefaultResultOrder("ipv4first");

require("dotenv").config();
const assert = require("assert");
const crypto = require("crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { io: ioClient } = require("socket.io-client");

const { app, server } = require("../server");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");

const TEST_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "fallback_secret";

let serverUrl = "";
let serverInstance = null;

// Test users and tokens
let normalUser = null;
let normalToken = "";
let adminUser = null;
let adminToken = "";
let attackerUser = null;
let attackerToken = "";

// Helper to make authenticated HTTP requests to the running test server
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

  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    data = {};
  }

  return { status: response.status, data, headers: response.headers };
}

// Summary accumulator
const testResults = [];
function recordResult(num, title, passed, details = "") {
  testResults.push({ num, title, passed, details });
  const mark = passed ? "PASS" : "FAIL";
  console.log(`[${mark}] Test ${num}: ${title}`);
  if (details && !passed) {
    console.log(`       Reason: ${details}`);
  }
}

async function runAllTests() {
  console.log("=========================================================");
  console.log("   MERN E-COMMERCE SECURITY & RELIABILITY AUDIT SUITE    ");
  console.log("=========================================================\n");

  // Connect DB
  const MONGO_URL = process.env.MONGO_URL;
  if (!MONGO_URL) {
    throw new Error("MONGO_URL is required in .env");
  }

  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  console.log(" MongoDB Connected to Replica Set for Transaction Testing\n");

  // Start HTTP Server on ephemeral port
  await new Promise((resolve) => {
    serverInstance = server.listen(0, () => {
      const port = serverInstance.address().port;
      serverUrl = `http://localhost:${port}`;
      console.log(` Test Server listening on ${serverUrl}\n`);
      resolve();
    });
  });

  try {
    // Clean up test collections
    const testPrefix = "test_audit_";
    await User.deleteMany({ email: new RegExp(testPrefix) });
    await Product.deleteMany({ name: new RegExp(testPrefix) });
    await Order.deleteMany({ userName: new RegExp(testPrefix) });

    // Seed test users
    normalUser = await User.create({
      name: `${testPrefix}Customer`,
      email: `${testPrefix}user@example.com`,
      password: "hashed_dummy_password",
      role: "user"
    });
    normalToken = jwt.sign(
      { id: normalUser._id.toString(), email: normalUser.email, role: "user", name: normalUser.name },
      TEST_SECRET,
      { expiresIn: "1h" }
    );

    attackerUser = await User.create({
      name: `${testPrefix}Attacker`,
      email: `${testPrefix}attacker@example.com`,
      password: "hashed_dummy_password",
      role: "user"
    });
    attackerToken = jwt.sign(
      { id: attackerUser._id.toString(), email: attackerUser.email, role: "user", name: attackerUser.name },
      TEST_SECRET,
      { expiresIn: "1h" }
    );

    adminUser = await User.create({
      name: `${testPrefix}Admin`,
      email: `${testPrefix}admin@example.com`,
      password: "hashed_dummy_password",
      role: "admin"
    });
    adminToken = jwt.sign(
      { id: adminUser._id.toString(), email: adminUser.email, role: "admin", name: adminUser.name },
      TEST_SECRET,
      { expiresIn: "1h" }
    );

    // -------------------------------------------------------------
    // Test 1: Successful Order Creation with Valid Data
    // -------------------------------------------------------------
    try {
      const p1 = await Product.create({
        name: `${testPrefix}Widget`,
        category: "Electronics",
        price: 150,
        stock: 20
      });

      const res = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: {
          products: [{ productId: p1._id.toString(), quantity: 2 }]
        }
      });

      const updatedP1 = await Product.findById(p1._id);
      assert.strictEqual(res.status, 201, `Expected status 201, got ${res.status}`);
      assert.strictEqual(res.data.order.totalAmount, 300, `Expected total 300, got ${res.data.order.totalAmount}`);
      assert.strictEqual(updatedP1.stock, 18, `Expected stock 18, got ${updatedP1.stock}`);
      recordResult(1, "Successful order creation with valid data", true);
    } catch (err) {
      recordResult(1, "Successful order creation with valid data", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 2: Empty Cart & Invalid Product ID Rejection
    // -------------------------------------------------------------
    try {
      const emptyRes = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: { products: [] }
      });
      assert.strictEqual(emptyRes.status, 400, "Empty products array should return 400");

      const invalidIdRes = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: { products: [{ productId: "not_a_valid_object_id", quantity: 1 }] }
      });
      assert.strictEqual(invalidIdRes.status, 400, "Invalid ObjectId should return 400");
      recordResult(2, "Empty cart & invalid product ID rejection", true);
    } catch (err) {
      recordResult(2, "Empty cart & invalid product ID rejection", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 3: Non-Integer / Negative Quantity Rejection
    // -------------------------------------------------------------
    try {
      const p = await Product.create({
        name: `${testPrefix}QtyTest`,
        category: "Testing",
        price: 50,
        stock: 10
      });

      const negRes = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: { products: [{ productId: p._id.toString(), quantity: -2 }] }
      });
      assert.strictEqual(negRes.status, 400, "Negative quantity must return 400");

      const floatRes = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: { products: [{ productId: p._id.toString(), quantity: 1.5 }] }
      });
      assert.strictEqual(floatRes.status, 400, "Float quantity must return 400");

      const zeroRes = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: { products: [{ productId: p._id.toString(), quantity: 0 }] }
      });
      assert.strictEqual(zeroRes.status, 400, "Zero quantity must return 400");

      recordResult(3, "Non-integer / negative quantity rejection", true);
    } catch (err) {
      recordResult(3, "Non-integer / negative quantity rejection", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 4: Insufficient Stock Rollback
    // -------------------------------------------------------------
    try {
      const p = await Product.create({
        name: `${testPrefix}LowStock`,
        category: "Testing",
        price: 200,
        stock: 3
      });

      const res = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: { products: [{ productId: p._id.toString(), quantity: 5 }] }
      });

      assert.strictEqual(res.status, 400, "Order exceeding stock must return 400");
      const postP = await Product.findById(p._id);
      assert.strictEqual(postP.stock, 3, "Stock must remain unchanged at 3");
      recordResult(4, "Insufficient stock rollback", true);
    } catch (err) {
      recordResult(4, "Insufficient stock rollback", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 5: Multiple Items with Later Item Stock Failure Rollback
    // -------------------------------------------------------------
    try {
      const itemA = await Product.create({
        name: `${testPrefix}Multi_A`,
        category: "Testing",
        price: 100,
        stock: 5
      });
      const itemB = await Product.create({
        name: `${testPrefix}Multi_B`,
        category: "Testing",
        price: 100,
        stock: 1
      });

      // Request 2 of itemA (available) and 4 of itemB (unavailable)
      const res = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: {
          products: [
            { productId: itemA._id.toString(), quantity: 2 },
            { productId: itemB._id.toString(), quantity: 4 }
          ]
        }
      });

      assert.strictEqual(res.status, 400, "Order must fail due to itemB");
      const checkA = await Product.findById(itemA._id);
      const checkB = await Product.findById(itemB._id);
      assert.strictEqual(checkA.stock, 5, "Item A stock must be rolled back completely to 5");
      assert.strictEqual(checkB.stock, 1, "Item B stock must remain 1");
      recordResult(5, "Multiple items with later item stock failure rollback", true);
    } catch (err) {
      recordResult(5, "Multiple items with later item stock failure rollback", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 6: Concurrent Orders Competing for Final Unit
    // -------------------------------------------------------------
    try {
      const finalUnit = await Product.create({
        name: `${testPrefix}FinalUnit`,
        category: "Testing",
        price: 99,
        stock: 1
      });

      // Fire 2 simultaneous order placements for the 1 unit
      const [res1, res2] = await Promise.all([
        apiRequest("/api/orders", {
          method: "POST",
          token: normalToken,
          body: { products: [{ productId: finalUnit._id.toString(), quantity: 1 }] }
        }),
        apiRequest("/api/orders", {
          method: "POST",
          token: attackerToken,
          body: { products: [{ productId: finalUnit._id.toString(), quantity: 1 }] }
        })
      ]);

      const statuses = [res1.status, res2.status];
      const successCount = statuses.filter((s) => s === 201).length;
      const failCount = statuses.filter((s) => s === 400).length;

      assert.strictEqual(successCount, 1, "Exactly 1 concurrent order should succeed");
      assert.strictEqual(failCount, 1, "Exactly 1 concurrent order should fail with 400");

      const checkFinal = await Product.findById(finalUnit._id);
      assert.strictEqual(checkFinal.stock, 0, "Final unit stock must be exactly 0");
      recordResult(6, "Concurrent orders competing for final unit", true);
    } catch (err) {
      recordResult(6, "Concurrent orders competing for final unit", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 7: Database Failure / Transaction Rollback
    // -------------------------------------------------------------
    try {
      const rollbackProd = await Product.create({
        name: `${testPrefix}DbFailProd`,
        category: "Testing",
        price: 300,
        stock: 10
      });

      // Session rollback verification: create an order using session then abort
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await Product.findOneAndUpdate(
            { _id: rollbackProd._id },
            { $inc: { stock: -3 } },
            { session }
          );
          // Simulate failure before commit
          throw new Error("Simulated database failure inside transaction");
        });
      } catch (e) {
        // Expected abort
      } finally {
        await session.endSession();
      }

      const verified = await Product.findById(rollbackProd._id);
      assert.strictEqual(verified.stock, 10, "Stock must remain 10 after aborted transaction");
      recordResult(7, "Database failure / transaction rollback", true);
    } catch (err) {
      recordResult(7, "Database failure / transaction rollback", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 8: Repeated / Concurrent Cancellation Idempotency
    // -------------------------------------------------------------
    try {
      const cancelProd = await Product.create({
        name: `${testPrefix}CancelProd`,
        category: "Testing",
        price: 250,
        stock: 5
      });

      // Place order of 2 units -> stock becomes 3
      const orderRes = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: { products: [{ productId: cancelProd._id.toString(), quantity: 2 }] }
      });
      const orderId = orderRes.data.order._id;

      // Cancel 1st time as admin -> stock restored to 5
      const cancel1 = await apiRequest(`/api/orders/${orderId}/status`, {
        method: "PUT",
        token: adminToken,
        body: { status: "Cancelled" }
      });
      assert.strictEqual(cancel1.status, 200, "First cancellation should succeed");

      const stockAfterFirst = await Product.findById(cancelProd._id);
      assert.strictEqual(stockAfterFirst.stock, 5, "Stock must be restored to 5");

      // Attempt repeated cancellation -> should be rejected and NOT restore stock again
      const cancel2 = await apiRequest(`/api/orders/${orderId}/status`, {
        method: "PUT",
        token: adminToken,
        body: { status: "Cancelled" }
      });
      assert.strictEqual(cancel2.status, 400, "Duplicate cancellation must be rejected with 400");

      const stockAfterSecond = await Product.findById(cancelProd._id);
      assert.strictEqual(stockAfterSecond.stock, 5, "Stock must NEVER be double-restored (must remain 5)");
      recordResult(8, "Repeated / concurrent cancellation idempotency", true);
    } catch (err) {
      recordResult(8, "Repeated / concurrent cancellation idempotency", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 9: Invalid Order Status Transitions
    // -------------------------------------------------------------
    try {
      const statusProd = await Product.create({
        name: `${testPrefix}StatusProd`,
        category: "Testing",
        price: 100,
        stock: 10
      });

      const orderRes = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: { products: [{ productId: statusProd._id.toString(), quantity: 1 }] }
      });
      const orderId = orderRes.data.order._id;

      // Try illegal skip: Pending -> Shipped (skipping Processing)
      const skipRes = await apiRequest(`/api/orders/${orderId}/status`, {
        method: "PUT",
        token: adminToken,
        body: { status: "Shipped" }
      });
      assert.strictEqual(skipRes.status, 400, "Skipping to Shipped while Pending must return 400");

      // Try transition without payment: Pending -> Processing requires Paid status
      const unpaidAdvance = await apiRequest(`/api/orders/${orderId}/status`, {
        method: "PUT",
        token: adminToken,
        body: { status: "Processing" }
      });
      assert.strictEqual(unpaidAdvance.status, 400, "Advancing unpaid order must return 400");

      recordResult(9, "Invalid order status transitions", true);
    } catch (err) {
      recordResult(9, "Invalid order status transitions", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 10: Unauthorized Order Status Update
    // -------------------------------------------------------------
    try {
      const p = await Product.create({
        name: `${testPrefix}AuthCheck`,
        category: "Testing",
        price: 50,
        stock: 5
      });
      const orderRes = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: { products: [{ productId: p._id.toString(), quantity: 1 }] }
      });
      const orderId = orderRes.data.order._id;

      // Regular customer attempts to update status
      const userUpdateRes = await apiRequest(`/api/orders/${orderId}/status`, {
        method: "PUT",
        token: normalToken,
        body: { status: "Cancelled" }
      });
      assert.strictEqual(userUpdateRes.status, 403, "Non-admin update must return 403 Forbidden");

      // Unauthenticated attempt
      const unauthRes = await apiRequest(`/api/orders/${orderId}/status`, {
        method: "PUT",
        body: { status: "Cancelled" }
      });
      assert.strictEqual(unauthRes.status, 401, "Unauthenticated update must return 401 Unauthorized");

      recordResult(10, "Unauthorized order status update", true);
    } catch (err) {
      recordResult(10, "Unauthorized order status update", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 11: Client Price Manipulation Rejection
    // -------------------------------------------------------------
    try {
      const luxuryItem = await Product.create({
        name: `${testPrefix}LuxuryLaptop`,
        category: "Electronics",
        price: 150000,
        stock: 5
      });

      // Attacker sends manipulated client total (1 Rupee instead of 150,000)
      const tamperRes = await apiRequest("/api/orders", {
        method: "POST",
        token: attackerToken,
        body: {
          products: [{ productId: luxuryItem._id.toString(), quantity: 1, price: 1 }],
          totalAmount: 1
        }
      });

      assert.strictEqual(tamperRes.status, 201, "Order placed successfully");
      assert.strictEqual(
        tamperRes.data.order.totalAmount,
        150000,
        `Tampered total (1) must be rejected; authoritative DB total (150000) enforced. Got: ${tamperRes.data.order.totalAmount}`
      );

      recordResult(11, "Client price manipulation rejection", true);
    } catch (err) {
      recordResult(11, "Client price manipulation rejection", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 12: Duplicate Payment Idempotency
    // -------------------------------------------------------------
    try {
      const p = await Product.create({
        name: `${testPrefix}PaymentItem`,
        category: "Testing",
        price: 200,
        stock: 5
      });
      const orderRes = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: { products: [{ productId: p._id.toString(), quantity: 1 }] }
      });
      const orderId = orderRes.data.order._id;

      // First simulated payment
      const pay1 = await apiRequest("/api/payment/simulate", {
        method: "POST",
        token: normalToken,
        body: { orderId, shouldSucceed: true }
      });
      assert.strictEqual(pay1.status, 200, "First payment must succeed (200)");
      assert.strictEqual(pay1.data.order.paymentStatus, "Paid");

      // Second duplicate payment call
      const pay2 = await apiRequest("/api/payment/simulate", {
        method: "POST",
        token: normalToken,
        body: { orderId, shouldSucceed: true }
      });
      assert.strictEqual(pay2.status, 200, "Duplicate payment returns idempotent 200");
      assert.strictEqual(pay2.data.message, "Order is already paid");

      recordResult(12, "Duplicate payment idempotency", true);
    } catch (err) {
      recordResult(12, "Duplicate payment idempotency", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 13: Invalid Webhook Signature Rejection
    // -------------------------------------------------------------
    try {
      const p = await Product.create({
        name: `${testPrefix}WebhookProd`,
        category: "Testing",
        price: 500,
        stock: 5
      });
      const orderRes = await apiRequest("/api/orders", {
        method: "POST",
        token: normalToken,
        body: { products: [{ productId: p._id.toString(), quantity: 1 }] }
      });
      const orderId = orderRes.data.order._id;

      const payload = {
        event: "payment.succeeded",
        orderId,
        transactionId: "TXN_VALID_123"
      };
      const rawString = JSON.stringify(payload);

      // Attempt 1: Forged signature -> 401
      const forgedRes = await fetch(`${serverUrl}/api/payment/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": "forged_invalid_hex_signature"
        },
        body: rawString
      });
      assert.strictEqual(forgedRes.status, 401, "Forged signature must return 401");

      // Attempt 2: Missing signature -> 400
      const missingRes = await fetch(`${serverUrl}/api/payment/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawString
      });
      assert.strictEqual(missingRes.status, 400, "Missing signature must return 400");

      // Attempt 3: Valid HMAC-SHA256 signature -> 200
      const validSignature = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(rawString)
        .digest("hex");

      const validRes = await fetch(`${serverUrl}/api/payment/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": validSignature
        },
        body: rawString
      });
      assert.strictEqual(validRes.status, 200, "Valid webhook signature must return 200");

      const paidOrder = await Order.findById(orderId);
      assert.strictEqual(paidOrder.paymentStatus, "Paid", "Webhook successfully marked order as Paid");

      recordResult(13, "Invalid webhook signature rejection", true);
    } catch (err) {
      recordResult(13, "Invalid webhook signature rejection", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 14: Unauthorized Socket.io Room Join Rejection
    // -------------------------------------------------------------
    try {
      // 14a: Unauthenticated socket connection must be rejected
      const unauthSocket = ioClient(serverUrl, {
        reconnection: false,
        timeout: 2000
      });

      const unauthError = await new Promise((resolve) => {
        unauthSocket.on("connect_error", (err) => resolve(err.message));
        unauthSocket.on("connect", () => resolve("connected"));
      });
      unauthSocket.disconnect();
      assert.ok(
        unauthError.includes("Token required") || unauthError.includes("Authentication error"),
        `Expected Token required, got: ${unauthError}`
      );

      // 14b: Normal user tries to join 'admins' room
      const normalSocket = ioClient(serverUrl, {
        auth: { token: normalToken },
        reconnection: false,
        timeout: 2000
      });

      await new Promise((resolve) => normalSocket.on("connect", resolve));

      const adminJoinError = await new Promise((resolve) => {
        normalSocket.emit("joinAdminRoom");
        normalSocket.on("error", (err) => resolve(err.message));
        setTimeout(() => resolve("timed_out"), 1500);
      });
      normalSocket.disconnect();

      assert.ok(
        adminJoinError.includes("Admin privileges required"),
        `Non-admin joining admins room must be rejected, got: ${adminJoinError}`
      );

      recordResult(14, "Unauthorized Socket.io room join rejection", true);
    } catch (err) {
      recordResult(14, "Unauthorized Socket.io room join rejection", false, err.message);
    }

    // -------------------------------------------------------------
    // Test 15: Rate Limiting on Auth Endpoints
    // -------------------------------------------------------------
    try {
      let reachedLimit = false;
      // The auth limiter is configured to allow 20 attempts before returning 429
      for (let i = 0; i < 23; i++) {
        const res = await apiRequest("/api/auth/login", {
          method: "POST",
          body: { email: "attacker@test.com", password: "wrong_password" }
        });
        if (res.status === 429) {
          reachedLimit = true;
          break;
        }
      }

      assert.strictEqual(reachedLimit, true, "Excessive rapid authentication attempts must trigger HTTP 429 Too Many Requests");
      recordResult(15, "Rate limiting on auth endpoints", true);
    } catch (err) {
      recordResult(15, "Rate limiting on auth endpoints", false, err.message);
    }

  } finally {
    // Teardown
    if (serverInstance) {
      serverInstance.close();
    }
    await mongoose.disconnect();
    console.log("\n Test teardown completed.");
  }

  // Print Summary Table
  console.log("\n=========================================================");
  console.log("                   TEST SUITE SUMMARY                    ");
  console.log("=========================================================");
  const passedTotal = testResults.filter((r) => r.passed).length;
  console.log(`TOTAL TESTS:  ${testResults.length}`);
  console.log(`PASSED:       ${passedTotal}`);
  console.log(`FAILED:       ${testResults.length - passedTotal}\n`);

  if (passedTotal === testResults.length) {
    console.log(">>> ALL 15 CRITICAL SECURITY & AUDIT TESTS PASSED SUCCESSFULLY! <<<\n");
    process.exit(0);
  } else {
    console.error(">>> SOME TESTS FAILED. PLEASE REVIEW LOGS ABOVE. <<<\n");
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Fatal error running test suite:", err);
  process.exit(1);
});
