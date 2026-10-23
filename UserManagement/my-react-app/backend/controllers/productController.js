const Product = require("../models/Product");
const Order = require("../models/Order");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("../config/s3");
const fs = require("fs");
const path = require("path");

exports.getProducts = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    let query = {};

    if (search) {
      const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(sanitizedSearch, "i");
      query = {
        $or: [
          { name: searchRegex },
          { category: searchRegex },
          { description: searchRegex }
        ]
      };
    }
//pagination
    if (page) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 12;
      const skip = (pageNum - 1) * limitNum;

      const total = await Product.countDocuments(query);
      const products = await Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      return res.json({
        products,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum)
      });
    }

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

// Helper: Upload to S3 with local disk fallback and error logging
async function processProductImage(file) {
  const cleanName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
  const fileName = `products/${cleanName}`;
  let image = "";
  let uploadSource = "s3";
  let s3Error = null;

  try {
  // processProductImage command
  const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype
    });

    await s3.send(command);

    image = process.env.AWS_S3_BUCKET_NAME && process.env.AWS_REGION
      ? `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`
      : fileName;
    uploadSource = "s3";
    console.log("✓ AWS S3 Upload Successful:", image);
  } catch (err) {
    s3Error = err.message;
    uploadSource = "local";
    console.error("❌ AWS S3 Upload Failed:", err.message);
    console.warn("⚠️ S3 error detected! Falling back to local disk storage (uploads/products)...");

    const localDir = path.join(__dirname, "..", "uploads", "products");
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const localPath = path.join(localDir, cleanName);
    await fs.promises.writeFile(localPath, file.buffer);

    image = `uploads/products/${cleanName}`;
    console.log("✓ Saved image to local server storage:", image);
  }

  return { image, uploadSource, s3Error };
}

exports.createProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ message: "Name, price, and category are required" });
    }

    let image = "";
    let uploadSource = "none";
    let s3Error = null;

    if (req.file) {
      const result = await processProductImage(req.file);
      image = result.image;
      uploadSource = result.uploadSource;
      s3Error = result.s3Error;
    } else if (req.body.image) {
      image = req.body.image;
      uploadSource = "url";
    }

    const product = await Product.create({
      name,
      description: description || "",
      price: Number(price),
      category,
      stock: Number(stock || 0),
      image
    });

    res.status(201).json({
      message: "Product created successfully",
      product,
      uploadSource,
      s3Error
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

    let uploadSource = "none";
    let s3Error = null;

    if (req.file) {
      const result = await processProductImage(req.file);
      product.image = result.image;
      uploadSource = result.uploadSource;
      s3Error = result.s3Error;
    } else if (req.body.image) {
      product.image = req.body.image;
      uploadSource = "url";
    }

    await product.save();
    res.json({
      message: "Product updated successfully",
      product,
      uploadSource,
      s3Error
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

exports.checkPurchaseEligibility = async (req, res) => {
  try {
    const hasPurchased = await Order.findOne({
      userId: req.user.id,
      "products.productId": req.params.id,
      paymentStatus: "Paid",
      status: { $ne: "Cancelled" }
    });

    res.json({ canReview: Boolean(hasPurchased) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

    const hasPurchased = await Order.findOne({
      userId: req.user.id,
      "products.productId": req.params.id,
      paymentStatus: "Paid",
      status: { $ne: "Cancelled" }
    });

    if (!hasPurchased) {
      return res.status(403).json({
        message: "Only verified buyers with completed payment can submit a review."
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

    product.reviewsCount = product.reviews.length;
    const totalStars = product.reviews.reduce((sum, item) => sum + item.rating, 0);
    product.rating = Math.round((totalStars / product.reviews.length) * 10) / 10;

    await product.save();
    res.status(201).json({ message: "Review submitted successfully", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const products = await Product.find({ "reviews.0": { $exists: true } });
    const allReviews = [];

    products.forEach((product) => {
      if (Array.isArray(product.reviews)) {
        product.reviews.forEach((review) => {
          allReviews.push({
            _id: review._id,
            productId: product._id,
            productName: product.name,
            productImage: product.image,
            userId: review.userId,
            userName: review.userName,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt
          });
        });
      }
    });

    // Sort newest first
    allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(allReviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProductReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const reviewExists = product.reviews.some((r) => r._id.toString() === reviewId);
    if (!reviewExists) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Filter out the review
    product.reviews = product.reviews.filter((r) => r._id.toString() !== reviewId);
    product.reviewsCount = product.reviews.length;

    // Recalculate average rating
    if (product.reviews.length > 0) {
      const totalStars = product.reviews.reduce((sum, item) => sum + item.rating, 0);
      product.rating = Math.round((totalStars / product.reviews.length) * 10) / 10;
    } else {
      product.rating = 0;
    }

    await product.save();

    res.json({
      message: "Review deleted successfully",
      reviewsCount: product.reviewsCount,
      rating: product.rating
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};