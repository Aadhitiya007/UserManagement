import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  addUser,
  getUser,
  updateUser
} from "../services/userService";

const DEFAULT_COUNTRIES = [
  "India", "USA", "UK", "Canada", "Australia", "Germany", "France", "Japan", "China", 
  "Brazil", "Italy", "Spain", "Mexico", "Netherlands", "Sweden", "Norway", "Denmark", 
  "Finland", "Switzerland", "Belgium", "Austria", "New Zealand", "South Korea", "Singapore", 
  "Ireland", "Portugal", "Greece", "Poland", "Czech Republic", "Hungary", "Argentina", 
  "Chile", "Colombia", "Peru", "South Africa", "Egypt", "Turkey", "Saudi Arabia", "UAE", 
  "Thailand", "Vietnam", "Malaysia", "Indonesia", "Philippines", "Pakistan", "Bangladesh", 
  "Nigeria", "Kenya", "Ghana", "Morocco", "Iceland"
];

function UserForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [number, setNumber] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [existingAvatar, setExistingAvatar] = useState("");

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { id } = useParams();
  const editMode = Boolean(id);

  const loadUser = useCallback(async () => {
    try {
      const user = await getUser(id);

      if (!user) {
        alert("User not found");
        navigate("/users");
        return;
      }

      setName(user.name || "");
      setEmail(user.email || "");
      setNumber(user.number || "");
      setAge(user.age || "");
      setCountry(user.country || "");
      setExistingAvatar(user.avatar || "");

    } catch (error) {
      console.error(error);
      setApiError(error.message || "Failed to load user");
    }
  }, [id, navigate]);

  useEffect(() => {
    if (editMode) {
      loadUser();
    }
  }, [editMode, loadUser]);

  function validate() {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    const ageNum = Number(age);
    if (!String(age).trim()) {
      newErrors.age = "Age is required";
    } else if (isNaN(ageNum) || ageNum < 19) {
      newErrors.age = "Age must be greater than 18";
    } else if (ageNum > 100) {
      newErrors.age = "Please enter a valid age";
    }

    const numStr = String(number).trim();
    if (!numStr) {
      newErrors.number = "Phone number is required";
    } else if (!/^\d{10}$/.test(numStr)) {
      newErrors.number = "Number must contain exactly 10 digits";
    }

    if (!country) {
      newErrors.country = "Please select a country";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setApiError("");

    // Validate on frontend to highlight input fields immediately
    const isValid = validate();

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("email", email.trim());
    formData.append("number", String(number).trim());
    formData.append("age", String(age).trim());
    formData.append("country", country);

    if (avatar && typeof avatar !== "string") {
      formData.append("avatar", avatar);
    }

    try {
      setIsSubmitting(true);

      if (!isValid) {
       
      }

      if (editMode) {
        await updateUser(id, formData);
      } else {
        await addUser(formData);
      }

      navigate("/users");

    } catch (error) {
      console.error("Backend API Error:", error);
      if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
      }
      setApiError(error.message || "An error occurred while saving");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBack() {
    navigate("/users");
  }

  return (
    <div>

      <h1>
        {editMode ? "Edit User" : "Add New User"}
      </h1>

      {apiError && (
        <div className="form-api-error">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>

        <input
          type="text"
          placeholder="Name"
          value={name}
          className={errors.name ? "input-error" : ""}
          onChange={(event) => {
            setName(event.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
          }}
        />
        {errors.name && <span className="field-error">{errors.name}</span>}

        <br />

        <input
          type="email"
          placeholder="Email"
          value={email}
          className={errors.email ? "input-error" : ""}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
          }}
        />
        {errors.email && <span className="field-error">{errors.email}</span>}

        <br />

        <input
          type="number"
          placeholder="Age"
          value={age}
          className={errors.age ? "input-error" : ""}
          onChange={(event) => {
            setAge(event.target.value);
            if (errors.age) setErrors((prev) => ({ ...prev, age: "" }));
          }}
        />
        {errors.age && <span className="field-error">{errors.age}</span>}

        <br />

        <input
          type="text"
          placeholder="Phone Number"
          value={number}
          maxLength={10}
          className={errors.number ? "input-error" : ""}
          onChange={(event) => {
            const val = event.target.value.replace(/\D/g, "");
            setNumber(val);
            if (errors.number) setErrors((prev) => ({ ...prev, number: "" }));
          }}
        />
        {errors.number && <span className="field-error">{errors.number}</span>}

        <br />

        <label>Profile Picture</label>
        {editMode && existingAvatar && (
          <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
            <img
              src={`http://localhost:5000${existingAvatar}`}
              alt="Current Profile"
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid var(--border-tactile)"
              }}
            />
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              Current Picture
            </span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setAvatar(e.target.files[0])}
        />

        <br />

        <label>Country</label>

        <select
          value={country}
          className={errors.country ? "input-error" : ""}
          onChange={(event) => {
            setCountry(event.target.value);
            if (errors.country) setErrors((prev) => ({ ...prev, country: "" }));
          }}
        >
          <option value="">
            Select Country
          </option>

          {Array.from(
            new Set(
              country && !DEFAULT_COUNTRIES.includes(country)
                ? [...DEFAULT_COUNTRIES, country]
                : DEFAULT_COUNTRIES
            )
          )
            .sort((a, b) => a.localeCompare(b))
            .map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
        </select>
        {errors.country && <span className="field-error">{errors.country}</span>}

        <br />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving..."
            : editMode
            ? "Update User"
            : "Add User"}
        </button>

      </form>

      <br />

      <button onClick={handleBack}>
        Back to Users
      </button>

    </div>
  );
}

export default UserForm;