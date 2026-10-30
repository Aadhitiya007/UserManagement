import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import logo from "../assets/logo.png";

function Navbar() {
  const navigate = useNavigate();
  const { cart, switchUser } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  function handleLogout() {
    setMobileMenuOpen(false);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("student_cart");
    if (typeof switchUser === "function") {
      switchUser(null);
    }
    navigate("/login");
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <>
      <header className="navbar">
        <Link to="/products" className="navbar-brand" onClick={closeMobileMenu}>
          <img
            src={logo}
            alt="shopiee"
            className="navbar-logo"
          />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="navbar-links desktop-nav">
          <Link to="/products">Products</Link>
          <Link to="/cart" className="cart-nav-link">
            Cart {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </Link>

          {token && <Link to="/orders">My Orders</Link>}

          {user && user.role === "admin" && (
            <Link to="/admin/dashboard" style={{ color: "#2563eb", fontWeight: "bold" }}>
              Admin Dashboard
            </Link>
          )}

          {token ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                Hi, {user?.name || "User"}
              </span>
              <button onClick={handleLogout} className="btn btn-outline btn-sm">
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px" }}>
              <Link to="/login" className="btn btn-outline btn-sm">
                Login
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                Register
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile Header Actions (Cart Icon + Hamburger Toggle) */}
        <div className="mobile-actions">
          <Link to="/cart" className="mobile-cart-btn" onClick={closeMobileMenu}>
            🛒
            {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </Link>
          <button
            type="button"
            className="hamburger-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            <span className={`bar ${mobileMenuOpen ? "bar-open-1" : ""}`} />
            <span className={`bar ${mobileMenuOpen ? "bar-open-2" : ""}`} />
            <span className={`bar ${mobileMenuOpen ? "bar-open-3" : ""}`} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile Navigation Drawer */}
      <div className={`mobile-drawer ${mobileMenuOpen ? "drawer-open" : ""}`}>
        <div className="mobile-drawer-header">
          <span className="drawer-title">Menu</span>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={closeMobileMenu}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="mobile-drawer-links">
          <Link to="/products" onClick={closeMobileMenu}>
            📦 Products
          </Link>
          <Link to="/cart" onClick={closeMobileMenu}>
            🛒 Cart {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </Link>

          {token && (
            <Link to="/orders" onClick={closeMobileMenu}>
              📜 My Orders
            </Link>
          )}

          {user && user.role === "admin" && (
            <Link
              to="/admin/dashboard"
              onClick={closeMobileMenu}
              style={{ color: "#2563eb", fontWeight: "bold" }}
            >
              📊 Admin Dashboard
            </Link>
          )}
        </nav>

        <div className="mobile-drawer-footer">
          {token ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "0.95rem", color: "#475569", fontWeight: 500 }}>
                Logged in as: <strong>{user?.name || "User"}</strong>
              </span>
              <button onClick={handleLogout} className="btn btn-outline btn-block">
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <Link to="/login" onClick={closeMobileMenu} className="btn btn-outline btn-block">
                Login
              </Link>
              <Link to="/signup" onClick={closeMobileMenu} className="btn btn-primary btn-block">
                Create Account
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Navbar;
