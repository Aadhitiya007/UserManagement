import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { loginUser, isAuthenticated, getUserRole } from "../services/authService";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const noticeMessage = location.state?.message;

  useEffect(() => {
    if (isAuthenticated()) {
      const role = getUserRole();
      if (role === "admin") {
        navigate("/users", { replace: true });
      } else {
        navigate("/products", { replace: true });
      }
    }
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginUser(email, password);

      if (data.user?.role === "admin") {
        navigate("/users", { replace: true });
      } else {
        const from = location.state?.from || "/products";
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <h2>🔐 Account Login</h2>

      {noticeMessage && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: "16px",
            borderRadius: "6px",
            backgroundColor: "#eff6ff",
            color: "#1d4ed8",
            border: "1px solid #bfdbfe",
            fontSize: "0.9rem",
            fontWeight: "500"
          }}
        >
          {noticeMessage}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-add">
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className="auth-footer">
        Don't have an account? <Link to="/signup" state={location.state}>Sign Up</Link>
      </p>
    </div>
  );
}

export default Login;