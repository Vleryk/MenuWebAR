const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isSupabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const supabase = isSupabaseEnabled
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseIntId(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parsePriceToInt(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value !== "string") return null;

  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;

  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return parsed;
}

function formatPrice(price) {
  if (!Number.isFinite(price)) return "$0";
  return `$${new Intl.NumberFormat("es-CL").format(price)}`;
}

function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIngredientsInput(ingredientsInput) {
  if (ingredientsInput === undefined || ingredientsInput === null) return [];

  const rawList = [];

  if (Array.isArray(ingredientsInput)) {
    for (const entry of ingredientsInput) {
      rawList.push(...String(entry).split(","));
    }
  } else if (typeof ingredientsInput === "string" || typeof ingredientsInput === "number") {
    rawList.push(...String(ingredientsInput).split(","));
  }

  const normalized = [];
  const seen = new Set();

  for (const entry of rawList) {
    const candidate = safeTrim(entry);
    if (!candidate) continue;

    const dedupeKey = candidate.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    normalized.push(candidate);
  }

  return normalized;
}

function mapCategoryRow(row) {
  return {
    id: String(row.id_categ),
    label: row.nombre_categ,
  };
}

function mapModeloRow(row) {
  return {
    id: String(row.id_model),
    label: row.nombre_model,
    src: row.url_model,
  };
}

function mapImagenRow(row) {
  return {
    id: String(row.id_image),
    label: row.nombre_image,
    src: row.url_image,
  };
}

function mapItemRow(row, lookups) {
  const imageSrc = lookups.imagenesById.get(row.imagen) || "/assets/IMG/comida.jfif";
  const ingredients = normalizeIngredientsInput(row.ingredientes);

  return {
    id: String(row.id),
    category: row.categoria !== null && row.categoria !== undefined ? String(row.categoria) : "",
    name: row.nombre || "",
    description: row.descripcion || "",
    price: formatPrice(row.precio),
    image: imageSrc,
    modelAR: row.modelo !== null && row.modelo !== undefined ? String(row.modelo) : "",
    ingredients,
  };
}

async function selectTable(table, columns, orderBy) {
  const query = supabase.from(table).select(columns);
  const response = orderBy ? await query.order(orderBy, { ascending: true }) : await query;

  if (response.error) {
    throw createHttpError(500, `Error consultando tabla ${table}: ${response.error.message}`);
  }

  return response.data || [];
}

async function getLookups() {
  const [modelosRows, imagenesRows] = await Promise.all([
    selectTable("modelos", "id_model,nombre_model,url_model", "id_model"),
    selectTable("imagenes", "id_image,nombre_image,url_image", "id_image"),
  ]);

  const modelosById = new Map(modelosRows.map((row) => [row.id_model, row.url_model]));
  const imagenesById = new Map(imagenesRows.map((row) => [row.id_image, row.url_image]));

  return {
    modelosRows,
    imagenesRows,
    modelosById,
    imagenesById,
  };
}

async function getNextId(table, column) {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .order(column, { ascending: false })
    .limit(1);

  if (error) {
    throw createHttpError(500, `No se pudo calcular siguiente id para ${table}: ${error.message}`);
  }

  const current = data && data.length > 0 ? data[0][column] : 0;
  return (current || 0) + 1;
}

async function ensureCategoriaExists(categoriaId) {
  const { data, error } = await supabase
    .from("categorias")
    .select("id_categ")
    .eq("id_categ", categoriaId)
    .maybeSingle();

  if (error) {
    throw createHttpError(500, `Error validando categoria: ${error.message}`);
  }

  if (!data) {
    throw createHttpError(400, "Categoria no encontrada");
  }
}

async function ensureModeloId(modelValue) {
  if (modelValue === undefined || modelValue === null || modelValue === "") {
    return null;
  }

  const modelId = parseIntId(modelValue);

  if (modelId !== null) {
    const { data, error } = await supabase
      .from("modelos")
      .select("id_model")
      .eq("id_model", modelId)
      .maybeSingle();

    if (error) {
      throw createHttpError(500, `Error validando modelo: ${error.message}`);
    }

    if (!data) {
      throw createHttpError(400, "Modelo AR no encontrado");
    }

    return modelId;
  }

  const trimmed = safeTrim(modelValue);

  const queryByName = await supabase
    .from("modelos")
    .select("id_model")
    .eq("nombre_model", trimmed)
    .maybeSingle();

  if (queryByName.error) {
    throw createHttpError(500, `Error validando modelo por nombre: ${queryByName.error.message}`);
  }

  if (queryByName.data) {
    return queryByName.data.id_model;
  }

  const queryByUrl = await supabase
    .from("modelos")
    .select("id_model")
    .eq("url_model", trimmed)
    .maybeSingle();

  if (queryByUrl.error) {
    throw createHttpError(500, `Error validando modelo por URL: ${queryByUrl.error.message}`);
  }

  if (queryByUrl.data) {
    return queryByUrl.data.id_model;
  }

  throw createHttpError(400, "Modelo AR no encontrado");
}

function deriveNameFromUrl(url, fallbackPrefix, fallbackId) {
  const candidate = safeTrim(url);
  if (!candidate) return `${fallbackPrefix} ${fallbackId}`;

  try {
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      const parsed = new URL(candidate);
      const segment = parsed.pathname.split("/").filter(Boolean).pop();
      if (segment) return segment;
    }
  } catch {
    // Ignorado: se usa fallback
  }

  const parts = candidate.split("/").filter(Boolean);
  const last = parts.pop();
  return last || `${fallbackPrefix} ${fallbackId}`;
}

async function ensureImagenId(imageValue) {
  const normalized = safeTrim(imageValue) || "/assets/IMG/comida.jfif";

  const parsedId = parseIntId(normalized);
  if (parsedId !== null) {
    const { data, error } = await supabase
      .from("imagenes")
      .select("id_image")
      .eq("id_image", parsedId)
      .maybeSingle();

    if (error) {
      throw createHttpError(500, `Error validando imagen: ${error.message}`);
    }

    if (!data) {
      throw createHttpError(400, "Imagen no encontrada");
    }

    return parsedId;
  }

  const existing = await supabase
    .from("imagenes")
    .select("id_image")
    .eq("url_image", normalized)
    .maybeSingle();

  if (existing.error) {
    throw createHttpError(500, `Error validando imagen por URL: ${existing.error.message}`);
  }

  if (existing.data) {
    return existing.data.id_image;
  }

  const newId = await getNextId("imagenes", "id_image");
  const newName = deriveNameFromUrl(normalized, "Imagen", newId);

  const inserted = await supabase
    .from("imagenes")
    .insert({
      id_image: newId,
      nombre_image: newName,
      url_image: normalized,
    })
    .select("id_image")
    .single();

  if (inserted.error) {
    throw createHttpError(500, `No se pudo crear imagen referenciada: ${inserted.error.message}`);
  }

  return inserted.data.id_image;
}

async function loadSupabaseData() {
  const [categoriesRows, platosRows, lookups] = await Promise.all([
    selectTable("categorias", "id_categ,nombre_categ", "id_categ"),
    selectTable(
      "platos",
      "id,nombre,descripcion,precio,categoria,imagen,modelo,ingredientes",
      "id",
    ),
    getLookups(),
  ]);

  const categories = categoriesRows.map(mapCategoryRow);
  const modelos = lookups.modelosRows.map(mapModeloRow);
  const imagenes = lookups.imagenesRows.map(mapImagenRow);
  const menuItems = platosRows.map((row) => mapItemRow(row, lookups));
  const uniqueIngredients = Array.from(new Set(menuItems.flatMap((item) => item.ingredients)));

  return {
    categories,
    modelos,
    imagenes,
    menuItems,
    ingredientes: uniqueIngredients.map((label, index) => ({
      id: String(index + 1),
      label,
    })),
  };
}

async function createModeloAsset(payload) {
  const modelSrc = safeTrim(payload.url || payload.src || payload.secure_url || payload.secureUrl);
  const modelLabel = safeTrim(payload.label || payload.name || "");

  if (!modelSrc) {
    throw createHttpError(400, "url es requerida");
  }

  if (!modelLabel) {
    throw createHttpError(400, "label es requerido");
  }

  const requestedId = parseIntId(payload.id || payload.name);
  const modelId = requestedId !== null ? requestedId : await getNextId("modelos", "id_model");

  const exists = await supabase
    .from("modelos")
    .select("id_model")
    .eq("id_model", modelId)
    .maybeSingle();

  if (exists.error) {
    throw createHttpError(500, `Error validando id de modelo: ${exists.error.message}`);
  }

  if (exists.data) {
    throw createHttpError(409, "Modelo con ese id ya existe");
  }

  const inserted = await supabase
    .from("modelos")
    .insert({
      id_model: modelId,
      nombre_model: modelLabel,
      url_model: modelSrc,
    })
    .select("id_model,nombre_model,url_model")
    .single();

  if (inserted.error) {
    throw createHttpError(500, `No se pudo crear modelo: ${inserted.error.message}`);
  }

  return mapModeloRow(inserted.data);
}

async function createImagenAsset(payload) {
  const imageSrc = safeTrim(payload.url || payload.src || payload.secure_url || payload.secureUrl);
  const imageLabel = safeTrim(payload.label || payload.name || "");

  if (!imageSrc) {
    throw createHttpError(400, "url es requerida");
  }

  if (!imageLabel) {
    throw createHttpError(400, "label es requerido");
  }

  const requestedId = parseIntId(payload.id || payload.name);
  const imageId = requestedId !== null ? requestedId : await getNextId("imagenes", "id_image");

  const exists = await supabase
    .from("imagenes")
    .select("id_image")
    .eq("id_image", imageId)
    .maybeSingle();

  if (exists.error) {
    throw createHttpError(500, `Error validando id de imagen: ${exists.error.message}`);
  }

  if (exists.data) {
    throw createHttpError(409, "Imagen con ese id ya existe");
  }

  const inserted = await supabase
    .from("imagenes")
    .insert({
      id_image: imageId,
      nombre_image: imageLabel,
      url_image: imageSrc,
    })
    .select("id_image,nombre_image,url_image")
    .single();

  if (inserted.error) {
    throw createHttpError(500, `No se pudo crear imagen: ${inserted.error.message}`);
  }

  return mapImagenRow(inserted.data);
}

async function createCategory(payload) {
  const categoryLabel = safeTrim(payload.label);
  if (!categoryLabel) {
    throw createHttpError(400, "label es requerido");
  }

  const requestedId = parseIntId(payload.id);
  const categoryId = requestedId !== null ? requestedId : await getNextId("categorias", "id_categ");

  const exists = await supabase
    .from("categorias")
    .select("id_categ")
    .eq("id_categ", categoryId)
    .maybeSingle();

  if (exists.error) {
    throw createHttpError(500, `Error validando id de categoria: ${exists.error.message}`);
  }

  if (exists.data) {
    throw createHttpError(409, "Categoria ya existe");
  }

  const inserted = await supabase
    .from("categorias")
    .insert({ id_categ: categoryId, nombre_categ: categoryLabel })
    .select("id_categ,nombre_categ")
    .single();

  if (inserted.error) {
    throw createHttpError(500, `No se pudo crear categoria: ${inserted.error.message}`);
  }

  return mapCategoryRow(inserted.data);
}

async function updateCategory(categoryIdParam, payload) {
  const categoryId = parseIntId(categoryIdParam);
  if (categoryId === null) {
    throw createHttpError(400, "Categoria no valida");
  }

  const categoryLabel = safeTrim(payload.label);
  if (!categoryLabel) {
    throw createHttpError(400, "label no puede estar vacio");
  }

  const updated = await supabase
    .from("categorias")
    .update({ nombre_categ: categoryLabel })
    .eq("id_categ", categoryId)
    .select("id_categ,nombre_categ")
    .maybeSingle();

  if (updated.error) {
    throw createHttpError(500, `No se pudo actualizar categoria: ${updated.error.message}`);
  }

  if (!updated.data) {
    throw createHttpError(404, "Categoria no encontrada");
  }

  return mapCategoryRow(updated.data);
}

async function deleteCategory(categoryIdParam) {
  const categoryId = parseIntId(categoryIdParam);
  if (categoryId === null) {
    throw createHttpError(400, "Categoria no valida");
  }

  const removedItems = await supabase.from("platos").delete().eq("categoria", categoryId);
  if (removedItems.error) {
    throw createHttpError(
      500,
      `No se pudieron eliminar platos de la categoria: ${removedItems.error.message}`,
    );
  }

  const removedCategory = await supabase
    .from("categorias")
    .delete()
    .eq("id_categ", categoryId)
    .select("id_categ")
    .maybeSingle();

  if (removedCategory.error) {
    throw createHttpError(500, `No se pudo eliminar categoria: ${removedCategory.error.message}`);
  }

  if (!removedCategory.data) {
    throw createHttpError(404, "Categoria no encontrada");
  }
}

async function createItem(payload) {
  const categoryId = parseIntId(payload.category);
  if (categoryId === null) {
    throw createHttpError(400, "category es requerido");
  }

  await ensureCategoriaExists(categoryId);

  const itemName = safeTrim(payload.name);
  if (!itemName) {
    throw createHttpError(400, "name es requerido");
  }

  const itemPrice = parsePriceToInt(payload.price);
  if (itemPrice === null) {
    throw createHttpError(400, "price es requerido");
  }

  const requestedId = parseIntId(payload.id);
  const itemId = requestedId !== null ? requestedId : await getNextId("platos", "id");

  const exists = await supabase.from("platos").select("id").eq("id", itemId).maybeSingle();
  if (exists.error) {
    throw createHttpError(500, `Error validando id de plato: ${exists.error.message}`);
  }

  if (exists.data) {
    throw createHttpError(409, "Item con ese id ya existe");
  }

  const imageId = await ensureImagenId(payload.image);
  const modelId = await ensureModeloId(payload.modelAR);
  const ingredients = normalizeIngredientsInput(payload.ingredients);

  const inserted = await supabase
    .from("platos")
    .insert({
      id: itemId,
      nombre: itemName,
      descripcion: safeTrim(payload.description),
      precio: itemPrice,
      categoria: categoryId,
      imagen: imageId,
      modelo: modelId,
      ingredientes: ingredients,
    })
    .select("id")
    .single();

  if (inserted.error) {
    throw createHttpError(500, `No se pudo crear plato: ${inserted.error.message}`);
  }

  return getItemById(inserted.data.id);
}

async function getItemById(itemId) {
  const numericId = parseIntId(itemId);
  if (numericId === null) {
    throw createHttpError(400, "Item no valido");
  }

  const [itemResponse, lookups] = await Promise.all([
    supabase
      .from("platos")
      .select("id,nombre,descripcion,precio,categoria,imagen,modelo,ingredientes")
      .eq("id", numericId)
      .maybeSingle(),
    getLookups(),
  ]);

  if (itemResponse.error) {
    throw createHttpError(500, `No se pudo consultar plato: ${itemResponse.error.message}`);
  }

  if (!itemResponse.data) {
    throw createHttpError(404, "Item no encontrado");
  }

  return mapItemRow(itemResponse.data, lookups);
}

async function updateItem(itemIdParam, payload) {
  const itemId = parseIntId(itemIdParam);
  if (itemId === null) {
    throw createHttpError(400, "Item no valido");
  }

  const existing = await supabase.from("platos").select("id").eq("id", itemId).maybeSingle();
  if (existing.error) {
    throw createHttpError(500, `No se pudo validar el item: ${existing.error.message}`);
  }

  if (!existing.data) {
    throw createHttpError(404, "Item no encontrado");
  }

  const updates = {};

  if (payload.category !== undefined) {
    const categoryId = parseIntId(payload.category);
    if (categoryId === null) {
      throw createHttpError(400, "category es requerido");
    }
    await ensureCategoriaExists(categoryId);
    updates.categoria = categoryId;
  }

  if (payload.name !== undefined) {
    const itemName = safeTrim(payload.name);
    if (!itemName) throw createHttpError(400, "name es requerido");
    updates.nombre = itemName;
  }

  if (payload.description !== undefined) {
    updates.descripcion = safeTrim(payload.description);
  }

  if (payload.price !== undefined) {
    const parsedPrice = parsePriceToInt(payload.price);
    if (parsedPrice === null) throw createHttpError(400, "price es requerido");
    updates.precio = parsedPrice;
  }

  if (payload.image !== undefined) {
    updates.imagen = await ensureImagenId(payload.image);
  }

  if (payload.modelAR !== undefined) {
    updates.modelo = await ensureModeloId(payload.modelAR);
  }

  if (payload.ingredients !== undefined) {
    updates.ingredientes = normalizeIngredientsInput(payload.ingredients);
  }

  const updated = await supabase.from("platos").update(updates).eq("id", itemId);

  if (updated.error) {
    throw createHttpError(500, `No se pudo actualizar item: ${updated.error.message}`);
  }

  return getItemById(itemId);
}

async function deleteItem(itemIdParam) {
  const itemId = parseIntId(itemIdParam);
  if (itemId === null) {
    throw createHttpError(400, "Item no valido");
  }

  const removed = await supabase
    .from("platos")
    .delete()
    .eq("id", itemId)
    .select("id")
    .maybeSingle();

  if (removed.error) {
    throw createHttpError(500, `No se pudo eliminar item: ${removed.error.message}`);
  }

  if (!removed.data) {
    throw createHttpError(404, "Item no encontrado");
  }
}

module.exports = {
  isSupabaseEnabled,
  loadSupabaseData,
  createModeloAsset,
  createImagenAsset,
  createCategory,
  updateCategory,
  deleteCategory,
  createItem,
  updateItem,
  deleteItem,
};
