const express = require("express");
const router = express.Router();
const { getProducts, getProductById, createProduct } = require("../controllers/productControllers");

router.get("/", getProducts);
router.get("/:id", getProductById);
router.post("/", createProduct);

module.exports = router;

