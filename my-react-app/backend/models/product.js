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
      required: [true, "Product name is required"]
    },
    description: {
      type: String,
      default: ""
    },
    price: {
      type: Number,
      required: [true, "Product price is required"]
    },
    category: {
      type: String,
      required: [true, "Product category is required"]
    },
    stock: {
      type: Number,
      required: [true, "Product stock quantity is required"],
      default: 0
    },
    image: {
      type: String,
      default: ""
    },
    mrp: {
      type: Number
    },
    rating: {
      type: Number,
      default: 0
    },
    reviewsCount: {
      type: Number,
      default: 0
    },
    warranty: {
      type: String,
      default: "1 Year Manufacturer Warranty"
    },
    reviews: [reviewSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
