const API_URL = "/api"; // "http://localhost:3001/api" en local, /api en hosting

function getHeaders() {
  const token = localStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function login(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error de autenticación");
  }
  const data = await res.json();
  localStorage.setItem("admin_token", data.token);
  localStorage.setItem("admin_user", data.username);
  return data;
}

export function logout() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
}

export function isAuthenticated() {
  return !!localStorage.getItem("admin_token");
}

export async function verifyToken() {
  const res = await fetch(`${API_URL}/auth/verify`, { headers: getHeaders() });
  return res.ok;
}

// --- Categorías ---
export async function getCategories() {
  const res = await fetch(`${API_URL}/admin/categories`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Error al obtener categorías");
  return res.json();
}

export async function createCategory(category) {
  const res = await fetch(`${API_URL}/admin/categories`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(category),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }
  return res.json();
}

export async function updateCategory(id, data) {
  const res = await fetch(`${API_URL}/admin/categories/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }
  return res.json();
}

export async function deleteCategory(id) {
  const res = await fetch(`${API_URL}/admin/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }
  return res.json();
}

// --- Items del Menú ---
export async function getItems() {
  const res = await fetch(`${API_URL}/admin/items`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Error al obtener items");
  return res.json();
}

// --- Modelos AR ---
export async function getModelos() {
  const res = await fetch(`${API_URL}/modelos`);
  if (!res.ok) throw new Error("Error al obtener modelos");
  return res.json();
}

export async function createItem(item) {
  const res = await fetch(`${API_URL}/admin/items`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }
  return res.json();
}

export async function updateItem(id, data) {
  const res = await fetch(`${API_URL}/admin/items/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }
  return res.json();
}

export async function deleteItem(id) {
  const res = await fetch(`${API_URL}/admin/items/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }
  return res.json();
}

// --- Contraseña ---
export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${API_URL}/admin/password`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }
  return res.json();
}

// --- Público ---
export async function getPublicMenu() {
  const res = await fetch(`${API_URL}/menu`);
  if (!res.ok) throw new Error("Error al obtener menú");
  return res.json();
}

