// src/components/OrderSuccessModal.jsx
import { useNavigate } from "react-router-dom";

function OrderSuccessModal({ order, isOpen, onClose }) {
  const navigate = useNavigate();

  if (!isOpen || !order) return null;

  const orderId = order._id || order.id || "N/A";
  const total = order.totalAmount || 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ textAlign: "center", padding: "32px 24px" }} onClick={(e) => e.stopPropagation()}>
        
        {/* Success Icon */}
        <div style={{ fontSize: "3rem", marginBottom: "10px" }}>🎉</div>
        
        <h2 style={{ color: "#16a34a", marginBottom: "8px" }}>Thank You For Your Order!</h2>
        <p style={{ color: "#6b7280", fontSize: "0.95rem", marginBottom: "20px" }}>
          Your order has been placed successfully and is being processed.
        </p>

        {/* Order ID Badge Box */}
        <div style={{
          background: "#f0fdf4",
          border: "1px dashed #22c55e",
          borderRadius: "8px",
          padding: "14px",
          marginBottom: "24px"
        }}>
          <span style={{ fontSize: "0.85rem", color: "#15803d", textTransform: "uppercase", fontWeight: "bold" }}>
            Order Reference ID
          </span>
          <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#166534", marginTop: "4px" }}>
            #{orderId}
          </div>
          <div style={{ fontSize: "0.9rem", color: "#15803d", marginTop: "6px" }}>
            Total Paid: <strong>₹{total}</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => {
              onClose();
              navigate("/orders");
            }}
            className="btn btn-primary"
            style={{ flex: 1, padding: "12px" }}
          >
            📦 View My Orders
          </button>
          
          <button
            onClick={() => {
              onClose();
              navigate("/products");
            }}
            className="btn btn-outline"
            style={{ flex: 1, padding: "12px" }}
          >
            🛍️ Keep Shopping
          </button>
        </div>

      </div>
    </div>
  );
}

export default OrderSuccessModal;