require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const crypto = require("crypto");
const {
  isSupabaseEnabled,
  loadSupabaseData,
  createModeloAsset: createSupabaseModeloAsset,
  createImagenAsset: createSupabaseImagenAsset,
  createCategory: createSupabaseCategory,
  updateCategory: updateSupabaseCategory,
  deleteCategory: deleteSupabaseCategory,
  createItem: createSupabaseItem,
  updateItem: updateSupabaseItem,
  deleteItem: deleteSupabaseItem,
} = require("./supabaseStore");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_FILE = path.join(__dirname, "data", "admin.json");

// Fallo inmediato: JWT_SECRET es obligatorio en producción
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET environment variable is required in production.");
    process.exit(1);
  }
  console.warn("WARNING: JWT_SECRET not set. Using insecure default for development only.");
}

const jwtSecret = JWT_SECRET || "dev-only-insecure-secret";

// --- Configuración de Multer para subida de imágenes ---
const uploadDir = path.join(__dirname, "..", "public", "assets", "IMG");

// Crear directorio si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre único: timestamp-hash.extensión
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  // Solo permitir imágenes
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten imágenes (JPEG, PNG, WebP, GIF)"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
});

// --- Helpers de validación ---
const SAFE_PATH_RE = /^\/assets\/(modelosAR|IMG)\//;
const CLOUDINARY_HOST = "res.cloudinary.com";

function isSafePath(p) {
  if (!p) return true; // vacío es permitido
  if (typeof p !== "string") return false;
  if (p.includes("..")) return false;
  if (!p.startsWith("/")) return false;
  return SAFE_PATH_RE.test(p);
}

function isCloudinaryUploadUrl(value, resourceType) {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== CLOUDINARY_HOST) return false;

    const pathName = parsed.pathname || "";
    if (resourceType) {
      return pathName.includes(`/${resourceType}/upload/`);
    }

    return pathName.includes("/upload/");
  } catch {
    return false;
  }
}

function isSafeImageRef(value) {
  return isSafePath(value) || isCloudinaryUploadUrl(value, "image");
}

function isSafeModelSrc(value) {
  return (
    isSafePath(value) ||
    isCloudinaryUploadUrl(value, "raw") ||
    isCloudinaryUploadUrl(value, "image")
  );
}

function isNonEmptyString(val) {
  return typeof val === "string" && val.trim().length > 0;
}

function isValidId(val) {
  return typeof val === "string" && /^[a-zA-Z0-9_-]+$/.test(val);
}

function isValidPrice(val) {
  // Los precios se almacenan como strings, ej: "$12.990"
  return typeof val === "string" && val.trim().length > 0;
}

function isValidModeloId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]+$/.test(id);
}

function resolveModelAR(modeloId, modelos) {
  if (!modeloId) return "";
  const modelo = (modelos || []).find((m) => m.id === modeloId);
  return modelo ? modelo.src : "";
}

function resolveMenuItems(items, modelos) {
  return items.map((item) => ({
    ...item,
    modelAR: resolveModelAR(item.modelAR, modelos),
  }));
}

// Archivos estáticos (salida compilada de Vite)
const frontendPath = path.join(__dirname, "../dist");
app.use(express.static(frontendPath));

// Servir archivos estáticos de public (para las imágenes subidas)
app.use("/assets", express.static(path.join(__dirname, "..", "public", "assets")));

function initAdmin() {
  let needsInit = false;

  if (!fs.existsSync(ADMIN_FILE)) {
    needsInit = true;
  } else {
    try {
      const existing = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf-8"));
      if (!existing.username || !existing.password) {
        needsInit = true;
      }
    } catch {
      needsInit = true;
    }
  }

  if (needsInit) {
    const defaultEmail = process.env.ADMIN_DEFAULT_EMAIL || "admin@hublab.com";
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD;

    if (!defaultPassword) {
      console.error(
        "ADMIN_DEFAULT_PASSWORD env var is required to create the initial admin account.",
      );
      console.error("Set it in your .env file. See .env.example for reference.");
      process.exit(1);
    }

    const hash = bcrypt.hashSync(defaultPassword, 10);
    fs.writeFileSync(
      ADMIN_FILE,
      JSON.stringify({ username: defaultEmail, password: hash }, null, 2),
    );
    console.log(`Admin created: ${defaultEmail} (change password after first login)`);
  }
}

function handleSupabaseRouteError(res, error) {
  const statusCode = Number.isInteger(error?.status) ? error.status : 500;

  if (statusCode >= 500) {
    console.error("Supabase route error:", error?.message || error);
  }

  return res.status(statusCode).json({ error: error?.message || "Error de datos en Supabase" });
}

function requireSupabaseDataSource(res) {
  if (isSupabaseEnabled) return true;

  return res.status(503).json({
    error:
      "Supabase no esta configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para usar la API de datos.",
  });
}

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Limitador de intentos para auth (15 intentos por ventana de 15 minutos)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de login. Intenta de nuevo en 15 minutos." },
});

// Limitador general para todos los endpoints de la API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
});

app.use("/api/", apiLimiter);

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

// Manejador centralizado de errores (Express requiere los 4 parámetros para middleware de errores)
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (process.env.NODE_ENV !== "production") {
    console.error("Unhandled error:", err.stack || err.message);
  } else {
    console.error("Unhandled error:", err.message);
  }
  res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
}

// ========================
// VERIFICACIÓN DE SALUD
// ========================

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ========================
// RUTAS PÚBLICAS (no protegidas)
// ========================

app.get("/api/menu", async (_req, res) => {
  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  try {
    const data = await loadSupabaseData();
    return res.json({
      ...data,
      menuItems: resolveMenuItems(data.menuItems, data.modelos),
    });
  } catch (error) {
    return handleSupabaseRouteError(res, error);
  }
});

app.get("/api/categories", async (_req, res) => {
  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  try {
    const data = await loadSupabaseData();
    return res.json(data.categories);
  } catch (error) {
    return handleSupabaseRouteError(res, error);
  }
});

app.get("/api/modelos", async (_req, res) => {
  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  try {
    const data = await loadSupabaseData();
    return res.json(data.modelos || []);
  } catch (error) {
    return handleSupabaseRouteError(res, error);
  }
});

app.get("/api/imagenes", async (_req, res) => {
  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  try {
    const data = await loadSupabaseData();
    return res.json(data.imagenes || []);
  } catch (error) {
    return handleSupabaseRouteError(res, error);
  }
});

app.get("/api/menu-items", async (_req, res) => {
  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  try {
    const data = await loadSupabaseData();
    return res.json(resolveMenuItems(data.menuItems, data.modelos));
  } catch (error) {
    return handleSupabaseRouteError(res, error);
  }
});

// ========================
// AUTENTICACIÓN
// ========================

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  }

  const admin = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf-8"));
  if (username !== admin.username || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const token = jwt.sign({ username }, jwtSecret, { expiresIn: "8h" });
  res.json({ token, username });
});

app.get("/api/auth/verify", authMiddleware, (req, res) => {
  res.json({ valid: true, username: req.user.username });
});

// ========================
// RUTAS DE ADMIN (protegidas)
// ========================

// --- Upload de Imágenes ---
app.post("/api/admin/upload-image", authMiddleware, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "La imagen es muy grande (máximo 5MB)" });
        }
        return res.status(400).json({ error: "Error al subir la imagen" });
      }
      return res.status(400).json({ error: err.message || "Error al subir la imagen" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No se subió ninguna imagen" });
    }

    // Devolver la ruta relativa para guardar en la BD
    const imagePath = `/assets/IMG/${req.file.filename}`;
    res.json({ image: imagePath });
  });
});

// --- Registrar Modelos (Cloudinary u origen permitido) ---
app.post("/api/admin/modelos", authMiddleware, (req, res) => {
  const { id, name, label, url, src, secure_url, secureUrl } = req.body || {};

  const modeloId = typeof (id || name) === "string" ? (id || name).trim() : "";
  const modeloSrc =
    typeof (url || src || secure_url || secureUrl) === "string"
      ? (url || src || secure_url || secureUrl).trim()
      : "";
  const modeloLabel =
    typeof (label || name || modeloId) === "string" ? (label || name || modeloId).trim() : "";

  if (!isValidModeloId(modeloId)) {
    return res
      .status(400)
      .json({ error: "id de modelo invalido (solo letras, numeros, guion y guion bajo)" });
  }

  if (!isNonEmptyString(modeloLabel)) {
    return res.status(400).json({ error: "label es requerido" });
  }

  if (!isNonEmptyString(modeloSrc)) {
    return res.status(400).json({ error: "url es requerida" });
  }

  if (!isSafeModelSrc(modeloSrc)) {
    return res.status(400).json({ error: "URL de modelo no permitida" });
  }

  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  createSupabaseModeloAsset({ id, name, label: modeloLabel, url: modeloSrc })
    .then((newModelo) => res.status(201).json(newModelo))
    .catch((error) => handleSupabaseRouteError(res, error));
});

// --- Registrar Imágenes (Cloudinary u origen permitido) ---
app.post("/api/admin/imagenes", authMiddleware, (req, res) => {
  const { id, name, label, url, src, secure_url, secureUrl } = req.body || {};

  const imagenId = typeof (id || name) === "string" ? (id || name).trim() : "";
  const imagenSrc =
    typeof (url || src || secure_url || secureUrl) === "string"
      ? (url || src || secure_url || secureUrl).trim()
      : "";
  const imagenLabel =
    typeof (label || name || imagenId) === "string" ? (label || name || imagenId).trim() : "";

  if (!isValidId(imagenId)) {
    return res
      .status(400)
      .json({ error: "id de imagen invalido (solo letras, numeros, guion y guion bajo)" });
  }

  if (!isNonEmptyString(imagenLabel)) {
    return res.status(400).json({ error: "label es requerido" });
  }

  if (!isNonEmptyString(imagenSrc)) {
    return res.status(400).json({ error: "url es requerida" });
  }

  if (!isSafeImageRef(imagenSrc)) {
    return res.status(400).json({ error: "URL de imagen no permitida" });
  }

  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  createSupabaseImagenAsset({ id, name, label: imagenLabel, url: imagenSrc })
    .then((newImagen) => res.status(201).json(newImagen))
    .catch((error) => handleSupabaseRouteError(res, error));
});

// --- Categorías ---
app.get("/api/admin/categories", authMiddleware, async (_req, res) => {
  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  try {
    const data = await loadSupabaseData();
    return res.json(data.categories);
  } catch (error) {
    return handleSupabaseRouteError(res, error);
  }
});

app.post("/api/admin/categories", authMiddleware, (req, res) => {
  const { id, label } = req.body;
  if (!isValidId(id)) {
    return res
      .status(400)
      .json({ error: "id invalido (solo letras, numeros, guion y guion bajo)" });
  }
  if (!isNonEmptyString(label)) {
    return res.status(400).json({ error: "label es requerido" });
  }

  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  createSupabaseCategory({ id, label })
    .then((newCategory) => res.status(201).json(newCategory))
    .catch((error) => handleSupabaseRouteError(res, error));
});

app.put("/api/admin/categories/:id", authMiddleware, (req, res) => {
  const { label } = req.body;
  if (label !== undefined && !isNonEmptyString(label)) {
    return res.status(400).json({ error: "label no puede estar vacio" });
  }

  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  updateSupabaseCategory(req.params.id, { label })
    .then((updatedCategory) => res.json(updatedCategory))
    .catch((error) => handleSupabaseRouteError(res, error));
});

app.delete("/api/admin/categories/:id", authMiddleware, (req, res) => {
  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  deleteSupabaseCategory(req.params.id)
    .then(() => res.json({ message: "Categoria y sus items eliminados" }))
    .catch((error) => handleSupabaseRouteError(res, error));
});

// --- Menu Items ---
app.get("/api/admin/items", authMiddleware, async (_req, res) => {
  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  try {
    const data = await loadSupabaseData();
    return res.json(data.menuItems);
  } catch (error) {
    return handleSupabaseRouteError(res, error);
  }
});

app.post("/api/admin/items", authMiddleware, (req, res) => {
  const { id, category, name, description, price, image, modelAR, ingredients } = req.body;
  if (!isValidId(id)) {
    return res
      .status(400)
      .json({ error: "id invalido (solo letras, numeros, guion y guion bajo)" });
  }
  if (!isNonEmptyString(category)) {
    return res.status(400).json({ error: "category es requerido" });
  }
  if (!isNonEmptyString(name)) {
    return res.status(400).json({ error: "name es requerido" });
  }
  if (!isValidPrice(price)) {
    return res.status(400).json({ error: "price es requerido" });
  }
  if (image && !isSafeImageRef(image)) {
    return res.status(400).json({ error: "Imagen no permitida" });
  }
  if (modelAR && !isValidModeloId(modelAR)) {
    return res.status(400).json({ error: "modelAR debe ser un id de modelo valido" });
  }

  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  createSupabaseItem({ id, category, name, description, price, image, modelAR, ingredients })
    .then((newItem) => res.status(201).json(newItem))
    .catch((error) => handleSupabaseRouteError(res, error));
});

app.put("/api/admin/items/:id", authMiddleware, (req, res) => {
  const { image, modelAR } = req.body || {};

  if (image !== undefined && image && !isSafeImageRef(image)) {
    return res.status(400).json({ error: "Imagen no permitida" });
  }
  if (modelAR !== undefined && modelAR && !isValidModeloId(modelAR)) {
    return res.status(400).json({ error: "modelAR debe ser un id de modelo valido" });
  }

  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  updateSupabaseItem(req.params.id, req.body || {})
    .then((updatedItem) => res.json(updatedItem))
    .catch((error) => handleSupabaseRouteError(res, error));
});

app.delete("/api/admin/items/:id", authMiddleware, (req, res) => {
  if (!isSupabaseEnabled) {
    return requireSupabaseDataSource(res);
  }

  deleteSupabaseItem(req.params.id)
    .then(() => res.json({ message: "Item eliminado" }))
    .catch((error) => handleSupabaseRouteError(res, error));
});

// --- Cambiar Contraseña ---
app.put("/api/admin/password", authMiddleware, loginLimiter, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Contraseña actual y nueva requeridas" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
  }

  const admin = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf-8"));
  if (!bcrypt.compareSync(currentPassword, admin.password)) {
    return res.status(401).json({ error: "Contraseña actual incorrecta" });
  }

  admin.password = bcrypt.hashSync(newPassword, 10);
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(admin, null, 2));
  res.json({ message: "Contraseña actualizada" });
});

// SPA fallback: servir la app React para rutas que no sean de la API
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Manejador centralizado de errores (debe ir al final)
app.use(errorHandler);

// --- Inicio ---
initAdmin();

// Exportar app para testing
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
