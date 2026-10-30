import { Navigate } from "react-router-dom";
import { isTokenExpired, clearAuthAndRedirect } from "../utils/auth";

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!token || isTokenExpired(token)) {
    if (token) {
      clearAuthAndRedirect();
    }
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    return <Navigate to="/products" replace />;
  }

  return children;
}

export default ProtectedRoute;
