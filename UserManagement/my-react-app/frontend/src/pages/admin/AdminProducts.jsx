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

  // Pagination (20 products per page)
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = products.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "15px" }}>
            <h2>Product Management</h2>

            <input
              type="text"
              className="form-control"
              placeholder="🔍 Search products by name, category, or description..."
              style={{ width: "340px" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <Link to="/admin/products/add" className="btn btn-primary">
              ➕ Add New Product
            </Link>
          </div>

          {error && (
            <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
              {error}
            </div>
          )}

          {loading ? (
            <p>Loading products...</p>
          ) : products.length === 0 ? (
            <p>No matching products found.</p>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product) => {
                      const imageUrl =
                        product.imageUrl ||
                        product.image ||
                        "https://via.placeholder.com/100x100?text=No+Image";

                      return (
                        <tr key={product._id}>
                          <td>
                            <img
                              src={imageUrl}
                              alt={product.name}
                              style={{ width: "45px", height: "45px", objectFit: "cover", borderRadius: "4px" }}
                            />
                          </td>
                          <td style={{ fontWeight: "500" }}>{product.name}</td>
                          <td>{product.category}</td>
                          <td style={{ fontWeight: "600", color: "#2563eb" }}>₹{product.price}</td>
                          <td>
                            <span className={product.stock > 0 ? "badge badge-success" : "badge badge-danger"}>
                              {product.stock}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <Link to={`/admin/products/edit/${product._id}`} className="btn btn-outline btn-sm">
                                Edit
                              </Link>
                              <button onClick={() => handleDelete(product._id, product.name)} className="btn btn-danger btn-sm">
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
        </main>
      </div>
    </>
  );
}

export default AdminProducts;
