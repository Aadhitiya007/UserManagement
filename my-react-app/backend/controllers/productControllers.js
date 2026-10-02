const Product = require("../models/product");
const Inventory = require("../models/Inventory");

const getProducts = async (req, res) => {
    try {
        const products = await Product.find({});
        const formattedProducts = await Promise.all(
            products.map(async (p) => {
                const obj = p.toObject();
                let invDoc = await Inventory.findOne({ productId: p._id });
                if (invDoc) {
                    obj.quantity = invDoc.currentStock;
                } else if (obj.quantity === undefined || obj.quantity === null) {
                    obj.quantity = 10;
                }

                if (obj.quantity <= 0) {
                    obj.quantity = 0;
                    obj.isOutOfStock = true;
                }

                return obj;
            })
        );
        res.status(200).json(formattedProducts);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch products", error: error.message });
    }
};

const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const obj = product.toObject();
        let invDoc = await Inventory.findOne({ productId: product._id });
        if (invDoc) {
            obj.quantity = invDoc.currentStock;
        } else if (obj.quantity === undefined || obj.quantity === null) {
            obj.quantity = 10;
        }

        if (obj.quantity <= 0) {
            obj.quantity = 0;
            obj.isOutOfStock = true;
        }

        res.status(200).json(obj);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch product details", error: error.message });
    }
};

const createProduct = async (req, res) => {
    try {
        const productData = req.body;
        if (productData.quantity === undefined || productData.quantity === null) {
            productData.quantity = 10;
        }
        const newProduct = await Product.create(productData);

        // Create corresponding inventory record in Inventory collection
        try {
            await Inventory.create({
                productId: newProduct._id,
                productName: newProduct.name,
                totalStock: productData.quantity,
                currentStock: productData.quantity,
                soldCount: 0
            });
        } catch (invErr) {
            console.warn("Inventory creation notice:", invErr.message);
        }

        res.status(201).json({ message: "Product created successfully", product: newProduct });
    } catch (error) {
        res.status(400).json({ message: "Failed to create product", error: error.message });
    }
};

const getInventory = async (req, res) => {
    try {
        const inventory = await Inventory.find({}).populate("productId", "name price category");
        res.status(200).json(inventory);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch inventory records", error: error.message });
    }
};

module.exports = { getProducts, getProductById, createProduct, getInventory };
