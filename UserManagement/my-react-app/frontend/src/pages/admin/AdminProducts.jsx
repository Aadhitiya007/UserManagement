import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import { API_URL } from "../../config/api";

const ITEMS_PER_PAGE = 20;

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts(search);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  async function fetchProducts(query = "") {
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

  async function handleQuickStockUpdate(product) {
    const current = product.stock;
    const input = window.prompt(`Enter new stock quantity for "${product.name}":`, current);
    if (input === null) return;
    const newStock = parseInt(input, 10);
    if (isNaN(newStock) || newStock < 0) {
      alert("Please enter a valid non-negative integer.");
      return;
    }
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/products/${product._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ stock: newStock })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update stock");
      setProducts(products.map((p) => (p._id === product._id ? data.product : p)));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete product");

      setProducts(products.filter((p) => p._id !== id));
      alert("Product deleted successfully");
    } catch (err) {
      alert(err.message);
    }
  }

  // Filter by stock
  const filteredProducts = products.filter((p) => {
    if (stockFilter === "IN_STOCK") return p.stock > 5;
    if (stockFilter === "LOW_STOCK") return p.stock > 0 && p.stock <= 5;
    if (stockFilter === "OUT_OF_STOCK") return p.stock === 0;
    return true;
  });

  // Pagination (20 products per page)
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <div className="admin-dashboard-container">
            <div className="admin-dashboard-header">
              <div>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Product Catalog & Stock Management
                </h1>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.92rem" }}>
                  Monitor inventory levels, set product discounts, and manage SKU availability
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link to="/admin/products/add" className="btn btn-primary btn-sm">
                  ➕ Add New Product
                </Link>
              </div>
            </div>

            {error && (
              <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
                {error}
              </div>
            )}

            {/* Filter and Search Bar Card */}
            <div className="admin-card" style={{ padding: "16px 20px", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="🔍 Search products by name, category, or description..."
                  style={{ width: "340px", maxWidth: "100%" }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => { setStockFilter("ALL"); setCurrentPage(1); }}
                    className={`btn btn-sm ${stockFilter === "ALL" ? "btn-primary" : "btn-outline"}`}
                  >
                    All ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStockFilter("IN_STOCK"); setCurrentPage(1); }}
                    className={`btn btn-sm ${stockFilter === "IN_STOCK" ? "btn-primary" : "btn-outline"}`}
                  >
                    In Stock ({products.filter((p) => p.stock > 5).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStockFilter("LOW_STOCK"); setCurrentPage(1); }}
                    className={`btn btn-sm ${stockFilter === "LOW_STOCK" ? "btn-primary" : "btn-outline"}`}
                  >
                    Low Stock ({products.filter((p) => p.stock > 0 && p.stock <= 5).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStockFilter("OUT_OF_STOCK"); setCurrentPage(1); }}
                    className={`btn btn-sm ${stockFilter === "OUT_OF_STOCK" ? "btn-primary" : "btn-outline"}`}
                  >
                    Out of Stock ({products.filter((p) => p.stock === 0).length})
                  </button>
                </div>
              </div>
            </div>

            {/* Product Table Card */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>📦 Catalog Products ({filteredProducts.length})</h3>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Click stock to quick-update inventory</span>
              </div>

              {loading ? (
                <p style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>Loading products...</p>
              ) : filteredProducts.length === 0 ? (
                <p style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>No matching products found.</p>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Image</th>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Base Price</th>
                          <th>Discount</th>
                          <th>Inventory Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedProducts.map((product) => {
                          const imageUrl =
                            product.imageUrl ||
                            product.image ||
                            "https://via.placeholder.com/100x100?text=No+Image";

                          const isOutOfStock = product.stock === 0;
                          const isLowStock = product.stock > 0 && product.stock <= (product.lowStockThreshold || 5);
                          const hasDiscount = Boolean(product.isDiscountActive && product.discountAmount > 0);

                          return (
                            <tr key={product._id}>
                              <td>
                                <img
                                  src={imageUrl}
                                  alt={product.name}
                                  style={{ width: "45px", height: "45px", objectFit: "cover", borderRadius: "4px" }}
                                />
                              </td>
                              <td style={{ fontWeight: "600", color: "#0f172a" }}>
                                {product.name}
                              </td>
                              <td>{product.category}</td>
                              <td style={{ fontWeight: "600" }}>
                                ₹{product.price.toLocaleString("en-IN")}
                              </td>
                              <td>
                                {hasDiscount ? (
                                  <span className="discount-pill">
                                    {product.discountPercent}% OFF (₹{product.effectivePrice})
                                  </span>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>None</span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  {isOutOfStock ? (
                                    <span className="stock-badge-out">Out of Stock (0)</span>
                                  ) : isLowStock ? (
                                    <span className="stock-badge-low">Low Stock ({product.stock})</span>
                                  ) : (
                                    <span className="stock-badge-in">In Stock ({product.stock})</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleQuickStockUpdate(product)}
                                    title="Quick adjust stock quantity"
                                    style={{
                                      background: "#f1f5f9",
                                      border: "1px solid #cbd5e1",
                                      borderRadius: "4px",
                                      fontSize: "0.75rem",
                                      padding: "2px 6px",
                                      cursor: "pointer"
                                    }}
                                  >
                                    ✏️
                                  </button>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <Link to={`/admin/products/edit/${product._id}`} className="btn btn-outline btn-sm">
                                    Edit
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(product._id, product.name)}
                                    className="btn btn-danger btn-sm"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "24px" }}>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="btn btn-outline btn-sm"
                        style={{ padding: "6px 14px" }}
                      >
                        ← Previous
                      </button>

                      <span style={{ fontSize: "0.9rem", color: "#475569" }}>
                        Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="btn btn-outline btn-sm"
                        style={{ padding: "6px 14px" }}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default AdminProducts;
