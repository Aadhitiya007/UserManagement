import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout, getToken } from "../services/authService";

const SAMPLE_PRODUCTS = [
  {
    id: 1,
    name: "Wireless ANC Headphones",
    category: "Electronics",
    price: 2999,
    originalPrice: 5999,
    discount: "50% OFF",
    rating: 4.5,
    reviews: 1240,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300",
    tag: "Bestseller"
  },
  {
    id: 2,
    name: "Smart Fitness Watch v2",
    category: "Wearables",
    price: 1999,
    originalPrice: 3999,
    discount: "50% OFF",
    rating: 4.3,
    reviews: 850,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300",
    tag: "Free Delivery"
  },
  {
    id: 3,
    name: "RGB Gaming Mouse",
    category: "Electronics",
    price: 899,
    originalPrice: 1499,
    discount: "40% OFF",
    rating: 4.6,
    reviews: 2100,
    image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=300",
    tag: "Top Deal"
  },
  {
    id: 4,
    name: "Mechanical Keyboard",
    category: "Electronics",
    price: 3499,
    originalPrice: 4999,
    discount: "30% OFF",
    rating: 4.7,
    reviews: 1540,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=300",
    tag: "Limited Stock"
  },
  {
    id: 5,
    name: "Smartphone 128GB",
    category: "Mobiles",
    price: 14999,
    originalPrice: 18999,
    discount: "21% OFF",
    rating: 4.4,
    reviews: 3400,
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300",
    tag: "Top Seller"
  },
  {
    id: 6,
    name: "Bluetooth Speaker 20W",
    category: "Audio",
    price: 1299,
    originalPrice: 2499,
    discount: "48% OFF",
    rating: 4.2,
    reviews: 980,
    image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300",
    tag: "Free Delivery"
  }
];

const CATEGORIES = ["All", "Electronics", "Mobiles", "Wearables", "Audio"];

function Products() {
  const navigate = useNavigate();
  const [products] = useState(SAMPLE_PRODUCTS);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [notification, setNotification] = useState(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  async function addToCart(product) {
    console.log("%c🛒 [FRONTEND ACTION] Add to Cart Clicked:", "color: #3b82f6; font-weight: bold;", product);
    const token = getToken();

    try {
      const res = await fetch("http://localhost:5000/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: product.id,
          name: product.name,
          price: product.price
        })
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("%c❌ [BACKEND ERROR] Cart Add Failed:", "color: #ef4444; font-weight: bold;", data);
        showNotification("error", data.message || "Failed to add product to backend cart.");
        return;
      }

      console.log("%c✅ [BACKEND RESPONSE 200 OK] Item added:", "color: #10b981; font-weight: bold;", data);
      showNotification("success", `Added "${product.name}" to cart!`);

      setCart((prev) => {
        const existing = prev.find((item) => item.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          );
        }
        return [...prev, { ...product, quantity: 1 }];
      });
    } catch (err) {
      console.error("%c❌ [NETWORK ERROR] Could not reach backend server:", "color: #ef4444; font-weight: bold;", err);
      showNotification("error", "Network error: Could not connect to backend server.");
    }
  }

  async function updateQuantity(id, amount) {
    const item = cart.find((i) => i.id === id);
    if (!item) return;

    const newQty = item.quantity + amount;
    console.log(`%c🔄 [FRONTEND ACTION] Update Quantity for "${item.name}": ${item.quantity} -> ${newQty}`, "color: #f59e0b; font-weight: bold;");
    const token = getToken();

    try {
      const res = await fetch("http://localhost:5000/api/cart/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: id,
          change: amount,
          newQuantity: newQty
        })
      });

      const data = await res.json();
      console.log("%c✅ [BACKEND RESPONSE 200 OK] Quantity updated:", "color: #10b981; font-weight: bold;", data);

      setCart((prev) =>
        prev
          .map((item) =>
            item.id === id ? { ...item, quantity: item.quantity + amount } : item
          )
          .filter((item) => item.quantity > 0)
      );
      showNotification("success", `Updated quantity for "${item.name}".`);
    } catch (err) {
      console.error("%c❌ [NETWORK ERROR] Update quantity failed:", "color: #ef4444; font-weight: bold;", err);
      showNotification("error", "Network error updating quantity.");
    }
  }

  async function removeFromCart(id) {
    const item = cart.find((i) => i.id === id);
    console.log(`%c🗑️ [FRONTEND ACTION] Remove Item Clicked for ID ${id}`, "color: #ef4444; font-weight: bold;");
    const token = getToken();

    try {
      const res = await fetch(`http://localhost:5000/api/cart/remove/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();
      console.log("%c✅ [BACKEND RESPONSE 200 OK] Item removed:", "color: #10b981; font-weight: bold;", data);

      setCart((prev) => prev.filter((item) => item.id !== id));
      showNotification("success", `Removed "${item ? item.name : "Item"}" from cart.`);
    } catch (err) {
      console.error("%c❌ [NETWORK ERROR] Remove item failed:", "color: #ef4444; font-weight: bold;", err);
      showNotification("error", "Network error removing item.");
    }
  }

  async function handleOrder() {
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
        <div>
          <span className="cart-info">
            Cart: {totalCartCount} item(s)
          </span>
          <button onClick={handleLogout} className="btn-delete btn-logout">
            Logout
          </button>
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
            <div key={p.id} className="product-card">
              <img
                src={p.image}
                alt={p.name}
                style={{ width: "100%", height: "140px", objectFit: "cover", borderRadius: "6px", marginBottom: "10px" }}
              />
              <h3>{p.name}</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                ⭐ {p.rating} ({p.reviews.toLocaleString()} reviews) • {p.tag}
              </p>
              <div style={{ marginBottom: "12px" }}>
                <span className="product-price">₹{p.price.toLocaleString()}</span>{" "}
                <span style={{ textDecoration: "line-through", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  ₹{p.originalPrice.toLocaleString()}
                </span>{" "}
                <span style={{ color: "#10b981", fontSize: "0.85rem", fontWeight: "bold" }}>
                  {p.discount}
                </span>
              </div>
              <button onClick={() => addToCart(p)} className="btn-add btn-cart">
                Add to Cart
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
