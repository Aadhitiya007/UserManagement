const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Product price cannot be negative"]
    },
    category: {
      type: String,
      required: [true, "Product category is required"],
      trim: true
    },
    stock: {
      type: Number,
      required: [true, "Product stock quantity is required"],
      default: 0,
      min: [0, "Product stock quantity cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Stock quantity must be an integer"
      }
    },
    image: {
      type: String,
      default: ""
    },
    mrp: {
      type: Number,
      min: [0, "MRP cannot be negative"]
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"]
    },
    reviewsCount: {
      type: Number,
      default: 0,
      min: [0, "Reviews count cannot be negative"]
    },
    warranty: {
      type: String,
      default: "1 Year Manufacturer Warranty"
    },
    reviews: [reviewSchema]
  },
  { timestamps: true }
);

productSchema.index({ category: 1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model("Product", productSchema);
