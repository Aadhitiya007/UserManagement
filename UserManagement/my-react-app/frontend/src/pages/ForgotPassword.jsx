import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json();
      setMessage(data.message || "If an account exists with this email, a password reset link has been sent.");
    } catch (err) {
      setError(err.message || "Failed to process request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="form-card">
          <h2 style={{ marginBottom: "12px", textAlign: "center" }}>Reset Password</h2>
          <p style={{ textAlign: "center", color: "#64748b", fontSize: "0.95rem", marginBottom: "20px" }}>
            Enter your registered email address and we will send you a link to reset your password.
          </p>

          {message && (
            <div style={{ padding: "12px 14px", background: "#f0fdf4", color: "#15803d", borderRadius: "6px", marginBottom: "20px", fontSize: "0.9rem", border: "1px solid #bbf7d0" }}>
              ✓ {message}
            </div>
          )}

          {error && (
            <div style={{ padding: "12px 14px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px", fontSize: "0.9rem" }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@example.com"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Sending link..." : "Send Reset Link"}
            </button>
          </form>

          <p style={{ marginTop: "20px", textAlign: "center", color: "#6b7280" }}>
            Remembered your password? <Link to="/login" style={{ color: "#2563eb", fontWeight: 500 }}>Back to Login</Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default ForgotPassword;

