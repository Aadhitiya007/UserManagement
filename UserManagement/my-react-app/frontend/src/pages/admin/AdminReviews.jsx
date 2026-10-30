import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import { API_URL } from "../../config/api";

const ITEMS_PER_PAGE = 20;

function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchReviews();
  }, []);

  async function fetchReviews() {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_URL}/api/products/reviews/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load reviews");
      setReviews(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteReview(productId, reviewId, customerName) {
    if (!window.confirm(`Are you sure you want to delete the review by "${customerName}"?`)) {
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/products/${productId}/reviews/${reviewId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete review");

      setReviews((prev) => prev.filter((r) => r._id !== reviewId));
      alert("Review deleted successfully!");
    } catch (err) {
      alert(err.message);
    }
  }

  // Search filtering logic
  const filteredReviews = reviews.filter((r) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      (r.productName && r.productName.toLowerCase().includes(term)) ||
      (r.userName && r.userName.toLowerCase().includes(term)) ||
      (r.comment && r.comment.toLowerCase().includes(term)) ||
      String(r.rating).includes(term)
    );
  });

  // 20 items per page pagination
  const totalPages = Math.ceil(filteredReviews.length / ITEMS_PER_PAGE) || 1;
  const paginatedReviews = filteredReviews.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  function handleSearchChange(e) {
    setSearch(e.target.value);
    setCurrentPage(1);
  }

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
                  Customer Reviews Management
                </h1>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.92rem" }}>
                  Monitor and moderate customer ratings, product feedback, and verified customer testimonials
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="🔍 Search by customer, product, or review..."
                  style={{ width: "320px", maxWidth: "100%", fontSize: "0.9rem" }}
                  value={search}
                  onChange={handleSearchChange}
                />
              </div>
            </div>

            {error && (
              <div style={{ padding: "14px 18px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "20px" }}>
                {error}
              </div>
            )}

            {/* Reviews Box Container Card */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>⭐ Customer Ratings & Feedback ({filteredReviews.length})</h3>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  Showing {filteredReviews.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}–
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredReviews.length)} of {filteredReviews.length}
                </span>
              </div>

              {loading ? (
                <p style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>Loading reviews...</p>
              ) : filteredReviews.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ color: "#64748b" }}>
                    {search ? `No reviews found matching "${search}".` : "No customer reviews submitted yet."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Customer</th>
                          <th>Rating</th>
                          <th style={{ width: "38%" }}>Review Comment</th>
                          <th>Date</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedReviews.map((rev) => {
                          const img = rev.productImage
                            ? (rev.productImage.startsWith("http") ? rev.productImage : `${API_URL}/${rev.productImage.replace(/^\//, "")}`)
                            : "https://via.placeholder.com/45";

                          return (
                            <tr key={rev._id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <img
                                    src={img}
                                    alt={rev.productName}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = "https://via.placeholder.com/45";
                                    }}
                                    style={{ width: "42px", height: "42px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e2e8f0" }}
                                  />
                                  <span style={{ fontWeight: "600", fontSize: "0.92rem", color: "#1e293b" }}>{rev.productName}</span>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontWeight: "500", color: "#334155" }}>{rev.userName || "Customer"}</span>
                              </td>
                              <td>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontWeight: "700",
                                  fontSize: "0.82rem",
                                  background: rev.rating >= 4 ? "#dcfce7" : rev.rating >= 3 ? "#fef3c7" : "#fee2e2",
                                  color: rev.rating >= 4 ? "#166534" : rev.rating >= 3 ? "#92400e" : "#991b1b"
                                }}>
                                  ⭐ {rev.rating} / 5
                                </span>
                              </td>
                              <td>
                                <p style={{ margin: 0, fontSize: "0.88rem", color: "#334155", lineHeight: "1.4" }}>
                                  "{rev.comment}"
                                </p>
                              </td>
                              <td style={{ fontSize: "0.85rem", color: "#64748b", whiteSpace: "nowrap" }}>
                                {new Date(rev.createdAt).toLocaleDateString()}
                              </td>
                              <td>
                                <button
                                  onClick={() => handleDeleteReview(rev.productId, rev._id, rev.userName)}
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: "5px 10px", fontSize: "0.85rem" }}
                                >
                                  🗑️ Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls at Bottom (20 per page) */}
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

export default AdminReviews;

