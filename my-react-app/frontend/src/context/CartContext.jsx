import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { logout, getToken, isAuthenticated } from "../services/authService";

const CartContext = createContext();

export function getUserCartKey() {
  const userEmail = localStorage.getItem("userEmail");
  return userEmail ? `userCart_${userEmail}` : null;
}

export function getStoredUserCart() {
  if (!isAuthenticated()) {
    return [];
  }
  const key = getUserCartKey();
  if (!key) return [];
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => getStoredUserCart());
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const loadUserCart = useCallback(() => {
    const userCart = getStoredUserCart();
    setCart(userCart);
  }, []);

  // Sync cart to user-specific localStorage whenever cart updates while logged in
  useEffect(() => {
    if (isAuthenticated()) {
      const key = getUserCartKey();
      if (key) {
        localStorage.setItem(key, JSON.stringify(cart));
      }
    }
  }, [cart]);

  async function addToCart(product, options = {}) {
    const token = getToken();
    const productId = product.id || product._id;
    const itemPrice = options.price !== undefined ? options.price : product.price;
    const variantName = options.variantString ? ` (${options.variantString})` : "";
    const displayName = product.name + variantName;

    try {
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      await fetch("http://localhost:5000/api/cart/add", {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId,
          name: displayName,
          price: itemPrice
        })
      });
    } catch (err) {
      console.warn("Backend add to cart notice:", err);
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === productId);
      const maxStock = product.quantity !== undefined ? product.quantity : 10;
      if (existing) {
        return prev.map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity + 1, maxStock } : item
        );
      }
      return [
        ...prev,
        { ...product, id: productId, name: displayName, price: itemPrice, quantity: 1, maxStock }
      ];
    });

    showNotification("success", `Added "${displayName}" to cart!`);
  }

  async function updateQuantity(productId, change) {
    let targetItem = null;
    let newQty = 0;
    let limitExceeded = false;
    let availableStock = 0;

    setCart((prevCart) => {
      targetItem = prevCart.find((i) => i.id === productId);
      if (!targetItem) return prevCart;

      const maxStock = targetItem.maxStock !== undefined ? targetItem.maxStock : (targetItem.quantity || 10);
      if (change > 0 && targetItem.quantity + change > maxStock) {
        limitExceeded = true;
        availableStock = maxStock;
        return prevCart;
      }

      newQty = targetItem.quantity + change;
      return prevCart
        .map((i) => (i.id === productId ? { ...i, quantity: newQty } : i))
        .filter((i) => i.quantity > 0);
    });

    if (limitExceeded) {
      if (availableStock <= 0) {
        showNotification("error", "Product is out of stock!");
      } else {
        showNotification("error", `Only ${availableStock} ${availableStock === 1 ? "item is" : "items are"} available in stock!`);
      }
      return;
    }

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
          newQuantity: newQty
        })
      });
    } catch (err) {
      console.warn("Backend cart update notice:", err);
    }

    if (targetItem) {
      showNotification("success", `Updated quantity for "${targetItem.name}".`);
    }
  }

  async function removeFromCart(productId) {
    let targetItem = null;
    setCart((prevCart) => {
      targetItem = prevCart.find((i) => i.id === productId);
      return prevCart.filter((i) => i.id !== productId);
    });

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

    showNotification("success", `Removed "${targetItem ? targetItem.name : "Item"}" from cart.`);
  }

  async function performLogout(navigate, fromPath = "") {
    await logout();
    setCart([]); // Empty UI cart on logout
    if (fromPath === "/cart" || window.location.pathname === "/cart") {
      navigate("/products");
    } else {
      navigate("/products");
    }
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        setCart,
        addToCart,
        updateQuantity,
        removeFromCart,
        loadUserCart,
        performLogout,
        notification,
        setNotification,
        showNotification
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
