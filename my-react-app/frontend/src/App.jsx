import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import UserTable from "./pages/UserTable";
import UserForm from "./pages/UserForm";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/cart";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

       
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <UserTable />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/add"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <UserForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/edit/:id"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <UserForm />
            </ProtectedRoute>
          }
        />

        
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />

        
        <Route
          path="*"
          element={<Navigate to="/products" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;