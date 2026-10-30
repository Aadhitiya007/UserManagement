import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { API_URL } from "../config/api";
import { throttle } from "../utils/throttle";

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Verified Buyer & Review States
  const [canReview, setCanReview] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProductDetails();
    checkPurchaseEligibility();
  }, [id]);

  async function fetchProductDetails() {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/products/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Product not found");
      setProduct(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkPurchaseEligibility() {
    const token = localStorage.getItem("token");
    if (!token) {
      setCanReview(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/products/${id}/can-review`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.canReview) {
        setCanReview(true);
      } else {
        setCanReview(false);
      }
    } catch {
      setCanReview(false);
    }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login to submit a review.");
      navigate("/login");
      return;
    }

    if (!comment.trim()) {
      setReviewMessage("Please enter a review comment.");
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewMessage("");
      const res = await fetch(`${API_URL}/api/products/${id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rating: userRating, comment: comment.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit review");

      setProduct(data.product);
      setComment("");
      setReviewMessage("🎉 Thank you! Your review has been published.");
    } catch (err) {
      setReviewMessage(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container">
          <p style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>Loading product details...</p>
        </div>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <Navbar />
        <div className="container">
          <p style={{ color: "#ef4444", padding: "40px 0", textAlign: "center" }}>{error || "Product not found"}</p>
        </div>
      </>
    );
  }

  const imageUrl = product.imageUrl || product.image || "https://via.placeholder.com/400x300?text=No+Image";
  const isOutOfStock = Number(product.stock) <= 0;
  const isLowStock = !isOutOfStock && Number(product.stock) <= (product.lowStockThreshold || 5);

  const hasProductDiscount = Boolean(product.isDiscountActive && product.discountAmount > 0);
  const effectivePrice = product.effectivePrice !== undefined ? product.effectivePrice : product.price;
  const originalMRP = product.mrp || Math.round(product.price * 1.25);

  const reviewsList = product.reviews || [];
  const avgRating = product.rating || (reviewsList.length > 0 ? (reviewsList.reduce((acc, r) => acc + r.rating, 0) / reviewsList.length).toFixed(1) : 4.5);
  const totalReviews = product.reviewsCount || reviewsList.length;
  const warranty = product.warranty || "1 Year Manufacturer Warranty";

  const handleAddToCart = throttle(() => {
    if (isOutOfStock) return;
    addToCart(product, quantity);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  }, 800);

  async function handleBuyNow() {
    if (isOutOfStock) return;
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login to purchase items directly.");
      navigate("/login");
      return;
    }
    try {
      setBuying(true);
      const res = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          products: [
            {
              productId: product._id || product.id,
              name: product.name,
              price: effectivePrice,
              quantity: quantity,
              image: product.image || ""
            }
          ]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to place order");
      const orderId = data.order?._id || data.order?.id;
      navigate(`/payment/${orderId}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setBuying(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <Link to="/products" className="btn btn-outline btn-sm" style={{ marginBottom: "20px" }}>
          ← Back to Products
        </Link>

        {/* Product Details Grid */}
        <div className="product-detail-grid">
          {/* Left Column: Image & Product Specifications */}
          <div>
            <div style={{ position: "relative", borderRadius: "8px", overflow: "hidden", background: "#f8fafc" }}>
              <img
                src={imageUrl}
                alt={product.name}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "https://via.placeholder.com/400x300?text=No+Image";
                }}
                style={{
                  width: "100%",
                  maxHeight: "380px",
                  objectFit: "cover",
                  filter: isOutOfStock ? "grayscale(40%)" : "none"
                }}
              />
              {isOutOfStock && (
                <div style={{ position: "absolute", top: "16px", left: "16px" }}>
                  <span className="stock-badge-out" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
                    ● OUT OF STOCK
                  </span>
                </div>
              )}
              {hasProductDiscount && !isOutOfStock && (
                <div style={{ position: "absolute", top: "16px", right: "16px" }}>
                  <span className="sale-badge" style={{ fontSize: "0.85rem", padding: "4px 10px" }}>
                    SALE - {product.discountPercent}% OFF
                  </span>
                </div>
              )}
            </div>

            <div className="specs-container">
              <h3 className="specs-title">Product Specifications</h3>
              <table className="specs-table">
                <tbody>
                  <tr>
                    <td className="spec-key">Product Name</td>
                    <td className="spec-val">{product.name}</td>
                  </tr>
                  <tr>
                    <td className="spec-key">Category</td>
                    <td className="spec-val">{product.category}</td>
                  </tr>
                  <tr>
                    <td className="spec-key">Inventory Status</td>
                    <td className="spec-val">
                      {isOutOfStock ? (
                        <span className="stock-badge-out">Out of Stock</span>
                      ) : isLowStock ? (
                        <span className="stock-badge-low">Low Stock ({product.stock} available)</span>
                      ) : (
                        <span className="stock-badge-in">In Stock ({product.stock} units)</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="spec-key">Warranty</td>
                    <td className="spec-val">{warranty}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Pricing, Rating, Action Buttons */}
          <div>
            <span style={{ textTransform: "uppercase", color: "#6b7280", fontSize: "0.85rem", fontWeight: "600" }}>
              {product.category}
            </span>
            <h1 style={{ fontSize: "1.8rem", margin: "8px 0" }}>{product.name}</h1>

            {/* Dynamic Rating & Review Badge */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
              <span className="rating-badge">
                {avgRating} ★
              </span>
              <span className="rating-count">{totalReviews} Customer Rating{totalReviews !== 1 ? "s" : ""}</span>
            </div>

            {/* Pricing Breakdown */}
            <div className="price-container" style={{ margin: "14px 0" }}>
              {hasProductDiscount ? (
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                  <span className="selling-price" style={{ fontSize: "1.9rem", color: "#0f172a", fontWeight: 800 }}>
                    ₹{effectivePrice.toLocaleString("en-IN")}
                  </span>
                  <span className="strikethrough-price" style={{ fontSize: "1.1rem" }}>
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                  <span className="discount-pill" style={{ fontSize: "0.88rem", padding: "4px 8px" }}>
                    {product.discountPercent}% OFF
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                  <span className="selling-price" style={{ fontSize: "1.9rem", color: "#0f172a", fontWeight: 800 }}>
                    ₹{product.price.toLocaleString("en-IN")}
                  </span>
                  {originalMRP > product.price && (
                    <>
                      <span className="strikethrough-price">₹{originalMRP.toLocaleString("en-IN")}</span>
                      <span className="discount-badge">
                        {Math.round(((originalMRP - product.price) / originalMRP) * 100)}% off
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Stock Availability Badge */}
            <div style={{ marginBottom: "20px" }}>
              {isOutOfStock ? (
                <div style={{ padding: "10px 14px", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "6px", color: "#b91c1c", fontWeight: 600 }}>
                  ⚠️ This product is currently OUT OF STOCK and cannot be ordered right now.
                </div>
              ) : isLowStock ? (
                <div style={{ padding: "8px 12px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "6px", color: "#b45309", fontWeight: 600 }}>
                  ⚡ Only {product.stock} left in stock - order soon!
                </div>
              ) : (
                <div style={{ color: "#16a34a", fontWeight: 600, fontSize: "0.95rem" }}>
                  ✓ In Stock ({product.stock} units available)
                </div>
              )}
            </div>

            <p style={{ color: "#4b5563", marginBottom: "20px", lineHeight: "1.7" }}>
              {product.description || "No description provided."}
            </p>

            {/* Trust Badges */}
            <div className="trust-badges-grid">
              <div className="trust-item">
                <span className="icon">🔄</span>
                <span>7 Days Replacement</span>
              </div>
              <div className="trust-item">
                <span className="icon">💵</span>
                <span>Cash on Delivery</span>
              </div>
              <div className="trust-item">
                <span className="icon">🛡️</span>
                <span>{warranty}</span>
              </div>
            </div>

            {/* Quantity Selector: Clamped to available stock */}
            {!isOutOfStock && (
              <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
                <label style={{ fontWeight: "600", color: "#334155" }}>Quantity:</label>
                <input
                  type="number"
                  min="1"
                  max={product.stock}
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 1;
                    setQuantity(Math.max(1, Math.min(product.stock, val)));
                  }}
                  className="form-control"
                  style={{ width: "90px", fontWeight: "bold" }}
                />
                <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Max available: {product.stock}</span>
              </div>
            )}

            {/* Action Buttons */}
            {isOutOfStock ? (
              <div style={{ marginTop: "15px" }}>
                <button
                  type="button"
                  disabled
                  className="btn btn-out-of-stock"
                  style={{ width: "100%", padding: "14px", fontSize: "1rem" }}
                  aria-disabled="true"
                >
                  Out of Stock - Currently Unavailable
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "12px", marginTop: "15px" }}>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={`btn ${addedFeedback ? "btn-success" : "btn-outline"}`}
                  style={{
                    flex: 1,
                    padding: "12px",
                    transition: "all 0.25s ease",
                    background: addedFeedback ? "#16a34a" : "",
                    color: addedFeedback ? "#ffffff" : "",
                    borderColor: addedFeedback ? "#16a34a" : ""
                  }}
                >
                  {addedFeedback ? "✓ Added to Cart!" : "🛒 Add to Cart"}
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={buying}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: "12px", background: "#f59e0b", borderColor: "#d97706", color: "#000", fontWeight: "bold" }}
                >
                  {buying ? "Processing..." : "⚡ Buy Now"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="reviews-section">
          <h2 style={{ marginBottom: "16px", color: "#1e293b" }}>Customer Ratings & Reviews</h2>

          <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "8px", marginBottom: "30px", border: "1px solid #e2e8f0" }}>
            {canReview ? (
              <form onSubmit={handleSubmitReview}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ fontSize: "1.1rem" }}>Write a Review</h3>
                  <span className="verified-buyer-badge">✔ Verified Buyer</span>
                </div>

                {reviewMessage && (
                  <div style={{ padding: "10px", margin: "12px 0", borderRadius: "6px", background: reviewMessage.includes("🎉") ? "#dcfce7" : "#fee2e2", color: reviewMessage.includes("🎉") ? "#166534" : "#991b1b", fontSize: "0.9rem" }}>
                    {reviewMessage}
                  </div>
                )}

                <div style={{ margin: "12px 0" }}>
                  <label style={{ fontWeight: "500", fontSize: "0.9rem" }}>Select Rating:</label>
                  <div className="star-rating-input">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`star ${star <= userRating ? "active" : ""}`}
                        onClick={() => setUserRating(star)}
                      >
                        ★
                      </span>
                    ))}
                    <span style={{ fontSize: "1rem", color: "#475569", marginLeft: "10px" }}>
                      ({userRating} / 5 Stars)
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: "500", fontSize: "0.9rem" }}>Your Feedback:</label>
                  <textarea
                    rows="3"
                    className="form-control"
                    placeholder="Share your experience with this product..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={reviewSubmitting}>
                  {reviewSubmitting ? "Submitting..." : "Submit Review"}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: "center", color: "#6b7280", padding: "10px 0" }}>
                🔒 <strong>Verified Purchaser Review Only</strong>: You must purchase this item to write a review. All visitors can read reviews below!
              </div>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", color: "#334155" }}>
              All Reviews ({reviewsList.length})
            </h3>

            {reviewsList.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>No reviews submitted yet. Be the first verified buyer to review this product!</p>
            ) : (
              reviewsList.map((rev) => (
                <div key={rev._id || rev.createdAt} className="review-card">
                  <div className="review-header">
                    <div>
                      <strong style={{ color: "#0f172a" }}>{rev.userName}</strong>
                      <span className="verified-buyer-badge">✔ Verified Buyer</span>
                    </div>
                    <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ color: "#f59e0b", fontSize: "1rem", margin: "4px 0" }}>
                    {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
                    <span style={{ color: "#475569", fontSize: "0.88rem", marginLeft: "8px", fontWeight: "bold" }}>
                      {rev.rating} / 5
                    </span>
                  </div>

                  <p style={{ color: "#334155", fontSize: "0.95rem", marginTop: "6px" }}>
                    {rev.comment}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default ProductDetail;
