import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout, getToken, isAuthenticated, getUserRole } from "../services/authService";

const CATEGORIES = ["All", "Electronics", "Mobiles", "Wearables", "Audio"];

function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = JSON.parse(localStorage.getItem("userCart") || "[]");
      return Array.isArray(savedCart) ? savedCart : [];
    } catch {
      return [];
    }
  });
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("http://localhost:5000/api/products");
        const data = await res.json();

        // Map MongoDB _id to id so cart and UI components work seamlessly
        const formattedData = data.map((item) => ({
          ...item,
          id: item._id || item.id
        }));

        setProducts(formattedData);
      } catch (err) {
        console.error("Error fetching products:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  useEffect(() => {
    localStorage.setItem("userCart", JSON.stringify(cart));
  }, [cart]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  async function addToCart(product) {
    console.log("%c🛒 [FRONTEND ACTION] Add to Cart Clicked:", "color: #3b82f6; font-weight: bold;", product);
    const token = getToken();

    try {
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      await fetch("http://localhost:5000/api/cart/add", {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId: product.id,
          name: product.name,
          price: product.price
        })
      });
    } catch (err) {
      console.warn("Backend cart add notice:", err);
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    showNotification("success", `Added "${product.name}" to cart!`);
  }

  async function updateQuantity(id, amount) {
    const item = cart.find((i) => i.id === id);
    if (!item) return;

    const newQty = item.quantity + amount;
    console.log(`%c🔄 [FRONTEND ACTION] Update Quantity for "${item.name}": ${item.quantity} -> ${newQty}`, "color: #f59e0b; font-weight: bold;");
    const token = getToken();

    try {
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      await fetch("http://localhost:5000/api/cart/update", {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId: id,
          change: amount,
          newQuantity: newQty
        })
      });
    } catch (err) {
      console.warn("Backend cart update notice:", err);
    }

    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + amount } : item
        )
        .filter((item) => item.quantity > 0)
    );
    showNotification("success", `Updated quantity for "${item.name}".`);
  }

  async function removeFromCart(id) {
    const item = cart.find((i) => i.id === id);
    console.log(`%c🗑️ [FRONTEND ACTION] Remove Item Clicked for ID ${id}`, "color: #ef4444; font-weight: bold;");
    const token = getToken();

    try {
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      await fetch(`http://localhost:5000/api/cart/remove/${id}`, {
        method: "DELETE",
        headers
      });
    } catch (err) {
      console.warn("Backend cart remove notice:", err);
    }

    setCart((prev) => prev.filter((item) => item.id !== id));
    showNotification("success", `Removed "${item ? item.name : "Item"}" from cart.`);
  }

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
    console.log("%c💳 [FRONTEND ACTION] Place Order Clicked. Cart:", "color: #8b5cf6; font-weight: bold;", cart);
    const token = getToken();

    try {
      const res = await fetch("http://localhost:5000/api/cart/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
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
        console.error("%c❌ [BACKEND ERROR] Checkout failed:", "color: #ef4444; font-weight: bold;", data);
        showNotification("error", data.message || "Checkout failed.");
        return;
      }

      console.log("%c🎉 [BACKEND RESPONSE 201 CREATED] Order Placed Successfully:", "color: #10b981; font-size: 14px; font-weight: bold;", data);
      showNotification("success", `🎉 Order ${data.orderId} placed for ₹${totalPrice.toLocaleString()}!`);
      setCart([]);
    } catch (err) {
      console.error("%c❌ [NETWORK ERROR] Order placement failed:", "color: #ef4444; font-weight: bold;", err);
      showNotification("error", "Network error: Failed to place order.");
    }
  }

  function handleCategoryChange(cat) {
    console.log(`%c🏷️ [FRONTEND ACTION] Category Filter Changed: "${cat}"`, "color: #06b6d4; font-weight: bold;");
    setSelectedCategory(cat);
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    console.log(`%c🔎 [FRONTEND ACTION] Search Input Changed: "${val}"`, "color: #64748b;");
    setSearch(val);
  }

  async function handleLogout() {
    console.log("%c🚪 [FRONTEND ACTION] Initiating Logout...", "color: #ef4444; font-weight: bold;");
    await logout();
    console.log("%c🚪 [FRONTEND ACTION] Logout complete. Redirecting to /login", "color: #ef4444; font-weight: bold;");
    navigate("/login");
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

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
          filteredProducts.map((p) => (
            <div
              key={p.id}
              className="product-card clickable-product-card"
              onClick={() => navigate(`/products/${p.id}`)}
              style={{ cursor: "pointer" }}
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
              <div style={{ marginBottom: "12px" }}>
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
            </div>
          ))
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
