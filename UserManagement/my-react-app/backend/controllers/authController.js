const crypto = require("crypto");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is missing.");
  }
  return process.env.JWT_SECRET;
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, age, country, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Security fix: Force role to "user" to prevent privilege escalation
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user",
      age,
      country,
      phone,
      tokenVersion: 0
    });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name, tokenVersion: user.tokenVersion || 0 },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, name: user.name, tokenVersion: user.tokenVersion || 0 },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Account Enumeration Safe Password Reset Request
 * POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  const genericResponse = {
    message: "If an account exists with this email, a password reset link has been sent."
  };

  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(200).json(genericResponse);
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      // Artificial delay simulation to mitigate timing-based account enumeration
      await new Promise((resolve) => setTimeout(resolve, 150));
      return res.status(200).json(genericResponse);
    }

    // 1. Cryptographically secure 32-byte raw token
    const rawToken = crypto.randomBytes(32).toString("hex");

    // 2. Hash raw token with SHA-256 for MongoDB storage
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    // 3. Save hash with 15-minute expiration
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    // 4. Construct safe reset URL
    const frontendBaseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const resetUrl = `${frontendBaseUrl}/reset-password/${rawToken}`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b; margin-bottom: 16px;">Password Reset Request</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          You requested a password reset for your <strong>Shopiee</strong> account. Click the button below to set a new password:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            Reset My Password
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          This link will expire in <strong>15 minutes</strong>. If you did not request this, please disregard this email and your password will remain unchanged.
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">Shopiee E-Commerce Platform • Security Services</p>
      </div>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: "Shopiee - Password Reset Request",
        html: htmlContent
      });
    } catch (emailErr) {
      // Clear token if email delivery hard fails to prevent zombie tokens
      user.resetPasswordToken = null;
      user.resetPasswordExpire = null;
      await user.save();
      console.error("[Auth] Email delivery failure:", emailErr.message);
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("[Auth] Forgot password error:", error.message);
    return res.status(200).json(genericResponse);
  }
};

/**
 * Atomically Consume Token and Set New Password
 * PUT /api/auth/reset-password/:token
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Invalid or missing password reset token." });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    // Hash the raw token to match MongoDB stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Atomically find and clear token in a single operation to prevent concurrent reuse
    const user = await User.findOneAndUpdate(
      {
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: new Date() }
      },
      {
        $set: {
          resetPasswordToken: null,
          resetPasswordExpire: null
        },
        $inc: {
          tokenVersion: 1
        }
      },
      { returnDocument: "after" }
    );

    if (!user) {
      return res.status(400).json({ message: "Password reset link is invalid or has expired." });
    }

    // Hash and store the new password
    user.password = await bcrypt.hash(password, 10);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in with your new password."
    });
  } catch (error) {
    console.error("[Auth] Reset password error:", error.message);
    return res.status(500).json({ message: "Unable to reset password. Please try again later." });
  }
};
