import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const { addToCart } = useCart();

  useEffect(() => {
    getProducts();
  }, []);

  async function getProducts() {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:5000/api/products");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch products");
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2>Available Products</h2>
          <input
            type="text"
            className="form-control"
            placeholder="Search products..."
            style={{ width: "260px" }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <p>Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p>No products found.</p>
        ) : (
          <div className="product-grid">
            {filteredProducts.map((product) => {
              const imageUrl = product.image
                ? (product.image.startsWith("http") ? product.image : `http://localhost:5000${product.image}`)
                : "https://via.placeholder.com/300x180?text=No+Image";

              const isOutOfStock = product.stock <= 0;

              return (
                <div key={product._id} className="product-card">
                  <img src={imageUrl} alt={product.name} />
                  <div className="product-card-body">
                    <span style={{ fontSize: "0.8rem", color: "#6b7280", textTransform: "uppercase" }}>
                      {product.category}
                    </span>
                    <h3 className="product-card-title">{product.name}</h3>
                    <p className="product-card-price">₹{product.price}</p>

                    {isOutOfStock && (
                      <div style={{ marginBottom: "15px" }}>
                        <span className="badge badge-danger">Out of Stock</span>
                      </div>
                    )}

                    <div style={{ marginTop: "auto", display: "flex", gap: "10px" }}>
                      <Link to={`/products/${product._id}`} className="btn btn-outline btn-sm" style={{ flex: 1 }}>
                        Details
                      </Link>
                      <button
                        onClick={() => addToCart(product)}
                        disabled={isOutOfStock}
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1 }}
                      >
                        {isOutOfStock ? "Sold Out" : "Add to Cart"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default Products;
