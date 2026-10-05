import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts(search);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [search]);

  async function fetchProducts(query = "") {
    try {
      setLoading(true);
      const url = query
        ? `http://localhost:5000/api/products?search=${encodeURIComponent(query)}`
        : "http://localhost:5000/api/products";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch products");
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:5000/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete product");

      setProducts(products.filter((p) => p._id !== id));
      alert("Product deleted successfully");
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "15px" }}>
            <h2>Product Management</h2>

            {/* Product Search Bar */}
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Search products by name, category, or description..."
              style={{ width: "340px" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <Link to="/admin/products/add" className="btn btn-primary">
              ➕ Add New Product
            </Link>
          </div>

          {error && (
            <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
              {error}
            </div>
          )}

          {loading ? (
            <p>Loading products...</p>
          ) : products.length === 0 ? (
            <p>No matching products found.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const imageUrl = product.image
                      ? (product.image.startsWith("http") ? product.image : `http://localhost:5000${product.image}`)
                      : "https://via.placeholder.com/50";

                    return (
                      <tr key={product._id}>
                        <td>
                          <img
                            src={imageUrl}
                            alt={product.name}
                            style={{ width: "45px", height: "45px", objectFit: "cover", borderRadius: "4px" }}
                          />
                        </td>
                        <td style={{ fontWeight: "500" }}>{product.name}</td>
                        <td>{product.category}</td>
                        <td style={{ fontWeight: "600", color: "#2563eb" }}>₹{product.price}</td>
                        <td>
                          <span className={product.stock > 0 ? "badge badge-success" : "badge badge-danger"}>
                            {product.stock}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <Link to={`/admin/products/edit/${product._id}`} className="btn btn-outline btn-sm">
                              Edit
                            </Link>
                            <button onClick={() => handleDelete(product._id, product.name)} className="btn btn-danger btn-sm">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default AdminProducts;
