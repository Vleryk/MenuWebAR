// Cliente HTTP del frontend. Todas las llamadas a la API pasan por aca.
// Asi el resto de los componentes no tienen que saber de fetch, headers,
// tokens, etc. Si mañana cambiamos de backend solo tocamos este archivo.

// En dev, Vite hace proxy de /api al backend en localhost:3001 (ver
// vite.config.js). En produccion el frontend y el backend estan en el mismo
// host, asi que /api apunta al mismo servidor.
const API_URL = "/api"; // "http://localhost:3001/api" en local, /api en hosting

// Arma los headers de cada request. Si hay token guardado en localStorage,
// lo agrega como Bearer para que el backend valide la sesion.
function getHeaders() {
  const token = localStorage.getItem("admin_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ---------- AUTENTICACION ----------

// Login. Si es exitoso, guarda el token, el usuario y los permisos en
// localStorage para que persistan entre recargas de pagina. El token dura 8h.
// Ahora el backend devuelve tambien isSuperAdmin y permissions: los serializamos
// en localStorage para que el frontend pueda usarlos sin tener que consultar
// /auth/verify cada vez.
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
  // guardamos info de sesion para que el frontend renderice botones/pestañas
  // sin tener que decodificar el JWT
  localStorage.setItem("admin_is_super", data.isSuperAdmin ? "1" : "0");
  localStorage.setItem("admin_permissions", JSON.stringify(data.permissions || {}));
  return data;
}

// Logout simplemente borra el token local. No hay endpoint server porque JWT
// es stateless, cuando expire deja de valer.
export function logout() {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
  localStorage.removeItem("admin_is_super");
  localStorage.removeItem("admin_permissions");
}

export function isAuthenticated() {
  return !!localStorage.getItem("admin_token");
}

// Helpers para que los componentes lean rapido el estado de sesion sin tener
// que parsear localStorage cada vez.
export function isSuperAdmin() {
  return localStorage.getItem("admin_is_super") === "1";
}

export function getPermissions() {
  try {
    return JSON.parse(localStorage.getItem("admin_permissions") || "{}");
  } catch {
    return {};
  }
}

// Devuelve true si el usuario actual tiene el permiso, considerando que el
// super_admin tiene todos los permisos. Los componentes lo usan para decidir
// si renderizar / habilitar botones.
export function hasPermission(permKey) {
  if (isSuperAdmin()) return true;
  const perms = getPermissions();
  return Boolean(perms[permKey]);
}

// Valida el token contra el server. Se usa al cargar el admin para saber si
// el token guardado todavia es valido (puede haber expirado mientras el user
// estaba ausente). Aprovecha la respuesta para refrescar permissions y
// isSuperAdmin en localStorage por si cambiaron en el server.
export async function verifyToken() {
  const res = await fetch(`${API_URL}/auth/verify`, { headers: getHeaders() });
  if (!res.ok) return false;
  try {
    const data = await res.json();
    if (data && typeof data === "object") {
      // refrescamos los permisos: util si el super_admin le cambio los
      // permisos a este usuario mientras estaba logueado
      localStorage.setItem("admin_is_super", data.isSuperAdmin ? "1" : "0");
      localStorage.setItem("admin_permissions", JSON.stringify(data.permissions || {}));
    }
  } catch {
    // si la respuesta no es JSON valido igual consideramos el token valido
  }
  return true;
}

// --- Upload de Imágenes ---
// Endpoint legacy que sube a disco local. En el flujo normal no se usa porque
// AdminUploader.jsx sube directo a Cloudinary. Queda como fallback.
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const token = localStorage.getItem("admin_token");
  const res = await fetch(`${API_URL}/admin/upload-image`, {
    method: "POST",
    headers: {
      // OJO: no incluimos Content-Type. fetch lo pone solo con el boundary
      // correcto cuando mandamos FormData.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al subir imagen");
  }

  return res.json();
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
// Los items (platos) son el nucleo del sistema. Un item tiene nombre, precio,
// categoria, imagen (URL) y opcionalmente modelAR (id del modelo 3D).
export async function getItems() {
  const res = await fetch(`${API_URL}/admin/items`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Error al obtener items");
  return res.json();
}

// --- Modelos AR ---
// Estos endpoints son publicos (sin auth) porque el menu principal los consume
// para mostrar los 3D. getImagenes tambien es publico por la misma razon.
export async function getModelos() {
  const res = await fetch(`${API_URL}/modelos`);
  if (!res.ok) throw new Error("Error al obtener modelos");
  return res.json();
}

export async function getImagenes() {
  const res = await fetch(`${API_URL}/imagenes`);
  if (!res.ok) throw new Error("Error al obtener imagenes");
  return res.json();
}

// Registra un modelo en la BD despues de haberlo subido a Cloudinary.
// El .glb ya esta en Cloudinary, aca solo guardamos label + URL.
export async function createModeloAsset(payload) {
  const res = await fetch(`${API_URL}/admin/modelos`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al guardar modelo");
  }
  return res.json();
}

// Borra un modelo. El backend se encarga de borrar tambien el .glb de
// Cloudinary y de limpiar las referencias de los platos que lo usaban.
export async function deleteModelo(id) {
  const res = await fetch(`${API_URL}/admin/modelos/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al eliminar modelo");
  }
  return res.json();
}

// Misma logica que modelos: registrar en BD lo que ya esta en Cloudinary.
export async function createImagenAsset(payload) {
  const res = await fetch(`${API_URL}/admin/imagenes`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al guardar imagen");
  }
  return res.json();
}

export async function deleteImagen(id) {
  const res = await fetch(`${API_URL}/admin/imagenes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al eliminar imagen");
  }
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

// --- Historial de colores ---
// Lista los ultimos colores usados en cardColor. El backend ya los devuelve
// ordenados (mas reciente primero) y limitados a 8.
export async function getColorHistorial() {
  const res = await fetch(`${API_URL}/admin/historial-colores`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Error al obtener historial de colores");
  return res.json();
}

// Empuja un color al historial. En el flujo normal no hace falta llamar a
// esto desde el front, porque el server lo guarda solo cuando se crea o
// actualiza un plato. Queda disponible por si se quiere registrar un color
// sin guardar plato (ej: probar paleta).
export async function pushColorHistorial(color) {
  const res = await fetch(`${API_URL}/admin/historial-colores`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ color }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al guardar color");
  }
  return res.json();
}

// --- Usuarios ---
// CRUD de usuarios secundarios. Solo accesibles para usuarios con permiso
// "puede_gestionar_usuarios" (super_admin lo tiene siempre).
export async function getUsuarios() {
  const res = await fetch(`${API_URL}/admin/usuarios`, { headers: getHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al obtener usuarios");
  }
  return res.json();
}

export async function createUsuario(payload) {
  // payload: { email, password, permissions }
  const res = await fetch(`${API_URL}/admin/usuarios`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al crear usuario");
  }
  return res.json();
}

export async function updateUsuario(id, payload) {
  // payload puede incluir { email, password, permissions }. Si password es
  // string vacio, el backend lo ignora (no lo cambia).
  const res = await fetch(`${API_URL}/admin/usuarios/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al actualizar usuario");
  }
  return res.json();
}

export async function deleteUsuario(id) {
  const res = await fetch(`${API_URL}/admin/usuarios/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al eliminar usuario");
  }
  return res.json();
}

// --- Contraseña ---
// Cambio de pass del admin. Pide la actual como confirmacion. Solo aplica al
// super_admin; para los demas usuarios el cambio lo hace el super via gestion.
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
// Endpoint del menu publico. Lo consume App.jsx para armar toda la carta.
export async function getPublicMenu() {
  const res = await fetch(`${API_URL}/menu`);
  if (!res.ok) throw new Error("Error al obtener menú");
  return res.json();
}
