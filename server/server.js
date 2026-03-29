const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || "route66-admin-secret-change-in-production";
const DATA_FILE = path.join(__dirname, "data", "menu.json");

// --- Admin credentials (hashed on first run) ---
const ADMIN_FILE = path.join(__dirname, "data", "admin.json");

function initAdmin() {
  if (!fs.existsSync(ADMIN_FILE)) {
    const hash = bcrypt.hashSync("Hublab2026", 10);
    fs.writeFileSync(
      ADMIN_FILE,
      JSON.stringify({ username: "Administrador@Hublab.cl", password: hash }, null, 2)
    );
    console.log("Admin creado: usuario=Administrador@Hublab.cl (cambiar en produccion)");
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

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

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

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña requeridos" });
  }

  const admin = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf-8"));
  if (username !== admin.username || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "8h" });
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
  if (!id || !label) return res.status(400).json({ error: "id y label requeridos" });

  const data = readData();
  if (data.categories.find((c) => c.id === id)) {
    return res.status(409).json({ error: "Categoria ya existe" });
  }
  data.categories.push({ id, label });
  writeData(data);
  res.status(201).json({ id, label });
});

app.put("/api/admin/categories/:id", authMiddleware, (req, res) => {
  const { label } = req.body;
  const data = readData();
  const cat = data.categories.find((c) => c.id === req.params.id);
  if (!cat) return res.status(404).json({ error: "Categoria no encontrada" });

  cat.label = label || cat.label;
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
  if (!id || !category || !name || !price) {
    return res.status(400).json({ error: "id, category, name y price son requeridos" });
  }

  const data = readData();
  if (data.menuItems.find((item) => item.id === id)) {
    return res.status(409).json({ error: "Item con ese id ya existe" });
  }

  const newItem = {
    id,
    category,
    name,
    description: description || "",
    price,
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
  if (category) item.category = category;
  if (name) item.name = name;
  if (description !== undefined) item.description = description;
  if (price) item.price = price;
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

// --- Start ---
initAdmin();
app.listen(PORT, () => {
  console.log(`API headless corriendo en http://localhost:${PORT}`);
});
