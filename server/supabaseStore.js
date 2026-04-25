// Esta es la capa de acceso a datos. Todo lo que tenga que ver con leer o
// escribir en Supabase pasa por aca. El server.js solo sabe de endpoints HTTP
// y llama a estas funciones.
//
// Hay una particularidad importante: el frontend trabaja con ids tipo string
// ("item-12", "cat-bebidas", "img-3") pero la BD usa integers autoincrement.
// Las funciones parseIntId / formatItemId se encargan de traducir en los dos
// sentidos.

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// El store se puede deshabilitar si faltan las env vars. El server chequea
// este flag antes de llamar cualquier funcion para devolver 503 en vez de
// crashear.
const isSupabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

// Service role key es la KEY DE ADMIN de Supabase. No persistimos sesion ni
// auto-refresh porque no hay usuario logueado, este cliente es server-side
// puro.
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

// Los errores que tiran estas funciones llevan un .status que el server.js usa
// para devolver el codigo HTTP correcto.
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

// El frontend manda ids como "item-12", "cat-5", "img-3". En la BD son numeros.
// Esta funcion extrae el numero final del string.
function parseIntId(stringId) {
  if (typeof stringId !== "string") return null;
  const match = stringId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

// Funciones inversas: de numero de BD a string que espera el frontend.
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
// La BD tiene nombres en español (nombre_categ, url_image, etc). El frontend
// usa nombres en ingles (label, src). Estos mappers normalizan la forma.

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

// El mapper de platos es mas complicado porque tiene FKs a 3 tablas
// (categoria, imagen, modelo). Le pasamos los indices ya armados para no
// tener que hacer .find() lineal por cada plato.
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

// Carga TODO de una vez (las 4 tablas en paralelo) y arma los objetos que
// espera el frontend. Se usa tanto para el menu publico como para el admin.
// Es un poco pesado pero el dataset es chico (pocas decenas de platos) asi
// que no vale la pena optimizar todavia.
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

  // Para resolver las FKs en los platos armamos Maps por id numerico.
  // Esto convierte un .find() O(n) en un .get() O(1).
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

  // Insertamos sin id, la BD lo genera sola (identity autoincrement).
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

  // Construimos el payload solo con los campos que vinieron. Si label viene
  // undefined no lo incluimos.
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

  // Borramos los platos asociados ANTES de borrar la categoria. Tecnicamente
  // la FK tiene ON DELETE CASCADE, pero lo hacemos explicito para mas control
  // y por si hay que hacer algo extra con los platos en el futuro.
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

// Borrar una imagen es un poco delicado: si algun plato la estaba usando, hay
// que dejar esa columna en null para no romper la FK. Despues borramos la fila
// de imagenes y devolvemos la URL para que el server.js pueda borrar tambien
// de Cloudinary.
async function deleteImagenAsset(stringId) {
  requireClient();
  const intId = parseIntId(stringId);
  if (intId == null) throw httpError(400, "id de imagen invalido");

  // Primero sacamos la URL antes de borrar, la necesitamos para devolverla.
  const { data: existing, error: fetchErr } = await supabase
    .from("imagenes")
    .select("url_image")
    .eq("id_image", intId)
    .single();

  if (fetchErr) throw httpError(404, "Imagen no encontrada");

  // Limpiar las referencias en platos que usaban esta imagen.
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

// Resuelve las FKs de un plato. El frontend manda strings (category="cat-5",
// image="https://...", modelAR="mod-3") y la BD necesita integers
// (categoria=5, imagen=12, modelo=3). Esta funcion hace la traduccion.
//
// Para imagen es un caso especial: el frontend no manda el id de la imagen,
// manda la URL. Hacemos un lookup por url_image para encontrar el id_image.
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
      // El frontend guarda la URL de Cloudinary directamente, no el id.
      // Buscamos por url_image.
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

  // El precio viene como string ("$12.990"), lo convertimos a int quitando
  // todo lo que no sea digito.
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

  // Para devolver el plato con las relaciones resueltas (no solo los int ids)
  // recargamos todo y buscamos el recien creado. Es un poco costoso pero
  // mantiene la consistencia del formato de respuesta.
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

  // Armamos el update solo con los campos que vinieron. Asi podemos hacer
  // updates parciales sin pisar datos.
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

  // Misma logica que en create: recargamos para devolver con relaciones.
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
