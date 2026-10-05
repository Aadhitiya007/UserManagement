const mongoose = require("mongoose");

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
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
