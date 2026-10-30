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
const { calculateProductDiscount } = require("../utils/discountCalculator");
const { logActivity } = require("../utils/logger");

// In-memory cache for presigned URLs: key -> { url, expiresAt }
const presignedCache = new Map();

/**
 * Converts a stored S3 object key or legacy URL into a temporary presigned URL.
 * Handles private S3 objects while retaining compatibility with existing
 * Base64 images, local upload paths, and external image URLs.
 * Also appends authoritative effective discounted price & stock status.
 */
async function getProductWithImageUrl(product) {
  if (!product) return product;

  const item =
    typeof product.toObject === "function"
      ? product.toObject()
      : { ...product };

  // Calculate discount & stock metrics
  const discountInfo = calculateProductDiscount(item);
  item.effectivePrice = discountInfo.effectivePrice;
  item.discountAmount = discountInfo.discountAmount;
  item.discountPercent = discountInfo.discountPercent;
  item.isDiscountActive = discountInfo.isDiscountActive;
  item.isOutOfStock = Number(item.stock) <= 0;
  item.isLowStock = Number(item.stock) > 0 && Number(item.stock) <= (item.lowStockThreshold || 5);

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
    : (process.env.AWS_REGION || "ap-south-1");

  let key = "";

  // Canonical format: products/filename.jpg
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

      if (cached && cached.expiresAt > now + 60 * 1000) {
        item.imageUrl = cached.url;
        return item;
      }

      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: key
        });

        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
        presignedCache.set(key, {
          url: presignedUrl,
          expiresAt: now + 3500 * 1000
        });

        item.imageUrl = presignedUrl;
      }
    } catch (err) {
      console.warn(`Presigned URL warning for key "${key}":`, err.message);
    }
  }

  return item;
}

/**
 * Resolves images & pricing for an array of products in parallel
 */
async function getProductsWithImageUrls(products) {
  if (!Array.isArray(products)) return [];
  return Promise.all(products.map((p) => getProductWithImageUrl(p)));
}

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
    const {
      name,
      description,
      price,
      category,
      stock,
      lowStockThreshold,
      discountType,
      discountValue,
      discountStartDate,
      discountEndDate,
      isDiscountActive
    } = req.body;

    if (!name || price === undefined || !category) {
      return res.status(400).json({ message: "Name, price, and category are required" });
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ message: "Product price must be a non-negative number" });
    }

    const numStock = Number(stock !== undefined ? stock : 0);
    if (isNaN(numStock) || numStock < 0) {
      return res.status(400).json({ message: "Stock must be a non-negative number" });
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

    // Configure discount if supplied
    let discountConfig = {
      discountType: "percentage",
      value: 0,
      isActive: false
    };

    if (discountValue !== undefined && Number(discountValue) > 0) {
      const val = Number(discountValue);
      const type = discountType === "fixed" ? "fixed" : "percentage";

      if (type === "percentage" && val > 100) {
        return res.status(400).json({ message: "Percentage discount cannot exceed 100%." });
      }
      if (type === "fixed" && val > numPrice) {
        return res.status(400).json({ message: "Fixed discount cannot exceed the product price." });
      }

      discountConfig = {
        discountType: type,
        value: val,
        startDate: discountStartDate ? new Date(discountStartDate) : new Date(),
        endDate: discountEndDate ? new Date(discountEndDate) : null,
        isActive: isDiscountActive !== undefined ? (isDiscountActive === true || isDiscountActive === "true") : true
      };
    }

    const product = await Product.create({
      name,
      description: description || "",
      price: numPrice,
      category,
      stock: numStock,
      lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : 5,
      discount: discountConfig,
      image
    });

    const productWithUrl = await getProductWithImageUrl(product);

    // Audit Log: Product Created
    await logActivity({
      action: "PRODUCT_CREATED",
      category: "INVENTORY",
      actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
      target: { entityType: "Product", entityId: product._id, name: product.name },
      status: "SUCCESS",
      details: {
        price: product.price,
        stock: product.stock,
        category: product.category,
        discount: product.discount
      }
    });

    if (product.stock === 0) {
      await logActivity({
        action: "PRODUCT_OUT_OF_STOCK",
        category: "INVENTORY",
        actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
        target: { entityType: "Product", entityId: product._id, name: product.name },
        status: "WARNING",
        details: { stock: 0 }
      });
    }

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
    const {
      name,
      description,
      price,
      category,
      stock,
      lowStockThreshold,
      discountType,
      discountValue,
      discountStartDate,
      discountEndDate,
      isDiscountActive
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const previousStock = product.stock;
    const previousDiscount = { ...product.discount };

    if (name) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return res.status(400).json({ message: "Price must be a non-negative number" });
      }
      product.price = numPrice;
    }
    if (category) product.category = category;
    if (stock !== undefined) {
      const numStock = Number(stock);
      if (isNaN(numStock) || numStock < 0) {
        return res.status(400).json({ message: "Stock must be a non-negative integer" });
      }
      product.stock = numStock;
    }
    if (lowStockThreshold !== undefined) {
      product.lowStockThreshold = Math.max(0, Number(lowStockThreshold));
    }

    // Update discount configuration if provided
    let discountChanged = false;
    if (discountValue !== undefined || discountType !== undefined || isDiscountActive !== undefined) {
      const type = discountType || product.discount?.discountType || "percentage";
      const val = discountValue !== undefined ? Number(discountValue) : (product.discount?.value || 0);

      if (type === "percentage" && val > 100) {
        return res.status(400).json({ message: "Percentage discount cannot exceed 100%." });
      }
      if (type === "fixed" && val > product.price) {
        return res.status(400).json({ message: "Fixed discount cannot exceed the product price." });
      }

      product.discount = {
        discountType: type,
        value: val,
        startDate: discountStartDate ? new Date(discountStartDate) : (product.discount?.startDate || new Date()),
        endDate: discountEndDate ? new Date(discountEndDate) : (product.discount?.endDate || null),
        isActive: isDiscountActive !== undefined
          ? (isDiscountActive === true || isDiscountActive === "true")
          : (val > 0)
      };
      discountChanged = true;
    }

    let uploadSource = "none";
    let s3Error = null;

    if (req.file) {
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

    // Audit Log: Stock changes
    if (stock !== undefined && Number(stock) !== previousStock) {
      await logActivity({
        action: "PRODUCT_STOCK_UPDATED",
        category: "INVENTORY",
        actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
        target: { entityType: "Product", entityId: product._id, name: product.name },
        status: "SUCCESS",
        details: {
          previousQuantity: previousStock,
          newQuantity: product.stock
        }
      });

      if (product.stock === 0) {
        await logActivity({
          action: "PRODUCT_OUT_OF_STOCK",
          category: "INVENTORY",
          actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
          target: { entityType: "Product", entityId: product._id, name: product.name },
          status: "WARNING",
          details: { stock: 0 }
        });
      }
    }

    // Audit Log: Discount changes
    if (discountChanged) {
      await logActivity({
        action: "PRODUCT_DISCOUNT_MODIFIED",
        category: "DISCOUNT",
        actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
        target: { entityType: "Product", entityId: product._id, name: product.name },
        status: "SUCCESS",
        details: {
          previousDiscount,
          newDiscount: product.discount
        }
      });
    }

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

    const name = product.name;
    const prodId = product._id;

    // Clean up S3 image and local files before deleting product document
    if (product.image) {
      await deleteProductImageFile(product.image);
    }

    await Product.findByIdAndDelete(req.params.id);

    await logActivity({
      action: "PRODUCT_DELETED",
      category: "INVENTORY",
      actor: { userId: req.user.id, email: req.user.email, role: req.user.role, ipAddress: req.ip },
      target: { entityType: "Product", entityId: prodId, name },
      status: "SUCCESS",
      details: { productName: name }
    });

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

    product.reviews = product.reviews.filter((r) => r._id.toString() !== reviewId);
    product.reviewsCount = product.reviews.length;

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

exports.getProductWithImageUrl = getProductWithImageUrl;
exports.getProductsWithImageUrls = getProductsWithImageUrls;
exports.processProductImage = processProductImage;
exports.deleteProductImageFile = deleteProductImageFile;
