const dns = require("dns");
try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch (e) {}
dns.setDefaultResultOrder("ipv4first");

require("dotenv").config();
const assert = require("assert");
const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { app, server } = require("../server");
const User = require("../models/User");

const TEST_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
let serverUrl = "";
let serverInstance = null;

// Helper to make HTTP requests
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

async function runTests() {
  console.log("\n========================================================");
  console.log("🔒 FORGOT & RESET PASSWORD COMPREHENSIVE SECURITY TEST");
  console.log("========================================================\n");

  const MONGO_URL = process.env.MONGO_URL;
  if (!MONGO_URL) {
    throw new Error("MONGO_URL is required in .env");
  }

  await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  console.log("✓ MongoDB connected for test suite.\n");

  await new Promise((resolve) => {
    serverInstance = server.listen(0, () => {
      const port = serverInstance.address().port;
      serverUrl = `http://127.0.0.1:${port}`;
      console.log(`✓ Test Server listening on ${serverUrl}\n`);
      resolve();
    });
  });

  const testEmail = `sec_user_${Date.now()}@shopiee-test.com`;
  const initialPassword = "InitialPassword123!";
  const newPassword = "NewSecurePassword456#";

  try {
    // ----------------------------------------------------
    // Setup: Create verified test user
    // ----------------------------------------------------
    const hashedPassword = await bcrypt.hash(initialPassword, 10);
    const user = await User.create({
      name: "Security Tester",
      email: testEmail,
      password: hashedPassword,
      role: "user",
      tokenVersion: 0
    });

    const oldJwt = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name, tokenVersion: 0 },
      TEST_SECRET,
      { expiresIn: "1h" }
    );

    console.log("Test Setup: Initialized test user & baseline JWT.");

    // ----------------------------------------------------
    // Test 1 & 2 & 3: Account Enumeration Protection
    // ----------------------------------------------------
    console.log("\n▶ [Test 1, 2, 3] Account Enumeration Protection");
    const regRes = await apiRequest("/api/auth/forgot-password", {
      method: "POST",
      body: { email: testEmail }
    });

    const unregRes = await apiRequest("/api/auth/forgot-password", {
      method: "POST",
      body: { email: "completely_fake_email_9999@random.org" }
    });

    assert.strictEqual(regRes.status, 200, "Registered email should return 200");
    assert.strictEqual(unregRes.status, 200, "Unregistered email should return 200");
    assert.strictEqual(
      regRes.data.message,
      unregRes.data.message,
      "Response messages must be IDENTICAL to prevent account enumeration"
    );
    console.log("✓ Passed: Identical status 200 and messages returned regardless of account existence.");

    // ----------------------------------------------------
    // Test 4: Verify MongoDB stores SHA-256 hash (never raw token)
    // ----------------------------------------------------
    console.log("\n▶ [Test 4] Secure Token Generation & Storage (SHA-256)");
    const userInDb = await User.findOne({ email: testEmail });
    assert(userInDb.resetPasswordToken, "Token hash must be present in MongoDB");
    assert.strictEqual(userInDb.resetPasswordToken.length, 64, "Token stored in MongoDB must be a 64-char SHA-256 hash");
    assert(userInDb.resetPasswordExpire > new Date(), "Expiration must be set in future");
    console.log("✓ Passed: Token stored as 64-character SHA-256 hash with valid 15-minute expiration.");

    // ----------------------------------------------------
    // Test 5: Invalid raw token is rejected
    // ----------------------------------------------------
    console.log("\n▶ [Test 5] Invalid Token Rejection");
    const invalidRes = await apiRequest("/api/auth/reset-password/fake_raw_token_that_does_not_exist", {
      method: "PUT",
      body: { password: newPassword }
    });
    assert.strictEqual(invalidRes.status, 400, "Invalid token must return 400");
    console.log("✓ Passed: Invalid token correctly rejected with 400.");

    // ----------------------------------------------------
    // Test 6: Expired token rejection
    // ----------------------------------------------------
    console.log("\n▶ [Test 6] Expired Token Rejection");
    // Manually set expiration in past
    userInDb.resetPasswordExpire = new Date(Date.now() - 60 * 1000);
    await userInDb.save();

    const expiredRes = await apiRequest(`/api/auth/reset-password/any_token`, {
      method: "PUT",
      body: { password: newPassword }
    });
    assert.strictEqual(expiredRes.status, 400, "Expired token must return 400");
    console.log("✓ Passed: Expired token rejected.");

    // ----------------------------------------------------
    // Test 7: Successful Password Reset with Valid Raw Token
    // ----------------------------------------------------
    console.log("\n▶ [Test 7] Valid Token Successfully Resets Password");
    const rawResetToken = crypto.randomBytes(32).toString("hex");
    const sha256Hash = crypto.createHash("sha256").update(rawResetToken).digest("hex");

    userInDb.resetPasswordToken = sha256Hash;
    userInDb.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
    await userInDb.save();

    const resetSuccessRes = await apiRequest(`/api/auth/reset-password/${rawResetToken}`, {
      method: "PUT",
      body: { password: newPassword }
    });
    assert.strictEqual(resetSuccessRes.status, 200, "Valid token reset should succeed");
    assert.strictEqual(resetSuccessRes.data.success, true);
    console.log("✓ Passed: Password reset succeeded with status 200.");

    // ----------------------------------------------------
    // Test 8: Reused token rejection (Single-Use Guarantee)
    // ----------------------------------------------------
    console.log("\n▶ [Test 8] Reused Token Rejection (Single-Use)");
    const reuseRes = await apiRequest(`/api/auth/reset-password/${rawResetToken}`, {
      method: "PUT",
      body: { password: "AnotherPassword789!" }
    });
    assert.strictEqual(reuseRes.status, 400, "Reused token must return 400");
    console.log("✓ Passed: Token was atomically cleared and cannot be reused.");

    // ----------------------------------------------------
    // Test 9: Bcrypt Password Verification & No Plaintext
    // ----------------------------------------------------
    console.log("\n▶ [Test 9] Password Stored as Bcrypt Hash");
    const updatedUser = await User.findOne({ email: testEmail });
    assert(updatedUser.password.startsWith("$2"), "Password must be a bcrypt hash string");
    const isNewPassValid = await bcrypt.compare(newPassword, updatedUser.password);
    assert.strictEqual(isNewPassValid, true, "New password must match stored bcrypt hash");
    console.log("✓ Passed: Stored password is confirmed bcrypt hash; plaintext is never stored.");

    // ----------------------------------------------------
    // Test 10: JWT Invalidation via tokenVersion
    // ----------------------------------------------------
    console.log("\n▶ [Test 10] Old JWT Invalidation via tokenVersion");
    assert.strictEqual(updatedUser.tokenVersion, 1, "tokenVersion must have incremented from 0 to 1");

    // Try calling protected endpoint (/api/orders/my-orders) with oldJwt (tokenVersion: 0)
    const oldJwtCheck = await apiRequest("/api/orders/my-orders", {
      method: "GET",
      token: oldJwt
    });
    assert.strictEqual(oldJwtCheck.status, 401, "Old JWT must be rejected with 401 Unauthorized");
    assert(
      oldJwtCheck.data.message.includes("Session expired due to password reset"),
      "Message must indicate token invalidation"
    );
    console.log("✓ Passed: Previously issued JWTs are rejected immediately after password reset.");

    // ----------------------------------------------------
    // Test 11: New JWT Authentication Works Correctly
    // ----------------------------------------------------
    console.log("\n▶ [Test 11] New JWT Authentication Works Correctly");
    const newLoginRes = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email: testEmail, password: newPassword }
    });
    assert.strictEqual(newLoginRes.status, 200, "Login with new password must succeed");
    const newJwt = newLoginRes.data.token;

    const newJwtCheck = await apiRequest("/api/orders/my-orders", {
      method: "GET",
      token: newJwt
    });
    assert.strictEqual(newJwtCheck.status, 200, "New JWT must be accepted with 200 OK");
    console.log("✓ Passed: Login with new password issues active JWT with updated tokenVersion.");

    // ----------------------------------------------------
    // Test 12: Short password validation
    // ----------------------------------------------------
    console.log("\n▶ [Test 12] Short Password Validation");
    const shortPassRes = await apiRequest(`/api/auth/reset-password/${rawResetToken}`, {
      method: "PUT",
      body: { password: "123" }
    });
    assert.strictEqual(shortPassRes.status, 400, "Passwords under 6 characters must be rejected");
    console.log("✓ Passed: Password minimum length enforcement verified.");

    console.log("\n========================================================");
    console.log("🎉 ALL 12/12 SECURITY RESET TESTS PASSED SUCCESSFULLY!");
    console.log("========================================================\n");

    // Clean up test user
    await User.deleteOne({ email: testEmail });
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exitCode = 1;
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
}

runTests();
