import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";

function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0
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
      const res = await fetch("http://localhost:5000/api/orders/stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load dashboard stats");
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
          <h2 style={{ marginBottom: "20px" }}>Admin Overview Dashboard</h2>

          {error && (
            <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
              {error}
            </div>
          )}

          {loading ? (
            <p>Loading stats...</p>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <h4>Total Users</h4>
                  <div className="stat-number">{stats.totalUsers}</div>
                </div>

                <div className="stat-card">
                  <h4>Total Products</h4>
                  <div className="stat-number">{stats.totalProducts}</div>
                </div>

                <div className="stat-card">
                  <h4>Total Orders</h4>
                  <div className="stat-number">{stats.totalOrders}</div>
                </div>

                <div className="stat-card">
                  <h4>Total Revenue</h4>
                  <div className="stat-number" style={{ color: "#2563eb" }}>₹{stats.totalRevenue}</div>
                </div>
              </div>

              <div style={{ background: "white", padding: "24px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ marginBottom: "15px" }}>Quick Actions</h3>
                <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
                  <Link to="/admin/products/add" className="btn btn-primary">
                    ➕ Add New Product
                  </Link>
                  <Link to="/admin/products" className="btn btn-outline">
                    📦 Manage Products
                  </Link>
                  <Link to="/admin/orders" className="btn btn-outline">
                    🛒 Manage Customer Orders
                  </Link>
                  <Link to="/admin/users" className="btn btn-outline">
                    👥 View Users
                  </Link>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default AdminDashboard;
