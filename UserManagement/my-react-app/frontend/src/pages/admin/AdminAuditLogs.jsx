import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import { API_URL } from "../../config/api";

function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchLogs();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [category, status, search, page]);

  async function fetchLogs() {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page,
        limit: 25
      });
      if (category !== "ALL") params.append("category", category);
      if (status !== "ALL") params.append("status", status);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`${API_URL}/api/admin/logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load audit logs");

      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
                  System Audit & Security Trail
                </h1>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.92rem" }}>
                  Persistent historical record of email dispatches, inventory mutations, payments, discounts, and authentication
                </p>
              </div>

              <button
                type="button"
                onClick={() => { setPage(1); fetchLogs(); }}
                className="btn btn-outline btn-sm"
              >
                🔄 Refresh Logs
              </button>
            </div>

            {error && (
              <div style={{ padding: "14px 18px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "24px" }}>
                {error}
              </div>
            )}

            {/* Filter Bar Card */}
            <div className="admin-card" style={{ padding: "16px 20px", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: "220px" }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="🔍 Search action, user email, or target..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>

                <div style={{ width: "160px" }}>
                  <select
                    className="form-control"
                    value={category}
                    onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                  >
                    <option value="ALL">All Categories</option>
                    <option value="INVENTORY">📦 Inventory</option>
                    <option value="DISCOUNT">🏷️ Discounts</option>
                    <option value="ORDER">🛒 Orders</option>
                    <option value="PAYMENT">💳 Payments</option>
                    <option value="EMAIL">✉️ Emails</option>
                    <option value="AUTH">🔐 Auth</option>
                  </select>
                </div>

                <div style={{ width: "140px" }}>
                  <select
                    className="form-control"
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SUCCESS">Success</option>
                    <option value="FAILURE">Failure</option>
                    <option value="WARNING">Warning</option>
                    <option value="INFO">Info</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Audit Logs Table Card */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>📜 Audit Events ({total} records)</h3>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>90-Day rolling retention</span>
              </div>

              {loading ? (
                <p style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>Loading audit records...</p>
              ) : logs.length === 0 ? (
                <p style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>No audit events match your filter criteria.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>Category</th>
                        <th>Actor</th>
                        <th>Target</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => {
                        const isSuccess = log.status === "SUCCESS";
                        const isWarning = log.status === "WARNING";
                        const isFailure = log.status === "FAILURE";

                        return (
                          <tr key={log._id}>
                            <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap", color: "#475569" }}>
                              {new Date(log.createdAt).toLocaleString("en-IN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              })}
                            </td>
                            <td>
                              <strong style={{ fontSize: "0.88rem", color: "#0f172a" }}>{log.action}</strong>
                            </td>
                            <td>
                              <span style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                background: "#f1f5f9",
                                color: "#475569",
                                padding: "3px 8px",
                                borderRadius: "4px"
                              }}>
                                {log.category}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontSize: "0.85rem" }}>
                                <span style={{ fontWeight: 500 }}>{log.actor?.email || "system"}</span>
                                {log.actor?.role && (
                                  <span style={{ fontSize: "0.72rem", color: "#64748b", marginLeft: "4px" }}>
                                    ({log.actor.role})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontSize: "0.85rem", color: "#334155" }}>
                                {log.target?.name || log.target?.entityType || "—"}
                              </div>
                            </td>
                            <td>
                              <span className={isSuccess ? "stock-badge-in" : isWarning ? "stock-badge-low" : isFailure ? "stock-badge-out" : "badge"}>
                                {log.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontSize: "0.8rem", color: "#64748b", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={JSON.stringify(log.details, null, 2)}>
                                {Object.keys(log.details || {}).length > 0 ? JSON.stringify(log.details) : "—"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginTop: "20px" }}>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="btn btn-outline btn-sm"
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: "0.85rem", color: "#475569" }}>
                    Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page === totalPages}
                    className="btn btn-outline btn-sm"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default AdminAuditLogs;

