import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { addToCart } = useCart();

  useEffect(() => {
    async function getProduct() {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:5000/api/products/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Product not found");
        setProduct(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    getProduct();
  }, [id]);

  if (loading) return <><Navbar /><div className="container"><p>Loading product...</p></div></>;
  if (error || !product) return <><Navbar /><div className="container"><p style={{ color: "red" }}>{error || "Product not found"}</p></div></>;

  const imageUrl = product.image
    ? (product.image.startsWith("http") ? product.image : `http://localhost:5000${product.image}`)
    : "https://via.placeholder.com/400x300?text=No+Image";

  const isOutOfStock = product.stock <= 0;

  function handleAddToCart() {
    addToCart(product, quantity);
    alert(`Added ${quantity} "${product.name}" to cart!`);
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <Link to="/products" className="btn btn-outline btn-sm" style={{ marginBottom: "20px" }}>
          ← Back to Products
        </Link>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", background: "white", padding: "30px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div>
            <img
              src={imageUrl}
              alt={product.name}
              style={{ width: "100%", maxHeight: "380px", objectFit: "cover", borderRadius: "8px" }}
            />
          </div>

          <div>
            <span style={{ textTransform: "uppercase", color: "#6b7280", fontSize: "0.85rem", fontWeight: "600" }}>
              {product.category}
            </span>
            <h1 style={{ fontSize: "1.8rem", margin: "10px 0" }}>{product.name}</h1>
            <h2 style={{ color: "#2563eb", fontSize: "1.6rem", marginBottom: "15px" }}>₹{product.price}</h2>

            {isOutOfStock && (
              <div style={{ marginBottom: "20px" }}>
                <span className="badge badge-danger">Out of Stock</span>
              </div>
            )}

            <p style={{ color: "#4b5563", marginBottom: "25px", lineHeight: "1.7" }}>
              {product.description || "No description provided."}
            </p>

            {!isOutOfStock && (
              <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
                <label style={{ fontWeight: "500" }}>Quantity:</label>
                <input
                  type="number"
                  min="1"
                  max={product.stock}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, Number(e.target.value))))}
                  className="form-control"
                  style={{ width: "80px" }}
                />
              </div>
            )}

            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="btn btn-primary"
              style={{ padding: "12px 24px" }}
            >
              {isOutOfStock ? "Out of Stock" : "Add to Cart"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductDetail;
