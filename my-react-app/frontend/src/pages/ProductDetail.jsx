import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { logout, getToken, isAuthenticated, getUserRole } from "../services/authService";

function formatKey(key) {
  if (!key) return "";
  // Convert camelCase or snake_case to readable Title Case
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
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
    async function fetchProduct() {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:5000/api/products/${id}`);
        if (!res.ok) {
          throw new Error("Product not found");
        }
        const data = await res.json();
        const formatted = {
          ...data,
          id: data._id || data.id
        };
        setProduct(formatted);

        // Normalize colors if available
        if (formatted.colors && formatted.colors.length > 0) {
          const firstColor = typeof formatted.colors[0] === "string"
            ? { name: formatted.colors[0], color: "#3b82f6" }
            : formatted.colors[0];
          setSelectedColor(firstColor);
        }

        // Normalize variants if available
        if (formatted.variants && formatted.variants.length > 0) {
          const firstVariant = typeof formatted.variants[0] === "string"
            ? { label: formatted.variants[0], priceDiff: 0 }
            : formatted.variants[0];
          setSelectedVariant(firstVariant);
        }
      } catch (err) {
        console.error("Error loading product detail:", err);
        setError(err.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchProduct();
    }
  }, [id]);

  useEffect(() => {
    localStorage.setItem("userCart", JSON.stringify(cart));
  }, [cart]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  async function handleAddToCart() {
    if (!product) return;

    const variantDiff = selectedVariant?.priceDiff || 0;
    const currentPrice = selectedVariant?.price
      ? selectedVariant.price
      : (product.price || 0) + variantDiff;

    const colorName = selectedColor?.name || (typeof selectedColor === "string" ? selectedColor : "");
    const variantLabel = selectedVariant?.label || selectedVariant?.name || (typeof selectedVariant === "string" ? selectedVariant : "");

    const variantString = [variantLabel, colorName].filter(Boolean).join(" • ");

    const itemToAdd = {
      ...product,
      price: currentPrice,
      selectedVariant: variantString
    };

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
          productId: itemToAdd.id,
          name: variantString ? `${itemToAdd.name} (${variantString})` : itemToAdd.name,
          price: currentPrice
        })
      });
    } catch (err) {
      console.warn("Backend add to cart notice:", err);
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === itemToAdd.id);
      if (existing) {
        return prev.map((item) =>
          item.id === itemToAdd.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...itemToAdd, quantity: 1 }];
    });

    showNotification("success", `Added "${itemToAdd.name}" to cart!`);
  }

  async function handleBuyNow() {
    if (!product) return;

    await handleAddToCart();

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

    navigate("/cart");
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="shop-container" style={{ textAlign: "center", padding: "60px 0" }}>
        <h2>Loading product details... ⌛</h2>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="shop-container" style={{ textAlign: "center", padding: "60px 0" }}>
        <h2>⚠️ Product Not Found</h2>
        <p style={{ color: "var(--text-secondary)", margin: "16px 0 24px" }}>
          We couldn't find the requested product details.
        </p>
        <button className="btn-add" onClick={() => navigate("/products")}>
          ← Back to Products Store
        </button>
      </div>
    );
  }

  // Extract raw specifications object or array from product
  const rawSpecs = product.specs || product.specifications || product.details || product.features;

  // Extract colors
  const rawColors = product.colors || product.colorOptions || [];
  const colorList = rawColors.map((c) =>
    typeof c === "string" ? { name: c, color: "#3b82f6" } : c
  );

  // Extract variants
  const rawVariants = product.variants || product.options || [];
  const variantList = rawVariants.map((v) =>
    typeof v === "string" ? { label: v, priceDiff: 0 } : v
  );

  const activeColor = selectedColor || colorList[0];
  const activeVariant = selectedVariant || variantList[0];

  const displayPrice = activeVariant?.price
    ? activeVariant.price
    : (product.price || 0) + (activeVariant?.priceDiff || 0);

  const displayOriginalPrice = product.originalPrice
    ? product.originalPrice + (activeVariant?.priceDiff || 0)
    : Math.round(displayPrice * 1.15);

  const descriptionText = product.description || product.desc || product.summary || "";

  return (
    <div className="shop-container">
      {/* Top Header */}
      <div className="shop-header">
        <h1>🛒 E-Shop</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button className="btn-page" onClick={() => navigate("/products")}>
            ← Back to Products
          </button>
          <button className="btn-page" onClick={() => navigate("/cart")}>
            🛒 View Cart ({totalCartCount})
          </button>

          {isAuthenticated() ? (
            <>
              {getUserRole() === "admin" && (
                <button onClick={() => navigate("/users")} className="btn-edit">
                  Admin Dashboard
                </button>
              )}
              <button onClick={handleLogout} className="btn-delete btn-logout">
                Logout
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate("/login")} className="btn-add">
                Login
              </button>
              <button onClick={() => navigate("/signup")} className="btn-edit">
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

      {/* Breadcrumbs */}
      <div className="detail-breadcrumb">
        <span>Home</span> / <span>{product.category || "Store"}</span> / <span className="active">{product.name}</span>
      </div>

      {/* Detail Grid */}
      <div className="detail-grid">
        {/* Left Column: Image & Feature Badges */}
        <div className="detail-left">
          <div className="detail-image-wrapper">
            <img
              src={product.image || "https://via.placeholder.com/400x300?text=Product+Image"}
              alt={product.name}
              className="detail-main-img"
            />
          </div>

          <div className="detail-badges">
            <div className="badge-item">
              <span className="badge-icon">🚚</span>
              <div>
                <strong>Free Express Shipping</strong>
                <p>Fast delivery right to your doorstep</p>
              </div>
            </div>
            <div className="badge-item">
              <span className="badge-icon">🛡️</span>
              <div>
                <strong>Authentic Product</strong>
                <p>100% genuine brand quality guaranteed</p>
              </div>
            </div>
            <div className="badge-item">
              <span className="badge-icon">↺</span>
              <div>
                <strong>7 Days Replacement</strong>
                <p>Hassle-free easy return policy</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Title, Unique Specs, Options & Action Buttons */}
        <div className="detail-right">
          <h2 className="detail-title">{product.name}</h2>

          {descriptionText && (
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.5" }}>
              {descriptionText}
            </p>
          )}

          <div className="detail-rating-row">
            <span className="rating-pill">★ {product.rating || 4.5}</span>
            <span className="reviews-count">
              {product.reviews ? product.reviews.toLocaleString() : "1,250"} ratings & reviews
            </span>
            {product.tag && <span className="tag-pill">{product.tag}</span>}
          </div>

          {/* Color Selector (Dynamically rendered for any product colors format) */}
          {colorList.length > 0 && (
            <div className="detail-option-group">
              <label className="option-label">
                Selected Color: <strong>{activeColor?.name || activeColor}</strong>
              </label>
              <div className="color-options-list">
                {colorList.map((c, idx) => {
                  const cName = typeof c === "object" ? c.name : c;
                  const cHex = typeof c === "object" && c.color ? c.color : "#3b82f6";
                  const isSelected = activeColor?.name === cName || activeColor === cName;

                  return (
                    <button
                      key={cName || idx}
                      className={`color-btn ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedColor(c)}
                      title={cName}
                    >
                      <span className="color-dot" style={{ backgroundColor: cHex }} />
                      <span>{cName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variant Selector (Dynamically rendered for any product variants format) */}
          {variantList.length > 0 && (
            <div className="detail-option-group">
              <label className="option-label">Select Variant:</label>
              <div className="storage-options-list">
                {variantList.map((v, idx) => {
                  const vLabel = v.label || v.name || (typeof v === "string" ? v : `Option ${idx + 1}`);
                  const vPrice = v.price ? v.price : (product.price || 0) + (v.priceDiff || 0);
                  const isOutOfStock = v.status === "out-of-stock";
                  const isSelected = (activeVariant?.label === vLabel) || (activeVariant?.name === vLabel) || (activeVariant === v);

                  return (
                    <button
                      key={vLabel || idx}
                      disabled={isOutOfStock}
                      className={`storage-card ${isSelected ? "selected" : ""} ${isOutOfStock ? "disabled" : ""}`}
                      onClick={() => !isOutOfStock && setSelectedVariant(v)}
                    >
                      <div className="storage-label">{vLabel}</div>
                      {!isOutOfStock ? (
                        <div className="storage-price">₹{vPrice.toLocaleString()}</div>
                      ) : (
                        <div className="storage-out">Out of stock</div>
                      )}
                      {v.badge && <span className="storage-badge">{v.badge}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price Box */}
          <div className="detail-price-box">
            <div className="price-row">
              <span className="main-price">₹{displayPrice ? displayPrice.toLocaleString() : 0}</span>
              {displayOriginalPrice > displayPrice && (
                <span className="orig-price">₹{displayOriginalPrice.toLocaleString()}</span>
              )}
              {product.discount && (
                <span className="discount-tag">{product.discount}</span>
              )}
            </div>
            <p className="fee-note">+ ₹299 Protect Promise Fee • Inclusive of all taxes</p>
          </div>

          {/* Product Specifications Section (Dynamically renders ANY specs structure uploaded by user) */}
          <div className="specs-section">
            <h3>Product Specifications</h3>
            {rawSpecs ? (
              <ul className="specs-list">
                {Array.isArray(rawSpecs) ? (
                  rawSpecs.map((item, idx) => {
                    if (typeof item === "string") {
                      return <li key={idx}>• {item}</li>;
                    }
                    if (typeof item === "object" && item !== null) {
                      const specKey = item.key || item.name || item.title || item.label || `Spec ${idx + 1}`;
                      const specVal = item.value || item.val || item.description || "";
                      return (
                        <li key={idx}>
                          <strong>{formatKey(specKey)}:</strong> {specVal}
                        </li>
                      );
                    }
                    return null;
                  })
                ) : typeof rawSpecs === "object" ? (
                  Object.entries(rawSpecs).map(([key, value]) => {
                    if (!value || value === "N/A") return null;
                    return (
                      <li key={key}>
                        <strong>{formatKey(key)}:</strong> {typeof value === "object" ? JSON.stringify(value) : value}
                      </li>
                    );
                  })
                ) : (
                  <li>{String(rawSpecs)}</li>
                )}
              </ul>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                High quality manufacturer specifications apply.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="detail-actions">
            <button className="btn-add-cart-detail" onClick={handleAddToCart}>
              🛒 Add to Cart
            </button>
            <button className="btn-buy-now-detail" onClick={handleBuyNow}>
              ⚡ Buy Now at ₹{displayPrice ? displayPrice.toLocaleString() : 0}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
