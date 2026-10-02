import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, isAuthenticated, getUserRole } from "../services/authService";
import { useCart } from "../context/CartContext";

const CATEGORIES = ["All", "Electronics", "Mobiles", "Wearables", "Audio"];

function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const {
    cart,
    setCart,
    updateQuantity,
    removeFromCart,
    performLogout,
    notification,
    setNotification,
    showNotification
  } = useCart();

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:5000/api/products");
      const data = await res.json();
      const formattedData = data.map((item) => ({
        ...item,
        id: item._id || item.id,
        quantity: item.quantity !== undefined ? item.quantity : 10
      }));

      setProducts(formattedData);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function handleOrder() {
    if (!isAuthenticated()) {
      showNotification("error", "Please login or sign up to complete your purchase.");
      setTimeout(() => {
        navigate("/login", {
          state: {
            from: "/cart",
            message: "Please log in or create an account to complete your purchase."
          }
        });
      }, 1200);
      return;
    }

    const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const token = getToken();

    try {
      const res = await fetch("http://localhost:5000/api/cart/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          items: cart,
          totalPrice
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          showNotification("error", "Session expired. Please log in to complete your purchase.");
          setTimeout(() => {
            navigate("/login", {
              state: {
                from: "/cart",
                message: "Please log in to complete your purchase."
              }
            });
          }, 1200);
          return;
        }
        showNotification("error", data.message || "Checkout failed.");
        return;
      }

      showNotification("success", `🎉 Order ${data.orderId} placed for ₹${totalPrice.toLocaleString()}!`);
      setCart([]);
      fetchProducts(); // Refresh stock in database
    } catch (err) {
      showNotification("error", "Network error: Failed to place order.");
    }
  }

  function handleCategoryChange(cat) {
    setSelectedCategory(cat);
  }

  function handleSearchChange(e) {
    setSearch(e.target.value);
  }

  async function handleLogout() {
    await performLogout(navigate, "/products");
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (loading) {
    return (
      <div className="shop-container" style={{ textAlign: "center", padding: "60px 0" }}>
        <h2>Loading products... ⌛</h2>
      </div>
    );
  }

  return (
    <div className="shop-container">
      <div className="shop-header">
        <h1>🛒 E-Shop</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => navigate("/cart")}
            className="btn-page"
            style={{ cursor: "pointer" }}
          >
            🛒 View Cart ({totalCartCount})
          </button>
          {isAuthenticated() ? (
            <>
              {getUserRole() === "admin" && (
                <button
                  onClick={() => navigate("/users")}
                  className="btn-edit"
                >
                  Admin Dashboard
                </button>
              )}
              <button onClick={handleLogout} className="btn-delete btn-logout">
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate("/login")}
                className="btn-add"
              >
                Login
              </button>
              <button
                onClick={() => navigate("/signup")}
                className="btn-edit"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>

      {notification && (
        <div
          style={{
            padding: "12px 16px",
            margin: "12px 0",
            borderRadius: "6px",
            fontWeight: "bold",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: notification.type === "success" ? "#d1fae5" : "#fee2e2",
            color: notification.type === "success" ? "#065f46" : "#991b1b",
            border: `1px solid ${notification.type === "success" ? "#a7f3d0" : "#fecaca"}`
          }}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="table-toolbar">
        <input
          type="search"
          placeholder="Search for products, brands and more..."
          value={search}
          onChange={handleSearchChange}
        />

        <div className="toolbar-actions">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`btn-page ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => handleCategoryChange(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="products-grid">
        {filteredProducts.length === 0 ? (
          <p className="empty-message">No products match your search or category filter.</p>
        ) : (
          filteredProducts.map((p) => {
            const isOutOfStock = p.quantity <= 0;
            return (
              <div
                key={p.id}
                className="product-card clickable-product-card"
                onClick={() => navigate(`/products/${p.id}`)}
                style={{ cursor: "pointer", opacity: isOutOfStock ? 0.8 : 1 }}
              >
                <img
                  src={p.image || "https://via.placeholder.com/300x150?text=Product+Image"}
                  alt={p.name}
                  style={{ width: "100%", height: "150px", objectFit: "cover", borderRadius: "6px", marginBottom: "10px" }}
                />
                <h3>{p.name}</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  ⭐ {p.rating || 4.5} ({p.reviews ? p.reviews.toLocaleString() : '1,250'} reviews) {p.tag ? `• ${p.tag}` : ''}
                </p>
                <div style={{ marginBottom: "6px" }}>
                  <span className="product-price">₹{p.price ? p.price.toLocaleString() : 0}</span>{" "}
                  {p.originalPrice && (
                    <span style={{ textDecoration: "line-through", color: "var(--text-muted)", fontSize: "0.85rem", marginRight: "6px" }}>
                      ₹{p.originalPrice.toLocaleString()}
                    </span>
                  )}
                  {p.discount && (
                    <span style={{ color: "#10b981", fontSize: "0.85rem", fontWeight: "bold" }}>
                      {p.discount}
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: "12px", fontSize: "0.85rem", fontWeight: "bold" }}>
                  {!isOutOfStock ? (
                    <span style={{ color: "#059669" }}>📦 In Stock</span>
                  ) : (
                    <span style={{ color: "#dc2626" }}>❌ Out of Stock</span>
                  )}
                </div>

                {isOutOfStock ? (
                  <button
                    disabled
                    className="btn-page"
                    style={{
                      width: "100%",
                      fontWeight: "bold",
                      backgroundColor: "#ef4444",
                      color: "#ffffff",
                      cursor: "not-allowed",
                      border: "none"
                    }}
                  >
                    Out of Stock ❌
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/products/${p.id}`);
                    }}
                    className="btn-page btn-view-detail"
                    style={{ width: "100%", fontWeight: "bold" }}
                  >
                    🔍 View Specs & Buy
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {cart.length > 0 && (
        <div className="cart-summary">
          <h3>Shopping Cart Total: ₹{totalCartPrice.toLocaleString()}</h3>
          <ul>
            {cart.map((item) => (
              <li key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  {item.name} (x{item.quantity}) - ₹{(item.price * item.quantity).toLocaleString()}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="btn-edit btn-sm" onClick={() => updateQuantity(item.id, -1)}>-</button>
                  <button className="btn-edit btn-sm" onClick={() => updateQuantity(item.id, 1)}>+</button>
                  <button className="btn-delete btn-sm" onClick={() => removeFromCart(item.id)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
          <button className="btn-add" style={{ marginTop: "16px", width: "100%" }} onClick={handleOrder}>
            Place Order
          </button>
        </div>
      )}
    </div>
  );
}

export default Products;
