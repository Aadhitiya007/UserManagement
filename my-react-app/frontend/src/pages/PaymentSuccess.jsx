import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";

function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setError("No order ID provided.");
      setLoading(false);
      return;
    }

    verifyPayment();
  }, [orderId]);

  async function verifyPayment() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_URL}/api/payment/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to verify payment status");
      }

      setOrder(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: "600px", margin: "50px auto", textAlign: "center" }}>
        {loading ? (
          <div style={{ background: "white", padding: "40px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <p>Verifying payment with the server...</p>
          </div>
        ) : error ? (
          <div style={{ background: "white", padding: "40px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "10px" }}>⚠️</div>
            <h2 style={{ color: "#dc2626", marginBottom: "10px" }}>Verification Error</h2>
            <p style={{ color: "#64748b", marginBottom: "20px" }}>{error}</p>
            <Link to="/orders" className="btn btn-primary">
              Go to My Orders
            </Link>
          </div>
        ) : order?.paymentStatus !== "Paid" ? (
          // Notice: Prompt rule: Do not show success if status is not verified as Paid
          <div style={{ background: "white", padding: "40px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "10px" }}>⏳</div>
            <h2 style={{ color: "#f59e0b", marginBottom: "10px" }}>Payment Status: {order?.paymentStatus || "Pending"}</h2>
            <p style={{ color: "#64748b", marginBottom: "20px" }}>
              Your order has been recorded, but payment has not been marked as Paid yet.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={verifyPayment} className="btn btn-primary">
                Refresh Status
              </button>
              <Link to={`/payment/${orderId}`} className="btn btn-outline">
                Retry Payment
              </Link>
            </div>
          </div>
        ) : (
          // Verified Paid State
          <div style={{ background: "white", padding: "40px 30px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "10px" }}>🎉</div>
            <h2 style={{ color: "#16a34a", marginBottom: "8px" }}>Payment Successful!</h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: "24px" }}>
              Your payment has been received and your order is now being processed.
            </p>

            {/* Receipt Summary Card */}
            <div style={{
              background: "#f0fdf4",
              border: "1px dashed #22c55e",
              borderRadius: "8px",
              padding: "18px",
              marginBottom: "28px",
              textAlign: "left"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem" }}>
                <span style={{ color: "#166534" }}>Order ID:</span>
                <span style={{ fontWeight: "bold", color: "#14532d" }}>#{orderId}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem" }}>
                <span style={{ color: "#166534" }}>Transaction Reference:</span>
                <span style={{ fontWeight: "bold", color: "#14532d" }}>
                  {order.paymentDetails?.transactionId || "N/A"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem" }}>
                <span style={{ color: "#166534" }}>Payment Method:</span>
                <span style={{ fontWeight: "600", color: "#14532d" }}>{order.paymentMethod || "Card"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem" }}>
                <span style={{ color: "#166534" }}>Date & Time:</span>
                <span style={{ color: "#14532d" }}>
                  {order.paymentDetails?.paidAt ? new Date(order.paymentDetails.paidAt).toLocaleString() : new Date().toLocaleString()}
                </span>
              </div>
              <div style={{ borderTop: "1px solid #bbf7d0", paddingTop: "8px", marginTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "1.15rem", fontWeight: "bold" }}>
                <span style={{ color: "#15803d" }}>Amount Paid:</span>
                <span style={{ color: "#15803d" }}>₹{order.totalAmount}</span>
              </div>
            </div>

            {/* Navigation buttons */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <Link to="/orders" className="btn btn-primary" style={{ flex: 1, padding: "12px" }}>
                📦 View My Orders
              </Link>
              <Link to="/products" className="btn btn-outline" style={{ flex: 1, padding: "12px" }}>
                🛍️ Continue Shopping
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default PaymentSuccess;

