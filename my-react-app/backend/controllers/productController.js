const Product = require("../models/Product");
const Order = require("../models/Order");

// Get all products (supports backend search query: /api/products?search=term)
exports.getProducts = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query = {
        $or: [
          { name: searchRegex },
          { category: searchRegex },
          { description: searchRegex }
        ]
      };
    }

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create product (Admin only)
exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ message: "Name, price, and category are required" });
    }

    let image = "";
    if (req.file) {
      image = `/uploads/products/${req.file.filename}`;
    } else if (req.body.image) {
      image = req.body.image;
    }

    const product = await Product.create({
      name,
      description: description || "",
      price: Number(price),
      category,
      stock: Number(stock || 0),
      image
    });

    res.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update product (Admin only)
exports.updateProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (name) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = Number(price);
    if (category) product.category = category;
    if (stock !== undefined) product.stock = Number(stock);

    if (req.file) {
      product.image = `/uploads/products/${req.file.filename}`;
    } else if (req.body.image) {
      product.image = req.body.image;
    }

    await product.save();
    res.json({ message: "Product updated successfully", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete product (Admin only)
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Check if user has purchased the product
exports.checkPurchaseEligibility = async (req, res) => {
  try {
    const hasPurchased = await Order.findOne({
      userId: req.user.id,
      "products.productId": req.params.id,
      status: { $ne: "Cancelled" }
    });

    res.json({ canReview: Boolean(hasPurchased) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create or update product review (Verified purchasers only)
exports.createProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({ message: "Rating and comment are required" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // 🔒 Verified Purchase Check: Must have a non-cancelled order for this product
    const hasPurchased = await Order.findOne({
      userId: req.user.id,
      "products.productId": req.params.id,
      status: { $ne: "Cancelled" }
    });

    if (!hasPurchased) {
      return res.status(403).json({
        message: "Only verified buyers who purchased this product can submit a review."
      });
    }

    const alreadyReviewed = product.reviews.find(
      (r) => r.userId.toString() === req.user.id.toString()
    );

    if (alreadyReviewed) {
      alreadyReviewed.rating = Number(rating);
      alreadyReviewed.comment = comment;
    } else {
      product.reviews.push({
        userId: req.user.id,
        userName: req.user.name || "Customer",
        rating: Number(rating),
        comment
      });
    }

    // Recalculate average rating & total review count
    product.reviewsCount = product.reviews.length;
    const totalStars = product.reviews.reduce((sum, item) => sum + item.rating, 0);
    product.rating = Math.round((totalStars / product.reviews.length) * 10) / 10;

    await product.save();
    res.status(201).json({ message: "Review submitted successfully", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};