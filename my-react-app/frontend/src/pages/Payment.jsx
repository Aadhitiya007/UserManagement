import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { API_URL } from "../config/api";

function Payment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  async function fetchOrderDetails() {
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
        throw new Error(data.message || "Could not retrieve order for payment");
      }

      // If already paid, go straight to success
      if (data.paymentStatus === "Paid") {
        navigate(`/payment/success?orderId=${orderId}`);
        return;
      }

      setOrder(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompletePayment() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setProcessing(true);
      setError("");

      const res = await fetch(`${API_URL}/api/payment/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId,
          shouldSucceed: true,
          paymentMethod
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Payment simulation failed");
      }

      // Clear cart items on payment success
      clearCart();

      navigate(`/payment/success?orderId=${orderId}`);
    } catch (err) {
      setError(err.message || "An error occurred during payment processing");
      setProcessing(false);
    }
  }

  async function handleCancelToCart() {
    const token = localStorage.getItem("token");
    try {
      setProcessing(true);
      setError("");

      // Restore reserved stock and delete the pending order from the backend
      await fetch(`${API_URL}/api/payment/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });
    } catch (err) {
      console.error("Error cancelling order:", err);
    } finally {
      // Cart items remain untouched in CartContext/localStorage
      navigate("/cart");
    }
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: "700px", margin: "40px auto" }}>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", background: "white", borderRadius: "8px" }}>
            <p>Loading order payment details...</p>
          </div>
        ) : !order ? (
          <div style={{ textAlign: "center", padding: "40px", background: "white", borderRadius: "8px" }}>
            <p>Order not found.</p>
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "28px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            
            <h2 style={{ marginBottom: "6px" }}>Dummy Payment Gateway</h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: "20px" }}>
              Select a payment method and test the transaction lifecycle.
            </p>

            {/* Order Summary Box */}
            <div style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "24px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.9rem" }}>
                <span style={{ color: "#64748b" }}>Order Reference:</span>
                <span style={{ fontWeight: "600" }}>#{orderId.slice(-8)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.25rem", fontWeight: "bold" }}>
                <span>Amount to Pay:</span>
                <span style={{ color: "#2563eb" }}>₹{order.totalAmount}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontWeight: "600", marginBottom: "10px" }}>
                Choose Payment Method:
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("UPI")}
                  className={`btn ${paymentMethod === "UPI" ? "btn-primary" : "btn-outline"}`}
                  style={{ padding: "12px 8px", fontSize: "0.9rem" }}
                >
                  📱 UPI
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("Card")}
                  className={`btn ${paymentMethod === "Card" ? "btn-primary" : "btn-outline"}`}
                  style={{ padding: "12px 8px", fontSize: "0.9rem" }}
                >
                  💳 Card
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("NetBanking")}
                  className={`btn ${paymentMethod === "NetBanking" ? "btn-primary" : "btn-outline"}`}
                  style={{ padding: "12px 8px", fontSize: "0.9rem" }}
                >
                  🏦 Net Banking
                </button>
              </div>
            </div>

            {/* Simulated Payment Form Mock */}
            <div style={{
              border: "1px dashed #cbd5e1",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "28px",
              background: "#fdfdfd"
            }}>
              {paymentMethod === "UPI" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#475569", marginBottom: "6px" }}>
                    Demo Virtual UPI ID:
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="test-buyer@dummybank"
                    className="form-control"
                    style={{ background: "#f1f5f9", color: "#475569" }}
                  />
                </div>
              )}

              {paymentMethod === "Card" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#475569", marginBottom: "6px" }}>
                    Demo Card Number:
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="4111 •••• •••• 1111 (Visa Test)"
                    className="form-control"
                    style={{ background: "#f1f5f9", color: "#475569" }}
                  />
                </div>
              )}

              {paymentMethod === "NetBanking" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "#475569", marginBottom: "6px" }}>
                    Selected Test Bank:
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="State Bank of India (Simulator Branch)"
                    className="form-control"
                    style={{ background: "#f1f5f9", color: "#475569" }}
                  />
                </div>
              )}
            </div>

            {/* Simulation Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                type="button"
                onClick={handleCompletePayment}
                className="btn btn-primary"
                style={{
                  padding: "14px",
                  fontSize: "1rem",
                  background: "#16a34a",
                  borderColor: "#16a34a",
                  fontWeight: "600"
                }}
                disabled={processing}
              >
                {processing ? "Processing Payment..." : `🟢 Complete Payment (₹${order.totalAmount})`}
              </button>

              <button
                type="button"
                onClick={handleCancelToCart}
                className="btn"
                style={{ background: "transparent", color: "#64748b", marginTop: "4px" }}
                disabled={processing}
              >
                {processing ? "Cancelling..." : "Cancel and return to Cart"}
              </button>
            </div>

          </div>
        )}
      </div>
    </>
  );
}

export default Payment;

