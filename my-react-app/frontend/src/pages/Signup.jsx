import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../services/authService";

const COUNTRIES = [
  "India", "USA", "UK", "Canada", "Australia", "Germany", "France", "Japan", "China", 
  "Brazil", "Italy", "Spain", "Mexico", "Netherlands", "Sweden", "Norway", "Denmark", 
  "Finland", "Switzerland", "Belgium", "Austria", "New Zealand", "South Korea", "Singapore", 
  "Ireland", "Portugal", "Greece", "Poland", "Czech Republic", "Hungary", "Argentina", 
  "Chile", "Colombia", "Peru", "South Africa", "Egypt", "Turkey", "Saudi Arabia", "UAE", 
  "Thailand", "Vietnam", "Malaysia", "Indonesia", "Philippines", "Pakistan", "Bangladesh", 
  "Nigeria", "Kenya", "Ghana", "Morocco", "Iceland"
];

function Signup() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    age: "",
    number: "",
    country: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  function handleChange(e) {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await registerUser(formData);

      if (data.user.role === "user") {
        navigate("/products");
      } else {
        navigate("/users");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <h2>📝 Create a User Account</h2>
      <p className="auth-subtitle">
        Sign up with your custom password to access the products store.
      </p>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name</label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            placeholder="John Doe"
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="john@example.com"
          />
        </div>

        <div className="form-group">
          <label>Password (min 6 chars)</label>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            value={formData.password}
            onChange={handleChange}
            placeholder="Choose a unique password"
          />
        </div>

        <div className="form-group">
          <label>Age</label>
          <input
            type="number"
            name="age"
            required
            min={19}
            value={formData.age}
            onChange={handleChange}
            placeholder="e.g. 25"
          />
        </div>

        <div className="form-group">
          <label>Phone Number (10 digits)</label>
          <input
            type="text"
            name="number"
            required
            pattern="\d{10}"
            title="Please enter exactly 10 digits"
            value={formData.number}
            onChange={handleChange}
            placeholder="9876543210"
          />
        </div>

        <div className="form-group">
          <label>Country</label>
          <select
            name="country"
            required
            value={formData.country}
            onChange={handleChange}
          >
            <option value="">Select a country...</option>
            {[...COUNTRIES].sort((a, b) => a.localeCompare(b)).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading} className="btn-add">
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>

      <p className="auth-footer">
        Already have an account? <Link to="/login">Log In</Link>
      </p>
    </div>
  );
}

export default Signup;
