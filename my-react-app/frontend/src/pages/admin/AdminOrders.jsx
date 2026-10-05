import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      const res = await fetch("http://localhost:5000/api/orders", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch orders");
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(orderId, newStatus) {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update status");

      setOrders(orders.map((o) => (o._id === orderId ? { ...o, status: newStatus } : o)));
      alert("Order status updated successfully!");
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
          <h2 style={{ marginBottom: "20px" }}>Customer Orders Management</h2>

          {error && (
            <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
              {error}
            </div>
          )}

          {loading ? (
            <p>Loading customer orders...</p>
          ) : orders.length === 0 ? (
            <p>No orders placed yet.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order._id}>
                      <td style={{ fontSize: "0.85rem", color: "#6b7280" }}>#{order._id.substring(0, 8)}...</td>
                      <td>
                        <strong>{order.userName}</strong>
                        <br />
                        <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{order.userEmail}</span>
                      </td>
                      <td>
                        {order.products.map((item, idx) => (
                          <div key={idx} style={{ fontSize: "0.85rem" }}>
                            {item.name} × {item.quantity}
                          </div>
                        ))}
                      </td>
                      <td style={{ fontWeight: "600", color: "#2563eb" }}>₹{order.totalAmount}</td>
                      <td>
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order._id, e.target.value)}
                          className="form-control"
                          style={{ padding: "4px 8px", fontSize: "0.85rem", width: "auto" }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Processing">Processing</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default AdminOrders;
