import { Navigate } from "react-router-dom";
import { isAuthenticated, getUserRole } from "../services/authService";

function ProtectedRoute({ children, allowedRoles }) {
    if (!isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }

    const role = getUserRole();

    if (allowedRoles && !allowedRoles.includes(role)) {
        if (role === "user") {
            return <Navigate to="/products" replace />;
        }
        return <Navigate to="/users" replace />;
    }

    return children;
}

export default ProtectedRoute;