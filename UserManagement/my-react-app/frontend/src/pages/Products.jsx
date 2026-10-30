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
          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Available Products</h2>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.9rem" }}>Explore our catalog with verified stock & exclusive discounts</p>
          </div>
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
                const isLowStock = !isOutOfStock && product.stock <= 5;
                const hasDiscount = Boolean(product.isDiscountActive && product.discountAmount > 0);
                const effectivePrice = product.effectivePrice !== undefined ? product.effectivePrice : product.price;

                return (
                  <div key={product._id} className={`product-card ${isOutOfStock ? "out-of-stock" : ""}`} style={{ position: "relative" }}>
                    {hasDiscount && (
                      <span className="sale-badge" style={{ position: "absolute", top: "10px", right: "10px", zIndex: 2 }}>
                        SALE
                      </span>
                    )}

                    <div style={{ position: "relative", width: "100%", height: "180px", overflow: "hidden", background: "#f8fafc" }}>
                      <img
                        src={imageUrl}
                        alt={product.name}
                        className="product-card-img"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "https://via.placeholder.com/300x180?text=No+Image";
                        }}
                      />
                      {isOutOfStock && (
                        <div style={{
                          position: "absolute",
                          bottom: "8px",
                          left: "8px",
                          zIndex: 2
                        }}>
                          <span className="stock-badge-out">● OUT OF STOCK</span>
                        </div>
                      )}
                    </div>

                    <div className="product-card-body">
                      <span className="product-category">
                        {product.category}
                      </span>
                      <h3 className="product-title">{product.name}</h3>

                      {/* Authoritative Pricing Display */}
                      <div style={{ margin: "6px 0 10px" }}>
                        {hasDiscount ? (
                          <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a" }}>
                              ₹{effectivePrice.toLocaleString("en-IN")}
                            </span>
                            <span className="strikethrough-price">
                              ₹{product.price.toLocaleString("en-IN")}
                            </span>
                            <span className="discount-pill">
                              {product.discountPercent}% OFF
                            </span>
                          </div>
                        ) : (
                          <p className="product-price" style={{ margin: 0 }}>
                            ₹{product.price.toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>

                      {/* Stock availability indicator */}
                      <div style={{ marginBottom: "14px" }}>
                        {isOutOfStock ? (
                          <span className="stock-badge-out">Out of Stock</span>
                        ) : isLowStock ? (
                          <span className="stock-badge-low">⚠️ Only {product.stock} left in stock</span>
                        ) : (
                          <span className="stock-badge-in">✓ In Stock</span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <Link to={`/products/${product._id}`} className="btn btn-outline btn-sm">
                          Details
                        </Link>
                        {isOutOfStock ? (
                          <button
                            type="button"
                            disabled
                            className="btn btn-out-of-stock btn-sm"
                            aria-disabled="true"
                          >
                            Out of Stock
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            className="btn btn-primary btn-sm"
                          >
                            Add
                          </button>
                        )}
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
