const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isSupabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const supabase = isSupabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

if (!isSupabaseEnabled) {
  console.warn(
    "WARNING: Supabase no configurado (falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY).",
  );
}

// =====================================================
// HELPERS
// =====================================================

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function requireClient() {
  if (!supabase) {
    throw httpError(503, "Supabase no esta configurado");
  }
}

// Los IDs del frontend son strings tipo "item-1", "cat-bebidas".
// La BD usa integer. Estas funciones extraen el numero del id string.
function parseIntId(stringId) {
  if (typeof stringId !== "string") return null;
  const match = stringId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function formatItemId(intId) {
  return `item-${intId}`;
}

function formatCategoryId(intId) {
  return `cat-${intId}`;
}

function formatImagenId(intId) {
  return `img-${intId}`;
}

function formatModeloId(intId) {
  return `mod-${intId}`;
}

// =====================================================
// MAPEOS BD -> FRONTEND
// =====================================================

function mapCategoryRow(row) {
  return {
    id: formatCategoryId(row.id_categ),
    label: row.nombre_categ,
  };
}

function mapImagenRow(row) {
  return {
    id: formatImagenId(row.id_image),
    label: row.nombre_image,
    src: row.url_image,
  };
}

function mapModeloRow(row) {
  return {
    id: formatModeloId(row.id_model),
    label: row.nombre_model,
    src: row.url_model,
  };
}

function mapItemRow(row, { categoriesById, imagenesById, modelosById }) {
  const category = categoriesById.get(row.categoria);
  const imagen = row.imagen != null ? imagenesById.get(row.imagen) : null;
  const modelo = row.modelo != null ? modelosById.get(row.modelo) : null;

  return {
    id: formatItemId(row.id),
    name: row.nombre,
    description: row.descripcion || "",
    price: String(row.precio),
    category: category ? category.id : null,
    image: imagen ? imagen.src : "",
    modelAR: modelo ? modelo.id : "",
    ingredients: Array.isArray(row.ingredientes) ? row.ingredientes : [],
    cardColor: row.cardColor || "#152238",
    cardMessage: row.cardMessage || null,
  };
}

// =====================================================
// LOAD ALL DATA
// =====================================================

async function loadSupabaseData() {
  requireClient();

  const [catsRes, imgsRes, modsRes, itemsRes] = await Promise.all([
    supabase.from("categorias").select("*").order("id_categ"),
    supabase.from("imagenes").select("*").order("id_image"),
    supabase.from("modelos").select("*").order("id_model"),
    supabase.from("platos").select("*").order("id"),
  ]);

  if (catsRes.error) throw httpError(500, `Error cargando categorias: ${catsRes.error.message}`);
  if (imgsRes.error) throw httpError(500, `Error cargando imagenes: ${imgsRes.error.message}`);
  if (modsRes.error) throw httpError(500, `Error cargando modelos: ${modsRes.error.message}`);
  if (itemsRes.error) throw httpError(500, `Error cargando platos: ${itemsRes.error.message}`);

  const categories = catsRes.data.map(mapCategoryRow);
  const imagenes = imgsRes.data.map(mapImagenRow);
  const modelos = modsRes.data.map(mapModeloRow);

  // Indices por id numerico para resolver FKs
  const categoriesById = new Map(catsRes.data.map((r) => [r.id_categ, mapCategoryRow(r)]));
  const imagenesById = new Map(imgsRes.data.map((r) => [r.id_image, mapImagenRow(r)]));
  const modelosById = new Map(modsRes.data.map((r) => [r.id_model, mapModeloRow(r)]));

  const menuItems = itemsRes.data.map((row) =>
    mapItemRow(row, { categoriesById, imagenesById, modelosById }),
  );

  return { categories, imagenes, modelos, menuItems };
}

// =====================================================
// CATEGORIES
// =====================================================

async function createCategory({ label }) {
  requireClient();

  const { data, error } = await supabase
    .from("categorias")
    .insert({ nombre_categ: label })
    .select()
    .single();

  if (error) throw httpError(500, error.message);
  return mapCategoryRow(data);
}

async function updateCategory(stringId, { label }) {
  requireClient();
  const intId = parseIntId(stringId);
  if (intId == null) throw httpError(400, "id de categoria invalido");

  const payload = {};
  if (label !== undefined) payload.nombre_categ = label;

  const { data, error } = await supabase
    .from("categorias")
    .update(payload)
    .eq("id_categ", intId)
    .select()
    .single();

  if (error) throw httpError(500, error.message);
  if (!data) throw httpError(404, "Categoria no encontrada");
  return mapCategoryRow(data);
}

async function deleteCategory(stringId) {
  requireClient();
  const intId = parseIntId(stringId);
  if (intId == null) throw httpError(400, "id de categoria invalido");

  // Borrar platos asociados primero
  const { error: platosErr } = await supabase.from("platos").delete().eq("categoria", intId);
  if (platosErr) throw httpError(500, platosErr.message);

  const { error } = await supabase.from("categorias").delete().eq("id_categ", intId);
  if (error) throw httpError(500, error.message);

  return { deleted: true };
}

// =====================================================
// IMAGENES
// =====================================================

async function createImagenAsset({ label, url }) {
  requireClient();

  const { data, error } = await supabase
    .from("imagenes")
    .insert({ nombre_image: label, url_image: url })
    .select()
    .single();

  if (error) throw httpError(500, error.message);
  return mapImagenRow(data);
}

async function deleteImagenAsset(stringId) {
  requireClient();
  const intId = parseIntId(stringId);
  if (intId == null) throw httpError(400, "id de imagen invalido");

  const { data: existing, error: fetchErr } = await supabase
    .from("imagenes")
    .select("url_image")
    .eq("id_image", intId)
    .single();

  if (fetchErr) throw httpError(404, "Imagen no encontrada");

  // Limpiar referencias en platos
  const { error: refErr } = await supabase
    .from("platos")
    .update({ imagen: null })
    .eq("imagen", intId);
  if (refErr) throw httpError(500, refErr.message);

  const { error } = await supabase.from("imagenes").delete().eq("id_image", intId);
  if (error) throw httpError(500, error.message);

  return { deleted: true, url: existing.url_image };
}

// =====================================================
// MODELOS
// =====================================================

async function createModeloAsset({ label, url }) {
  requireClient();

  const { data, error } = await supabase
    .from("modelos")
    .insert({ nombre_model: label, url_model: url })
    .select()
    .single();

  if (error) throw httpError(500, error.message);
  return mapModeloRow(data);
}

// =====================================================
// ITEMS (PLATOS)
// =====================================================

async function resolveItemFks({ category, image, modelAR }) {
  const result = {};

  if (category !== undefined) {
    const catIntId = parseIntId(category);
    if (catIntId == null) throw httpError(400, "category id invalido");
    result.categoria = catIntId;
  }

  if (image !== undefined) {
    if (!image) {
      result.imagen = null;
    } else {
      // image viene como URL; resolver id_image por url_image
      const { data, error } = await supabase
        .from("imagenes")
        .select("id_image")
        .eq("url_image", image)
        .maybeSingle();
      if (error) throw httpError(500, error.message);
      if (!data) throw httpError(400, "Imagen no registrada en BD");
      result.imagen = data.id_image;
    }
  }

  if (modelAR !== undefined) {
    if (!modelAR) {
      result.modelo = null;
    } else {
      const modIntId = parseIntId(modelAR);
      if (modIntId == null) throw httpError(400, "modelAR id invalido");
      result.modelo = modIntId;
    }
  }

  return result;
}

async function createItem(payload) {
  requireClient();

  const {
    category,
    name,
    description,
    price,
    image,
    modelAR,
    ingredients,
    cardColor,
    cardMessage,
  } = payload;

  const fks = await resolveItemFks({ category, image, modelAR });

  const priceInt = parseInt(String(price).replace(/[^\d]/g, ""), 10);
  if (Number.isNaN(priceInt)) throw httpError(400, "precio invalido");

  const insertRow = {
    nombre: name,
    descripcion: description || "",
    precio: priceInt,
    categoria: fks.categoria,
    imagen: fks.imagen ?? null,
    modelo: fks.modelo ?? null,
    ingredientes: Array.isArray(ingredients) ? ingredients : [],
    cardColor: cardColor || "#152238",
    cardMessage: cardMessage && cardMessage.trim() ? cardMessage.trim() : null,
  };

  const { data, error } = await supabase.from("platos").insert(insertRow).select().single();
  if (error) throw httpError(500, error.message);

  // Recargar con FKs resueltos
  const all = await loadSupabaseData();
  const found = all.menuItems.find((i) => i.id === formatItemId(data.id));
  return (
    found ||
    mapItemRow(data, {
      categoriesById: new Map(),
      imagenesById: new Map(),
      modelosById: new Map(),
    })
  );
}

async function updateItem(stringId, payload) {
  requireClient();
  const intId = parseIntId(stringId);
  if (intId == null) throw httpError(400, "id de plato invalido");

  const updateRow = {};

  if (payload.name !== undefined) updateRow.nombre = payload.name;
  if (payload.description !== undefined) updateRow.descripcion = payload.description || "";
  if (payload.price !== undefined) {
    const priceInt = parseInt(String(payload.price).replace(/[^\d]/g, ""), 10);
    if (Number.isNaN(priceInt)) throw httpError(400, "precio invalido");
    updateRow.precio = priceInt;
  }
  if (payload.ingredients !== undefined) {
    updateRow.ingredientes = Array.isArray(payload.ingredients) ? payload.ingredients : [];
  }
  if (payload.cardColor !== undefined) {
    updateRow.cardColor = payload.cardColor || "#152238";
  }
  if (payload.cardMessage !== undefined) {
    updateRow.cardMessage =
      payload.cardMessage && String(payload.cardMessage).trim()
        ? String(payload.cardMessage).trim()
        : null;
  }

  const fks = await resolveItemFks({
    category: payload.category,
    image: payload.image,
    modelAR: payload.modelAR,
  });
  Object.assign(updateRow, fks);

  if (Object.keys(updateRow).length === 0) {
    throw httpError(400, "Nada que actualizar");
  }

  const { data, error } = await supabase
    .from("platos")
    .update(updateRow)
    .eq("id", intId)
    .select()
    .single();

  if (error) throw httpError(500, error.message);
  if (!data) throw httpError(404, "Plato no encontrado");

  const all = await loadSupabaseData();
  const found = all.menuItems.find((i) => i.id === formatItemId(data.id));
  return (
    found ||
    mapItemRow(data, {
      categoriesById: new Map(),
      imagenesById: new Map(),
      modelosById: new Map(),
    })
  );
}

async function deleteItem(stringId) {
  requireClient();
  const intId = parseIntId(stringId);
  if (intId == null) throw httpError(400, "id de plato invalido");

  const { error } = await supabase.from("platos").delete().eq("id", intId);
  if (error) throw httpError(500, error.message);

  return { deleted: true };
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  isSupabaseEnabled,
  loadSupabaseData,
  createCategory,
  updateCategory,
  deleteCategory,
  createImagenAsset,
  deleteImagenAsset,
  createModeloAsset,
  createItem,
  updateItem,
  deleteItem,
};
