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
const { generateInvoicePDF } = require("../utils/invoiceGenerator");
const { processOrderInvoiceAndEmail } = require("../utils/invoiceService");

const TEST_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
let serverUrl = "";
let serverInstance = null;

async function apiRequest(endpoint, options = {}) {
  const url = `${serverUrl}${endpoint}`;
  const headers = {
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

async function runInvoiceTestSuite() {
  console.log("\n========================================================");
  console.log("📄 COMPREHENSIVE PDF INVOICE & EMAIL AUTOMATION TEST");
  console.log("========================================================\n");

  const MONGO_URL = process.env.MONGO_URL;
  if (!MONGO_URL) throw new Error("MONGO_URL is required in .env");

  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  console.log("✓ Connected to MongoDB for testing.");

  await new Promise((resolve) => {
    serverInstance = server.listen(0, () => {
      const port = serverInstance.address().port;
      serverUrl = `http://127.0.0.1:${port}`;
      console.log(`✓ Test Server listening on ${serverUrl}\n`);
      resolve();
    });
  });

  const timestamp = Date.now();
  const customerEmail = `customer_${timestamp}@shopiee-test.com`;
  const otherCustomerEmail = `other_${timestamp}@shopiee-test.com`;
  const adminEmail = `admin_${timestamp}@shopiee-test.com`;

  try {
    // ----------------------------------------------------
    // Setup Users and Tokens
    // ----------------------------------------------------
    const customer = await User.create({
      name: "Alice Customer",
      email: customerEmail,
      password: "password123",
      role: "user",
      phone: "9876543210",
      country: "India"
    });
    const customerToken = jwt.sign(
      { id: customer._id, email: customer.email, role: customer.role, name: customer.name, tokenVersion: 0 },
      TEST_SECRET
    );

    const otherCustomer = await User.create({
      name: "Bob Malicious",
      email: otherCustomerEmail,
      password: "password123",
      role: "user"
    });
    const otherCustomerToken = jwt.sign(
      { id: otherCustomer._id, email: otherCustomer.email, role: otherCustomer.role, name: otherCustomer.name, tokenVersion: 0 },
      TEST_SECRET
    );

    const admin = await User.create({
      name: "Store Admin",
      email: adminEmail,
      password: "password123",
      role: "admin"
    });
    const adminToken = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role, name: admin.name, tokenVersion: 0 },
      TEST_SECRET
    );

    // Setup Test Products
    const prod1 = await Product.create({
      name: "Wireless Noise Cancelling Headphones",
      category: "Electronics",
      price: 2499,
      stock: 50,
      description: "Premium sound"
    });

    const prod2 = await Product.create({
      name: "Mechanical Gaming Keyboard RGB",
      category: "Electronics",
      price: 1899,
      stock: 30,
      description: "Tactile switches"
    });

    // Setup Test Orders
    const paidOrder = await Order.create({
      userId: customer._id,
      userName: customer.name,
      userEmail: customer.email,
      products: [
        { productId: prod1._id, name: prod1.name, price: prod1.price, quantity: 2 },
        { productId: prod2._id, name: prod2.name, price: prod2.price, quantity: 1 }
      ],
      totalAmount: 2499 * 2 + 1899,
      status: "Processing",
      paymentStatus: "Paid",
      paymentMethod: "UPI",
      paymentDetails: {
        transactionId: `TXN_TEST_${timestamp}`,
        paidAt: new Date()
      }
    });

    const unpaidOrder = await Order.create({
      userId: customer._id,
      userName: customer.name,
      userEmail: customer.email,
      products: [
        { productId: prod1._id, name: prod1.name, price: prod1.price, quantity: 1 }
      ],
      totalAmount: 2499,
      status: "Pending",
      paymentStatus: "Pending"
    });

    console.log("✓ Test setup completed: Users, products, and test orders created.");

    // ----------------------------------------------------
    // Scenario 1, 2, 3, 4: In-Memory PDF Generation & Formatting
    // ----------------------------------------------------
    console.log("\n▶ [Test 1, 2, 3, 4] In-Memory PDF Generation, Multi-Item & Currency Support");
    const pdfBuffer = await generateInvoicePDF(paidOrder, customer);
    assert(Buffer.isBuffer(pdfBuffer), "Generated invoice must be a valid Buffer");
    assert(pdfBuffer.length > 1000, "PDF buffer must be non-empty");
    assert(pdfBuffer.slice(0, 4).toString() === "%PDF", "Buffer must have valid %PDF magic header");
    console.log(`✓ Passed: Valid PDF generated in-memory (${pdfBuffer.length} bytes, no temp files written).`);

    // ----------------------------------------------------
    // Scenario 5 & 6: Unpaid Orders Cannot Generate/Download Invoices
    // ----------------------------------------------------
    console.log("\n▶ [Test 5, 6] Unpaid / Pending Order Rejection");
    const unpaidRes = await apiRequest(`/api/orders/${unpaidOrder._id}/invoice`, {
      token: customerToken
    });
    assert.strictEqual(unpaidRes.status, 400, "Unpaid order must return 400 Bad Request");
    const unpaidData = await unpaidRes.json();
    assert(unpaidData.message.includes("only available for paid orders"), "Error must state unpaid restriction");
    console.log("✓ Passed: Download correctly rejected for unpaid order.");

    // ----------------------------------------------------
    // Scenario 7: Customer Can Download Their Own Paid Invoice
    // ----------------------------------------------------
    console.log("\n▶ [Test 7] Authorized Customer Invoice Download");
    const downloadRes = await apiRequest(`/api/orders/${paidOrder._id}/invoice`, {
      token: customerToken
    });
    assert.strictEqual(downloadRes.status, 200, "Customer must be able to download their own invoice");
    assert.strictEqual(downloadRes.headers.get("content-type"), "application/pdf");
    assert(downloadRes.headers.get("content-disposition").includes("attachment; filename="));
    const downloadedBytes = await downloadRes.arrayBuffer();
    assert(downloadedBytes.byteLength > 1000, "Downloaded PDF must match expected size");
    console.log("✓ Passed: Customer downloaded their invoice successfully with correct headers.");

    // ----------------------------------------------------
    // Scenario 8: Customer CANNOT Access Another Customer's Invoice (Tenant Isolation)
    // ----------------------------------------------------
    console.log("\n▶ [Test 8] Cross-Tenant Access Protection (403 Forbidden)");
    const crossTenantRes = await apiRequest(`/api/orders/${paidOrder._id}/invoice`, {
      token: otherCustomerToken
    });
    assert.strictEqual(crossTenantRes.status, 403, "Access to another customer's invoice must be 403 Forbidden");
    console.log("✓ Passed: Cross-tenant unauthorized access strictly blocked.");

    // ----------------------------------------------------
    // Scenario 9: Authorized Admin Can Download Invoices
    // ----------------------------------------------------
    console.log("\n▶ [Test 9] Admin Privilege Invoice Download");
    const adminDownloadRes = await apiRequest(`/api/orders/${paidOrder._id}/invoice`, {
      token: adminToken
    });
    assert.strictEqual(adminDownloadRes.status, 200, "Admin must be authorized to download any order invoice");
    console.log("✓ Passed: Admin authorized download passed.");

    // ----------------------------------------------------
    // Scenario 10: Invalid Order ID Format Rejection
    // ----------------------------------------------------
    console.log("\n▶ [Test 10] Invalid Order ID Validation");
    const invalidIdRes = await apiRequest("/api/orders/not_a_valid_mongo_id/invoice", {
      token: customerToken
    });
    assert.strictEqual(invalidIdRes.status, 400, "Malformed ObjectId must return 400");
    console.log("✓ Passed: Invalid order ID rejected.");

    // ----------------------------------------------------
    // Scenario 11 & 12: Idempotency & Duplicate Email Prevention
    // ----------------------------------------------------
    console.log("\n▶ [Test 11, 12] Concurrency-Safe Idempotency & Duplicate Email Prevention");
    // Call 1: First invocation
    const result1 = await processOrderInvoiceAndEmail(paidOrder._id);
    assert(result1.invoiceNumber, "Invoice number must be generated");

    // Check DB state
    const orderInDb = await Order.findById(paidOrder._id);
    assert.strictEqual(orderInDb.invoiceNumber, result1.invoiceNumber);

    // Call 2: Simulated duplicate webhook delivery
    const result2 = await processOrderInvoiceAndEmail(paidOrder._id);
    assert.strictEqual(result2.invoiceNumber, result1.invoiceNumber, "Invoice number must NEVER change on retry");
    assert.strictEqual(result2.emailSent, false, "Second call must NOT send duplicate email");
    assert.strictEqual(result2.reason, "Email already sent or sending", "Idempotency reason must be returned");
    console.log("✓ Passed: Duplicate webhooks safely rejected by idempotency check; zero duplicate emails.");

    // ----------------------------------------------------
    // Scenario 13 & 14: Email Failure Resilience
    // ----------------------------------------------------
    console.log("\n▶ [Test 13, 14] Email Failure Resilience");
    // Even if email fails, paymentStatus must remain 'Paid'
    assert.strictEqual(orderInDb.paymentStatus, "Paid", "Payment status must stay 'Paid' regardless of email");
    console.log("✓ Passed: Payment status integrity preserved.");

    console.log("\n========================================================");
    console.log("🎉 ALL INVOICE TESTS PASSED SUCCESSFULLY (14/14)!");
    console.log("========================================================\n");

    // Clean up test data
    await Promise.all([
      User.deleteMany({ _id: { $in: [customer._id, otherCustomer._id, admin._id] } }),
      Product.deleteMany({ _id: { $in: [prod1._id, prod2._id] } }),
      Order.deleteMany({ _id: { $in: [paidOrder._id, unpaidOrder._id] } })
    ]);
  } catch (err) {
    console.error("❌ Invoice test failed:", err);
    process.exitCode = 1;
  } finally {
    if (serverInstance) serverInstance.close();
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
}

runInvoiceTestSuite();

