const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploadMiddleware");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/roleMiddleware");
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  checkPurchaseEligibility,
  createProductReview
} = require("../controllers/productController");

router.get("/", getProducts);
router.get("/:id", getProductById);
router.get("/:id/can-review", verifyToken, checkPurchaseEligibility);
router.post("/:id/reviews", verifyToken, createProductReview);
router.post("/", verifyToken, requireAdmin, upload.single("image"), createProduct);
router.put("/:id", verifyToken, requireAdmin, upload.single("image"), updateProduct);
router.delete("/:id", verifyToken, requireAdmin, deleteProduct);

module.exports = router;
