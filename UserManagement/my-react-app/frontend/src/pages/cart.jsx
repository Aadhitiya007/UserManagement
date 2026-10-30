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

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  async function handleCheckout() {
    if (loading) return;

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
        price: item.price,
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
          totalAmount: totalAmount
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

                    return (
                      <tr key={id}>
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
                            <span style={{ fontWeight: "500" }}>{item.name}</span>
                          </div>
                        </td>
                        <td>₹{item.price}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                              onClick={() => updateQuantity(id, item.quantity - 1)}
                              className="btn btn-outline btn-sm"
                              style={{ minWidth: "36px", minHeight: "36px", padding: 0 }}
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <span style={{ padding: "0 8px", fontWeight: "600" }}>{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(id, item.quantity + 1)}
                              className="btn btn-outline btn-sm"
                              style={{ minWidth: "36px", minHeight: "36px", padding: 0 }}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ fontWeight: "600", color: "#2563eb" }}>₹{item.price * item.quantity}</td>
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

            <div style={{ background: "white", padding: "20px", borderRadius: "8px", border: "1px solid #e2e8f0", height: "fit-content" }}>
              <h3 style={{ marginBottom: "15px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", fontSize: "1.1rem" }}>
                Order Summary
              </h3>

              <div style={{ display: "flex", justifyContent: "space-between", margin: "15px 0", fontSize: "1.2rem", fontWeight: "bold" }}>
                <span>Total Amount:</span>
                <span style={{ color: "#2563eb" }}>₹{totalAmount}</span>
              </div>

              <button
                onClick={handleCheckout}
                className="btn btn-primary"
                style={{ width: "100%", padding: "12px", marginTop: "10px" }}
                disabled={loading}
              >
                {loading ? "Placing Order..." : "Place Order"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Cart;
