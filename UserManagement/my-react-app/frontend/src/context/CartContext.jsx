import { createContext, useContext, useState, useEffect, useCallback } from "react";

const CartContext = createContext();

function getStorageKey(user) {
  if (user && (user.id || user._id)) {
    return `cart_${user.id || user._id}`;
  }
  return "guest_cart";
}

function loadCartForUser(user) {
  try {
    const key = getStorageKey(user);
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);

    // One-time backward-compatibility migration for legacy "student_cart"
    if (user) {
      const legacy = localStorage.getItem("student_cart");
      if (legacy) {
        localStorage.removeItem("student_cart");
        return JSON.parse(legacy);
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const u = localStorage.getItem("user");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  const [cart, setCart] = useState(() => loadCartForUser(currentUser));

  // Seamlessly switch active cart on login or logout
  const switchUser = useCallback((newUser) => {
    setCurrentUser(newUser);

    if (newUser) {
      // 1. User logged in: Load their saved personal cart
      const userKey = getStorageKey(newUser);
      let existingUserCart = [];
      try {
        const saved = localStorage.getItem(userKey);
        if (saved) existingUserCart = JSON.parse(saved);
      } catch {}

      // If they had items in a guest cart before logging in, merge them in
      let guestItems = [];
      try {
        const guestSaved = localStorage.getItem("guest_cart");
        if (guestSaved) {
          guestItems = JSON.parse(guestSaved);
          localStorage.removeItem("guest_cart");
        }
      } catch {}

      const mergedCart = [...existingUserCart];
      if (guestItems.length > 0) {
        guestItems.forEach((gItem) => {
          const gId = gItem._id || gItem.id;
          const found = mergedCart.find((uItem) => (uItem._id || uItem.id) === gId);
          if (found) {
            found.quantity += gItem.quantity;
          } else {
            mergedCart.push(gItem);
          }
        });
      }

      setCart(mergedCart);
      localStorage.setItem(userKey, JSON.stringify(mergedCart));
    } else {
      // 2. User logged out: Reset in-memory cart to empty guest cart
      setCart([]);
      localStorage.removeItem("guest_cart");
      localStorage.removeItem("student_cart");
    }
  }, []);

  // Persist cart items whenever cart or currentUser changes
  useEffect(() => {
    const key = getStorageKey(currentUser);
    localStorage.setItem(key, JSON.stringify(cart));
  }, [cart, currentUser]);

  // Synchronize across browser tabs when authentication changes
  useEffect(() => {
    function handleStorageChange(e) {
      if (e.key === "user") {
        try {
          const updatedUser = e.newValue ? JSON.parse(e.newValue) : null;
          switchUser(updatedUser);
        } catch {}
      }
    }
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [switchUser]);

  function addToCart(product, quantity = 1) {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => (item._id || item.id) === (product._id || product.id));
      if (existing) {
        return prevCart.map((item) =>
          (item._id || item.id) === (product._id || product.id)
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevCart, { ...product, quantity }];
    });
  }

  function updateQuantity(productId, quantity) {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        (item._id || item.id) === productId ? { ...item, quantity } : item
      )
    );
  }

  function removeFromCart(productId) {
    setCart((prevCart) =>
      prevCart.filter((item) => (item._id || item.id) !== productId)
    );
  }

  function clearCart() {
    setCart([]);
    const key = getStorageKey(currentUser);
    localStorage.removeItem(key);
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        switchUser
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
