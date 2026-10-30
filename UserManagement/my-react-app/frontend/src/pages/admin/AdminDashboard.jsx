import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import { API_URL } from "../../config/api";

function AdminDashboard() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalUsers: 0,
    totalProducts: 0,
    pendingOrders: 0,
    paidOrders: 0,
    outOfStockProducts: 0,
    lowStockProducts: 0,
    activeDiscounts: 0,
    recentRevenue: 0,
    recentOrders: [],
    recentLogs: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/orders/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load dashboard statistics");
      setStats(data);
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
            {/* Page Header */}
            <div className="admin-dashboard-header">
              <div>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Store Operations & Analytics
                </h1>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.92rem" }}>
                  Real-time overview of revenue, inventory health, order fulfillment, and system events
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={fetchStats}
                  className="btn btn-outline btn-sm"
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  🔄 Refresh Data
                </button>
                <Link to="/admin/products/add" className="btn btn-primary btn-sm">
                  ➕ Add Product
                </Link>
              </div>
            </div>

            {error && (
              <div style={{ padding: "14px 18px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "24px", border: "1px solid #fca5a5" }}>
                {error}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#64748b" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: "12px" }}>⏳</div>
                <p style={{ fontSize: "1.05rem" }}>Loading store analytics and records...</p>
              </div>
            ) : (
              <>
                {/* 1. Summary Cards Grid (8 Cards: Revenue, Orders, Customers, Products, Pending, Paid, Out-of-Stock, Discounts) */}
                <div className="dashboard-summary-grid">
                  {/* Card 1: Total Revenue */}
                  <div className="dashboard-stat-card">
                    <div className="stat-card-info">
                      <h4>Total Revenue</h4>
                      <div className="stat-value" style={{ color: "#2563eb" }}>
                        ₹{(stats.totalRevenue || 0).toLocaleString("en-IN")}
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "#16a34a", fontWeight: "600" }}>
                        Verified Paid Orders
                      </span>
                    </div>
                    <div className="stat-card-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
                      💰
                    </div>
                  </div>

                  {/* Card 2: Total Orders */}
                  <div className="dashboard-stat-card">
                    <div className="stat-card-info">
                      <h4>Total Orders</h4>
                      <div className="stat-value">{stats.totalOrders || 0}</div>
                      <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                        Lifetime Placed
                      </span>
                    </div>
                    <div className="stat-card-icon" style={{ background: "#f1f5f9", color: "#475569" }}>
                      🛒
                    </div>
                  </div>

                  {/* Card 3: Total Customers */}
                  <div className="dashboard-stat-card">
                    <div className="stat-card-info">
                      <h4>Total Customers</h4>
                      <div className="stat-value">{stats.totalCustomers || stats.totalUsers || 0}</div>
                      <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                        Registered Accounts
                      </span>
                    </div>
                    <div className="stat-card-icon" style={{ background: "#f8fafc", color: "#0ea5e9" }}>
                      👥
                    </div>
                  </div>

                  {/* Card 4: Total Products */}
                  <div className="dashboard-stat-card">
                    <div className="stat-card-info">
                      <h4>Total Products</h4>
                      <div className="stat-value">{stats.totalProducts || 0}</div>
                      <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                        Catalog Items
                      </span>
                    </div>
                    <div className="stat-card-icon" style={{ background: "#f8fafc", color: "#8b5cf6" }}>
                      📦
                    </div>
                  </div>

                  {/* Card 5: Pending Orders */}
                  <div className="dashboard-stat-card">
                    <div className="stat-card-info">
                      <h4>Pending Orders</h4>
                      <div className="stat-value" style={{ color: "#d97706" }}>
                        {stats.pendingOrders || 0}
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "#b45309" }}>
                        Awaiting Payment / Action
                      </span>
                    </div>
                    <div className="stat-card-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
                      ⏳
                    </div>
                  </div>

                  {/* Card 6: Paid Orders */}
                  <div className="dashboard-stat-card">
                    <div className="stat-card-info">
                      <h4>Paid Orders</h4>
                      <div className="stat-value" style={{ color: "#16a34a" }}>
                        {stats.paidOrders || 0}
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "#16a34a" }}>
                        Completed Payments
                      </span>
                    </div>
                    <div className="stat-card-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
                      ✅
                    </div>
                  </div>

                  {/* Card 7: Out-of-Stock Products */}
                  <div className="dashboard-stat-card">
                    <div className="stat-card-info">
                      <h4>Out of Stock</h4>
                      <div className="stat-value" style={{ color: stats.outOfStockProducts > 0 ? "#dc2626" : "#64748b" }}>
                        {stats.outOfStockProducts || 0}
                      </div>
                      <span style={{ fontSize: "0.78rem", color: stats.outOfStockProducts > 0 ? "#b91c1c" : "#64748b" }}>
                        Requires Restock
                      </span>
                    </div>
                    <div className="stat-card-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>
                      ⚠️
                    </div>
                  </div>

                  {/* Card 8: Active Discounts */}
                  <div className="dashboard-stat-card">
                    <div className="stat-card-info">
                      <h4>Active Discounts</h4>
                      <div className="stat-value" style={{ color: "#9333ea" }}>
                        {stats.activeDiscounts || 0}
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "#9333ea" }}>
                        Coupons & Sales Live
                      </span>
                    </div>
                    <div className="stat-card-icon" style={{ background: "#f3e8ff", color: "#9333ea" }}>
                      🏷️
                    </div>
                  </div>
                </div>

                {/* 2. Main Dashboard Section Layout */}
                <div className="admin-grid-2col">
                  {/* Left Column: Recent Orders Card Container */}
                  <div className="admin-card">
                    <div className="admin-card-header">
                      <h3>🛒 Recent Customer Orders</h3>
                      <Link to="/admin/orders" className="btn btn-outline btn-sm">
                        View All Orders →
                      </Link>
                    </div>

                    {(!stats.recentOrders || stats.recentOrders.length === 0) ? (
                      <p style={{ color: "#94a3b8", textAlign: "center", padding: "30px 0" }}>No orders placed yet.</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Order ID</th>
                              <th>Customer</th>
                              <th>Amount</th>
                              <th>Payment</th>
                              <th>Status</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.recentOrders.map((ord) => {
                              const shortId = ord._id.toString().substring(18, 24).toUpperCase();
                              const isPaid = ord.paymentStatus === "Paid";
                              return (
                                <tr key={ord._id}>
                                  <td style={{ fontWeight: 600 }}>#{shortId}</td>
                                  <td>{ord.userName || ord.userEmail || "Customer"}</td>
                                  <td style={{ fontWeight: 700, color: "#0f172a" }}>
                                    ₹{ord.totalAmount?.toLocaleString("en-IN")}
                                  </td>
                                  <td>
                                    <span className={isPaid ? "stock-badge-in" : "stock-badge-low"}>
                                      {ord.paymentStatus || "Pending"}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="badge badge-primary">{ord.status}</span>
                                  </td>
                                  <td style={{ fontSize: "0.82rem", color: "#64748b" }}>
                                    {new Date(ord.createdAt).toLocaleDateString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Inventory Health & Active Promotions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    {/* Inventory Health Card */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h3>📦 Inventory Status</h3>
                        <Link to="/admin/products" className="btn btn-outline btn-sm">
                          Manage Stock
                        </Link>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f8fafc", borderRadius: "8px" }}>
                          <div>
                            <strong style={{ display: "block", color: "#0f172a" }}>In-Stock Catalog Items</strong>
                            <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Healthy inventory units</span>
                          </div>
                          <span className="stock-badge-in" style={{ fontSize: "0.9rem", padding: "4px 10px" }}>
                            {Math.max(0, (stats.totalProducts || 0) - (stats.outOfStockProducts || 0))}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#fffbeb", borderRadius: "8px" }}>
                          <div>
                            <strong style={{ display: "block", color: "#92400e" }}>Low Stock Warnings</strong>
                            <span style={{ fontSize: "0.82rem", color: "#b45309" }}>5 or fewer items remaining</span>
                          </div>
                          <span className="stock-badge-low" style={{ fontSize: "0.9rem", padding: "4px 10px" }}>
                            {stats.lowStockProducts || 0}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#fef2f2", borderRadius: "8px" }}>
                          <div>
                            <strong style={{ display: "block", color: "#991b1b" }}>Critical: Out of Stock</strong>
                            <span style={{ fontSize: "0.82rem", color: "#b91c1c" }}>Customers cannot order</span>
                          </div>
                          <span className="stock-badge-out" style={{ fontSize: "0.9rem", padding: "4px 10px" }}>
                            {stats.outOfStockProducts || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Promotions & Discounts Overview Card */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h3>🏷️ Promotional Campaigns</h3>
                        <Link to="/admin/discounts" className="btn btn-outline btn-sm">
                          Manage Discounts
                        </Link>
                      </div>

                      <div style={{ fontSize: "0.92rem", color: "#475569" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                          <span>Active Coupon Codes:</span>
                          <strong style={{ color: "#2563eb" }}>{stats.activeCouponsCount || 0}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                          <span>Products on Sale:</span>
                          <strong style={{ color: "#16a34a" }}>{stats.activeProductDiscountsCount || 0}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                          <span>Last 30 Days Revenue:</span>
                          <strong style={{ color: "#0f172a" }}>₹{(stats.recentRevenue || 0).toLocaleString("en-IN")}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Recent Audit Logs & System Activity Feed */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h3>📜 Recent System Activity & Audit Trail</h3>
                    <Link to="/admin/logs" className="btn btn-outline btn-sm">
                      View Full Audit Log →
                    </Link>
                  </div>

                  {(!stats.recentLogs || stats.recentLogs.length === 0) ? (
                    <p style={{ color: "#94a3b8", textAlign: "center", padding: "20px 0" }}>No audit events logged yet.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Action</th>
                            <th>Category</th>
                            <th>Actor</th>
                            <th>Target</th>
                            <th>Status</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentLogs.map((log) => {
                            const isSuccess = log.status === "SUCCESS";
                            const isWarning = log.status === "WARNING";
                            return (
                              <tr key={log._id}>
                                <td style={{ fontWeight: 600 }}>{log.action}</td>
                                <td>
                                  <span style={{ fontSize: "0.78rem", background: "#f1f5f9", padding: "3px 8px", borderRadius: "4px", color: "#475569", fontWeight: 600 }}>
                                    {log.category}
                                  </span>
                                </td>
                                <td style={{ fontSize: "0.85rem" }}>{log.actor?.email || "system"}</td>
                                <td style={{ fontSize: "0.85rem", color: "#64748b" }}>
                                  {log.target?.name || log.target?.entityType || "—"}
                                </td>
                                <td>
                                  <span className={isSuccess ? "stock-badge-in" : isWarning ? "stock-badge-low" : "stock-badge-out"}>
                                    {log.status}
                                  </span>
                                </td>
                                <td style={{ fontSize: "0.82rem", color: "#64748b" }}>
                                  {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default AdminDashboard;
