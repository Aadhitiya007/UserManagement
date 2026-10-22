import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";

function PaymentFailure() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setError("No order ID provided.");
      setLoading(false);
      return;
    }

    fetchOrder();
  }, [orderId]);

  async function fetchOrder() {
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
        throw new Error(data.message || "Failed to load order details");
      }

      setOrder(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setRetrying(true);
      setError("");

      const res = await fetch(`${API_URL}/api/payment/retry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not initialize retry");
      }

      // Navigate back to payment page with same order
      navigate(`/payment/${orderId}`);
    } catch (err) {
      setError(err.message);
      setRetrying(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: "600px", margin: "50px auto", textAlign: "center" }}>
        {loading ? (
          <div style={{ background: "white", padding: "40px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <p>Loading order details...</p>
          </div>
        ) : (
          <div style={{ background: "white", padding: "40px 30px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "10px" }}>❌</div>
            <h2 style={{ color: "#dc2626", marginBottom: "8px" }}>Payment Failed</h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: "24px" }}>
              The simulated payment transaction could not be completed.
            </p>

            {error && (
              <div style={{ padding: "10px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px", fontSize: "0.9rem" }}>
                {error}
              </div>
            )}

            {/* Order Reference Box */}
            <div style={{
              background: "#fef2f2",
              border: "1px dashed #f87171",
              borderRadius: "8px",
              padding: "18px",
              marginBottom: "28px",
              textAlign: "left"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem" }}>
                <span style={{ color: "#991b1b" }}>Order Reference:</span>
                <span style={{ fontWeight: "bold", color: "#7f1d1d" }}>#{orderId}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem" }}>
                <span style={{ color: "#991b1b" }}>Payment Status:</span>
                <span style={{ fontWeight: "bold", color: "#dc2626" }}>{order?.paymentStatus || "Failed"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem" }}>
                <span style={{ color: "#991b1b" }}>Reason:</span>
                <span style={{ color: "#7f1d1d" }}>
                  {order?.paymentDetails?.failureReason || "Transaction declined by simulated issuer"}
                </span>
              </div>
              <div style={{ borderTop: "1px solid #fecaca", paddingTop: "8px", marginTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "1.15rem", fontWeight: "bold" }}>
                <span style={{ color: "#991b1b" }}>Outstanding Amount:</span>
                <span style={{ color: "#991b1b" }}>₹{order?.totalAmount || 0}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="btn btn-primary"
                style={{ padding: "12px", fontSize: "1rem" }}
              >
                {retrying ? "Preparing Retry..." : "🔄 Retry Payment"}
              </button>

              <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                <Link to="/orders" className="btn btn-outline" style={{ flex: 1, padding: "10px" }}>
                  📦 View Orders
                </Link>
                <Link to="/products" className="btn btn-outline" style={{ flex: 1, padding: "10px" }}>
                  🛍️ Back to Store
                </Link>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}

export default PaymentFailure;

