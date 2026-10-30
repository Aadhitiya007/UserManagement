import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { API_URL } from "../config/api";

function Cart() {
  const { cart, updateQuantity, removeFromCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");

  // Calculate pricing breakdown
  const originalSubtotal = cart.reduce((sum, item) => {
    const origPrice = Number(item.originalPrice || item.price) || 0;
    return sum + origPrice * item.quantity;
  }, 0);

  const subtotalAfterProductDiscount = cart.reduce((sum, item) => {
    const effPrice = Number(item.effectivePrice !== undefined ? item.effectivePrice : item.price) || 0;
    return sum + effPrice * item.quantity;
  }, 0);

  const productDiscountTotal = Math.max(0, originalSubtotal - subtotalAfterProductDiscount);
  const finalPayable = Math.max(0, subtotalAfterProductDiscount - couponDiscount);

  // Check if any cart item is out of stock
  const hasOutOfStockItem = cart.some((item) => typeof item.stock === "number" && item.stock <= 0);

  async function handleApplyCoupon(e) {
    e.preventDefault();
    if (!couponInput.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please login to apply coupon discounts.");
      return;
    }

    try {
      setCouponLoading(true);
      setCouponMessage("");
      setError("");

      const res = await fetch(`${API_URL}/api/coupons/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: couponInput.trim().toUpperCase(),
          subtotal: subtotalAfterProductDiscount
        })
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.message || "Invalid coupon code");
      }

      setAppliedCoupon(data.coupon);
      setCouponDiscount(data.discountAmount || 0);
      setCouponMessage(`🎉 ${data.message} Saved ₹${data.discountAmount.toLocaleString("en-IN")}`);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponDiscount(0);
      setCouponMessage(err.message);
    } finally {
      setCouponLoading(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponInput("");
    setCouponMessage("");
  }

  async function handleCheckout() {
    if (loading) return;

    if (hasOutOfStockItem) {
      setError("Please remove out-of-stock items from your cart before proceeding.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (cart.length === 0) return;

    try {
      setLoading(true);
      setError("");

      const orderProducts = cart.map((item) => ({
        productId: item._id || item.id,
        name: item.name,
        price: item.effectivePrice !== undefined ? item.effectivePrice : item.price,
        quantity: item.quantity,
        image: item.image || ""
      }));

      const res = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          products: orderProducts,
          couponCode: appliedCoupon ? appliedCoupon.code : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to place order");
      }

      // Retain cart items until payment succeeds so user can return to cart safely
      const orderId = data.order?._id || data.order?.id;
      navigate(`/payment/${orderId}`);
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
        <h2 style={{ marginBottom: "20px", fontSize: "1.4rem", fontWeight: 700 }}>Shopping Cart</h2>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {hasOutOfStockItem && (
          <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px", border: "1px solid #fecaca", fontWeight: 600 }}>
            ⚠️ One or more items in your cart are currently OUT OF STOCK. Please remove them to proceed with checkout.
          </div>
        )}

        {cart.length === 0 ? (
          <div style={{ background: "white", padding: "40px 20px", textAlign: "center", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: "1.1rem", color: "#6b7280", marginBottom: "20px" }}>Your cart is empty.</p>
            <Link to="/products" className="btn btn-primary">
              Browse Products
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }} className="cart-layout-grid">
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Subtotal</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => {
                    const id = item._id || item.id;
                    const imageUrl = item.imageUrl || item.image || "https://via.placeholder.com/100x100?text=No+Image";
                    const isItemOutOfStock = typeof item.stock === "number" && item.stock <= 0;
                    const isAtMaxStock = typeof item.stock === "number" && item.quantity >= item.stock;
                    const itemPrice = item.effectivePrice !== undefined ? item.effectivePrice : item.price;

                    return (
                      <tr key={id} style={{ background: isItemOutOfStock ? "#fff5f5" : "inherit" }}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <img
                              src={imageUrl}
                              alt={item.name}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = "https://via.placeholder.com/60?text=No+Img";
                              }}
                              style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "4px", flexShrink: 0 }}
                            />
                            <div>
                              <span style={{ fontWeight: "600", display: "block" }}>{item.name}</span>
                              {isItemOutOfStock ? (
                                <span className="stock-badge-out" style={{ marginTop: "4px" }}>● Out of Stock</span>
                              ) : (
                                typeof item.stock === "number" && item.stock <= 5 && (
                                  <span className="stock-badge-low" style={{ marginTop: "4px" }}>Only {item.stock} left</span>
                                )
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div>
                            <span style={{ fontWeight: "600" }}>₹{itemPrice.toLocaleString("en-IN")}</span>
                            {item.originalPrice && item.originalPrice > itemPrice && (
                              <div style={{ fontSize: "0.8rem", textDecoration: "line-through", color: "#94a3b8" }}>
                                ₹{item.originalPrice.toLocaleString("en-IN")}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => updateQuantity(id, item.quantity - 1)}
                              className="btn btn-outline btn-sm"
                              style={{ minWidth: "36px", minHeight: "36px", padding: 0 }}
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <span style={{ padding: "0 8px", fontWeight: "600" }}>{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(id, item.quantity + 1)}
                              disabled={isAtMaxStock || isItemOutOfStock}
                              className="btn btn-outline btn-sm"
                              style={{ minWidth: "36px", minHeight: "36px", padding: 0 }}
                              aria-label="Increase quantity"
                              title={isAtMaxStock ? "Max available stock reached" : "Increase quantity"}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ fontWeight: "600", color: "#2563eb" }}>
                          ₹{(itemPrice * item.quantity).toLocaleString("en-IN")}
                        </td>
                        <td>
                          <button onClick={() => removeFromCart(id)} className="btn btn-danger btn-sm">
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Right Column: Order Summary & Coupon Code Box */}
            <div style={{ background: "white", padding: "24px", borderRadius: "8px", border: "1px solid #e2e8f0", height: "fit-content" }}>
              <h3 style={{ marginBottom: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", fontSize: "1.1rem" }}>
                Order Summary
              </h3>

              {/* Coupon Code Section */}
              <div className="coupon-box">
                <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#475569" }}>
                  Have a Promo / Coupon Code?
                </label>
                {!appliedCoupon ? (
                  <form onSubmit={handleApplyCoupon} className="coupon-input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. WELCOME10"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      style={{ textTransform: "uppercase" }}
                    />
                    <button
                      type="submit"
                      disabled={couponLoading || !couponInput.trim()}
                      className="btn btn-primary btn-sm"
                    >
                      {couponLoading ? "..." : "Apply"}
                    </button>
                  </form>
                ) : (
                  <div className="coupon-applied-pill">
                    <div>
                      <strong style={{ color: "#166534" }}>{appliedCoupon.code}</strong>
                      <span style={{ fontSize: "0.82rem", color: "#15803d", marginLeft: "6px" }}>
                        (-₹{couponDiscount.toLocaleString("en-IN")})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="btn btn-outline btn-sm"
                      style={{ padding: "2px 8px", fontSize: "0.75rem", borderColor: "#fca5a5", color: "#dc2626" }}
                    >
                      Remove
                    </button>
                  </div>
                )}
                {couponMessage && (
                  <p style={{
                    fontSize: "0.82rem",
                    margin: "6px 0 0",
                    color: couponMessage.includes("🎉") ? "#16a34a" : "#dc2626"
                  }}>
                    {couponMessage}
                  </p>
                )}
              </div>

              {/* Price Breakdown */}
              <div style={{ fontSize: "0.95rem", color: "#475569" }}>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0" }}>
                  <span>Original Subtotal:</span>
                  <span>₹{originalSubtotal.toLocaleString("en-IN")}</span>
                </div>

                {productDiscountTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0", color: "#16a34a" }}>
                    <span>Product Discounts:</span>
                    <span>-₹{productDiscountTotal.toLocaleString("en-IN")}</span>
                  </div>
                )}

                {couponDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0", color: "#16a34a" }}>
                    <span>Coupon ({appliedCoupon?.code}):</span>
                    <span>-₹{couponDiscount.toLocaleString("en-IN")}</span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0" }}>
                  <span>Shipping & Delivery:</span>
                  <span style={{ color: "#16a34a", fontWeight: "600" }}>FREE</span>
                </div>

                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "16px",
                  paddingTop: "14px",
                  borderTop: "2px solid #e2e8f0",
                  fontSize: "1.25rem",
                  fontWeight: "bold",
                  color: "#0f172a"
                }}>
                  <span>Final Payable:</span>
                  <span style={{ color: "#2563eb" }}>₹{finalPayable.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                className="btn btn-primary"
                style={{ width: "100%", padding: "14px", marginTop: "16px", fontSize: "1rem" }}
                disabled={loading || hasOutOfStockItem}
              >
                {loading ? "Placing Order..." : hasOutOfStockItem ? "Remove Unavailable Items" : "Proceed to Checkout"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Cart;
