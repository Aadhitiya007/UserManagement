const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"]
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true
    },
    password: {
      type: String,
      required: [true, "Password is required"]
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    },
    age: {
      type: Number
    },
    country: {
      type: String
    },
    phone: {
      type: String
    },
    // Secure Password Reset Fields
    resetPasswordToken: {
      type: String,
      default: null,
      index: true
    },
    resetPasswordExpire: {
      type: Date,
      default: null
    },
    // Token version for absolute JWT invalidation on password change
    tokenVersion: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
