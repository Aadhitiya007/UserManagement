import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import { API_URL } from "../../config/api";

function AddProduct() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [stock, setStock] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  // Product Discount configuration
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [discountStartDate, setDiscountStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [discountEndDate, setDiscountEndDate] = useState("");

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const token = localStorage.getItem("token");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("category", category);
    formData.append("stock", stock);
    formData.append("lowStockThreshold", lowStockThreshold);

    if (hasDiscount && Number(discountValue) > 0) {
      formData.append("discountType", discountType);
      formData.append("discountValue", discountValue);
      formData.append("discountStartDate", discountStartDate);
      if (discountEndDate) formData.append("discountEndDate", discountEndDate);
      formData.append("isDiscountActive", "true");
    }

    if (imageFile) {
      formData.append("image", imageFile);
    }

    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to create product");
      }

      alert("🎉 Product added successfully!");
      navigate("/admin/products");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <div className="admin-dashboard-container" style={{ maxWidth: "800px" }}>
            <div className="admin-dashboard-header">
              <div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Add New Catalog Product
                </h1>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.9rem" }}>
                  Configure SKU details, initial inventory stock, and product-level promotional discounts
                </p>
              </div>
            </div>

            <div className="admin-card">
              {error && (
                <div style={{ padding: "12px", background: "#fee2e2", color: "#991b1b", borderRadius: "6px", marginBottom: "20px" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: "14px" }}>
                  <label style={{ fontWeight: 600 }}>Product Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "14px" }}>
                  <label style={{ fontWeight: 600 }}>Description</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter detailed technical specifications and product highlights"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "14px" }}>
                  <div className="form-group">
                    <label style={{ fontWeight: 600 }}>Base Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                      placeholder="2999.00"
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: 600 }}>Category *</label>
                    <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="Electronics">Electronics</option>
                      <option value="Clothing">Clothing</option>
                      <option value="Books">Books</option>
                      <option value="Home & Kitchen">Home & Kitchen</option>
                      <option value="Accessories">Accessories</option>
                    </select>
                  </div>
                </div>

                {/* Inventory Management Section */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "18px" }}>
                  <div className="form-group">
                    <label style={{ fontWeight: 600 }}>Initial Stock Quantity *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      required
                      placeholder="e.g. 25 (0 = Out of Stock)"
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: 600 }}>Low Stock Alert Threshold</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      placeholder="Default: 5"
                    />
                  </div>
                </div>

                {/* Product-Level Discount Section */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", marginBottom: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: hasDiscount ? "14px" : "0" }}>
                    <input
                      type="checkbox"
                      id="enableDiscount"
                      checked={hasDiscount}
                      onChange={(e) => setHasDiscount(e.target.checked)}
                      style={{ width: "18px", height: "18px", cursor: "pointer" }}
                    />
                    <label htmlFor="enableDiscount" style={{ fontWeight: 700, color: "#1e293b", cursor: "pointer", margin: 0 }}>
                      🏷️ Enable Product-Level Discount (SALE)
                    </label>
                  </div>

                  {hasDiscount && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                      <div className="form-group">
                        <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Discount Type</label>
                        <select
                          className="form-control"
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value)}
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount (₹)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                          Discount Value {discountType === "percentage" ? "(%)" : "(₹)"}
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder={discountType === "percentage" ? "e.g. 15" : "e.g. 300"}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          min="1"
                          max={discountType === "percentage" ? "100" : undefined}
                          required={hasDiscount}
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Discount Start Date</label>
                        <input
                          type="date"
                          className="form-control"
                          value={discountStartDate}
                          onChange={(e) => setDiscountStartDate(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Discount End Date (Optional)</label>
                        <input
                          type="date"
                          className="form-control"
                          value={discountEndDate}
                          onChange={(e) => setDiscountEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: "20px" }}>
                  <label style={{ fontWeight: 600 }}>Product Image (AWS S3 Upload)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="form-control"
                  />
                  {imagePreview && (
                    <div style={{ marginTop: "10px" }}>
                      <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "0 0 6px" }}>Image Preview:</p>
                      <img src={imagePreview} alt="Preview" style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "14px", fontSize: "1rem" }}
                  disabled={loading}
                >
                  {loading ? "Adding Product to Catalog..." : "Add Product"}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default AddProduct;
