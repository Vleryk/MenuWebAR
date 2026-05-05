// Esta es la capa de acceso a datos. Todo lo que tenga que ver con leer o
// escribir en Supabase pasa por aca. El server.js solo sabe de endpoints HTTP
// y llama a estas funciones.
//
// Hay una particularidad importante: el frontend trabaja con ids tipo string
// ("item-12", "cat-bebidas", "img-3") pero la BD usa integers autoincrement.
// Las funciones parseIntId / formatItemId se encargan de traducir en los dos
// sentidos.

const { createClient } = require("@supabase/supabase-js");
// bcrypt para hashear contraseñas de los usuarios secundarios. El super_admin
// sigue viviendo en admin.json (con su propio bcrypt), aca solo manejamos los
// que estan en la tabla usuarios.
const bcrypt = require("bcryptjs");

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

// Tope de colores que guardamos en el historial. Si se pasa, eliminamos los
// mas viejos. 8 es un buen numero porque entra justo en una fila visual
// debajo de los presets sin saturar la UI.
const HISTORIAL_COLORES_MAX = 8;
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// Lista canonica de claves de permisos. La usamos para validar que solo
// guardemos columnas validas y para mapear entre el formato del frontend
// (camelCase) y la BD (snake_case). Si agregas un permiso nuevo a la tabla,
// agregalo aca tambien.
const PERMISSION_KEYS = [
  "puede_crear_platos",
  "puede_editar_platos",
  "puede_eliminar_platos",
  "puede_gestionar_categorias",
  "puede_subir_archivos",
  "puede_eliminar_archivos",
  "puede_gestionar_usuarios",
];

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

// Decide si un descuento esta activo AHORA mismo, comparando con el reloj
// del server (no del cliente) para evitar trampas de zona horaria del navegador.
// Reglas:
//   - descuento debe ser > 0
//   - si hay descuento_inicio, NOW() debe ser >= inicio (si no, todavia no arranca)
//   - si hay descuento_fin, NOW() debe ser <= fin (si no, ya termino)
//   - inicio o fin pueden ser null (significa "sin limite por ese lado")
function isDescuentoActive(descuento, inicio, fin, now = Date.now()) {
  if (!descuento || descuento <= 0) return false;
  if (inicio) {
    const ini = new Date(inicio).getTime();
    if (Number.isFinite(ini) && now < ini) return false;
  }
  if (fin) {
    const f = new Date(fin).getTime();
    if (Number.isFinite(f) && now > f) return false;
  }
  return true;
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
//
// Tambien calculamos el estado del descuento aca: el frontend recibe banderas
// "discountActive" + "discountedPrice" listas para usar, sin tener que volver
// a comparar fechas ni hacer cuentas. El server es la fuente de verdad de la
// hora actual, asi que el cliente no puede hacer trampa cambiando su reloj.
function mapItemRow(row, { categoriesById, imagenesById, modelosById }) {
  const category = categoriesById.get(row.categoria);
  const imagen = row.imagen != null ? imagenesById.get(row.imagen) : null;
  const modelo = row.modelo != null ? modelosById.get(row.modelo) : null;

  // calcula precio con descuento aplicado, redondeando a entero porque el
  // precio base se guarda como int (pesos chilenos sin decimales)
  const descuento = Number.isInteger(row.descuento) ? row.descuento : 0;
  const active = isDescuentoActive(descuento, row.descuento_inicio, row.descuento_fin);
  const discountedPrice = active ? Math.round(row.precio * (1 - descuento / 100)) : row.precio;

  return {
    id: formatItemId(row.id),
    name: row.nombre,
    description: row.descripcion || "",
    // mantengo "price" como el precio BASE (lo que cobras sin descuento) por
    // compatibilidad con el resto del codigo. discountedPrice trae el final.
    price: String(row.precio),
    category: category ? category.id : null,
    image: imagen ? imagen.src : "",
    modelAR: modelo ? modelo.id : "",
    ingredients: Array.isArray(row.ingredientes) ? row.ingredientes : [],
    cardColor: row.cardColor || "#152238",
    cardMessage: row.cardMessage || null,
    // campos crudos del descuento (para que el admin pueda editarlos)
    descuento, // 0-100
    descuentoInicio: row.descuento_inicio || null,
    descuentoFin: row.descuento_fin || null,
    // banderas calculadas server-side (para que la card publica las use directo)
    discountActive: active,
    discountedPrice: String(discountedPrice),
  };
}

// Convierte una fila de la tabla usuarios en el formato que ve el frontend.
// NUNCA devolvemos password_hash al cliente, eso queda solo server side.
function mapUsuarioRow(row) {
  const permissions = {};
  for (const key of PERMISSION_KEYS) {
    permissions[key] = Boolean(row[key]);
  }
  return {
    id: row.id_usuario,
    email: row.email,
    permissions,
    createdAt: row.creado_en,
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

// Helper para pasar los campos de descuento del payload del frontend a las
// columnas reales de la BD. Acepta strings vacios y los convierte a null
// para que la BD no falle (las columnas timestamptz no aceptan "").
//
// Reglas:
//   - descuento se castea a int en rango 0-100. Fuera de rango -> 400.
//   - descuentoInicio / descuentoFin: string vacio o null -> null.
//                                    string no vacio -> se valida que sea
//                                    una fecha parseable.
//   - si fin < inicio, error.
function buildDescuentoPayload({ descuento, descuentoInicio, descuentoFin }) {
  const out = {};

  if (descuento !== undefined) {
    const n = parseInt(descuento, 10);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      throw httpError(400, "descuento debe ser un entero entre 0 y 100");
    }
    out.descuento = n;
  }

  if (descuentoInicio !== undefined) {
    if (descuentoInicio === null || descuentoInicio === "") {
      out.descuento_inicio = null;
    } else {
      const d = new Date(descuentoInicio);
      if (Number.isNaN(d.getTime())) throw httpError(400, "descuentoInicio invalido");
      out.descuento_inicio = d.toISOString();
    }
  }

  if (descuentoFin !== undefined) {
    if (descuentoFin === null || descuentoFin === "") {
      out.descuento_fin = null;
    } else {
      const d = new Date(descuentoFin);
      if (Number.isNaN(d.getTime())) throw httpError(400, "descuentoFin invalido");
      out.descuento_fin = d.toISOString();
    }
  }

  // chequeo cruzado: si vienen ambas fechas y fin es menor que inicio, error
  if (out.descuento_inicio && out.descuento_fin) {
    if (new Date(out.descuento_fin) < new Date(out.descuento_inicio)) {
      throw httpError(400, "descuentoFin no puede ser anterior a descuentoInicio");
    }
  }

  return out;
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
    descuento,
    descuentoInicio,
    descuentoFin,
  } = payload;

  const fks = await resolveItemFks({ category, image, modelAR });

  // El precio viene como string ("$12.990"), lo convertimos a int quitando
  // todo lo que no sea digito.
  const priceInt = parseInt(String(price).replace(/[^\d]/g, ""), 10);
  if (Number.isNaN(priceInt)) throw httpError(400, "precio invalido");

  // descuento + fechas: defaults sensatos si no vinieron en el payload
  const descPayload = buildDescuentoPayload({
    descuento: descuento === undefined ? 0 : descuento,
    descuentoInicio,
    descuentoFin,
  });

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
    ...descPayload,
  };

  const { data, error } = await supabase.from("platos").insert(insertRow).select().single();
  if (error) throw httpError(500, error.message);

  // Si el plato se creo con un cardColor valido lo guardamos al historial.
  // Lo hacemos en background (sin await que bloquee la respuesta) y silenciamos
  // errores: si falla, no queremos romper el flujo de crear plato por algo
  // secundario como esto.
  if (insertRow.cardColor && HEX_COLOR_RE.test(insertRow.cardColor)) {
    pushColorToHistorial(insertRow.cardColor).catch((e) =>
      console.warn("No se pudo guardar color en historial:", e.message),
    );
  }

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

  // descuento + fechas: solo se incluyen si vinieron explicitamente en el
  // payload. Asi un PUT que no toca estos campos no los pisa.
  const descPayload = buildDescuentoPayload({
    descuento: payload.descuento,
    descuentoInicio: payload.descuentoInicio,
    descuentoFin: payload.descuentoFin,
  });
  Object.assign(updateRow, descPayload);

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

  // Mismo razonamiento que en createItem: si el update incluyo un cardColor
  // valido, lo empujamos al historial. Background, errores silenciados.
  if (updateRow.cardColor && HEX_COLOR_RE.test(updateRow.cardColor)) {
    pushColorToHistorial(updateRow.cardColor).catch((e) =>
      console.warn("No se pudo guardar color en historial:", e.message),
    );
  }

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
// HISTORIAL DE COLORES
// =====================================================
// Tabla independiente que guarda los ultimos colores usados en cardColor,
// para que el admin pueda reusarlos rapido sin tener que acordarse del hex.
// La PK es el color mismo (varchar(7)) asi que upsert por color = dedupe
// automatico, solo se actualiza el used_at.

async function listColorHistorial() {
  requireClient();

  // Traemos los mas recientes primero. Limit + 1 para evitar pedir mas de los
  // que vamos a mostrar igual.
  const { data, error } = await supabase
    .from("historial_colores")
    .select("color, used_at")
    .order("used_at", { ascending: false })
    .limit(HISTORIAL_COLORES_MAX);

  if (error) throw httpError(500, error.message);
  return (data || []).map((r) => r.color);
}

// Inserta o actualiza el timestamp del color, y deja en la tabla solo los
// MAX mas recientes. Hacemos podado dentro de la misma funcion para que la
// tabla nunca crezca indefinidamente.
async function pushColorToHistorial(color) {
  requireClient();

  if (typeof color !== "string" || !HEX_COLOR_RE.test(color)) {
    throw httpError(400, "color invalido (formato esperado #RRGGBB)");
  }

  // Normalizamos a minusculas para evitar tener "#FF0000" y "#ff0000" como
  // dos entradas distintas.
  const normalized = color.toLowerCase();

  // upsert con onConflict en la PK (color) -> si ya existe, refresca used_at.
  // Asi un color usado de nuevo se mueve al tope sin duplicar fila.
  const { error: upErr } = await supabase
    .from("historial_colores")
    .upsert({ color: normalized, used_at: new Date().toISOString() }, { onConflict: "color" });

  if (upErr) throw httpError(500, upErr.message);

  // Podado: traemos todos ordenados por used_at desc, y borramos los que
  // queden fuera del top MAX. Esto evita que la tabla crezca para siempre.
  const { data: allRows, error: listErr } = await supabase
    .from("historial_colores")
    .select("color, used_at")
    .order("used_at", { ascending: false });

  if (listErr) throw httpError(500, listErr.message);

  if (allRows && allRows.length > HISTORIAL_COLORES_MAX) {
    const toDelete = allRows.slice(HISTORIAL_COLORES_MAX).map((r) => r.color);
    const { error: delErr } = await supabase
      .from("historial_colores")
      .delete()
      .in("color", toDelete);
    if (delErr) throw httpError(500, delErr.message);
  }

  return { color: normalized };
}

// =====================================================
// USUARIOS
// =====================================================
// Usuarios secundarios con permisos granulares. El super_admin sigue en
// admin.json y bypasea estos checks (server.js lo maneja). Aca solo
// administramos los que estan en la tabla usuarios.

// Sanitiza un objeto de permisos quedandose solo con las claves validas y
// convirtiendo a boolean. Asi si el frontend manda algo raro (clave extra
// o valor no booleano) no lo guardamos en BD.
function sanitizePermissions(permissions) {
  const clean = {};
  if (!permissions || typeof permissions !== "object") {
    for (const key of PERMISSION_KEYS) clean[key] = false;
    return clean;
  }
  for (const key of PERMISSION_KEYS) {
    clean[key] = Boolean(permissions[key]);
  }
  return clean;
}

// Lista todos los usuarios. NO devuelve password_hash (mapUsuarioRow lo omite).
async function listUsuarios() {
  requireClient();

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .order("id_usuario", { ascending: true });

  if (error) throw httpError(500, error.message);
  return (data || []).map(mapUsuarioRow);
}

// Busca un usuario por email para el flujo de login. Devuelve la fila CRUDA
// con password_hash incluido (lo necesitamos para comparar). Esta funcion no
// se expone al cliente, solo la usa el endpoint /api/auth/login del server.
async function findUsuarioByEmail(email) {
  requireClient();
  if (typeof email !== "string" || !email.trim()) return null;

  // Comparacion case-insensitive: el index lower(email) hace que esto sea
  // rapido aunque parezca un escaneo.
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .ilike("email", email.trim())
    .maybeSingle();

  if (error) throw httpError(500, error.message);
  return data; // puede ser null si no existe
}

async function createUsuario({ email, password, permissions }) {
  requireClient();

  if (typeof email !== "string" || !email.trim()) {
    throw httpError(400, "email es requerido");
  }
  if (typeof password !== "string" || password.length < 6) {
    throw httpError(400, "password debe tener al menos 6 caracteres");
  }

  const cleanPerms = sanitizePermissions(permissions);
  const password_hash = bcrypt.hashSync(password, 10);

  const insertRow = {
    email: email.trim(),
    password_hash,
    ...cleanPerms,
  };

  const { data, error } = await supabase.from("usuarios").insert(insertRow).select().single();

  if (error) {
    // Postgres devuelve codigo 23505 cuando se viola un UNIQUE (email duplicado)
    if (error.code === "23505") {
      throw httpError(409, "Ya existe un usuario con ese email");
    }
    throw httpError(500, error.message);
  }
  return mapUsuarioRow(data);
}

// Actualiza un usuario. password y permissions son opcionales, solo se
// modifica lo que venga en el payload. email tambien se puede cambiar.
async function updateUsuario(id, { email, password, permissions }) {
  requireClient();

  const intId = typeof id === "string" ? parseInt(id, 10) : id;
  if (!Number.isInteger(intId)) throw httpError(400, "id de usuario invalido");

  const updateRow = {};

  if (email !== undefined) {
    if (typeof email !== "string" || !email.trim()) {
      throw httpError(400, "email no puede estar vacio");
    }
    updateRow.email = email.trim();
  }

  if (password !== undefined && password !== null && password !== "") {
    if (typeof password !== "string" || password.length < 6) {
      throw httpError(400, "password debe tener al menos 6 caracteres");
    }
    updateRow.password_hash = bcrypt.hashSync(password, 10);
  }

  if (permissions !== undefined) {
    Object.assign(updateRow, sanitizePermissions(permissions));
  }

  if (Object.keys(updateRow).length === 0) {
    throw httpError(400, "Nada que actualizar");
  }

  const { data, error } = await supabase
    .from("usuarios")
    .update(updateRow)
    .eq("id_usuario", intId)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw httpError(409, "Ya existe un usuario con ese email");
    }
    throw httpError(500, error.message);
  }
  if (!data) throw httpError(404, "Usuario no encontrado");
  return mapUsuarioRow(data);
}

async function deleteUsuario(id) {
  requireClient();

  const intId = typeof id === "string" ? parseInt(id, 10) : id;
  if (!Number.isInteger(intId)) throw httpError(400, "id de usuario invalido");

  const { error } = await supabase.from("usuarios").delete().eq("id_usuario", intId);
  if (error) throw httpError(500, error.message);

  return { deleted: true };
}

// Verifica un par email+password contra la tabla usuarios. Devuelve los datos
// del usuario sin password_hash si matchea, o null si no. La uso desde el
// login del server.js.
async function verifyUsuarioPassword(email, password) {
  const row = await findUsuarioByEmail(email);
  if (!row) return null;

  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return null;

  return mapUsuarioRow(row);
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
  // historial de colores: usados por server.js para exponer endpoints
  listColorHistorial,
  pushColorToHistorial,
  // usuarios: gestion de cuentas secundarias con permisos granulares
  PERMISSION_KEYS,
  listUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  verifyUsuarioPassword,
};
