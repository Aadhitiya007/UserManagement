import { createContext, useContext, useState, useEffect } from "react";
import { useCart } from "./CartContext";

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem("solstice_wishlist");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const { addToCart } = useCart();

  useEffect(() => {
    try {
      localStorage.setItem("solstice_wishlist", JSON.stringify(wishlist));
    } catch (err) {
      console.error("Failed to save wishlist:", err);
    }
  }, [wishlist]);

  function isInWishlist(productId) {
    if (!productId) return false;
    return wishlist.some((item) => String(item._id || item.id) === String(productId));
  }

  function addToWishlist(product) {
    if (!product) return;
    const prodId = product._id || product.id;
    if (isInWishlist(prodId)) return;

    setWishlist((prev) => [
      ...prev,
      {
        _id: prodId,
        id: prodId,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl || product.image || "https://via.placeholder.com/300x180?text=Solstice+Artisan",
        category: product.category || "Seasonal Drops",
        stock: product.stock !== undefined ? product.stock : 10,
        discount: product.discount || null
      }
    ]);
  }

  function removeFromWishlist(productId) {
    setWishlist((prev) => prev.filter((item) => String(item._id || item.id) !== String(productId)));
  }

  function toggleWishlist(product) {
    if (!product) return;
    const prodId = product._id || product.id;
    if (isInWishlist(prodId)) {
      removeFromWishlist(prodId);
      return false; // Removed
    } else {
      addToWishlist(product);
      return true; // Added
    }
  }

  function moveToCart(product) {
    if (!product) return;
    const prodId = product._id || product.id;
    addToCart(product, 1);
    removeFromWishlist(prodId);
  }

  function clearWishlist() {
    setWishlist([]);
  }

  const wishlistCount = wishlist.length;

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        wishlistCount,
        isInWishlist,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        moveToCart,
        clearWishlist,
        isWishlistOpen,
        setIsWishlistOpen
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
