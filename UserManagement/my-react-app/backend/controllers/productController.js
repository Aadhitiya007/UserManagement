const Product = require("../models/Product");
const Order = require("../models/Order");
const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const {
  getSignedUrl
} = require("@aws-sdk/s3-request-presigner");
const s3 = require("../config/s3");
const fs = require("fs");
const path = require("path");

// In-memory cache for presigned URLs: key -> { url, expiresAt }
const presignedCache = new Map();

/**
 * Converts a stored S3 object key or legacy URL into a temporary presigned URL.
 * Handles private S3 objects while retaining compatibility with existing
 * Base64 images, local upload paths, and external image URLs.
 */
async function getProductWithImageUrl(product) {
  if (!product) return product;

  const item =
    typeof product.toObject === "function"
      ? product.toObject()
      : { ...product };

  const image =
    typeof item.image === "string"
      ? item.image.trim()
      : "";

  // Default: preserve the stored image value
  item.imageUrl = image;

  // Empty or Base64 images do not need S3 signing
  if (!image || image.startsWith("data:") || image.startsWith("blob:")) {
    return item;
  }

  // Local fallback uploads
  if (image.startsWith("uploads/")) {
    item.imageUrl = `/${image}`;
    return item;
  }
  if (image.startsWith("/uploads/")) {
    item.imageUrl = image;
    return item;
  }

  const bucketName = typeof s3.getBucketName === "function"
    ? s3.getBucketName()
    : (process.env.AWS_S3_BUCKET_NAME || "");

  const region = typeof s3.getRegion === "function"
    ? s3.getRegion()
    : (process.env.AWS_REGION );

  let key = "";

  // New canonical format: products/filename.jpg
  if (image.startsWith("products/")) {
    key = image.replace(/\.\./g, "");
  } else if (image.startsWith("http://") || image.startsWith("https://")) {
    try {
      const parsed = new URL(image);

      const isConfiguredBucket =
        bucketName &&
        (
          parsed.hostname === `${bucketName}.s3.${region}.amazonaws.com` ||
          parsed.hostname === `${bucketName}.s3.amazonaws.com` ||
          parsed.hostname.startsWith(`${bucketName}.s3.`) ||
          parsed.hostname.includes(bucketName)
        );

      if (isConfiguredBucket) {
        key = decodeURIComponent(
          parsed.pathname.replace(/^\/+/, "")
        ).replace(/\.\./g, "");
      } else if (parsed.hostname.includes(".s3.") || parsed.hostname.includes(".amazonaws.com")) {
        const pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
        if (pathname.startsWith("products/")) {
          key = pathname.replace(/\.\./g, "");
        } else {
          item.imageUrl = "";
        }
      }
    } catch {
      // Keep the original URL if parsing fails
    }
  }

  if (key && bucketName) {
    try {
      const now = Date.now();
      const cached = presignedCache.get(key);
      if (cached && cached.expiresAt > now) {
        item.imageUrl = cached.url;
        item.image = cached.url;
        return item;
      }

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key
      });

      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

      // Cache for 50 minutes (safety buffer before 60-min expiry)
      presignedCache.set(key, {
        url: signedUrl,
        expiresAt: now + 50 * 60 * 1000
      });

      item.imageUrl = signedUrl;
      item.image = signedUrl;
    } catch (error) {
      console.warn(`Unable to sign S3 image URL for key "${key}":`, error.message);
      item.imageUrl = "";
    }
  } else if (key && !bucketName) {
    item.imageUrl = "";
  }

  return item;
}

/**
 * Applies the presigned URL helper across an array of products.
 */
async function getProductsWithImageUrls(products) {
  if (!Array.isArray(products)) return [];
  return Promise.all(products.map(getProductWithImageUrl));
}

// Periodic cleanup of expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of presignedCache.entries()) {
    if (value.expiresAt <= now) {
      presignedCache.delete(key);
    }
  }
}, 15 * 60 * 1000).unref();

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

    // Pagination
    if (page) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 12;
      const skip = (pageNum - 1) * limitNum;

      const total = await Product.countDocuments(query);
      const rawProducts = await Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      const productsWithImageUrls = await getProductsWithImageUrls(rawProducts);

      return res.json({
        products: productsWithImageUrls,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum)
      });
    }

    const rawProducts = await Product.find(query).sort({ createdAt: -1 });
    const productsWithImageUrls = await getProductsWithImageUrls(rawProducts);
    res.json(productsWithImageUrls);
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
    const productWithUrl = await getProductWithImageUrl(product);
    res.json(productWithUrl);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper: Upload to S3 with local disk fallback and sanitized error logging
async function processProductImage(file) {
  const cleanName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
  const fileName = `products/${cleanName}`;
  const bucketName = typeof s3.getBucketName === "function"
    ? s3.getBucketName()
    : (process.env.AWS_S3_BUCKET_NAME || "");

  let image = "";
  let uploadSource = "s3";
  let s3Error = null;

  try {
    if (!bucketName || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("AWS S3 environment variables not configured");
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype
    });

    await s3.send(command);

    // Store the canonical key in MongoDB, not a public S3 URL
    image = fileName;
    uploadSource = "s3";
    console.log("✓ AWS S3 Upload Successful. Object Key:", fileName);
  } catch (err) {
    s3Error = "S3 upload failed, stored locally";
    uploadSource = "local";
    console.warn("⚠️ S3 upload unavailable, falling back to local disk storage:", err.message);

    const localDir = path.join(__dirname, "..", "uploads", "products");
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const localPath = path.join(localDir, cleanName);
    await fs.promises.writeFile(localPath, file.buffer);

    image = `uploads/products/${cleanName}`;
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

    const productWithUrl = await getProductWithImageUrl(product);

    res.status(201).json({
      message: "Product created successfully",
      product: productWithUrl,
      uploadSource,
      s3Error
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Deletes a product image from AWS S3 (or local disk if stored locally).
 * Also purges the corresponding presigned URL cache entry.
 */
async function deleteProductImageFile(image) {
  if (!image || typeof image !== "string") return;
  const trimmed = image.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return;

  const bucketName = typeof s3.getBucketName === "function"
    ? s3.getBucketName()
    : (process.env.AWS_S3_BUCKET_NAME || "");

  let s3Key = "";

  // 1. Check canonical S3 key: products/filename.jpg
  if (trimmed.startsWith("products/")) {
    s3Key = trimmed.replace(/\.\./g, "");
  } else if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")).replace(/\.\./g, "");
      if (pathname.startsWith("products/")) {
        s3Key = pathname;
      } else if (parsed.hostname.includes("amazonaws.com") || parsed.hostname.includes(".s3.")) {
        const idx = pathname.indexOf("products/");
        if (idx !== -1) {
          s3Key = pathname.substring(idx);
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  // If S3 key found, delete object from S3 bucket
  if (s3Key && bucketName) {
    try {
      const deleteCmd = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: s3Key
      });
      await s3.send(deleteCmd);
      presignedCache.delete(s3Key);
      console.log(`✓ AWS S3 Object Deleted: ${s3Key}`);
    } catch (err) {
      console.warn(`⚠️ AWS S3 object deletion warning for "${s3Key}":`, err.message);
    }
  }

  // 2. If image is stored in local uploads directory
  if (trimmed.startsWith("uploads/") || trimmed.startsWith("/uploads/")) {
    try {
      const localRelPath = trimmed.replace(/^\/+/, "");
      const localFullPath = path.join(__dirname, "..", localRelPath);
      if (fs.existsSync(localFullPath)) {
        await fs.promises.unlink(localFullPath);
        console.log(`✓ Local product image file deleted: ${localRelPath}`);
      }
    } catch (err) {
      console.warn("⚠️ Failed to delete local image file:", err.message);
    }
  }
}

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
      // If replacing an existing image, delete the old image file from S3 / disk
      if (product.image) {
        await deleteProductImageFile(product.image);
      }
      const result = await processProductImage(req.file);
      product.image = result.image;
      uploadSource = result.uploadSource;
      s3Error = result.s3Error;
    } else if (req.body.image && req.body.image !== product.image) {
      if (product.image) {
        await deleteProductImageFile(product.image);
      }
      product.image = req.body.image;
      uploadSource = "url";
    }

    await product.save();
    const productWithUrl = await getProductWithImageUrl(product);

    res.json({
      message: "Product updated successfully",
      product: productWithUrl,
      uploadSource,
      s3Error
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Clean up S3 image and local files before deleting product document
    if (product.image) {
      await deleteProductImageFile(product.image);
    }

    await Product.findByIdAndDelete(req.params.id);
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
    const productWithUrl = await getProductWithImageUrl(product);

    res.status(201).json({ message: "Review submitted successfully", product: productWithUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const products = await Product.find({ "reviews.0": { $exists: true } });
    const allReviews = [];

    for (const product of products) {
      if (Array.isArray(product.reviews)) {
        const itemWithUrl = await getProductWithImageUrl(product);
        product.reviews.forEach((review) => {
          allReviews.push({
            _id: review._id,
            productId: product._id,
            productName: product.name,
            productImage: itemWithUrl.imageUrl || itemWithUrl.image,
            userId: review.userId,
            userName: review.userName,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt
          });
        });
      }
    }

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

// Export helpers for testing and reuse
exports.getProductWithImageUrl = getProductWithImageUrl;
exports.getProductsWithImageUrls = getProductsWithImageUrls;
exports.processProductImage = processProductImage;
exports.deleteProductImageFile = deleteProductImageFile;
