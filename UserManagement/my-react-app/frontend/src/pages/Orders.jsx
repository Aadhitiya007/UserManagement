import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";
import { io } from "socket.io-client";

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  // Search & Pagination States
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchMyOrders();

    const token = localStorage.getItem("token");
    if (!token) return;

    // Listen to real-time order status updates via authenticated WebSocket
    const socket = io(API_URL, {
      auth: { token }
    });

    socket.on("orderStatusUpdated", (data) => {
      setOrders((prevOrders) =>
        prevOrders.map((order) => {
          if (order._id === data.orderId) {
            return {
              ...order,
              status: data.status,
              paymentStatus: data.paymentStatus
            };
          }
          return order;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function fetchMyOrders() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/orders/my-orders`, {
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

  async function handleDownloadInvoice(orderId, invoiceNumber) {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setDownloadingId(orderId);
      const res = await fetch(`${API_URL}/api/orders/${orderId}/invoice`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to download invoice.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shopiee-invoice-${invoiceNumber || orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Invoice download error: ${err.message}`);
    } finally {
      setDownloadingId(null);
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

  // Search filter by Order ID or Product Name
  const filteredOrders = orders.filter((order) => {
    const matchId = order._id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchProduct = order.products.some((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return matchId || matchProduct;
  });

  // Calculate Pagination
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <>
      <Navbar />
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
          <h2>My Orders</h2>
          {orders.length > 0 && (
            <div style={{ width: "100%", maxWidth: "300px" }}>
              <input
                type="text"
                placeholder="🔍 Search my orders..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="form-control"
                style={{ padding: "8px 12px", fontSize: "0.9rem" }}
              />
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>Loading orders...</p>
        ) : orders.length === 0 ? (
          <div style={{ background: "white", padding: "40px", textAlign: "center", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <p style={{ color: "#6b7280" }}>You have not placed any orders yet.</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ background: "white", padding: "40px", textAlign: "center", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <p style={{ color: "#6b7280" }}>No orders found matching "{searchTerm}".</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {paginatedOrders.map((order) => (
                <div key={order._id} style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "15px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Order ID: #{order._id}</span>
                      <br />
                      <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                        Placed on: {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span className={getStatusBadge(order.status)}>{order.status}</span>
                      <span 
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          fontWeight: "bold",
                          background: order.paymentStatus === "Paid" 
                            ? "#dcfce7" 
                            : order.paymentStatus === "Failed" 
                            ? "#fee2e2" 
                            : "#fef3c7",
                          color: order.paymentStatus === "Paid" 
                            ? "#166534" 
                            : order.paymentStatus === "Failed" 
                            ? "#991b1b" 
                            : "#92400e"
                        }}
                      >
                        {order.paymentStatus === "Paid" 
                          ? "Paid" 
                          : order.paymentStatus === "Failed" 
                          ? "Payment Failed" 
                          : "Payment Pending"}
                      </span>

                      {/* Download Invoice Button (Only for Paid Orders) */}
                      {order.paymentStatus === "Paid" && (
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(order._id, order.invoiceNumber)}
                          disabled={downloadingId === order._id}
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: "0.8rem", padding: "4px 10px", borderColor: "#2563eb", color: "#2563eb" }}
                        >
                          {downloadingId === order._id ? "Downloading..." : "📄 Invoice"}
                        </button>
                      )}
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
    </>
  );
}

export default Orders;
