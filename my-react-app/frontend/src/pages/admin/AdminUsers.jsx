import { useState, useEffect } from "react";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    role: "user",
    age: "",
    country: "",
    phone: ""
  });
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchUsers(search);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  async function fetchUsers(query = "") {
    const token = localStorage.getItem("token");
    try {
      setLoading(true);
      const url = query
        ? `http://localhost:5000/api/users?search=${encodeURIComponent(query)}`
        : "http://localhost:5000/api/users";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch users");
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenEditModal(user) {
    setEditingUser(user);
    setEditFormData({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "user",
      age: user.age || "",
      country: user.country || "",
      phone: user.phone || ""
    });
  }

  async function handleSaveUser(e) {
    e.preventDefault();
    if (!editingUser) return;

    const token = localStorage.getItem("token");
    try {
      setSaveLoading(true);
      const res = await fetch(`http://localhost:5000/api/users/${editingUser._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editFormData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update user");

      setUsers(users.map((u) => (u._id === editingUser._id ? { ...u, ...editFormData } : u)));
      alert("User account updated successfully!");
      setEditingUser(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleDeleteUser(id, name) {
    if (!window.confirm(`Are you sure you want to delete user "${name}"?`)) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete user");

      setUsers(users.filter((u) => u._id !== id));
      alert("User deleted successfully!");
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2>User Account Management</h2>
            
            {/* User Search Bar */}
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Search users by name, email, role, phone, country..."
              style={{ width: "360px" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {error && (
            <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
              {error}
            </div>
          )}

          {loading ? (
            <p>Loading users...</p>
          ) : users.length === 0 ? (
            <p>No matching users found.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Phone / Country</th>
                    <th>Joined Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td style={{ fontWeight: "500" }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={u.role === "admin" ? "badge badge-info" : "badge badge-success"}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.88rem", color: "#475569" }}>
                        {u.phone ? `${u.phone} (${u.country || "N/A"})` : u.country || "N/A"}
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="btn btn-outline btn-sm"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u._id, u.name)}
                            className="btn btn-danger btn-sm"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Edit User Modal Pop-up */}
          {editingUser && (
            <div className="modal-backdrop" onClick={() => setEditingUser(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
                <div className="modal-header">
                  <h3>✏️ Edit User Details</h3>
                  <button className="close-btn" onClick={() => setEditingUser(null)}>&times;</button>
                </div>

                <form onSubmit={handleSaveUser}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Account Role</label>
                    <select
                      className="form-control"
                      value={editFormData.role}
                      onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    >
                      <option value="user">User / Customer</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="form-group">
                      <label>Age</label>
                      <input
                        type="number"
                        className="form-control"
                        value={editFormData.age}
                        onChange={(e) => setEditFormData({ ...editFormData, age: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Country</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editFormData.country}
                        onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ flex: 1, padding: "10px" }}
                      disabled={saveLoading}
                    >
                      {saveLoading ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => setEditingUser(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default AdminUsers;
