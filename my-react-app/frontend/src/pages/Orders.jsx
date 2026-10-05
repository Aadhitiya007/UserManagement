import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyOrders();
  }, []);

  async function fetchMyOrders() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch("http://localhost:5000/api/orders/my-orders", {
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

  function getStatusBadge(status) {
    switch (status) {
      case "Delivered": return "badge badge-success";
      case "Shipped": return "badge badge-info";
      case "Processing": return "badge badge-warning";
      case "Cancelled": return "badge badge-danger";
      default: return "badge badge-info";
    }
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <h2 style={{ marginBottom: "20px" }}>My Orders</h2>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <p>Loading orders...</p>
        ) : orders.length === 0 ? (
          <div style={{ background: "white", padding: "40px", textAlign: "center", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <p style={{ color: "#6b7280" }}>You have not placed any orders yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {orders.map((order) => (
              <div key={order._id} style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                  <div>
                    <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Order ID: #{order._id}</span>
                    <br />
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                      Placed on: {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className={getStatusBadge(order.status)}>{order.status}</span>
                  </div>
                </div>

                <div style={{ marginBottom: "15px" }}>
                  {order.products.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", margin: "8px 0", fontSize: "0.95rem" }}>
                      <span>{item.name} × {item.quantity}</span>
                      <span style={{ fontWeight: "500" }}>₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div style={{ textAlign: "right", borderTop: "1px solid #f1f5f9", paddingTop: "10px", fontWeight: "bold", fontSize: "1.1rem" }}>
                  Total: <span style={{ color: "#2563eb" }}>₹{order.totalAmount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default Orders;
