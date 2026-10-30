import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { API_URL } from "../config/api";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Add restrictive Referrer-Policy to prevent leaking token via HTTP Referer header
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  function getPasswordStrength(pass) {
    if (!pass) return { score: 0, text: "", color: "#cbd5e1" };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score, text: "Weak", color: "#ef4444" };
    if (score <= 4) return { score, text: "Moderate", color: "#f59e0b" };
    return { score, text: "Strong", color: "#16a34a" };
  }

  const strength = getPasswordStrength(password);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password/${encodeURIComponent(token)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to reset password. Link may be expired.");
      }

      setSuccess("Your password has been successfully reset! Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="form-card">
          <h2 style={{ marginBottom: "12px", textAlign: "center" }}>Create New Password</h2>
          <p style={{ textAlign: "center", color: "#64748b", fontSize: "0.95rem", marginBottom: "20px" }}>
            Please enter and confirm your new secure password.
          </p>

          {success && (
            <div style={{ padding: "12px 14px", background: "#f0fdf4", color: "#15803d", borderRadius: "6px", marginBottom: "20px", fontSize: "0.9rem", border: "1px solid #bbf7d0" }}>
              ✓ {success}
            </div>
          )}

          {error && (
            <div style={{ padding: "12px 14px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px", fontSize: "0.9rem" }}>
              ⚠️ {error}
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ margin: 0 }}>New Password *</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{ background: "none", border: "none", color: "#2563eb", fontSize: "0.8rem", cursor: "pointer", fontWeight: 500 }}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 6 characters"
                />

                {/* Password Strength Indicator */}
                {password && (
                  <div style={{ marginTop: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: strength.color, fontWeight: 600 }}>
                      <span>Strength:</span>
                      <span>{strength.text}</span>
                    </div>
                    <div style={{ height: "4px", width: "100%", background: "#e2e8f0", borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(strength.score / 5) * 100}%`,
                          background: strength.color,
                          transition: "width 0.25s ease, background 0.25s ease"
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Confirm New Password *</label>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter new password"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "10px" }} disabled={loading}>
                {loading ? "Resetting Password..." : "Update Password"}
              </button>
            </form>
          )}

          <p style={{ marginTop: "20px", textAlign: "center", color: "#6b7280" }}>
            <Link to="/login" style={{ color: "#2563eb", fontWeight: 500 }}>Back to Login</Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default ResetPassword;

