const express = require("express");
const router = express.Router();
const { getProducts, getProductById, createProduct, getInventory } = require("../controllers/productControllers");

router.get("/", getProducts);
router.get("/inventory", getInventory);
router.get("/:id", getProductById);
router.post("/", createProduct);

module.exports = router;
