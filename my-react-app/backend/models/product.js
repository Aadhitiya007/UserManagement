const mongoose = require("mongoose");

const colorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    color: { type: String, required: true }
  },
  { _id: false }
);

const variantSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    priceDiff: { type: Number, default: 0 },
    status: { type: String, default: "in-stock" },
    badge: { type: String }
  },
  { _id: false }
);

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
    tag: { type: String },
    description: { type: String },
    specs: {
      display: { type: String },
      processor: { type: String },
      camera: { type: String },
      battery: { type: String },
      os: { type: String },
      warranty: { type: String },
      sound: { type: String },
      connectivity: { type: String }
    },
    colors: [colorSchema],
    variants: [variantSchema],
    quantity: { type: Number, default: 10, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);