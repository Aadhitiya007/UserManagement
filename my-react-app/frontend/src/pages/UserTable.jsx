import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getUsers,
  deleteUser,
  deleteAllUsers,
  uploadUsersFromFile,
  exportUsersToFile,
  downloadUserTemplate
} from "../services/userService";
import { logout } from "../services/authService";

function UserTable() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const limit = 10;

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  async function loadUsers(searchTerm = search, page = currentPage) {
    try {
      const data = await getUsers(searchTerm, page, limit);
      setUsers(data.users || []);
      setTotalPages(data.totalPages || 1);
      setTotalUsers(data.totalUsers || 0);
      if (data.currentPage) setCurrentPage(data.currentPage);
    } catch (error) {
      console.error(error);
    }
  }

  function searchUsers(value) {
    setSearch(value);
    setCurrentPage(1);
  }

  async function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const res = await uploadUsersFromFile(file);
      alert(res.message || "Users imported successfully");
      await loadUsers(search, 1);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to import file");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleExport() {
    try {
      await exportUsersToFile();
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to export users");
    }
  }

  async function handleDownloadTemplate() {
    try {
      await downloadUserTemplate();
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to download template");
    }
  }

 
  async function handleDeleteSingle(id) {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser(id);
      await loadUsers(search, currentPage);
    } catch (error) {
      console.error(error);
    }
  }

 
  async function handleDeleteAllDatabaseUsers() {
    if (!confirm("⚠️ WARNING: Are you sure you want to delete ALL users from the database? This action cannot be undone!")) return;
    try {
      const res = await deleteAllUsers();
      alert(res.message || "All users deleted successfully");
      await loadUsers("", 1);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to delete all users");
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(search, currentPage);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, currentPage]);

  return (
    <div>
      <div className="table-header">
        <h1>Users</h1>
        <div className="table-header-actions">
          <input
            type="file"
            ref={fileInputRef}
            accept=".json,.csv,.pdf"
            className="hidden-file-input"
            onChange={handleFileImport}
          />
          <button
            className="btn-edit"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? "Importing..." : "Import File"}
          </button>
          <button
            className="btn-edit"
            onClick={handleDownloadTemplate}
          >
            Download Template
          </button>
          <button
            className="btn-edit"
            onClick={handleExport}
            disabled={totalUsers === 0}
          >
            Export CSV
          </button>
          <button
            className="btn-delete"
            onClick={handleDeleteAllDatabaseUsers}
            disabled={totalUsers === 0}
          >
            Delete All
          </button>
          
          <button className="btn-add" onClick={() => navigate("/users/add")}>
            Add New User
          </button>
          <button
            className="btn-delete btn-logout"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="table-search-wrapper">
        <input
          type="search"
          placeholder="Search users..."
          value={search}
          onChange={(e) => searchUsers(e.target.value)}
        />
      </div>

      <div className="table-wrapper">
        <table border="1">
        <thead>
          <tr>
            <th>Avatar</th>
            <th>Name</th>
            <th>Email</th>
            <th>Age</th>
            <th>Number</th>
            <th>Country</th>
            <th className="text-center">Actions</th>
          </tr>
        </thead>

        <tbody>
          {users.length === 0 ? (
            <tr>
              <td colSpan="7" className="empty-message">
                {search.trim()
                  ? `No users found matching "${search}"`
                  : "No users found"}
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user._id}>
                <td>
                  {user.avatar ? (
                    <img
                      src={`http://localhost:5000${user.avatar}`}
                      alt={user.name}
                      className="avatar-img"
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      N/A
                    </div>
                  )}
                </td>

                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.age}</td>
                <td>{user.number}</td>
                <td>{user.country}</td>

                
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn-edit btn-sm"
                      onClick={() => navigate(`/users/edit/${user._id}`)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-delete btn-sm"
                      onClick={() => handleDeleteSingle(user._id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>

     
      <div className="pagination-container">
        <div className="pagination-info">
          Showing <span>{users.length > 0 ? (currentPage - 1) * limit + 1 : 0}</span> to <span>{Math.min(currentPage * limit, totalUsers)}</span> of <span>{totalUsers}</span> users
        </div>
        <div className="pagination-controls">
          <button
            className="btn-page"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              className={`btn-page ${pageNum === currentPage ? "active" : ""}`}
              onClick={() => setCurrentPage(pageNum)}
            >
              {pageNum}
            </button>
          ))}

          <button
            className="btn-page"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserTable;