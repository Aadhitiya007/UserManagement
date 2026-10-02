import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { isAuthenticated, getUserRole, getToken } from "../services/authService";
import { useCart } from "../context/CartContext";

function formatKey(key) {
  if (!key) return "";

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
  const [purchasedOrder, setPurchasedOrder] = useState(null);
  const [buying, setBuying] = useState(false);

  const {
    cart,
    addToCart,
    performLogout,
    notification,
    setNotification,
    showNotification
  } = useCart();

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:5000/api/products/${id}`);
      if (!res.ok) {
        throw new Error("Product not found");
      }
      const data = await res.json();
      const formatted = {
        ...data,
        id: data._id || data.id,
        quantity: data.quantity !== undefined ? data.quantity : 10
      };
      setProduct(formatted);

      
      if (formatted.colors && formatted.colors.length > 0) {
        const firstColor = typeof formatted.colors[0] === "string"
          ? { name: formatted.colors[0], color: "#3b82f6" }
          : formatted.colors[0];
        setSelectedColor((prev) => prev || firstColor);
      }

      if (formatted.variants && formatted.variants.length > 0) {
        const firstVariant = typeof formatted.variants[0] === "string"
          ? { label: formatted.variants[0], priceDiff: 0 }
          : formatted.variants[0];
        setSelectedVariant((prev) => prev || firstVariant);
      }
    } catch (err) {
      console.error("Error loading product detail:", err);
      setError(err.message || "Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id, fetchProduct]);

  const executeDirectPurchase = useCallback(async () => {
    if (!product) return;

    const variantDiff = selectedVariant?.priceDiff || 0;
    const currentPrice = selectedVariant?.price
      ? selectedVariant.price
      : (product.price || 0) + variantDiff;

    const colorName = selectedColor?.name || (typeof selectedColor === "string" ? selectedColor : "");
    const variantLabel = selectedVariant?.label || selectedVariant?.name || (typeof selectedVariant === "string" ? selectedVariant : "");

    const variantString = [variantLabel, colorName].filter(Boolean).join(" • ");
    const displayName = variantString ? `${product.name} (${variantString})` : product.name;

    const token = getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    setBuying(true);

    try {
      const res = await fetch("http://localhost:5000/api/cart/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          items: [{
            id: product.id,
            name: displayName,
            price: currentPrice,
            quantity: 1
          }],
          totalPrice: currentPrice
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showNotification("error", data.message || "Purchase failed.");
        return;
      }

      
      showNotification("success", "🎉 Product has been purchased! Thank you for your order!");
      setPurchasedOrder({
        orderId: data.orderId,
        itemName: displayName,
        price: currentPrice
      });

      
      fetchProduct();
    } catch (err) {
      showNotification("error", "Network error placing order.");
    } finally {
      setBuying(false);
    }
  }, [product, selectedVariant, selectedColor, showNotification, fetchProduct]);

  async function handleAddToCart() {
    if (!product) return;

    if (product.quantity <= 0) {
      showNotification("error", "Product is out of stock!");
      return;
    }

    const existingInCart = cart.find((i) => i.id === product.id);
    const qtyInCart = existingInCart ? existingInCart.quantity : 0;
    if (qtyInCart + 1 > product.quantity) {
      showNotification(
        "error",
        `Only ${product.quantity} ${product.quantity === 1 ? "item is" : "items are"} available in stock!`
      );
      return;
    }

    const variantDiff = selectedVariant?.priceDiff || 0;
    const currentPrice = selectedVariant?.price
      ? selectedVariant.price
      : (product.price || 0) + variantDiff;

    const colorName = selectedColor?.name || (typeof selectedColor === "string" ? selectedColor : "");
    const variantLabel = selectedVariant?.label || selectedVariant?.name || (typeof selectedVariant === "string" ? selectedVariant : "");

    const variantString = [variantLabel, colorName].filter(Boolean).join(" • ");

    await addToCart(product, {
      price: currentPrice,
      variantString
    });
  }

  async function handleBuyNow() {
    if (!product) return;

    if (product.quantity <= 0) {
      showNotification("error", "Product is out of stock!");
      return;
    }

    if (!isAuthenticated()) {
      showNotification("error", "Please login to complete your purchase.");
      navigate("/login", {
        state: {
          from: `/products/${id}`,
          autoBuy: true,
          message: "Please log in to complete your purchase."
        }
      });
      return;
    }

    await executeDirectPurchase();
  }

  async function handleLogout() {
    await performLogout(navigate, "/products");
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

  const isOutOfStock = product.quantity !== undefined && product.quantity <= 0;

  
  const rawSpecs = product.specs || product.specifications || product.details || product.features;

 
  const rawColors = product.colors || product.colorOptions || [];
  const colorList = rawColors.map((c) =>
    typeof c === "string" ? { name: c, color: "#3b82f6" } : c
  );

 
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

    
      <div className="detail-breadcrumb">
        <span>Home</span> / <span>{product.category || "Store"}</span> / <span className="active">{product.name}</span>
      </div>

    
      <div className="detail-grid">
       
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

          
          <div style={{ marginTop: "12px", fontSize: "0.95rem", fontWeight: "bold" }}>
            {!isOutOfStock ? (
              <span style={{ color: "#059669" }}>📦 In Stock</span>
            ) : (
              <span style={{ color: "#dc2626" }}>❌ Out of Stock</span>
            )}
          </div>

         
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

         
          {variantList.length > 0 && (
            <div className="detail-option-group">
              <label className="option-label">Select Variant:</label>
              <div className="storage-options-list">
                {variantList.map((v, idx) => {
                  const vLabel = v.label || v.name || (typeof v === "string" ? v : `Option ${idx + 1}`);
                  const vPrice = v.price ? v.price : (product.price || 0) + (v.priceDiff || 0);
                  const isVariantOut = v.status === "out-of-stock" || isOutOfStock;
                  const isSelected = (activeVariant?.label === vLabel) || (activeVariant?.name === vLabel) || (activeVariant === v);

                  return (
                    <button
                      key={vLabel || idx}
                      disabled={isVariantOut}
                      className={`storage-card ${isSelected ? "selected" : ""} ${isVariantOut ? "disabled" : ""}`}
                      onClick={() => !isVariantOut && setSelectedVariant(v)}
                    >
                      <div className="storage-label">{vLabel}</div>
                      {!isVariantOut ? (
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

          
          <div className="detail-actions">
            {isOutOfStock ? (
              <>
                <button
                  disabled
                  className="btn-add-cart-detail"
                  style={{ backgroundColor: "#ef4444", color: "#fff", cursor: "not-allowed", border: "none" }}
                >
                  Out of Stock ❌
                </button>
                <button
                  disabled
                  className="btn-buy-now-detail"
                  style={{ backgroundColor: "#9ca3af", color: "#fff", cursor: "not-allowed", border: "none" }}
                >
                  Unavailable
                </button>
              </>
            ) : (
              <>
                <button className="btn-add-cart-detail" onClick={handleAddToCart}>
                  🛒 Add to Cart
                </button>
                <button className="btn-buy-now-detail" disabled={buying} onClick={handleBuyNow}>
                  {buying ? "Processing..." : `⚡ Buy Now at ₹${displayPrice ? displayPrice.toLocaleString() : 0}`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      
      {purchasedOrder && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            backdropFilter: "blur(4px)"
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "36px 28px",
              maxWidth: "460px",
              width: "90%",
              textAlign: "center",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
            }}
          >
            <div style={{ fontSize: "3.5rem", marginBottom: "12px" }}>🎉</div>
            <h2 style={{ color: "#065f46", margin: "0 0 10px", fontSize: "1.6rem" }}>
              Product Has Been Purchased! Thank You!
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "20px" }}>
              Your order has been placed successfully and product quantity has been reduced in database.
            </p>

            <div
              style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "10px",
                padding: "16px",
                textAlign: "left",
                marginBottom: "24px"
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "#166534", marginBottom: "6px" }}>
                <strong>Order ID:</strong> {purchasedOrder.orderId}
              </div>
              <div style={{ fontSize: "1rem", color: "#14532d", fontWeight: "bold", marginBottom: "6px" }}>
                {purchasedOrder.itemName}
              </div>
              <div style={{ fontSize: "0.95rem", color: "#15803d" }}>
                <strong>Total Amount Paid:</strong> ₹{purchasedOrder.price.toLocaleString()}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                className="btn-add"
                style={{ width: "100%", padding: "12px", fontSize: "1.05rem", borderRadius: "8px" }}
                onClick={() => setPurchasedOrder(null)}
              >
                Close & Continue 🛍️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetail;
