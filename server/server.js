require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const DATA_FILE = path.join(__dirname, "data", "menu.json");
const ADMIN_FILE = path.join(__dirname, "data", "admin.json");

// Fail-fast: require JWT_SECRET in production
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET environment variable is required in production.");
    process.exit(1);
  }
  console.warn("WARNING: JWT_SECRET not set. Using insecure default for development only.");
}

const jwtSecret = JWT_SECRET || "dev-only-insecure-secret";

// --- Validation helpers ---
const SAFE_PATH_RE = /^\/assets\/(modelosAR|IMG)\//;

function isSafePath(p) {
  if (!p) return true; // empty is allowed
  if (typeof p !== "string") return false;
  if (p.includes("..") || p.startsWith("/") === false) return false;
  return SAFE_PATH_RE.test(p);
}

function isNonEmptyString(val) {
  return typeof val === "string" && val.trim().length > 0;
}

function isValidId(val) {
  return typeof val === "string" && /^[a-zA-Z0-9_-]+$/.test(val);
}

function isValidPrice(val) {
  // Prices are stored as strings like "$12.990"
  return typeof val === "string" && val.trim().length > 0;
}

// Static assets (compiled Vite output)
const frontendPath = path.join(__dirname, "../dist");
app.use(express.static(frontendPath));

function initAdmin() {
  if (!fs.existsSync(ADMIN_FILE)) {
    const defaultEmail = process.env.ADMIN_DEFAULT_EMAIL || "admin@example.com";
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD;

    if (!defaultPassword) {
      console.error(
        "ADMIN_DEFAULT_PASSWORD env var is required to create the initial admin account."
      );
      console.error("Set it in your .env file. See .env.example for reference.");
      process.exit(1);
    }

    const hash = bcrypt.hashSync(defaultPassword, 10);
    fs.writeFileSync(
      ADMIN_FILE,
      JSON.stringify({ username: defaultEmail, password: hash }, null, 2)
    );
    console.log(`Admin created: ${defaultEmail} (change password after first login)`);
  }
}

// --- Helpers ---
function readData() {
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Rate limiter for auth endpoints (15 attempts per 15-minute window)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de login. Intenta de nuevo en 15 minutos." },
});

// General rate limiter for all API endpoints
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

// Centralized error handler (Express requires all 4 params for error middleware)
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
}

// ========================
// HEALTH CHECK
// ========================

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ========================
// PUBLIC ROUTES (no auth)
// ========================

app.get("/api/menu", (_req, res) => {
  const data = readData();
  res.json(data);
});

app.get("/api/categories", (_req, res) => {
  const data = readData();
  res.json(data.categories);
});

app.get("/api/menu-items", (_req, res) => {
  const data = readData();
  res.json(data.menuItems);
});

// ========================
// AUTH
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
// ADMIN ROUTES (protected)
// ========================

// --- Categories ---
app.get("/api/admin/categories", authMiddleware, (_req, res) => {
  const data = readData();
  res.json(data.categories);
});

app.post("/api/admin/categories", authMiddleware, (req, res) => {
  const { id, label } = req.body;
  if (!isValidId(id)) {
    return res.status(400).json({ error: "id invalido (solo letras, numeros, guion y guion bajo)" });
  }
  if (!isNonEmptyString(label)) {
    return res.status(400).json({ error: "label es requerido" });
  }

  const data = readData();
  if (data.categories.find((c) => c.id === id)) {
    return res.status(409).json({ error: "Categoria ya existe" });
  }
  data.categories.push({ id, label: label.trim() });
  writeData(data);
  res.status(201).json({ id, label: label.trim() });
});

app.put("/api/admin/categories/:id", authMiddleware, (req, res) => {
  const { label } = req.body;
  if (label !== undefined && !isNonEmptyString(label)) {
    return res.status(400).json({ error: "label no puede estar vacio" });
  }

  const data = readData();
  const cat = data.categories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: "Categoria no encontrada" });

  cat.label = label ? label.trim() : cat.label;
  writeData(data);
  res.json(cat);
});

app.delete("/api/admin/categories/:id", authMiddleware, (req, res) => {
  const data = readData();
  const idx = data.categories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Categoria no encontrada" });

  data.categories.splice(idx, 1);
  data.menuItems = data.menuItems.filter((item) => item.category !== req.params.id);
  writeData(data);
  res.json({ message: "Categoria y sus items eliminados" });
});

// --- Menu Items ---
app.get("/api/admin/items", authMiddleware, (_req, res) => {
  const data = readData();
  res.json(data.menuItems);
});

app.post("/api/admin/items", authMiddleware, (req, res) => {
  const { id, category, name, description, price, image, modelAR } = req.body;
  if (!isValidId(id)) {
    return res.status(400).json({ error: "id invalido (solo letras, numeros, guion y guion bajo)" });
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
  if (image && !isSafePath(image)) {
    return res.status(400).json({ error: "Ruta de imagen no permitida" });
  }
  if (modelAR && !isSafePath(modelAR)) {
    return res.status(400).json({ error: "Ruta de modelo AR no permitida" });
  }

  const data = readData();
  if (data.menuItems.find((item) => item.id === id)) {
    return res.status(409).json({ error: "Item con ese id ya existe" });
  }

  const newItem = {
    id,
    category: category.trim(),
    name: name.trim(),
    description: description ? description.trim() : "",
    price: price.trim(),
    image: image || "/assets/IMG/comida.jfif",
    modelAR: modelAR || "",
  };
  data.menuItems.push(newItem);
  writeData(data);
  res.status(201).json(newItem);
});

app.put("/api/admin/items/:id", authMiddleware, (req, res) => {
  const data = readData();
  const item = data.menuItems.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Item no encontrado" });

  const { category, name, description, price, image, modelAR } = req.body;

  if (image !== undefined && image && !isSafePath(image)) {
    return res.status(400).json({ error: "Ruta de imagen no permitida" });
  }
  if (modelAR !== undefined && modelAR && !isSafePath(modelAR)) {
    return res.status(400).json({ error: "Ruta de modelo AR no permitida" });
  }

  if (category) item.category = category.trim();
  if (name) item.name = name.trim();
  if (description !== undefined) item.description = description.trim();
  if (price) item.price = price.trim();
  if (image) item.image = image;
  if (modelAR !== undefined) item.modelAR = modelAR;

  writeData(data);
  res.json(item);
});

app.delete("/api/admin/items/:id", authMiddleware, (req, res) => {
  const data = readData();
  const idx = data.menuItems.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Item no encontrado" });

  data.menuItems.splice(idx, 1);
  writeData(data);
  res.json({ message: "Item eliminado" });
});

// --- Change Password ---
app.put("/api/admin/password", authMiddleware, (req, res) => {
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

// SPA fallback: serve React app for non-API routes
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Centralized error handler (must be last)
app.use(errorHandler);

// --- Start ---
initAdmin();

// Export app for testing
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
