import { NavLink } from "react-router-dom";

function AdminSidebar() {
  return (
    <aside className="admin-sidebar">
      <h3>Admin Panel</h3>
      <nav>
        <NavLink to="/admin/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
          📊 Dashboard
        </NavLink>
        <NavLink to="/admin/products" className={({ isActive }) => (isActive ? "active" : "")}>
          📦 Products
        </NavLink>
        <NavLink to="/admin/products/add" className={({ isActive }) => (isActive ? "active" : "")}>
          ➕ Add Product
        </NavLink>
        <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? "active" : "")}>
          🛒 Customer Orders
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>
          👥 Users
        </NavLink>
      </nav>
    </aside>
  );
}

export default AdminSidebar;
