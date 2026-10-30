import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import { API_URL } from "../../config/api";

function AdminDiscounts() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New coupon form state
  const [form, setForm] = useState({
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "",
    minOrderAmount: "0",
    maxDiscountAmount: "",
    startDate: new Date().toISOString().split("T")[0],
    expirationDate: "",
    maxTotalUsage: "",
    maxUsagePerCustomer: "1",
    isActive: true
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  async function fetchCoupons() {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_URL}/api/coupons`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load coupons");
      setCoupons(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCoupon(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");

    if (!form.code.trim()) {
      alert("Please enter a coupon code.");
      return;
    }
    if (!form.expirationDate) {
      alert("Please set an expiration date.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/api/coupons`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create coupon");

      alert(`🎉 Coupon "${data.coupon.code}" created successfully!`);
      setShowCreateModal(false);
      setForm({
        code: "",
        description: "",
        discountType: "percentage",
        discountValue: "",
        minOrderAmount: "0",
        maxDiscountAmount: "",
        startDate: new Date().toISOString().split("T")[0],
        expirationDate: "",
        maxTotalUsage: "",
        maxUsagePerCustomer: "1",
        isActive: true
      });
      fetchCoupons();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(coupon) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/coupons/${coupon._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !coupon.isActive })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update coupon status");
      setCoupons(coupons.map((c) => (c._id === coupon._id ? data.coupon : c)));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id, code) {
    if (!window.confirm(`Are you sure you want to delete coupon "${code}"?`)) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/coupons/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete coupon");
      setCoupons(coupons.filter((c) => c._id !== id));
      alert(`Coupon "${code}" deleted successfully.`);
    } catch (err) {
      alert(err.message);
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
                  Discount & Coupon Management
                </h1>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.92rem" }}>
                  Create and monitor promotional coupon codes with strict order minimums, usage limits, and expiration dates
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary btn-sm"
              >
                ➕ Create New Coupon
              </button>
            </div>

            {error && (
              <div style={{ padding: "14px 18px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", marginBottom: "24px" }}>
                {error}
              </div>
            )}

            {/* Coupons Table Card */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>🏷️ All Promotional Coupons ({coupons.length})</h3>
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Case-insensitive & verified atomically</span>
              </div>

              {loading ? (
                <p style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>Loading coupons...</p>
              ) : coupons.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ color: "#64748b", marginBottom: "16px" }}>No coupons created yet.</p>
                  <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
                    Create Your First Coupon
                  </button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Type & Value</th>
                        <th>Min Order</th>
                        <th>Max Discount</th>
                        <th>Usage / Limit</th>
                        <th>Per Customer</th>
                        <th>Expiration</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coupons.map((coupon) => {
                        const isExpired = new Date(coupon.expirationDate) < new Date();
                        const isLimitReached = coupon.maxTotalUsage !== null && coupon.usageCount >= coupon.maxTotalUsage;

                        return (
                          <tr key={coupon._id}>
                            <td>
                              <strong style={{ color: "#2563eb", fontSize: "1rem" }}>{coupon.code}</strong>
                              {coupon.description && (
                                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{coupon.description}</div>
                              )}
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>
                                {coupon.discountType === "percentage"
                                  ? `${coupon.discountValue}% OFF`
                                  : `₹${coupon.discountValue.toLocaleString("en-IN")} FLAT`}
                              </span>
                            </td>
                            <td>₹{(coupon.minOrderAmount || 0).toLocaleString("en-IN")}</td>
                            <td>
                              {coupon.maxDiscountAmount ? `₹${coupon.maxDiscountAmount.toLocaleString("en-IN")}` : "No Cap"}
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{coupon.usageCount || 0}</span>
                              <span style={{ color: "#64748b" }}>
                                {coupon.maxTotalUsage ? ` / ${coupon.maxTotalUsage}` : " (Unlimited)"}
                              </span>
                            </td>
                            <td>{coupon.maxUsagePerCustomer || 1}x</td>
                            <td>
                              <span style={{ fontSize: "0.85rem", color: isExpired ? "#dc2626" : "#475569" }}>
                                {new Date(coupon.expirationDate).toLocaleDateString()}
                              </span>
                              {isExpired && <div style={{ fontSize: "0.72rem", color: "#dc2626", fontWeight: "bold" }}>EXPIRED</div>}
                            </td>
                            <td>
                              {coupon.isActive && !isExpired && !isLimitReached ? (
                                <span className="stock-badge-in">ACTIVE</span>
                              ) : isLimitReached ? (
                                <span className="stock-badge-low">LIMIT HIT</span>
                              ) : isExpired ? (
                                <span className="stock-badge-out">EXPIRED</span>
                              ) : (
                                <span className="stock-badge-out">INACTIVE</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(coupon)}
                                  className="btn btn-outline btn-sm"
                                  style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                                >
                                  {coupon.isActive ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(coupon._id, coupon.code)}
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: "4px 8px", fontSize: "0.78rem" }}
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
              )}
            </div>

            {/* Create Coupon Modal */}
            {showCreateModal && (
              <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: "16px"
              }}>
                <div style={{
                  background: "white",
                  borderRadius: "10px",
                  padding: "24px",
                  maxWidth: "520px",
                  width: "100%",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a" }}>Create New Coupon Code</h3>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreateCoupon}>
                    <div className="form-group" style={{ marginBottom: "12px" }}>
                      <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Coupon Code (Uppercase)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. WELCOME10, SAVE200"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: "12px" }}>
                      <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Description</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 10% discount on all orders"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <div className="form-group">
                        <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Discount Type</label>
                        <select
                          className="form-control"
                          value={form.discountType}
                          onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount (₹)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                          Discount Value {form.discountType === "percentage" ? "(%)" : "(₹)"}
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder={form.discountType === "percentage" ? "e.g. 20" : "e.g. 200"}
                          value={form.discountValue}
                          onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                          required
                          min="1"
                          max={form.discountType === "percentage" ? "100" : undefined}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <div className="form-group">
                        <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Min Order Amount (₹)</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="e.g. 500"
                          value={form.minOrderAmount}
                          onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                          min="0"
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Max Discount Cap (₹)</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="Optional cap for %"
                          value={form.maxDiscountAmount}
                          onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                          min="0"
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <div className="form-group">
                        <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Start Date</label>
                        <input
                          type="date"
                          className="form-control"
                          value={form.startDate}
                          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Expiration Date</label>
                        <input
                          type="date"
                          className="form-control"
                          value={form.expirationDate}
                          onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                      <div className="form-group">
                        <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Max Total Redemptions</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="Leave empty for unlimited"
                          value={form.maxTotalUsage}
                          onChange={(e) => setForm({ ...form, maxTotalUsage: e.target.value })}
                          min="1"
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ fontWeight: 600, fontSize: "0.88rem" }}>Max Per Customer</label>
                        <input
                          type="number"
                          className="form-control"
                          value={form.maxUsagePerCustomer}
                          onChange={(e) => setForm({ ...form, maxUsagePerCustomer: e.target.value })}
                          min="1"
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        className="btn btn-outline"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="btn btn-primary"
                      >
                        {submitting ? "Creating..." : "Create Coupon"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default AdminDiscounts;

