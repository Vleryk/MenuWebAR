// =============================================================================
// AdminDashboard.jsx
// =============================================================================
// Dashboard principal del admin. Es el componente mas grande del proyecto
// porque contiene todo el CRUD: platos, categorias, subida de archivos,
// selector de imagenes, selector de modelos 3D, etc.
//
// Estructura del archivo (de arriba a abajo):
//   - AdminDashboard      -> componente raiz: maneja auth, tabs y carga de datos
//   - SuccessModal        -> modal verde de confirmacion (auto-cierra en 3s)
//   - ImageModal          -> modal para elegir/borrar imagenes guardadas
//   - ModelModal          -> modal para elegir/borrar modelos 3D guardados
//   - Section             -> [NUEVO] wrapper de seccion colapsable con header
//   - Tooltip             -> [NUEVO] icono "?" con texto al hacer hover/focus
//   - FieldStatus         -> [NUEVO] icono ✓/✗ inline para mostrar validacion
//   - LivePreview         -> [NUEVO] vista previa en vivo de la card del plato
//   - generateItemId      -> helper: ids de plato tipo "item-N"
//   - generateCategoryId  -> helper: ids slug de categoria
//   - formatPriceCLP      -> [NUEVO] helper: formatea numero a "$12.990"
//   - unformatPrice       -> [NUEVO] helper: extrae digitos de un precio
//   - ItemsPanel          -> formulario y vista tipo menu de platos
//   - CategoriesPanel     -> formulario y tabla de categorias
//   - UploadPanel         -> wrapper del uploader a Cloudinary
//
// Flujo de autenticacion:
//   1. Al montar, llamamos verifyToken() para chequear si el JWT sigue valido.
//   2. Mientras chequea, mostramos "Verificando sesion...".
//   3. Si es valido -> renderiza el dashboard.
//   4. Si no -> renderiza <AdminLogin/> que setea authenticated=true al loguear.
//
// Flujo de datos:
//   - Todos los datos (categorias, items, modelos, imagenes) viven en este
//     componente raiz y se pasan por props a los paneles hijos.
//   - Cada vez que se crea/edita/elimina algo, los hijos llaman a onReload()
//     que vuelve a pedir todo a la API y refresca el state.
//
// MEJORAS UX (sin tocar BD):
//   - Secciones colapsables agrupadas por proposito
//   - Vista previa en vivo (replica la card publica)
//   - Color picker visual con presets de marca
//   - Precio con formato CLP automatico al escribir
//   - Validacion inline con iconos ✓/✗
//   - Botón sticky de guardar (siempre visible)
//   - Tooltips en campos tecnicos
//   - Atajos: Ctrl+S para guardar, Esc para cancelar edicion, Enter en
//     ingredientes para agregarlos sin enviar el form
// =============================================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  // Lecturas
  getCategories,
  getItems,
  getModelos,
  getImagenes,
  // Escrituras de items
  createItem,
  updateItem,
  deleteItem,
  // Escrituras de categorias
  createCategory,
  updateCategory,
  deleteCategory,
  // Eliminar archivos subidos
  deleteImagen,
  deleteModelo,
  // Auth
  logout,
  verifyToken,
} from "./api";
import AdminLogin from "./AdminLogin";
import AdminUploader from "./AdminUploader";
import styles from "./admin.module.css";
import { currencyFormatter } from "../config/currencyFormatter";

// [NUEVO] Presets de colores de la marca para el color picker.
// Permite al admin elegir colores consistentes con un solo click en lugar
// de tipear codigos hex. Si quieres agregar mas, simplemente extiende el array.
const COLOR_PRESETS = [
  { name: "Azul oscuro", value: "#152238" },
  { name: "Dorado", value: "#d4aa63" },
  { name: "Vino", value: "#5c1a1b" },
  { name: "Verde", value: "#1f3d2b" },
  { name: "Negro", value: "#0a0a0a" },
  { name: "Café", value: "#3e2723" },
];

// Color por defecto de la card de un plato (azul oscuro).
const DEFAULT_CARD_COLOR = "#152238";

// [NUEVO] Formatea cualquier valor a precio chileno: "12990" -> "$12.990".
// Acepta strings con caracteres no numericos y los limpia. Si no hay digitos
// devuelve "" (mejor que "$0" para inputs vacios).
function formatPriceCLP(value) {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  return "$" + num.toLocaleString("es-CL");
}

// [NUEVO] Extrae solo los digitos de un precio formateado.
// Ej: "$12.990" -> "12990". Util para validar que el numero sea > 0
// independientemente del formato visual.
function unformatPrice(value) {
  return String(value).replace(/\D/g, "");
}

// =============================================================================
// COMPONENTE RAIZ: AdminDashboard
// =============================================================================
export default function AdminDashboard() {
  const navigate = useNavigate(); // hook de react-router para volver al menu publico

  // --- Estado de autenticacion ---
  // authenticated: si el usuario tiene sesion valida
  // checking: si todavia estamos verificando el token al cargar la pagina
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  // --- Datos del backend ---
  // Todos los datos que consume el admin viven aca. Se pasan por props a los
  // paneles hijos. No usamos context porque el arbol es chico.
  const [categories, setCategories] = useState([]); // [{id, label}]
  const [items, setItems] = useState([]); // [{id, name, category, price, ...}]
  const [modelos, setModelos] = useState([]); // [{id, label, src}] modelos .glb
  const [imagenes, setImagenes] = useState([]); // [{id, label, src}] imagenes

  // Tab activa: "items" | "categories" | "upload"
  const [activeTab, setActiveTab] = useState("items");

  // Filtro por categoria (se aplica antes de pasar items al ItemsPanel).
  const [filterCategory, setFilterCategory] = useState("");

  // ---------------------------------------------------------------------------
  // loadData: recarga todos los datos del backend.
  // Se llama despues de cada create/update/delete para mantener la UI
  // sincronizada con la BD. Promise.all paraleliza las 4 llamadas.
  // ---------------------------------------------------------------------------
  const loadData = async () => {
    try {
      const [cats, itms, mods, imgs] = await Promise.all([
        getCategories(),
        getItems(),
        getModelos(),
        getImagenes(),
      ]);
      setCategories(cats);
      setItems(itms);
      setModelos(mods);
      setImagenes(imgs);
    } catch {
      // Si las llamadas autenticadas fallan, probablemente expiro el token.
      // Forzamos logout para volver a la pantalla de login.
      setAuthenticated(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Effect 1: chequeo inicial de token al montar.
  // Solo corre una vez (deps = []). verifyToken() devuelve boolean.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    verifyToken().then((valid) => {
      setAuthenticated(valid);
      setChecking(false);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Effect 2: cuando el user se autentica, cargar todos los datos.
  // La bandera `cancelled` evita setear state si el componente se desmonto
  // antes de que resuelvan las promesas (ej: logout rapido).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const [cats, itms, mods, imgs] = await Promise.all([
          getCategories(),
          getItems(),
          getModelos(),
          getImagenes(),
        ]);
        if (!cancelled) {
          setCategories(cats);
          setItems(itms);
          setModelos(mods);
          setImagenes(imgs);
        }
      } catch {
        if (!cancelled) setAuthenticated(false);
      }
    })();
    // Cleanup: se ejecuta cuando el componente se desmonta o cambia `authenticated`.
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  // Cierra sesion: limpia el token y vuelve a mostrar el login.
  function handleLogout() {
    logout();
    setAuthenticated(false);
  }

  // --- Renders condicionales segun estado de auth ---
  if (checking) {
    return <div className={styles.loading}>Verificando sesion...</div>;
  }

  if (!authenticated) {
    // El callback onLogin lo dispara <AdminLogin/> cuando el login es exitoso.
    return <AdminLogin onLogin={() => setAuthenticated(true)} />;
  }

  // Aplicamos el filtro de categoria antes de pasar al ItemsPanel.
  // allItems se pasa tambien para que el panel pueda generar ids unicos
  // aunque este viendo una vista filtrada.
  const filteredItems = filterCategory ? items.filter((i) => i.category === filterCategory) : items;

  // --- Render principal ---
  return (
    <div className={styles.adminShell}>
      {/* Header con branding y botones de navegacion */}

      <header className={styles.adminHeader}>
        <div className={styles.adminHeaderLeft}>
          <h1 className={styles.adminBrand}>Route 66 — Admin</h1>
          <button className={styles.linkBtn} onClick={() => navigate("/")}>
            ← Ver Menu
          </button>
        </div>
        <div className={styles.adminHeaderRight}>
          <button className={styles.btnDanger} onClick={handleLogout}>
            Cerrar Sesion
          </button>
        </div>
      </header>

      {/* Tabs de navegacion entre paneles */}
      <nav className={styles.adminNav}>
        <button
          className={`${styles.navBtn} ${activeTab === "items" ? styles.navActive : ""}`}
          onClick={() => setActiveTab("items")}
        >
          Platos del Menu
        </button>
        <button
          className={`${styles.navBtn} ${activeTab === "categories" ? styles.navActive : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          Categorias
        </button>
        <button
          className={`${styles.navBtn} ${activeTab === "upload" ? styles.navActive : ""}`}
          onClick={() => setActiveTab("upload")}
        >
          Subir Archivos
        </button>
      </nav>

      {/* Contenido del panel activo (renderizado condicional segun activeTab) */}
      <main className={styles.adminMain}>
        {activeTab === "items" && (
          <ItemsPanel
            items={filteredItems}
            allItems={items}
            categories={categories}
            modelos={modelos}
            imagenes={imagenes}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            onReload={loadData}
          />
        )}
        {activeTab === "categories" && (
          <CategoriesPanel categories={categories} onReload={loadData} />
        )}
        {activeTab === "upload" && <UploadPanel onReload={loadData} />}
      </main>
    </div>
  );
}

// =============================================================================
// SuccessModal
// -----------------------------------------------------------------------------
// Modal verde que aparece despues de guardar algo con exito. Se cierra solo
// despues de 3s o cuando se llama a onClose(). El timer se limpia en el
// cleanup del useEffect para evitar memory leaks si el componente se desmonta
// antes de que terminen los 3s.
// =============================================================================
function SuccessModal({ isOpen, message, onClose }) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer); // cleanup
    }
  }, [isOpen, onClose]);

  // Patron comun: si no esta abierto, no renderizamos nada.
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalIcon}>✓</div>
        <p className={styles.modalText}>{message}</p>
      </div>
    </div>
  );
}

// =============================================================================
// ImageModal
// -----------------------------------------------------------------------------
// Modal para elegir una imagen ya subida. Muestra un grid con thumbnails,
// permite buscar por nombre y borrar imagenes (borra tambien de Cloudinary).
//
// Props:
//   - isOpen: si el modal esta visible
//   - imagenes: lista completa [{id, label, src}]
//   - onSelectImage(url): callback al seleccionar
//   - onDeleteImage(id): callback al eliminar
//   - onClose: callback al cerrar el modal
// =============================================================================
function ImageModal({ isOpen, imagenes, onSelectImage, onDeleteImage, onClose }) {
  // Estado local: termino de busqueda y id de la imagen que se esta borrando
  // (para mostrar spinner solo en ese item).
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // Filtro case-insensitive por label.
  const filteredImages = imagenes.filter((img) =>
    img.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!isOpen) return null;

  // Maneja el click en la X de borrar. Pide confirmacion antes.
  const handleDeleteClick = async (e, img) => {
    // stopPropagation: evita que el click en la X dispare el onClick del
    // contenedor padre, que seleccionaria la imagen en lugar de borrarla.
    e.stopPropagation();
    if (
      !window.confirm(
        `¿Eliminar "${img.label}"?\n\nSe borrará de Cloudinary y no podrá recuperarse.`,
      )
    ) {
      return;
    }
    setDeletingId(img.id);
    try {
      await onDeleteImage(img.id);
    } catch (err) {
      alert(err.message || "Error al eliminar imagen");
    } finally {
      // Reseteamos siempre, falle o no, para no dejar el spinner pegado.
      setDeletingId(null);
    }
  };

  return (
    // Click en el overlay (fondo oscuro) cierra el modal.
    <div className={styles.modalOverlay} onClick={onClose}>
      {/* stopPropagation para que click DENTRO del modal no cierre el modal */}
      <div className={styles.imageModalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.imageModalHeader}>
          <h3>Seleccionar Imagen</h3>
          <button className={styles.imageModalClose} onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <input
          type="text"
          placeholder="Buscar imagen..."
          className={styles.imageSearchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Grid: cada item tiene boton de borrar y click para seleccionar */}
        <div className={styles.imageGrid}>
          {filteredImages.length > 0 ? (
            filteredImages.map((img) => (
              <div key={img.id} className={styles.imageGridItem}>
                <button
                  type="button"
                  className={styles.imageDeleteBtn}
                  onClick={(e) => handleDeleteClick(e, img)}
                  disabled={deletingId === img.id}
                  title="Eliminar imagen"
                >
                  {deletingId === img.id ? "..." : "✕"}
                </button>
                <div className={styles.imageGridItemInner} onClick={() => onSelectImage(img.src)}>
                  <img src={img.src} alt={img.label} className={styles.gridImage} />
                  <p className={styles.gridLabel}>{img.label}</p>
                </div>
              </div>
            ))
          ) : (
            <p className={styles.noImagesText}>No hay imágenes que coincidan</p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ModelModal
// -----------------------------------------------------------------------------
// Modal analogo al de imagenes pero para modelos 3D (.glb). Los .glb no se
// pueden previsualizar facilmente asi que en lugar de thumbnail mostramos un
// icono generico de cubo con el label del modelo.
// =============================================================================
function ModelModal({ isOpen, modelos, onSelectModel, onDeleteModel, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const filteredModels = modelos.filter((m) =>
    m.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!isOpen) return null;

  // Mismo patron que en ImageModal: stopPropagation + confirm + spinner.
  const handleDeleteClick = async (e, model) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `¿Eliminar "${model.label}"?\n\nSe borrará de Cloudinary y no podrá recuperarse.`,
      )
    ) {
      return;
    }
    setDeletingId(model.id);
    try {
      await onDeleteModel(model.id);
    } catch (err) {
      alert(err.message || "Error al eliminar modelo");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.imageModalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.imageModalHeader}>
          <h3>Seleccionar Modelo AR</h3>
          <button className={styles.imageModalClose} onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <input
          type="text"
          placeholder="Buscar modelo..."
          className={styles.imageSearchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className={styles.imageGrid}>
          {filteredModels.length > 0 ? (
            filteredModels.map((model) => (
              <div key={model.id} className={styles.imageGridItem}>
                <button
                  type="button"
                  className={styles.imageDeleteBtn}
                  onClick={(e) => handleDeleteClick(e, model)}
                  disabled={deletingId === model.id}
                  title="Eliminar modelo"
                >
                  {deletingId === model.id ? "..." : "✕"}
                </button>
                <div className={styles.imageGridItemInner} onClick={() => onSelectModel(model.id)}>
                  {/* Icono generico de cubo (no podemos renderizar .glb facilmente) */}
                  <div className={styles.modelIconBox}>
                    <span className={styles.modelIconEmoji}>📦</span>
                    <span className={styles.modelIconText}>.glb</span>
                  </div>
                  <p className={styles.gridLabel}>{model.label}</p>
                </div>
              </div>
            ))
          ) : (
            <p className={styles.noImagesText}>No hay modelos que coincidan</p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// [NUEVO] Section
// -----------------------------------------------------------------------------
// Wrapper de seccion colapsable. Reemplaza el formulario "todo en un bloque"
// por bloques agrupados por proposito (Info basica, Multimedia, etc).
// El admin puede expandir/colapsar cada uno con click en el header.
//
// Props:
//   - title: titulo visible (ej: "Información básica")
//   - icon: emoji o icono que aparece a la izquierda del titulo
//   - children: contenido del cuerpo de la seccion
//   - defaultOpen: si arranca expandida (default true)
//   - badge: contenido opcional a la derecha del titulo (ej: numero de items
//     o un check ✓ si la seccion esta completa)
// =============================================================================
function Section({ title, icon, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.section}>
      <button type="button" className={styles.sectionHeader} onClick={() => setOpen(!open)}>
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
        {badge && <span className={styles.sectionBadge}>{badge}</span>}
        {/* Chevron rota 180deg cuando esta abierto via clase CSS */}
        <span className={`${styles.sectionChevron} ${open ? styles.sectionChevronOpen : ""}`}>
          ▼
        </span>
      </button>
      {/* Solo renderizamos el body si esta abierto. Asi tambien se mejora
          un poco el render en formularios grandes. */}
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

// =============================================================================
// [NUEVO] Tooltip
// -----------------------------------------------------------------------------
// Icono "?" pequeño que muestra un texto explicativo al hacer hover o al
// recibir focus (accesibilidad por teclado). Util para campos tecnicos
// como "Modelo AR" o "Color hex" donde el admin no tecnico puede no saber
// que es. El texto aparece arriba del icono con flecha apuntando hacia abajo.
// =============================================================================
function Tooltip({ text }) {
  return (
    <span className={styles.tooltip} tabIndex={0}>
      <span className={styles.tooltipIcon}>?</span>
      <span className={styles.tooltipText}>{text}</span>
    </span>
  );
}

// =============================================================================
// [NUEVO] FieldStatus
// -----------------------------------------------------------------------------
// Icono inline ✓ (verde) o ✗ (rojo) que aparece DENTRO del input para dar
// feedback visual inmediato sobre la validez. Solo se muestra si:
//   - el campo fue tocado (touched=true) Y tiene valor
// Asi evitamos mostrar ✗ en un input vacio que el user todavia no abrio.
// =============================================================================
function FieldStatus({ error, value, touched }) {
  if (!touched || !value) return null;
  if (error) return <span className={`${styles.fieldStatus} ${styles.fieldStatusError}`}>✗</span>;
  return <span className={`${styles.fieldStatus} ${styles.fieldStatusOk}`}>✓</span>;
}

// =============================================================================
// [NUEVO] LivePreview
// -----------------------------------------------------------------------------
// Vista previa en vivo de la card del plato tal como la verá el cliente.
// Se renderiza en una columna sticky a la derecha del formulario y se
// actualiza en tiempo real con cada cambio del form.
//
// Replica los estilos de MenuCard publica pero simplificado: no muestra
// modales de AR ni de ingredientes, solo la apariencia visual.
//
// Si algun campo aun no tiene valor, muestra placeholders sensatos
// ("Nombre del plato", "Sin imagen", etc) para que el admin vea el layout
// completo desde el primer momento.
// =============================================================================
function LivePreview({ form, categories }) {
  // El color de fondo se aplica inline porque depende del estado del form.
  const cardStyle = form.cardColor ? { backgroundColor: form.cardColor } : undefined;
  // Mostramos el label de la categoria (no el id) para que sea legible.
  const categoryLabel = categories.find((c) => c.id === form.category)?.label;

  return (
    <div className={styles.livePreviewWrap}>
      <div className={styles.livePreviewHeader}>
        <span className={styles.livePreviewLabel}>Vista previa en vivo</span>
        {categoryLabel && <span className={styles.livePreviewCat}>{categoryLabel}</span>}
      </div>
      <article className={styles.previewCard} style={cardStyle}>
        {/* Badge de mensaje (ej: "¡Nuevo!"). Solo si hay valor */}
        {form.cardMessage && <span className={styles.previewBadge}>{form.cardMessage}</span>}
        {/* Imagen o placeholder visual si todavia no se eligio */}
        {form.image ? (
          <img className={styles.previewThumb} src={form.image} alt={form.name || "Preview"} />
        ) : (
          <div className={styles.previewThumbPlaceholder}>
            <span>Sin imagen</span>
          </div>
        )}
        <div className={styles.previewContent}>
          <h3>{form.name || "Nombre del plato"}</h3>
          <p>{form.description || "Descripción del plato..."}</p>
          <div className={styles.previewFooter}>
            <strong>{form.price || "$0"}</strong>
            <div className={styles.previewActions}>
              {/* Indicadores visuales: si hay ingredientes muestra el icono,
                  si hay modelo AR muestra el badge correspondiente */}
              {form.ingredients?.length > 0 && <span className={styles.previewMiniBtn}>🍽️</span>}
              {form.modelAR && <span className={styles.previewMiniBtn}>📷 AR</span>}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

// =============================================================================
// HELPERS DE GENERACION DE IDS
// =============================================================================

// Genera el proximo id de item mirando los existentes y sumando 1 al mayor.
// Ej: si existen ["item-1", "item-3", "item-7"] -> devuelve "item-8".
//
// Nota: la BD tiene identity autoincrement asi que el server ignora este id.
// Lo dejamos para mantener compatibilidad con el codigo viejo del frontend.
function generateItemId(itemsList) {
  // 1) Extraer los numeros de cada id que matchee "item-N".
  const nums = itemsList
    .map((i) => {
      const m = String(i.id).match(/^item-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  // 2) Tomar el mayor + 1, o 1 si la lista esta vacia.
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `item-${next}`;
}

// Genera un id slug-like a partir del label de la categoria.
// Ej: "Bebidas y Jugos" -> "bebidas-y-jugos".
// Si ese id ya existe, agrega un numero incremental al final ("-2", "-3"...).
function generateCategoryId(categoriesList, label) {
  const base =
    label
      .toLowerCase()
      .normalize("NFD") // descomposicion unicode (separa tildes)
      .replace(/[\u0300-\u036f]/g, "") // quita tildes (combining marks)
      .replace(/[^a-z0-9]+/g, "-") // todo lo no-alfanumerico -> guion
      .replace(/^-+|-+$/g, "") || "cat"; // quita guiones del inicio/final
  // Si el slug ya existe, agregamos sufijo numerico hasta que sea unico.
  let id = base;
  let i = 2;
  while (categoriesList.some((c) => c.id === id)) {
    id = `${base}-${i++}`;
  }
  return id;
}

// =============================================================================
// ItemsPanel
// -----------------------------------------------------------------------------
// Panel principal: formulario de plato arriba y vista tipo "menu cliente"
// abajo (cards agrupadas por categoria). El form sirve para crear o editar
// segun si editingItem es null.
//
// Es el componente mas complejo del dashboard. Maneja:
//   - Form con muchos campos y validacion en vivo
//   - Selector de imagen (modal)
//   - Selector de modelo 3D (modal)
//   - Lista de ingredientes dinamica
//   - Color picker para la card
//   - Vista de menu agrupada por categoria con filtro
//
// [NUEVO] Reorganizado en secciones colapsables + columna de vista previa
//         en vivo + barra sticky de acciones + atajos de teclado.
// =============================================================================
const DEFAULT_FORM_ITEMS = {
  id: "",
  category: "",
  name: "",
  description: "",
  price: "",
  image: "",
  modelAR: "",
  ingredients: [],
  cardColor: DEFAULT_CARD_COLOR,
  cardMessage: "",
};

function ItemsPanel({
  items, // items ya filtrados por categoria (para mostrar)
  allItems, // items completos (para generar ids unicos)
  categories,
  modelos,
  imagenes,
  filterCategory,
  setFilterCategory,
  onReload,
}) {
  const [isEditingItem, setIsEditingItem] = useState(false);

  // Ref al form para hacer scroll automatico cuando se entra a modo "editar".
  const formRef = useRef(null);

  // ---------------------------------------------------------------------------
  // ESTADO DEL FORMULARIO
  // ---------------------------------------------------------------------------
  // form: objeto con todos los campos del plato. Se usa tanto para crear como
  // para editar. Cuando editingItem cambia, se re-llena con esos datos.
  const [form, setForm] = useState(DEFAULT_FORM_ITEMS);

  // Input temporal para agregar ingredientes (uno o varios separados por coma).
  const [newIngredient, setNewIngredient] = useState("");

  // Errores y estado de submit
  const [error, setError] = useState(""); // error general (server)
  const [saving, setSaving] = useState(false); // mientras se guarda
  const [fieldErrors, setFieldErrors] = useState({}); // errores por campo

  // [NUEVO] touched: registra que campos ya fueron modificados por el user.
  // Sin esto, el icono ✗ aparece en TODOS los inputs vacios al cargar el form,
  // lo que es ruidoso. Solo mostramos validacion visual cuando el user
  // realmente interactuo con el campo.
  const [touched, setTouched] = useState({});

  // Estados de modales
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);

  // Lista completa de items (para generar ids). Si no se paso allItems usa items.
  const itemsList = allItems || items;

  // ---------------------------------------------------------------------------
  // VALIDACION
  // ---------------------------------------------------------------------------

  // Devuelve un mensaje de error si el campo es invalido, "" si es valido.
  // Se usa para validacion en vivo (al escribir) y en el submit.
  const getFieldError = (name, value) => {
    if (name === "category") {
      if (!value) return "Categoria es requerida";
    }
    if (name === "name") {
      if (!value.trim()) return "Nombre es requerido";
      // Permitimos solo letras, espacios, guiones y vocales acentuadas/ñ.
      if (!/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]+$/.test(value)) return "Solo letras y espacios";
    }
    if (name === "price") {
      // [NUEVO] El precio ahora es un string formateado ("$12.990") asi que
      // validamos sobre los digitos limpios, no sobre el formato visual.
      const clean = unformatPrice(value);
      if (!clean) return "Precio es requerido";
      if (parseInt(clean, 10) <= 0) return "Precio debe ser mayor a 0";
    }
    if (name === "description") {
      if (!value.trim()) return "Descripcion es requerida";
      if (value.length > 500) return "Maximo 500 caracteres";
    }
    if (name === "image") {
      if (!value) return "Imagen es requerida";
    }
    if (name === "cardColor") {
      // Hex de 6 digitos con # al inicio.
      if (value && !/^#[0-9A-Fa-f]{6}$/.test(value)) return "Formato hex invalido (#RRGGBB)";
    }
    if (name === "cardMessage") {
      if (value.length > 40) return "Maximo 40 caracteres";
    }
    return "";
  };

  // Corre todas las validaciones y devuelve un objeto con los errores.
  const validateAll = () => {
    const errors = {};
    ["category", "name", "price", "description", "image", "cardColor", "cardMessage"].forEach(
      (field) => {
        const err = getFieldError(field, form[field] || "");
        if (err) errors[field] = err;
      },
    );
    return errors;
  };

  // True si no hay ningun error.
  const isFormValid = () => Object.keys(validateAll()).length === 0;

  // ---------------------------------------------------------------------------
  // HANDLERS DEL FORM
  // ---------------------------------------------------------------------------

  // Maneja cambios en los inputs. Ademas de setear el valor, aplica algunos
  // "bloqueos de entrada": si el nuevo valor tiene caracteres invalidos, ni
  // siquiera dejamos que se escriban (mejor UX que solo mostrar error).
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Bloqueos por campo:
    if (name === "name") {
      if (value !== "" && !/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]*$/.test(value)) return;
    }
    // [NUEVO] Precio con auto-formato CLP. El user escribe "12990" y se
    // muestra "$12.990" en tiempo real. Tomamos el valor del input,
    // lo limpiamos a digitos, y devolvemos el formateado.
    if (name === "price") {
      const formatted = formatPriceCLP(value);
      setForm((f) => ({ ...f, price: formatted }));
      setFieldErrors((errs) => ({ ...errs, price: getFieldError("price", formatted) }));
      setTouched((t) => ({ ...t, price: true }));
      return; // salimos temprano, el flujo normal de abajo no aplica
    }
    if (name === "description") {
      if (value.length > 500) return;
    }
    if (name === "cardMessage") {
      if (value.length > 40) return;
    }

    // Actualizar form, marcar campo como tocado y revalidar.
    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((errs) => ({ ...errs, [name]: getFieldError(name, value) }));
    // [NUEVO] marcamos el campo como tocado para que se muestre el icono ✓/✗
    setTouched((t) => ({ ...t, [name]: true }));
  };

  // Agrega ingredientes. Acepta varios separados por coma en un solo input
  // ("tomate, cebolla, palta") y evita duplicados ignorando mayusculas.
  const handleAddIngredient = () => {
    // 1) Parsear: split por coma, trim, descartar vacios.
    const nextIngredients = newIngredient
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    if (nextIngredients.length === 0) return;

    // 2) Mergear con los existentes evitando duplicados (case-insensitive).
    setForm((f) => {
      const existingKeys = new Set(f.ingredients.map((i) => i.toLowerCase()));
      const merged = [...f.ingredients];
      for (const ingredient of nextIngredients) {
        const key = ingredient.toLowerCase();
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        merged.push(ingredient);
      }
      return { ...f, ingredients: merged };
    });

    // 3) Limpiar el input.
    setNewIngredient("");
  };

  // Quita un ingrediente por indice.
  const handleRemoveIngredient = (index) => {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== index) }));
  };

  // Al seleccionar una imagen del modal, la guardamos en el form y cerramos.
  const handleSelectImage = (imageUrl) => {
    setForm((f) => ({ ...f, image: imageUrl }));
    setFieldErrors((errs) => ({ ...errs, image: "" })); // limpiar error si habia
    // [NUEVO] marcamos imagen como tocada (importante porque la imagen no se
    // setea via input estandar, sino via el modal).
    setTouched((t) => ({ ...t, image: true }));
    setShowImageModal(false);
  };

  // Al borrar una imagen desde el modal: la borramos del backend, y si era
  // la que estaba seleccionada en el form, la limpiamos para no quedarnos
  // con una URL muerta.
  const handleDeleteImage = async (imageId) => {
    await deleteImagen(imageId);
    const deletedImg = imagenes.find((i) => i.id === imageId);
    if (deletedImg && form.image === deletedImg.src) {
      setForm((f) => ({ ...f, image: "" }));
    }
    await onReload();
  };

  // Mismo patron para modelos 3D.
  const handleSelectModel = (modelId) => {
    setForm((f) => ({ ...f, modelAR: modelId }));
    setShowModelModal(false);
  };

  const handleDeleteModel = async (modelId) => {
    await deleteModelo(modelId);
    if (form.modelAR === modelId) {
      setForm((f) => ({ ...f, modelAR: "" }));
    }
    await onReload();
  };

  // Quita el modelo del form sin borrarlo de Cloudinary (para cuando no lo
  // queremos en ESTE plato pero si dejarlo disponible para otros).
  const handleClearModel = () => {
    setForm((f) => ({ ...f, modelAR: "" }));
  };

  // [NUEVO] Helper para resetear el form a su estado inicial. Lo usamos en
  // varios lugares: despues de guardar, al cancelar edicion, al presionar Esc.
  const resetForm = () => {
    setIsEditingItem(false);
    setForm(DEFAULT_FORM_ITEMS);
    setFieldErrors({});
    setTouched({});
    setNewIngredient("");
  };

  // ---------------------------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------------------------
  // [NUEVO] Envuelto en useCallback para que el atajo Ctrl+S (que lo llama
  // desde un useEffect) tenga una referencia estable.
  const handleSubmit = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault(); // evitar reload de pagina (comportamiento default del form)
      setError("");

      // 1) Validacion final antes de mandar al server.
      const errors = validateAll();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        // [NUEVO] Si hubo errores marcamos TODOS los campos como tocados
        // para que se vean los iconos ✗ en los que faltan completar.
        setTouched({
          category: true,
          name: true,
          price: true,
          description: true,
          image: true,
          cardColor: true,
          cardMessage: true,
        });
        return;
      }

      setSaving(true);
      try {
        // 2) Preparar payload: cardMessage vacio se manda como null para que la
        //    BD no guarde "" (mas semantico).
        const payloadBase = {
          ...form,
          cardMessage: form.cardMessage.trim() || null,
        };

        // 3) Llamar al endpoint correcto segun modo (editar vs crear).
        if (isEditingItem) {
          await updateItem(form.id, payloadBase);
          setSuccessMessage("EL PLATO SE HA ACTUALIZADO CON EXITO");
        } else {
          // Al crear, generamos el id temporal. El server lo ignora pero
          // mantiene compatibilidad con codigo viejo.
          const payload = { ...payloadBase, id: generateItemId(itemsList) };
          await createItem(payload);
          setSuccessMessage("EL PLATO SE HA AGREGADO CON EXITO");
        }

        // 4) Mostrar modal de exito y volver a modo "crear".
        setShowSuccessModal(true);

        // 5) Reset completo del form (usa el helper).
        resetForm();
        setSaving(false);

        // 6) Recargar datos despues de 1.5s. Esperamos para que el user alcance
        //    a ver el modal de exito; si recargaramos inmediato, la lista
        //    pestañearia mientras todavia se ve el modal.
        setTimeout(async () => {
          try {
            await onReload();
          } catch (reloadErr) {
            console.error("Error al recargar datos:", reloadErr);
          }
        }, 1500);
      } catch (err) {
        setError(err.message || "Error al guardar el plato");
        setSaving(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [form, isEditingItem, itemsList, onReload],
  );

  // ---------------------------------------------------------------------------
  // [NUEVO] ATAJOS DE TECLADO
  // ---------------------------------------------------------------------------
  // Listener global mientras el panel esta montado:
  //   - Ctrl+S (o Cmd+S en Mac): dispara el submit si el form es valido
  //   - Esc: cancela la edicion (solo si NO hay un modal abierto, para que
  //          Esc en un modal lo cierre primero antes de cancelar el form)
  //
  // Re-suscribimos el handler cuando cambian las dependencias para que las
  // closures siempre vean el estado actualizado.
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!saving && isFormValid()) handleSubmit();
      }
      if (e.key === "Escape" && isEditingItem && !showImageModal && !showModelModal) {
        resetForm();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, isEditingItem, showImageModal, showModelModal, handleSubmit]);

  // Borrar plato con confirmacion.
  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar este plato?")) return;
    try {
      await deleteItem(id);
      await onReload();
    } catch (err) {
      setError(err.message);
    }
  };

  // Datos derivados que necesitamos en el render.
  const formValid = isFormValid();
  const selectedModel = modelos.find((m) => m.id === form.modelAR);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div>
      {/* Modales (solo se renderizan internamente si isOpen=true) */}
      <SuccessModal
        isOpen={showSuccessModal}
        message={successMessage}
        onClose={() => setShowSuccessModal(false)}
      />

      <ImageModal
        isOpen={showImageModal}
        imagenes={imagenes}
        onSelectImage={handleSelectImage}
        onDeleteImage={handleDeleteImage}
        onClose={() => setShowImageModal(false)}
      />

      <ModelModal
        isOpen={showModelModal}
        modelos={modelos}
        onSelectModel={handleSelectModel}
        onDeleteModel={handleDeleteModel}
        onClose={() => setShowModelModal(false)}
      />

      <div className={styles.panelHeader}>
        <h2>{isEditingItem ? "Editar Plato" : "Agregar Plato"}</h2>
        {/* [NUEVO] Hint visual de los atajos disponibles. Se oculta en
            mobile via media query (no hay teclado fisico). */}
        <span className={styles.shortcutHint}>
          Atajos: <kbd>Ctrl+S</kbd> guardar · <kbd>Esc</kbd> cancelar
        </span>
      </div>

      {/* [NUEVO] Layout de 2 columnas: formulario a la izquierda + vista
          previa pegada (sticky) a la derecha. En pantallas <1100px colapsa
          a una sola columna (la preview baja debajo del form). */}
      <div className={styles.editorLayout}>
        {/* ============ FORMULARIO ============ */}
        <form ref={formRef} className={styles.editorForm} onSubmit={handleSubmit}>
          {/* Error general del server (se muestra arriba del form) */}
          {error && <div className={styles.errorMsg}>{error}</div>}

          {/* [NUEVO] SECCIÓN 1: INFORMACIÓN BÁSICA
              Agrupa los datos esenciales del plato: categoria, nombre,
              precio y descripcion. Esta abierta por defecto porque es lo
              primero que el admin completa. */}
          <Section title="Información básica" icon="📋" defaultOpen>
            <div className={styles.sectionGrid}>
              {/* --- Categoria --- */}
              <label className={styles.label}>
                Categoria
                {/* [NUEVO] Wrapper inputWithIcon para posicionar el ✓/✗ adentro */}
                <div className={styles.inputWithIcon}>
                  <select
                    className={`${styles.input} ${fieldErrors.category ? styles.inputError : ""}`}
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {/* [NUEVO] Icono visual ✓/✗ inline */}
                  <FieldStatus
                    error={fieldErrors.category}
                    value={form.category}
                    touched={touched.category}
                  />
                </div>
                {fieldErrors.category && (
                  <span className={styles.helperError}>{fieldErrors.category}</span>
                )}
              </label>

              {/* --- Nombre --- */}
              <label className={styles.label}>
                Nombre
                <div className={styles.inputWithIcon}>
                  <input
                    className={`${styles.input} ${fieldErrors.name ? styles.inputError : ""}`}
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="Nombre del plato"
                  />
                  <FieldStatus error={fieldErrors.name} value={form.name} touched={touched.name} />
                </div>
                {/* Helper text dinamico: muestra error en rojo o hint en gris */}
                {fieldErrors.name ? (
                  <span className={styles.helperError}>{fieldErrors.name}</span>
                ) : (
                  <span className={styles.helperText}>Solo letras y espacios</span>
                )}
              </label>

              {/* --- Precio --- */}
              {/* [NUEVO] Tooltip explicativo del formato automatico CLP */}
              <label className={styles.label}>
                Precio{" "}
                <Tooltip text="Ingresa solo números. Se formatea automáticamente como pesos chilenos." />
                <div className={styles.inputWithIcon}>
                  <input
                    className={`${styles.input} ${fieldErrors.price ? styles.inputError : ""}`}
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    required
                    placeholder="$12.990"
                    /* [NUEVO] inputMode="numeric" -> en mobile abre el teclado numerico */
                    inputMode="numeric"
                  />
                  <FieldStatus
                    error={fieldErrors.price}
                    value={form.price}
                    touched={touched.price}
                  />
                </div>
                {fieldErrors.price ? (
                  <span className={styles.helperError}>{fieldErrors.price}</span>
                ) : (
                  <span className={styles.helperText}>Formato automático: $12.990</span>
                )}
              </label>

              {/* --- Descripcion (full width, ocupa las 2 columnas del grid) --- */}
              <label className={`${styles.label} ${styles.fullWidth}`}>
                Descripcion
                <textarea
                  className={`${styles.textarea} ${fieldErrors.description ? styles.inputError : ""}`}
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  required
                  placeholder="Descripcion del plato..."
                />
                <div className={styles.helperRow}>
                  {fieldErrors.description ? (
                    <span className={styles.helperError}>{fieldErrors.description}</span>
                  ) : (
                    // Contador de caracteres visible para el user.
                    <span className={styles.helperText}>
                      {form.description.length}/500 caracteres
                    </span>
                  )}
                </div>
              </label>
            </div>
          </Section>

          {/* [NUEVO] SECCIÓN 2: MULTIMEDIA
              Agrupa imagen y modelo AR. Muestra un badge ✓ en el header
              cuando hay imagen seleccionada (feedback rapido al colapsar). */}
          <Section title="Multimedia" icon="🖼️" defaultOpen badge={form.image ? "✓" : null}>
            {/* --- Selector de imagen: abre modal con todas las imagenes --- */}
            <div className={styles.label}>
              <span>Imagen del plato</span>

              <button
                type="button"
                className={styles.btnImageSelector}
                onClick={() => setShowImageModal(true)}
                disabled={saving}
              >
                {form.image ? "🔄 Cambiar imagen" : "🖼️ Seleccionar imagen guardada..."}
              </button>

              {fieldErrors.image ? (
                <span className={styles.helperError}>{fieldErrors.image}</span>
              ) : (
                <span className={styles.helperText}>
                  Selecciona una imagen ya subida en &quot;Subir Archivos&quot;.
                </span>
              )}

              {/* Hint extra si no hay nada en la BD */}
              {imagenes.length === 0 && (
                <span className={styles.helperError}>
                  No hay imágenes registradas. Primero sube una.
                </span>
              )}
            </div>

            {/* Preview de la imagen seleccionada (si existe y la URL es valida) */}
            {form.image &&
              (form.image.startsWith("/assets/") || form.image.startsWith("https://")) && (
                <div className={styles.imagePreviewContainer}>
                  <img src={form.image} alt="Vista previa" className={styles.imagePreview} />
                </div>
              )}

            {/* --- Selector de modelo 3D: mismo patron que imagen --- */}
            {/* [NUEVO] Tooltip explicando que es un modelo AR para usuarios no tecnicos */}
            <div className={styles.label} style={{ marginTop: "1rem" }}>
              <span>
                Modelo AR (opcional){" "}
                <Tooltip text="Modelo 3D en formato .glb que el cliente puede ver en realidad aumentada con su cámara." />
              </span>

              <button
                type="button"
                className={styles.btnImageSelector}
                onClick={() => setShowModelModal(true)}
                disabled={saving}
              >
                {selectedModel
                  ? `🔄 Cambiar (actual: ${selectedModel.label})`
                  : "📦 Seleccionar modelo guardado..."}
              </button>

              <span className={styles.helperText}>
                Selecciona un .glb ya subido en &quot;Subir Archivos&quot;.
              </span>

              {modelos.length === 0 && (
                <span className={styles.helperError}>
                  No hay modelos registrados. Primero sube un .glb.
                </span>
              )}
            </div>

            {/* Card con info del modelo seleccionado y boton para quitarlo */}
            {selectedModel && (
              <div className={styles.modelPreviewContainer}>
                <div className={styles.modelPreviewCard}>
                  <div className={styles.modelIconBox}>
                    <span className={styles.modelIconEmoji}>📦</span>
                    <span className={styles.modelIconText}>.glb</span>
                  </div>
                  <div className={styles.modelPreviewInfo}>
                    <p className={styles.modelPreviewLabel}>{selectedModel.label}</p>
                    <p className={styles.modelPreviewId}>{selectedModel.id}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.btnSmallDanger}
                    onClick={handleClearModel}
                    title="Quitar modelo de este plato"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* [NUEVO] SECCIÓN 3: PERSONALIZACIÓN
              Agrupa color de la card y mensaje destacado. Cerrada por
              defecto porque son opcionales/avanzados. */}
          <Section title="Personalización de la card" icon="🎨" defaultOpen={false}>
            <div className={styles.sectionGrid}>
              {/* --- Color picker de la card --- */}
              {/* [NUEVO] Tooltip + paleta de presets debajo del input */}
              <label className={styles.label}>
                Color de fondo <Tooltip text="Color de fondo de la tarjeta del plato en el menú." />
                <div className={styles.colorPickerRow}>
                  {/* input type="color" da el picker nativo del navegador */}
                  <input
                    type="color"
                    name="cardColor"
                    value={form.cardColor}
                    onChange={handleChange}
                    className={styles.colorSwatch}
                  />
                  {/* Input text para escribir el hex a mano (sincronizado con el color) */}
                  <input
                    className={`${styles.input} ${fieldErrors.cardColor ? styles.inputError : ""}`}
                    name="cardColor"
                    value={form.cardColor}
                    onChange={handleChange}
                    placeholder="#152238"
                    maxLength={7}
                  />
                </div>
                {/* [NUEVO] Paleta de presets de marca: click rapido a colores comunes */}
                <div className={styles.colorPresets}>
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      className={styles.colorPresetBtn}
                      style={{ background: p.value }}
                      title={p.name}
                      onClick={() => setForm((f) => ({ ...f, cardColor: p.value }))}
                    />
                  ))}
                </div>
                {fieldErrors.cardColor ? (
                  <span className={styles.helperError}>{fieldErrors.cardColor}</span>
                ) : (
                  <span className={styles.helperText}>Click en un color o ingresa hex #RRGGBB</span>
                )}
              </label>

              {/* --- Mensaje de la card (badge tipo "Nuevo!", "Recomendado") --- */}
              {/* [NUEVO] Tooltip con ejemplos de uso */}
              <label className={styles.label}>
                Mensaje destacado (opcional){" "}
                <Tooltip text="Etiqueta corta que aparece sobre la card. Ej: ¡Nuevo!, Recomendado, 2x1." />
                <input
                  className={`${styles.input} ${fieldErrors.cardMessage ? styles.inputError : ""}`}
                  name="cardMessage"
                  value={form.cardMessage}
                  onChange={handleChange}
                  placeholder="Ej: ¡Nuevo!, Recomendado..."
                  maxLength={40}
                />
                {fieldErrors.cardMessage ? (
                  <span className={styles.helperError}>{fieldErrors.cardMessage}</span>
                ) : (
                  <span className={styles.helperText}>{form.cardMessage.length}/40 caracteres</span>
                )}
              </label>
            </div>
          </Section>

          {/* [NUEVO] SECCIÓN 4: INGREDIENTES
              Cerrada por defecto. El badge muestra la cantidad agregada
              para que se vea aun colapsada. */}
          <Section
            title="Ingredientes"
            icon="🥗"
            defaultOpen={false}
            badge={form.ingredients.length > 0 ? form.ingredients.length : null}
          >
            {/* --- Input para agregar ingredientes --- */}
            <label className={styles.label}>
              Agregar ingredientes{" "}
              <Tooltip text="Puedes agregar varios separados por coma. Presiona Enter o el botón + para añadir." />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  className={styles.input}
                  value={newIngredient}
                  onChange={(e) => setNewIngredient(e.target.value)}
                  /* [NUEVO] onKeyDown en lugar de onKeyPress (deprecado).
                     Enter agrega el ingrediente sin enviar el form entero. */
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddIngredient();
                    }
                  }}
                  placeholder="Ej: Tomate, Cebolla, Palta..."
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={handleAddIngredient}
                  style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap" }}
                >
                  + Agregar
                </button>
              </div>
              <span className={styles.helperText}>
                Tip: separa con comas para agregar varios a la vez
              </span>
            </label>

            {/* Lista de ingredientes ya agregados, cada uno con boton para quitarlo */}
            {form.ingredients.length > 0 && (
              <div className={styles.ingredientsList}>
                {form.ingredients.map((ing, idx) => (
                  <div key={idx} className={styles.ingredientItem}>
                    <span className={styles.ingredientBadge}>{ing}</span>
                    <button
                      type="button"
                      className={styles.btnSmallDanger}
                      onClick={() => handleRemoveIngredient(idx)}
                      style={{ marginLeft: "auto" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </form>

        {/* [NUEVO] COLUMNA DE VISTA PREVIA
            Sticky a la derecha. Se actualiza en vivo con cada cambio del form. */}
        <aside className={styles.previewColumn}>
          <LivePreview form={form} categories={categories} />
        </aside>
      </div>

      {/* [NUEVO] BARRA STICKY DE ACCIONES
          Fija en la parte inferior de la pantalla. Siempre visible aunque el
          admin scrollee. Muestra:
            - Estado del form (incompleto / listo / en error)
            - Boton de cancelar (solo en modo editar)
            - Boton primario de guardar
          Reemplaza el viejo formActions que estaba al final del form (que
          podia quedar lejos del scroll cuando el form era largo). */}
      <div className={styles.stickyActions}>
        <div className={styles.stickyActionsInner}>
          <span className={styles.stickyStatus}>
            {!formValid && Object.keys(touched).length > 0 ? (
              <span className={styles.statusError}>⚠️ Completa los campos requeridos</span>
            ) : formValid ? (
              <span className={styles.statusOk}>✓ Listo para guardar</span>
            ) : (
              <span className={styles.statusNeutral}>Completa la información del plato</span>
            )}
          </span>
          <div className={styles.stickyButtons}>
            {/* Cancelar solo aparece en modo editar (vuelve a modo crear). */}
            {isEditingItem && (
              <button type="button" className={styles.btnSecondary} onClick={resetForm}>
                Cancelar
              </button>
            )}
            <button
              className={styles.btnPrimary}
              type="button"
              disabled={saving || !formValid}
              onClick={handleSubmit}
            >
              {saving ? "Guardando..." : isEditingItem ? "💾 Actualizar Plato" : "✓ Crear Plato"}
            </button>
          </div>
        </div>
      </div>

      {/* ============ VISTA TIPO MENU CLIENTE ============ */}
      {/* Header con contador y filtro por categoria */}
      <div className={styles.tableHeader}>
        <h2>Platos ({items.length})</h2>
        <select
          className={styles.filterSelect}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">Todas las categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Iteramos por categorias (no por items) para agruparlas visualmente.
          Si hay filtro activo, solo mostramos esa categoria.
          Categorias sin items se omiten (return null). */}
      <div className={styles.menuPreview}>
        {categories
          .filter((cat) => !filterCategory || cat.id === filterCategory)
          .map((cat) => {
            const catItems = items.filter((i) => i.category === cat.id);
            if (catItems.length === 0) return null;
            return (
              <section key={cat.id} className={styles.menuCategory}>
                <h3 className={styles.menuCategoryTitle}>{cat.label}</h3>
                <div className={styles.menuGrid}>
                  {catItems.map((item) => (
                    // Cada plato es una card con color de fondo personalizado.
                    <article
                      key={item.id}
                      className={styles.menuCard}
                      style={{ backgroundColor: item.cardColor || DEFAULT_CARD_COLOR }}
                    >
                      {/* Badge superior izquierdo (ej: "¡Nuevo!") */}
                      {item.cardMessage && (
                        <span className={styles.menuBadge}>{item.cardMessage}</span>
                      )}

                      {/* Imagen de cabecera */}
                      {item.image && (
                        <div className={styles.menuImageWrap}>
                          <img src={item.image} alt={item.name} className={styles.menuImage} />
                        </div>
                      )}

                      {/* Cuerpo de la card */}
                      <div className={styles.menuBody}>
                        <div className={styles.menuTopRow}>
                          <h4 className={styles.menuName}>{item.name}</h4>
                          <span className={styles.menuPrice}>
                            {currencyFormatter.format(item.price)}
                          </span>
                        </div>

                        {/* Id en mono (util para debug/identificacion) */}
                        <p className={styles.menuId}>{item.id}</p>

                        {item.description && <p className={styles.menuDesc}>{item.description}</p>}

                        {/* Lista de ingredientes como badges */}
                        {item.ingredients?.length > 0 && (
                          <div className={styles.menuIngredients}>
                            {item.ingredients.map((ing, i) => (
                              <span key={i} className={styles.ingredientBadge}>
                                {ing}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Indicador de modelo AR disponible */}
                        {item.modelAR && <span className={styles.menuAr}>AR ✓</span>}

                        {/* Acciones de admin: editar y eliminar */}
                        <div className={styles.menuActions}>
                          <button
                            className={styles.btnSmall}
                            onClick={() => {
                              setIsEditingItem(true);
                              setForm({
                                ...DEFAULT_FORM_ITEMS,
                                ...item,
                                cardMessage: item.cardMessage ?? "",
                              });
                              // [NUEVO] Reseteamos touched al entrar a editar:
                              // los campos ya tienen valor pero el user todavia
                              // no los modifico, asi que no mostramos validacion.
                              setTouched({});
                              // Scroll al form. setTimeout asegura que el form
                              // ya se rellenó (effect dispara) antes de scrollear.
                              setTimeout(
                                () =>
                                  formRef.current?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                  }),
                                50,
                              );
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className={`${styles.btnSmall} ${styles.btnSmallDanger}`}
                            onClick={() => handleDelete(item.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}

// =============================================================================
// CategoriesPanel
// -----------------------------------------------------------------------------
// Panel de categorias. Mucho mas simple que el de platos: solo tiene un campo
// (label). El id se genera automaticamente a partir del label.
//
// IMPORTANTE: eliminar una categoria tambien borra todos los platos de esa
// categoria (ON DELETE CASCADE en la BD). Por eso el confirm es enfatico.
// =============================================================================
const DEFAULT_FORM_CATEGORY = { id: "", label: "" };

function CategoriesPanel({ categories, onReload }) {
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  // Estado del form: solo necesita id y label.
  const [form, setForm] = useState(DEFAULT_FORM_CATEGORY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Validacion: solo letras y espacios en el label.
  const getFieldError = (name, value) => {
    if (name === "label") {
      if (!value.trim()) return "Nombre visible es requerido";
      if (!/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]+$/.test(value)) return "Solo letras y espacios";
    }
    return "";
  };

  const validateAll = () => {
    const errors = {};
    ["label"].forEach((field) => {
      const err = getFieldError(field, form[field] || "");
      if (err) errors[field] = err;
    });
    return errors;
  };

  const isFormValid = () => Object.keys(validateAll()).length === 0;

  // Bloqueo de entrada: solo permitimos letras/espacios.
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (value !== "" && !/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]*$/.test(value)) return;
    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((errs) => ({ ...errs, [name]: getFieldError(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const errors = validateAll();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      if (isEditingCategory) {
        // Editar: solo actualizamos el label, el id no cambia.
        await updateCategory(form.id, { label: form.label });
        setSuccessMessage("LA CATEGORIA SE HA ACTUALIZADO CON EXITO");
      } else {
        // Crear: id se deriva del label (ej: "Bebidas" -> "bebidas").
        const payload = { id: generateCategoryId(categories, form.label), label: form.label };
        await createCategory(payload);
        setSuccessMessage("LA CATEGORIA SE HA AGREGADO CON EXITO");
      }
      setShowSuccessModal(true);
      setIsEditingCategory(false);
      setForm(DEFAULT_FORM_CATEGORY);
      setFieldErrors({});
      setSaving(false);

      // Recargar despues de 1.5s (mismo motivo que en ItemsPanel).
      setTimeout(async () => {
        try {
          await onReload();
        } catch (reloadErr) {
          console.error("Error al recargar datos:", reloadErr);
        }
      }, 1500);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  // OJO: eliminar una categoria tambien borra todos los platos de esa
  // categoria (ON DELETE CASCADE en la BD). El confirm avisa al user.
  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar esta categoria y todos sus platos?")) return;
    try {
      await deleteCategory(id);
      await onReload();
    } catch (err) {
      setError(err.message);
    }
  };

  const formValid = isFormValid();

  return (
    <div>
      <SuccessModal
        isOpen={showSuccessModal}
        message={successMessage}
        onClose={() => setShowSuccessModal(false)}
      />

      <div className={styles.panelHeader}>
        <h2>{isEditingCategory ? "Editar Categoria" : "Agregar Categoria"}</h2>
      </div>

      {/* Form simple en una sola fila */}
      <form className={styles.formRow} onSubmit={handleSubmit}>
        {error && <div className={styles.errorMsg}>{error}</div>}

        <label className={styles.label}>
          Nombre visible
          <input
            className={`${styles.input} ${fieldErrors.label ? styles.inputError : ""}`}
            name="label"
            value={form.label}
            onChange={handleChange}
            required
            placeholder="ej: Bebidas y Jugos"
          />
          {fieldErrors.label ? (
            <span className={styles.helperError}>{fieldErrors.label}</span>
          ) : (
            <span className={styles.helperText}>Solo letras y espacios</span>
          )}
        </label>

        <div className={styles.formActions}>
          <button className={styles.btnPrimary} type="submit" disabled={saving || !formValid}>
            {saving ? "Guardando..." : isEditingCategory ? "Actualizar" : "Crear"}
          </button>
          {isEditingCategory && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                setIsEditingCategory(false);
                setForm(DEFAULT_FORM_CATEGORY);
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Tabla de categorias existentes */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td className={styles.mono}>{cat.id}</td>
                <td>{cat.label}</td>
                <td>
                  <button
                    className={styles.btnSmall}
                    onClick={() => {
                      setIsEditingCategory(true);
                      setForm({ ...DEFAULT_FORM_CATEGORY, ...cat });
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className={`${styles.btnSmall} ${styles.btnSmallDanger}`}
                    onClick={() => handleDelete(cat.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// UploadPanel
// -----------------------------------------------------------------------------
// Wrapper simple del AdminUploader (componente externo que maneja la subida
// a Cloudinary). Cuando se sube algo nuevo, recarga todos los datos del
// dashboard para que aparezca en los selectores de imagen y modelo.
// =============================================================================
function UploadPanel({ onReload }) {
  return (
    <div>
      <div className={styles.panelHeader}>
        <h2>Subir Archivos</h2>
      </div>

      <div className={styles.uploadContainer}>
        <AdminUploader
          // Callback que dispara AdminUploader cuando termina una subida.
          // type es "model" o "image" (nos lo pasa el uploader).
          onUploadComplete={async (asset, type) => {
            console.log(`${type === "model" ? "Modelo AR" : "Imagen"} subida:`, asset);
            await onReload();
          }}
        />
      </div>
    </div>
  );
}
