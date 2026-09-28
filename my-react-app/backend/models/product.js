const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number, required: true },
    discount: { type: String },
    rating: { type: Number, default: 4.5 },
    reviews: { type: Number, default: 0 },
    image: { type: String, required: true },
    tag: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);