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

// Helper interno: centraliza el patron fetch + check + parse JSON + throw.
// Antes cada funcion repetia este bloque, ahora vive en un solo lugar.
//
// Uso: request("/admin/items") para GET; pasar { method, body } para otras.
// Si el server responde con { error: "..." } lo respeta como mensaje, sino
// arma uno generico con el path para que sea facil de debuggear.
async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error en ${path}`);
  }
  return res.json();
}

// Atajos para los verbs mas usados, asi cada funcion del API queda en una
// linea. encodeURIComponent se aplica al id en put/del porque pueden venir
// strings con caracteres raros.
const get = (path) => request(path);
const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });
const put = (path, id, body) =>
  request(`${path}/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) });
const del = (path, id) => request(`${path}/${encodeURIComponent(id)}`, { method: "DELETE" });

// ---------- AUTENTICACION ----------

// Login. Si es exitoso, guarda el token, el usuario y los permisos en
// localStorage para que persistan entre recargas de pagina. El token dura 8h.
// Ahora el backend devuelve tambien isSuperAdmin y permissions: los serializamos
// en localStorage para que el frontend pueda usarlos sin tener que consultar
// /auth/verify cada vez.
//
// No usa request() porque hace cosas extra (guardar en localStorage) y no
// quiere mandar el header Authorization (todavia no hay token).
export async function login(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
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

// Helpers para que los componentes lean rapido el estado de sesion sin tener
// que parsear localStorage cada vez.
export function isSuperAdmin() {
  return localStorage.getItem("admin_is_super") === "1";
}

// Privada: solo la usa hasPermission de aca abajo. Si en algun momento
// algun componente necesita leer todos los permisos crudos, agregar export.
function getPermissions() {
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
//
// No usa request() porque el comportamiento de error es distinto: si falla
// devuelve false en vez de tirar excepcion, asi el componente puede decidir
// que hacer (mandarte al login en vez de mostrar un error rojo).
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

// --- Categorías ---
export const getCategories = () => get("/admin/categories");
export const createCategory = (category) => post("/admin/categories", category);
export const updateCategory = (id, data) => put("/admin/categories", id, data);
export const deleteCategory = (id) => del("/admin/categories", id);

// --- Items del Menú ---
// Los items (platos) son el nucleo del sistema. Un item tiene nombre, precio,
// categoria, imagen (URL) y opcionalmente modelAR (id del modelo 3D).
export const getItems = () => get("/admin/items");
export const createItem = (item) => post("/admin/items", item);
export const updateItem = (id, data) => put("/admin/items", id, data);
export const deleteItem = (id) => del("/admin/items", id);

// --- Modelos AR ---
// getModelos y getImagenes son endpoints publicos (sin auth) porque el menu
// principal los consume para mostrar los 3D. Los demas si requieren JWT.
export const getModelos = () => get("/modelos");
export const getImagenes = () => get("/imagenes");

// Registra un modelo en la BD despues de haberlo subido a Cloudinary.
// El .glb ya esta en Cloudinary, aca solo guardamos label + URL.
export const createModeloAsset = (payload) => post("/admin/modelos", payload);

// Borra un modelo. El backend se encarga de borrar tambien el .glb de
// Cloudinary y de limpiar las referencias de los platos que lo usaban.
export const deleteModelo = (id) => del("/admin/modelos", id);

// Misma logica que modelos: registrar en BD lo que ya esta en Cloudinary.
export const createImagenAsset = (payload) => post("/admin/imagenes", payload);
export const deleteImagen = (id) => del("/admin/imagenes", id);

// --- Historial de colores ---
// Lista los ultimos colores usados en cardColor. El backend ya los devuelve
// ordenados (mas reciente primero) y limitados a 8.
export const getColorHistorial = () => get("/admin/historial-colores");

// --- Usuarios ---
// CRUD de usuarios secundarios. Solo accesibles para usuarios con permiso
// "puede_gestionar_usuarios" (super_admin lo tiene siempre).
export const getUsuarios = () => get("/admin/usuarios");

// payload: { email, password, permissions }
export const createUsuario = (payload) => post("/admin/usuarios", payload);

// payload puede incluir { email, password, permissions }. Si password es
// string vacio, el backend lo ignora (no lo cambia).
export const updateUsuario = (id, payload) => put("/admin/usuarios", id, payload);

export const deleteUsuario = (id) => del("/admin/usuarios", id);
