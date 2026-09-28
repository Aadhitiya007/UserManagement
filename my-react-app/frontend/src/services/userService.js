import { getToken, logout } from "./authService";

const baseUrl = "http://localhost:5000/api/users";

function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function checkAuthStatus(response) {
  if (response.status === 401 || response.status === 403) {
    logout();
    window.location.href = "/login";
    throw new Error("Session expired or unauthorized. Please log in again.");
  }
}

export async function getUsers(search = "", page = 1, limit = 10) {
  const queryParams = new URLSearchParams();
  if (search.trim()) queryParams.append("search", search.trim());
  queryParams.append("page", page);
  queryParams.append("limit", limit);

  const response = await fetch(`${baseUrl}?${queryParams.toString()}`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  checkAuthStatus(response);

  if (!response.ok) {
    throw new Error(`Unable to load users (${response.status})`);
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return { users: data, totalUsers: data.length, totalPages: 1, currentPage: 1, limit };
  }
  return data;
}

export async function getUser(id) {
  const response = await fetch(`${baseUrl}/${id}`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  checkAuthStatus(response);

  if (!response.ok) {
    throw new Error(`Unable to fetch user details (${response.status})`);
  }
  return await response.json();
}

export async function addUser(userData) {
  const isFormData = userData instanceof FormData;
  const headers = { ...getAuthHeaders() };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const options = {
    method: "POST",
    headers,
    body: isFormData ? userData : JSON.stringify(userData)
  };

  const response = await fetch(baseUrl, options);

  checkAuthStatus(response);

  if (!response.ok) {
    let errMsg = `Unable to add user (${response.status})`;
    let fieldErrors = null;
    try {
      const data = await response.json();
      if (data?.message) errMsg = data.message;
      if (data?.errors) fieldErrors = data.errors;
    } catch {}
    const err = new Error(errMsg);
    err.fieldErrors = fieldErrors;
    throw err;
  }

  return await response.json();
}

export async function updateUser(id, userData) {
  const isFormData = userData instanceof FormData;
  const headers = { ...getAuthHeaders() };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const options = {
    method: "PUT",
    headers,
    body: isFormData ? userData : JSON.stringify(userData)
  };

  const response = await fetch(`${baseUrl}/${id}`, options);

  checkAuthStatus(response);

  if (!response.ok) {
    let errMsg = `Unable to update user (${response.status})`;
    let fieldErrors = null;
    try {
      const data = await response.json();
      if (data?.message) errMsg = data.message;
      if (data?.errors) fieldErrors = data.errors;
    } catch {}
    const err = new Error(errMsg);
    err.fieldErrors = fieldErrors;
    throw err;
  }

  return await response.json();
}

export async function deleteUser(id) {
  const response = await fetch(`${baseUrl}/${id}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeaders()
    }
  });

  checkAuthStatus(response);

  if (!response.ok) {
    throw new Error(`Unable to delete user (${response.status})`);
  }
  return await response.json();
}

export async function deleteAllUsers() {
  const response = await fetch(`${baseUrl}/all/clear`, {
    method: "DELETE",
    headers: {
      ...getAuthHeaders()
    }
  });

  checkAuthStatus(response);

  if (!response.ok) {
    throw new Error(`Unable to delete all users (${response.status})`);
  }
  return await response.json();
}

export async function uploadUsersFromFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${baseUrl}/import`, {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    },
    body: formData
  });

  checkAuthStatus(response);

  if (!response.ok) {
    let errMsg = `Failed to import file (${response.status})`;
    try {
      const data = await response.json();
      if (data?.message) errMsg = data.message;
    } catch {}
    throw new Error(errMsg);
  }

  return await response.json();
}

export async function exportUsersToFile() {
  const response = await fetch(`${baseUrl}/export`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  checkAuthStatus(response);

  if (!response.ok) {
    throw new Error(`Failed to export users (${response.status})`);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "users.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadUserTemplate() {
  const response = await fetch(`${baseUrl}/template`);
  if (!response.ok) {
    throw new Error(`Failed to download template (${response.status})`);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "users_template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}