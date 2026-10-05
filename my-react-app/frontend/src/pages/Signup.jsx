import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";

function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Regex Patterns for Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\d{10}$/; // Requires exactly 10 digits

  function validateForm() {
    if (!name.trim()) {
      return "Full Name is required.";
    }

    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address (e.g. user@example.com).";
    }

    if (!password || password.length < 6) {
      return "Password must be at least 6 characters long.";
    }

    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 18) {
      return "You must be at least 18 years old to create an account.";
    }

    if (!country.trim()) {
      return "Country is required.";
    }

    if (!phoneRegex.test(phone.trim())) {
      return "Phone number must be a valid 10-digit number.";
    }

    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Perform Regex and Form Validation
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          age: Number(age),
          country: country.trim(),
          phone: phone.trim(),
          role: "user" // Default role
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      alert("🎉 Registration successful! Please login to continue.");
      navigate("/login");
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
          <h2 style={{ marginBottom: "20px", textAlign: "center" }}>Create Account</h2>

          {error && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "15px", fontSize: "0.9rem" }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Full Name */}
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="John Doe"
              />
            </div>

            {/* Email Address */}
            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@example.com"
              />
            </div>

            {/* Password */}
            <div className="form-group">
              <label>Password *</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Choose a strong password (min. 6 characters)"
              />
            </div>

            {/* Age & Country (Two Column Grid) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div className="form-group">
                <label>Age (Must be 18+) *</label>
                <input
                  type="number"
                  min="18"
                  max="120"
                  className="form-control"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                  placeholder="18"
                />
              </div>

              <div className="form-group">
                <label>Country *</label>
                <input
                  type="text"
                  className="form-control"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                  placeholder="India"
                />
              </div>
            </div>

            {/* Phone Number (10 Digits) */}
            <div className="form-group">
              <label>Phone Number (10 Digits) *</label>
              <input
                type="tel"
                maxLength={10}
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} // Only allow numeric digits
                required
                placeholder="9876543210"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "10px", padding: "12px" }} disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </button>
          </form>

          <p style={{ marginTop: "20px", textAlign: "center", color: "#6b7280" }}>
            Already have an account? <Link to="/login" style={{ color: "#2563eb", fontWeight: "bold" }}>Login</Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default Signup;
