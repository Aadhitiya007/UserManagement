import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { API_URL } from "../config/api";
import { throttle } from "../utils/throttle";

const ITEMS_PER_PAGE = 20;

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { addToCart } = useCart();

  useEffect(() => {
    const handleScroll = throttle(() => {
      setShowScrollTop(window.scrollY > 250);
    }, 150);

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      getProducts(search);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  async function getProducts(query = "") {
    try {
      setLoading(true);
      const url = query
        ? `${API_URL}/api/products?search=${encodeURIComponent(query)}`
        : `${API_URL}/api/products`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch products");
      setProducts(data);
      setCurrentPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Pagination (20 products per page)
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = products.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <>
      <Navbar />
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Available Products</h2>
          <div style={{ width: "100%", maxWidth: "340px" }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>Loading products...</p>
        ) : products.length === 0 ? (
          <p style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>No products found.</p>
        ) : (
          <>
            <div className="product-grid">
              {paginatedProducts.map((product) => {
                const imageUrl =
                  product.imageUrl ||
                  product.image ||
                  "https://via.placeholder.com/300x180?text=No+Image";

                const isOutOfStock = product.stock <= 0;

                return (
                  <div key={product._id} className="product-card">
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="product-card-img"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "https://via.placeholder.com/300x180?text=No+Image";
                      }}
                    />
                    <div className="product-card-body">
                      <span className="product-category">
                        {product.category}
                      </span>
                      <h3 className="product-title">{product.name}</h3>
                      <p className="product-price">₹{product.price}</p>

                      {isOutOfStock && (
                        <div style={{ marginBottom: "12px" }}>
                          <span className="badge badge-danger">Out of Stock</span>
                        </div>
                      )}

                      <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <Link to={`/products/${product._id}`} className="btn btn-outline btn-sm">
                          Details
                        </Link>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={isOutOfStock}
                          className="btn btn-primary btn-sm"
                        >
                          {isOutOfStock ? "Sold Out" : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "30px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((p) => Math.max(p - 1, 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={currentPage === 1}
                  className="btn btn-outline btn-sm"
                >
                  ← Prev
                </button>

                <span style={{ fontSize: "0.85rem", color: "#475569" }}>
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage((p) => Math.min(p + 1, totalPages));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={currentPage === totalPages}
                  className="btn btn-outline btn-sm"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="scroll-to-top-btn"
            title="Back to Top"
            aria-label="Back to Top"
          >
            ↑
          </button>
        )}
      </div>
    </>
  );
}

export default Products;
