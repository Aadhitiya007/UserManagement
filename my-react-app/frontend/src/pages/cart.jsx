import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout, getToken, isAuthenticated, getUserRole } from "../services/authService";

function Cart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = JSON.parse(localStorage.getItem("userCart") || "[]");
      return Array.isArray(savedCart) ? savedCart : [];
    } catch {
      return [];
    }
  });
  const [notification, setNotification] = useState(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Sync state changes to localStorage
  useEffect(() => {
    localStorage.setItem("userCart", JSON.stringify(cart));
  }, [cart]);

  // 2. UPDATE: Change item quantity (+1 or -1)
  async function updateQuantity(productId, change) {
    const item = cart.find((i) => i.id === productId);
    if (!item) return;

    const newQuantity = item.quantity + change;
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
          productId,
          change,
          newQuantity
        })
      });
    } catch (err) {
      console.warn("Backend cart update notice:", err);
    }

    setCart((prevCart) =>
      prevCart
        .map((item) =>
          item.id === productId ? { ...item, quantity: newQuantity } : item
        )
        .filter((item) => item.quantity > 0)
    );
    showNotification("success", `Updated quantity for ${item.name}`);
  }

  // 3. DELETE: Remove item from cart
  async function removeFromCart(productId) {
    const item = cart.find((i) => i.id === productId);
    const token = getToken();

    try {
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      await fetch(`http://localhost:5000/api/cart/remove/${productId}`, {
        method: "DELETE",
        headers
      });
    } catch (err) {
      console.warn("Backend cart remove notice:", err);
    }

    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
    showNotification("success", `Removed "${item ? item.name : "Item"}" from cart.`);
  }

  // 4. CREATE / CHECKOUT: Place order
  async function handleCheckout() {
    if (cart.length === 0) return;

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
        body: JSON.stringify({ items: cart, totalPrice })
      });

      const data = await res.json();

      if (res.status === 401 || res.status === 403) {
        showNotification("error", "Session expired. Redirecting to login...");
        setTimeout(() => {
          navigate("/login", {
            state: {
              from: "/cart",
              message: "Please log in to complete your purchase."
            }
          });
        }, 1500);
        return;
      }

      if (res.ok) {
        showNotification("success", `🎉 Order ${data.orderId} placed for ₹${totalPrice.toLocaleString()}!`);
        setCart([]);
      } else {
        showNotification("error", data.message || "Checkout failed.");
      }
    } catch (err) {
      showNotification("error", "Network error placing order.");
    }
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="shop-container">
      {/* Header */}
      <div className="shop-header">
        <h1>🛒 Shopping Cart</h1>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="btn-page" onClick={() => navigate("/products")}>
            ← Back to Products
          </button>
          {isAuthenticated() ? (
            <>
              {getUserRole() === "admin" && (
                <button className="btn-edit" onClick={() => navigate("/users")}>
                  Admin Dashboard
                </button>
              )}
              <button className="btn-delete btn-logout" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button className="btn-add" onClick={() => navigate("/login")}>
                Login
              </button>
              <button className="btn-edit" onClick={() => navigate("/signup")}>
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notification Toast */}
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
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Cart Items List */}
      {cart.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <h2>Your cart is empty 🛍️</h2>
          <p style={{ color: "var(--text-secondary)", margin: "10px 0 20px" }}>
            Looks like you haven't added any items to your cart yet.
          </p>
          <button className="btn-add" onClick={() => navigate("/products")}>
            Explore Products
          </button>
        </div>
      ) : (
        <div className="cart-summary" style={{ marginTop: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3>Total Items: {totalCount}</h3>
            <h3>Total Amount: ₹{totalPrice.toLocaleString()}</h3>
          </div>

          <ul style={{ listStyle: "none", padding: 0 }}>
            {cart.map((item) => (
              <li
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px",
                  borderBottom: "1px solid var(--border-hairline)"
                }}
              >
                <div>
                  <strong>{item.name}</strong>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    ₹{item.price.toLocaleString()} × {item.quantity} = ₹{(item.price * item.quantity).toLocaleString()}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button className="btn-edit btn-sm" onClick={() => updateQuantity(item.id, -1)}>
                    -
                  </button>
                  <span style={{ fontWeight: "bold", minWidth: "20px", textAlign: "center" }}>
                    {item.quantity}
                  </span>
                  <button className="btn-edit btn-sm" onClick={() => updateQuantity(item.id, 1)}>
                    +
                  </button>
                  <button className="btn-delete btn-sm" onClick={() => removeFromCart(item.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button
            className="btn-add"
            style={{ marginTop: "24px", width: "100%", fontSize: "1.1rem", padding: "12px" }}
            onClick={handleCheckout}
          >
            💳 Proceed to Checkout (₹{totalPrice.toLocaleString()})
          </button>
        </div>
      )}
    </div>
  );
}

export default Cart;
