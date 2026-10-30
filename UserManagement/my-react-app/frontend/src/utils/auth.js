/**
 * Utility functions for authentication checks and auto-logout handling.
 */

export function isTokenExpired(token) {
  if (!token || typeof token !== "string") return true;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;

    // Base64Url decode payload
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    const payload = JSON.parse(jsonPayload);
    if (!payload || !payload.exp) return false;

    // payload.exp is in seconds; Date.now() is in milliseconds
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function clearAuthAndRedirect() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("student_cart");

  // Broadcast storage change event so CartContext and Navbar update in other tabs / listeners
  window.dispatchEvent(new Event("storage"));

  // Only redirect if not already on the login or signup page
  const currentPath = window.location.pathname;
  if (currentPath !== "/login" && currentPath !== "/signup") {
    window.location.href = "/login";
  }
}

/**
 * Custom fetch wrapper that automatically handles 401/403 token expiration responses.
 */
export async function authFetch(url, options = {}) {
  const token = localStorage.getItem("token");

  // If token is locally detected as expired prior to fetch, clear and redirect immediately
  if (token && isTokenExpired(token)) {
    clearAuthAndRedirect();
    throw new Error("Session expired. Please log in again.");
  }

  const headers = {
    ...(options.headers || {})
  };

  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401 || response.status === 403) {
    // Clone response to inspect body without consuming the original body stream
    try {
      const cloned = response.clone();
      const data = await cloned.json();
      const message = (data?.message || "").toLowerCase();

      // Trigger redirect on expired, invalid, or missing token
      if (
        message.includes("token") ||
        message.includes("access denied") ||
        message.includes("unauthorized") ||
        message.includes("expired")
      ) {
        clearAuthAndRedirect();
      }
    } catch {
      // If not JSON, clear and redirect on 401/403
      if (response.status === 401) {
        clearAuthAndRedirect();
      }
    }
  }

  return response;
}

