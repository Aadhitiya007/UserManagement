import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AdminSidebar from "../../components/AdminSidebar";
import { API_URL } from "../../config/api";

function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [stock, setStock] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  // Discount states
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [discountStartDate, setDiscountStartDate] = useState("");
  const [discountEndDate, setDiscountEndDate] = useState("");

  const [currentImage, setCurrentImage] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/products/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load product details");

        setName(data.name || "");
        setDescription(data.description || "");
        setPrice(data.price || "");
        setCategory(data.category || "Electronics");
        setStock(data.stock !== undefined ? data.stock : 0);
        setLowStockThreshold(data.lowStockThreshold !== undefined ? data.lowStockThreshold : 5);
        setCurrentImage(data.imageUrl || data.image || "");

        if (data.discount && data.discount.value > 0) {
          setHasDiscount(Boolean(data.discount.isActive));
          setDiscountType(data.discount.discountType || "percentage");
          setDiscountValue(data.discount.value || "");
          if (data.discount.startDate) {
            setDiscountStartDate(new Date(data.discount.startDate).toISOString().split("T")[0]);
          }
          if (data.discount.endDate) {
            setDiscountEndDate(new Date(data.discount.endDate).toISOString().split("T")[0]);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

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
    setSubmitting(true);

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
      if (discountStartDate) formData.append("discountStartDate", discountStartDate);
      if (discountEndDate) formData.append("discountEndDate", discountEndDate);
      formData.append("isDiscountActive", "true");
    } else {
      formData.append("isDiscountActive", "false");
      formData.append("discountValue", "0");
    }

    if (imageFile) {
      formData.append("image", imageFile);
    }

    try {
      const res = await fetch(`${API_URL}/api/products/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to update product");
      }

      alert("🎉 Product updated successfully!");
      navigate("/admin/products");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="admin-layout">
          <AdminSidebar />
          <main className="admin-content">
            <p style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>Loading product details...</p>
          </main>
        </div>
      </>
    );
  }

  const displayImage = imagePreview || (currentImage
    ? (currentImage.startsWith("http") || currentImage.startsWith("data:") ? currentImage : `${API_URL}/${currentImage.replace(/^\//, "")}`)
    : "");

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
                  Edit Product SKU
                </h1>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.9rem" }}>
                  Update inventory levels, pricing, category classification, and promotional discounts
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
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "14px" }}>
                  <label style={{ fontWeight: 600 }}>Description</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
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

                {/* Stock Management */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "18px" }}>
                  <div className="form-group">
                    <label style={{ fontWeight: 600 }}>Available Stock *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: "0.8rem", color: Number(stock) === 0 ? "#dc2626" : "#64748b" }}>
                      {Number(stock) === 0 ? "⚠️ Set to 0: Product displays as Out of Stock" : "In Stock"}
                    </span>
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: 600 }}>Low Stock Alert Threshold</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                    />
                  </div>
                </div>

                {/* Promotional Discount Section */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "16px", marginBottom: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: hasDiscount ? "14px" : "0" }}>
                    <input
                      type="checkbox"
                      id="editEnableDiscount"
                      checked={hasDiscount}
                      onChange={(e) => setHasDiscount(e.target.checked)}
                      style={{ width: "18px", height: "18px", cursor: "pointer" }}
                    />
                    <label htmlFor="editEnableDiscount" style={{ fontWeight: 700, color: "#1e293b", cursor: "pointer", margin: 0 }}>
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
                  <label style={{ fontWeight: 600 }}>Replace Product Image (AWS S3 Upload)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="form-control"
                  />
                  {displayImage && (
                    <div style={{ marginTop: "10px" }}>
                      <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "0 0 6px" }}>Current Image:</p>
                      <img
                        src={displayImage}
                        alt="Product preview"
                        style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/products")}
                    className="btn btn-outline"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 2, padding: "14px", fontSize: "1rem" }}
                    disabled={submitting}
                  >
                    {submitting ? "Saving Changes..." : "Save Product Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default EditProduct;
