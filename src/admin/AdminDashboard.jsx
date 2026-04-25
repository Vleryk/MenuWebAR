// Dashboard principal del admin. Es el componente mas grande del proyecto
// porque contiene todo el CRUD: platos, categorias, subida de archivos,
// selector de imagenes, selector de modelos 3D, etc.
//
// Esta dividido en varios componentes internos:
//   - AdminDashboard  -> shell, auth, tabs, carga de datos
//   - ItemsPanel      -> formulario y tabla de platos
//   - CategoriesPanel -> formulario y tabla de categorias
//   - UploadPanel     -> wrapper del uploader a Cloudinary
//   - ImageModal      -> modal para elegir/borrar imagenes guardadas
//   - ModelModal      -> modal para elegir/borrar modelos 3D guardados
//   - SuccessModal    -> modal verde de confirmacion (auto-cierra en 3s)
//
// La auth funciona asi: al cargar se llama verifyToken(). Si el token sigue
// valido, muestra el dashboard. Si no, muestra AdminLogin.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCategories,
  getItems,
  getModelos,
  getImagenes,
  createItem,
  updateItem,
  deleteItem,
  createCategory,
  updateCategory,
  deleteCategory,
  deleteImagen,
  deleteModelo,
  logout,
  verifyToken,
} from "./api";
import AdminLogin from "./AdminLogin";
import AdminUploader from "./AdminUploader";
import styles from "./admin.module.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  // Todos los datos que consume el admin viven en este componente. Se pasan
  // por props a los paneles hijos. No usamos context porque el arbol es chico.
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [imagenes, setImagenes] = useState([]);
  const [activeTab, setActiveTab] = useState("items");

  // Item/categoria que se esta editando. Si es null, el form esta en modo
  // "crear nuevo". Si tiene valor, el form se pre-llena para editar.
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");

  // Recarga todos los datos. Se llama despues de cada create/update/delete
  // para mantener la UI sincronizada con la BD.
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

  // Primer chequeo al montar: verificamos si hay un token valido.
  useEffect(() => {
    verifyToken().then((valid) => {
      setAuthenticated(valid);
      setChecking(false);
    });
  }, []);

  // Una vez autenticado, cargamos los datos iniciales. Usamos la bandera
  // `cancelled` para evitar setear state si el componente se desmonto antes
  // de que resuelvan las promesas (por ej, si el user hace logout rapido).
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
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  function handleLogout() {
    logout();
    setAuthenticated(false);
  }

  if (checking) {
    return <div className={styles.loading}>Verificando sesion...</div>;
  }

  if (!authenticated) {
    return <AdminLogin onLogin={() => setAuthenticated(true)} />;
  }

  // El filtro por categoria se aplica aca antes de pasar al ItemsPanel.
  // allItems se pasa tambien para que el panel pueda generar ids unicos
  // aunque este viendo una vista filtrada.
  const filteredItems = filterCategory ? items.filter((i) => i.category === filterCategory) : items;

  return (
    <div className={styles.adminShell}>
      <header className={styles.adminHeader}>
        <div className={styles.adminHeaderLeft}>
          <h1 className={styles.adminBrand}>Route 66 — Admin</h1>
          <button className={styles.linkBtn} onClick={() => navigate("/")}>
            ← Ver Menu
          </button>
        </div>
        <button className={styles.btnDanger} onClick={handleLogout}>
          Cerrar Sesion
        </button>
      </header>

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
            editingItem={editingItem}
            setEditingItem={setEditingItem}
            onReload={loadData}
          />
        )}
        {activeTab === "categories" && (
          <CategoriesPanel
            categories={categories}
            editingCategory={editingCategory}
            setEditingCategory={setEditingCategory}
            onReload={loadData}
          />
        )}
        {activeTab === "upload" && <UploadPanel onReload={loadData} />}
      </main>
    </div>
  );
}

// Modal verde que aparece despues de guardar algo con exito. Se cierra solo
// despues de 3 segundos o cuando se llama a onClose.
function SuccessModal({ isOpen, message, onClose }) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

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

// Modal para elegir una imagen ya subida. Muestra un grid con thumbnails,
// permite buscar por nombre y borrar imagenes (borra tambien de Cloudinary).
function ImageModal({ isOpen, imagenes, onSelectImage, onDeleteImage, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const filteredImages = imagenes.filter((img) =>
    img.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!isOpen) return null;

  const handleDeleteClick = async (e, img) => {
    // stopPropagation para que el click en la X no dispare el onClick del
    // contenedor padre (que seleccionaria la imagen).
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
      setDeletingId(null);
    }
  };

  return (
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

// Modal analogo al de imagenes pero para modelos 3D. Los .glb no se pueden
// previsualizar directamente asi que mostramos un icono generico con el label.
function ModelModal({ isOpen, modelos, onSelectModel, onDeleteModel, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const filteredModels = modelos.filter((m) =>
    m.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!isOpen) return null;

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

// Genera el proximo id de item mirando los existentes y sumando 1 al mayor.
// Nota: la BD ya tiene identity autoincrement asi que este id se ignora en
// el server. Lo dejamos para no romper la interfaz historica.
function generateItemId(itemsList) {
  const nums = itemsList
    .map((i) => {
      const m = String(i.id).match(/^item-(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `item-${next}`;
}

// Genera un id slug-like a partir del label de la categoria. Ej: "Bebidas y
// Jugos" -> "bebidas-y-jugos". Si ese id ya existe, agrega un numero
// incremental al final.
function generateCategoryId(categoriesList, label) {
  const base =
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // quita tildes
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "cat";
  let id = base;
  let i = 2;
  while (categoriesList.some((c) => c.id === id)) {
    id = `${base}-${i++}`;
  }
  return id;
}

const DEFAULT_CARD_COLOR = "#152238";

// Panel principal: formulario de plato arriba y tabla listando los platos
// abajo. El form sirve para crear o editar segun si editingItem es null.
function ItemsPanel({
  items,
  allItems,
  categories,
  modelos,
  imagenes,
  filterCategory,
  setFilterCategory,
  editingItem,
  setEditingItem,
  onReload,
}) {
  const formRef = useRef(null);
  // Estado del formulario. Tiene todos los campos que se guardan en BD.
  const [form, setForm] = useState({
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
  });
  const [newIngredient, setNewIngredient] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Errores campo por campo para mostrar en rojo debajo de cada input.
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);

  const itemsList = allItems || items;

  // Patron para sincronizar el form con editingItem. No usamos useEffect
  // porque dispararia un render extra y haria parpadear el form. En su lugar,
  // detectamos el cambio con un ref y actualizamos el state en el mismo
  // render. Es un workaround valido documentado en la doc de React.
  const prevEditingItemRef = useRef(editingItem);
  if (prevEditingItemRef.current !== editingItem) {
    prevEditingItemRef.current = editingItem;
    if (editingItem) {
      // Modo editar: pre-llenamos con los datos del item clickeado.
      setForm({
        ...editingItem,
        modelAR: editingItem.modelAR || "",
        ingredients: editingItem.ingredients || [],
        cardColor: editingItem.cardColor || DEFAULT_CARD_COLOR,
        cardMessage: editingItem.cardMessage || "",
      });
    } else {
      // Modo crear: reseteamos a valores por defecto.
      setForm({
        id: "",
        category: categories[0]?.id || "",
        name: "",
        description: "",
        price: "",
        image: "",
        modelAR: "",
        ingredients: [],
        cardColor: DEFAULT_CARD_COLOR,
        cardMessage: "",
      });
    }
    setFieldErrors({});
    setNewIngredient("");
  }

  // Reglas de validacion. Cada campo tiene su regla, se usan tanto al
  // escribir (validacion en vivo) como al hacer submit.
  const getFieldError = (name, value) => {
    if (name === "category") {
      if (!value) return "Categoria es requerida";
    }
    if (name === "name") {
      if (!value.trim()) return "Nombre es requerido";
      if (!/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]+$/.test(value)) return "Solo letras y espacios";
    }
    if (name === "price") {
      if (!value.trim()) return "Precio es requerido";
      if (!/^[\d.]+$/.test(value)) return "Solo numeros y punto";
      if (parseFloat(value) <= 0) return "Precio debe ser mayor a 0";
    }
    if (name === "description") {
      if (!value.trim()) return "Descripcion es requerida";
      if (value.length > 500) return "Maximo 500 caracteres";
    }
    if (name === "image") {
      if (!value) return "Imagen es requerida";
    }
    if (name === "cardColor") {
      if (value && !/^#[0-9A-Fa-f]{6}$/.test(value)) return "Formato hex invalido (#RRGGBB)";
    }
    if (name === "cardMessage") {
      if (value.length > 40) return "Maximo 40 caracteres";
    }
    return "";
  };

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

  const isFormValid = () => Object.keys(validateAll()).length === 0;

  // Maneja cambios en los inputs. Ademas de setear el valor, aplica algunos
  // filtros (por ejemplo, bloquea caracteres no permitidos antes de que
  // entren al state). Eso da mejor UX que solo mostrar error.
  const handleChange = (e) => {
    const { name, value } = e.target;

    // "Bloqueos" de entrada: si el nuevo valor tiene caracteres invalidos,
    // ni siquiera dejamos que se escriban.
    if (name === "name") {
      if (value !== "" && !/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]*$/.test(value)) return;
    }
    if (name === "price") {
      if (value !== "" && !/^[\d.]*$/.test(value)) return;
    }
    if (name === "description") {
      if (value.length > 500) return;
    }
    if (name === "cardMessage") {
      if (value.length > 40) return;
    }

    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((errs) => ({ ...errs, [name]: getFieldError(name, value) }));
  };

  // Agrega ingredientes. Acepta varios separados por coma en un solo input
  // ("tomate, cebolla, palta") y evita duplicados ignorando mayusculas.
  const handleAddIngredient = () => {
    const nextIngredients = newIngredient
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    if (nextIngredients.length === 0) return;

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

    setNewIngredient("");
  };

  const handleRemoveIngredient = (index) => {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== index) }));
  };

  // Al seleccionar una imagen del modal, la guardamos en el form y cerramos.
  const handleSelectImage = (imageUrl) => {
    setForm((f) => ({ ...f, image: imageUrl }));
    setFieldErrors((errs) => ({ ...errs, image: "" }));
    setShowImageModal(false);
  };

  const handleDeleteImage = async (imageId) => {
    await deleteImagen(imageId);
    // Si la imagen borrada era la que estaba seleccionada en el form, la
    // limpiamos para no quedarnos con una URL muerta.
    const deletedImg = imagenes.find((i) => i.id === imageId);
    if (deletedImg && form.image === deletedImg.src) {
      setForm((f) => ({ ...f, image: "" }));
    }
    await onReload();
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validacion final antes de mandar al server.
    const errors = validateAll();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      // cardMessage vacio se manda como null para que la BD no guarde "".
      const payloadBase = {
        ...form,
        cardMessage: form.cardMessage.trim() || null,
      };

      if (editingItem) {
        await updateItem(editingItem.id, payloadBase);
        setSuccessMessage("EL PLATO SE HA ACTUALIZADO CON EXITO");
      } else {
        // Al crear, generamos el id temporal. El server igual lo ignora pero
        // mantiene compatibilidad con codigo viejo.
        const payload = { ...payloadBase, id: generateItemId(itemsList) };
        await createItem(payload);
        setSuccessMessage("EL PLATO SE HA AGREGADO CON EXITO");
      }
      setShowSuccessModal(true);
      setEditingItem(null);

      // Reset completo del form despues de guardar.
      setForm({
        id: "",
        category: categories[0]?.id || "",
        name: "",
        description: "",
        price: "",
        image: "",
        modelAR: "",
        ingredients: [],
        cardColor: DEFAULT_CARD_COLOR,
        cardMessage: "",
      });
      setFieldErrors({});
      setNewIngredient("");
      setSaving(false);

      // Esperamos 1.5s antes de recargar para que el user alcance a ver el
      // modal de exito. Si recargaramos inmediato, la tabla pestañearia.
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
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar este plato?")) return;
    try {
      await deleteItem(id);
      await onReload();
    } catch (err) {
      setError(err.message);
    }
  };

  const formValid = isFormValid();
  const selectedModel = modelos.find((m) => m.id === form.modelAR);

  return (
    <div>
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
        <h2>{editingItem ? "Editar Plato" : "Agregar Plato"}</h2>
      </div>

      <form ref={formRef} className={styles.formGrid} onSubmit={handleSubmit}>
        {error && <div className={styles.errorMsg}>{error}</div>}

        <label className={styles.label}>
          Categoria
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
          {fieldErrors.category && (
            <span className={styles.helperError}>{fieldErrors.category}</span>
          )}
        </label>

        <label className={styles.label}>
          Nombre
          <input
            className={`${styles.input} ${fieldErrors.name ? styles.inputError : ""}`}
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="Nombre del plato"
          />
          {fieldErrors.name ? (
            <span className={styles.helperError}>{fieldErrors.name}</span>
          ) : (
            <span className={styles.helperText}>Solo letras y espacios</span>
          )}
        </label>

        <label className={styles.label}>
          Precio
          <input
            className={`${styles.input} ${fieldErrors.price ? styles.inputError : ""}`}
            name="price"
            value={form.price}
            onChange={handleChange}
            required
            placeholder="$12.990"
          />
          {fieldErrors.price ? (
            <span className={styles.helperError}>{fieldErrors.price}</span>
          ) : (
            <span className={styles.helperText}>Solo numeros y punto</span>
          )}
        </label>

        <label className={`${styles.label} ${styles.fullWidth}`}>
          Descripcion
          <textarea
            className={`${styles.textarea} ${fieldErrors.description ? styles.inputError : ""}`}
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={2}
            required
            placeholder="Descripcion del plato..."
          />
          <div className={styles.helperRow}>
            {fieldErrors.description ? (
              <span className={styles.helperError}>{fieldErrors.description}</span>
            ) : (
              <span className={styles.helperText}>{form.description.length}/500 caracteres</span>
            )}
          </div>
        </label>

        {/* Selector de imagen: abre el modal con todas las imagenes guardadas */}
        <div className={`${styles.label} ${styles.fullWidth}`}>
          <span>Imagen</span>

          <button
            type="button"
            className={styles.btnImageSelector}
            onClick={() => setShowImageModal(true)}
            disabled={saving}
          >
            {form.image ? "Cambiar imagen" : "Seleccionar imagen guardada..."}
          </button>

          {fieldErrors.image ? (
            <span className={styles.helperError}>{fieldErrors.image}</span>
          ) : (
            <span className={styles.helperText}>
              Selecciona una imagen ya subida desde la pestaña &quot;Subir Archivos&quot;.
            </span>
          )}

          {imagenes.length === 0 && (
            <span className={styles.helperError}>
              No hay imágenes registradas. Primero sube una imagen en &quot;Subir Archivos&quot;.
            </span>
          )}
        </div>

        {/* Preview de la imagen seleccionada (si existe) */}
        {form.image && (form.image.startsWith("/assets/") || form.image.startsWith("https://")) && (
          <div className={`${styles.fullWidth} ${styles.imagePreviewContainer}`}>
            <img src={form.image} alt="Vista previa" className={styles.imagePreview} />
          </div>
        )}

        {/* Selector de modelo 3D: mismo patron que el de imagen */}
        <div className={`${styles.label} ${styles.fullWidth}`}>
          <span>Modelo AR (opcional)</span>

          <button
            type="button"
            className={styles.btnImageSelector}
            onClick={() => setShowModelModal(true)}
            disabled={saving}
          >
            {selectedModel
              ? `Cambiar modelo (actual: ${selectedModel.label})`
              : "Seleccionar modelo guardado..."}
          </button>

          <span className={styles.helperText}>
            Selecciona un modelo .glb ya subido desde la pestaña &quot;Subir Archivos&quot;.
          </span>

          {modelos.length === 0 && (
            <span className={styles.helperError}>
              No hay modelos registrados. Primero sube un .glb en &quot;Subir Archivos&quot;.
            </span>
          )}
        </div>

        {/* Card con info del modelo seleccionado y boton para quitarlo */}
        {selectedModel && (
          <div className={`${styles.fullWidth} ${styles.modelPreviewContainer}`}>
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

        <label className={styles.label}>
          Color de la card
          <div className={styles.colorPickerRow}>
            <input
              type="color"
              name="cardColor"
              value={form.cardColor}
              onChange={handleChange}
              className={styles.colorSwatch}
            />
            <input
              className={`${styles.input} ${fieldErrors.cardColor ? styles.inputError : ""}`}
              name="cardColor"
              value={form.cardColor}
              onChange={handleChange}
              placeholder="#152238"
              maxLength={7}
            />
          </div>
          {fieldErrors.cardColor ? (
            <span className={styles.helperError}>{fieldErrors.cardColor}</span>
          ) : (
            <span className={styles.helperText}>Formato hex: #RRGGBB</span>
          )}
        </label>

        <label className={styles.label}>
          Mensaje de la card (opcional)
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

        <label className={`${styles.label} ${styles.fullWidth}`}>
          Ingredientes (opcional)
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              className={styles.input}
              value={newIngredient}
              onChange={(e) => setNewIngredient(e.target.value)}
              onKeyPress={(e) => {
                // Enter agrega el ingrediente sin enviar el form entero.
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddIngredient();
                }
              }}
              placeholder="Ej: Tomate, Cebolla..."
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleAddIngredient}
              style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap" }}
            >
              +
            </button>
          </div>
        </label>

        {/* Lista de ingredientes ya agregados, cada uno con boton para quitarlo */}
        {form.ingredients.length > 0 && (
          <div className={`${styles.ingredientsList} ${styles.fullWidth}`}>
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

        <div className={styles.formActions}>
          <button className={styles.btnPrimary} type="submit" disabled={saving || !formValid}>
            {saving ? "Guardando..." : editingItem ? "Actualizar" : "Crear Plato"}
          </button>
          {editingItem && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setEditingItem(null)}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Tabla con todos los platos y filtro por categoria */}
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

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Categoria</th>
              <th>Precio</th>
              <th>Color</th>
              <th>Mensaje</th>
              <th>Ingr.</th>
              <th>AR</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className={styles.mono}>{item.id}</td>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{item.price}</td>
                <td>
                  <span
                    className={styles.colorDot}
                    style={{ backgroundColor: item.cardColor || DEFAULT_CARD_COLOR }}
                    title={item.cardColor || DEFAULT_CARD_COLOR}
                  />
                </td>
                <td>{item.cardMessage || "—"}</td>
                <td>
                  {item.ingredients && item.ingredients.length > 0 ? item.ingredients.length : "—"}
                </td>
                <td className={styles.mono}>{item.modelAR ? "✓" : "—"}</td>
                <td>
                  <button
                    className={styles.btnSmall}
                    onClick={() => {
                      setEditingItem(item);
                      // Scroll al form para que se vea la edicion. El timeout
                      // asegura que el form ya se rellenó antes de scrollear.
                      setTimeout(
                        () =>
                          formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Panel de categorias. Mucho mas simple que el de platos: solo tiene un campo
// (label). El id se genera automaticamente a partir del label.
function CategoriesPanel({ categories, editingCategory, setEditingCategory, onReload }) {
  const [form, setForm] = useState({ id: "", label: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Mismo patron que ItemsPanel para sincronizar el form con editingCategory.
  const prevEditingCategoryRef = useRef(editingCategory);
  if (prevEditingCategoryRef.current !== editingCategory) {
    prevEditingCategoryRef.current = editingCategory;
    if (editingCategory) {
      setForm({ ...editingCategory });
    } else {
      setForm({ id: "", label: "" });
    }
    setFieldErrors({});
  }

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Bloqueo de entrada: solo permitimos letras/espacios.
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
      if (editingCategory) {
        await updateCategory(editingCategory.id, { label: form.label });
        setSuccessMessage("LA CATEGORIA SE HA ACTUALIZADO CON EXITO");
      } else {
        // En crear, el id se deriva del label (ej: "Bebidas" -> "bebidas").
        const payload = { id: generateCategoryId(categories, form.label), label: form.label };
        await createCategory(payload);
        setSuccessMessage("LA CATEGORIA SE HA AGREGADO CON EXITO");
      }
      setShowSuccessModal(true);
      setEditingCategory(null);
      setForm({ id: "", label: "" });
      setFieldErrors({});
      setSaving(false);

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
        <h2>{editingCategory ? "Editar Categoria" : "Agregar Categoria"}</h2>
      </div>

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
            {saving ? "Guardando..." : editingCategory ? "Actualizar" : "Crear"}
          </button>
          {editingCategory && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setEditingCategory(null)}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

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
                  <button className={styles.btnSmall} onClick={() => setEditingCategory(cat)}>
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

// Wrapper simple del AdminUploader. Cuando se sube algo nuevo, recarga todos
// los datos del dashboard para que aparezca en los selectores.
function UploadPanel({ onReload }) {
  return (
    <div>
      <div className={styles.panelHeader}>
        <h2>Subir Archivos</h2>
      </div>

      <div className={styles.uploadContainer}>
        <AdminUploader
          onUploadComplete={async (asset, type) => {
            console.log(`${type === "model" ? "Modelo AR" : "Imagen"} subida:`, asset);
            await onReload();
          }}
        />
      </div>
    </div>
  );
}
