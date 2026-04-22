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

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [imagenes, setImagenes] = useState([]);
  const [activeTab, setActiveTab] = useState("items");

  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");

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
      setAuthenticated(false);
    }
  };

  useEffect(() => {
    verifyToken().then((valid) => {
      setAuthenticated(valid);
      setChecking(false);
    });
  }, []);

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

function ImageModal({ isOpen, imagenes, onSelectImage, onDeleteImage, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const filteredImages = imagenes.filter((img) =>
    img.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (!isOpen) return null;

  const handleDeleteClick = async (e, img) => {
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

function generateCategoryId(categoriesList, label) {
  const base =
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "cat";
  let id = base;
  let i = 2;
  while (categoriesList.some((c) => c.id === id)) {
    id = `${base}-${i++}`;
  }
  return id;
}

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
  const [form, setForm] = useState({
    id: "",
    category: "",
    name: "",
    description: "",
    price: "",
    image: "",
    modelAR: "Plato3",
    ingredients: [],
  });
  const [newIngredient, setNewIngredient] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);

  const itemsList = allItems || items;

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (editingItem) {
      setForm({
        ...editingItem,
        modelAR: editingItem.modelAR || "",
        ingredients: editingItem.ingredients || [],
      });
    } else {
      setForm({
        id: "",
        category: categories[0]?.id || "",
        name: "",
        description: "",
        price: "",
        image: "",
        modelAR: "Plato3",
        ingredients: [],
      });
    }
    setFieldErrors({});
    setNewIngredient("");
  }, [editingItem, categories]);

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

    return "";
  };

  const validateAll = () => {
    const errors = {};
    ["category", "name", "price", "description", "image"].forEach((field) => {
      const err = getFieldError(field, form[field] || "");
      if (err) errors[field] = err;
    });
    return errors;
  };

  const isFormValid = () => {
    const errors = validateAll();
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "name") {
      if (value !== "" && !/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]*$/.test(value)) return;
    }

    if (name === "price") {
      if (value !== "" && !/^[\d.]*$/.test(value)) return;
    }

    if (name === "description") {
      if (value.length > 500) return;
    }

    setForm((f) => ({ ...f, [name]: value }));

    const fieldError = getFieldError(name, value);
    setFieldErrors((errs) => ({ ...errs, [name]: fieldError }));
  };

  const handleAddIngredient = () => {
    const nextIngredients = newIngredient
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (nextIngredients.length === 0) return;

    setForm((f) => {
      const existingKeys = new Set(f.ingredients.map((item) => item.toLowerCase()));
      const merged = [...f.ingredients];

      for (const ingredient of nextIngredients) {
        const key = ingredient.toLowerCase();
        if (existingKeys.has(key)) continue;

        existingKeys.add(key);
        merged.push(ingredient);
      }

      return {
        ...f,
        ingredients: merged,
      };
    });

    setNewIngredient("");
  };

  const handleRemoveIngredient = (index) => {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.filter((_, i) => i !== index),
    }));
  };

  const handleSelectImage = (imageUrl) => {
    setForm((f) => ({ ...f, image: imageUrl }));
    setFieldErrors((errs) => ({ ...errs, image: "" }));
    setShowImageModal(false);
  };

  const handleDeleteImage = async (imageId) => {
    await deleteImagen(imageId);
    // Si la imagen borrada estaba seleccionada en el form, limpiar
    const deletedImg = imagenes.find((i) => i.id === imageId);
    if (deletedImg && form.image === deletedImg.src) {
      setForm((f) => ({ ...f, image: "" }));
    }
    await onReload();
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
      if (editingItem) {
        await updateItem(editingItem.id, form);
        setSuccessMessage("EL PLATO SE HA ACTUALIZADO CON EXITO");
      } else {
        const payload = { ...form, id: generateItemId(itemsList) };
        await createItem(payload);
        setSuccessMessage("EL PLATO SE HA AGREGADO CON EXITO");
      }
      setShowSuccessModal(true);
      setEditingItem(null);

      setForm({
        id: "",
        category: categories[0]?.id || "",
        name: "",
        description: "",
        price: "",
        image: "",
        modelAR: "Plato3",
        ingredients: [],
      });
      setFieldErrors({});
      setNewIngredient("");
      setSaving(false);

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
            placeholder="$12.990 (al editar borra el signo $)"
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

        {form.image && (form.image.startsWith("/assets/") || form.image.startsWith("https://")) && (
          <div className={`${styles.fullWidth} ${styles.imagePreviewContainer}`}>
            <img src={form.image} alt="Vista previa" className={styles.imagePreview} />
          </div>
        )}

        <label className={`${styles.label} ${styles.fullWidth}`}>
          Ingredientes (opcional)
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              className={styles.input}
              value={newIngredient}
              onChange={(e) => setNewIngredient(e.target.value)}
              onKeyPress={(e) => {
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

        <label className={`${styles.label} ${styles.fullWidth}`}>
          Modelo AR
          <select
            className={styles.input}
            name="modelAR"
            value={form.modelAR}
            onChange={handleChange}
          >
            <option value="">Sin modelo</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

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
              <th>Ingredientes</th>
              <th>Modelo AR</th>
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
                  {item.ingredients && item.ingredients.length > 0 ? item.ingredients.length : "—"}
                </td>
                <td className={styles.mono}>{item.modelAR ? "✓" : "—"}</td>
                <td>
                  <button
                    className={styles.btnSmall}
                    onClick={() => {
                      setEditingItem(item);
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

function CategoriesPanel({ categories, editingCategory, setEditingCategory, onReload }) {
  const [form, setForm] = useState({ id: "", label: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (editingCategory) {
      setForm({ ...editingCategory });
    } else {
      setForm({ id: "", label: "" });
    }
    setFieldErrors({});
  }, [editingCategory]);

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

  const isFormValid = () => {
    const errors = validateAll();
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (value !== "" && !/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]*$/.test(value)) return;

    setForm((f) => ({ ...f, [name]: value }));

    const fieldError = getFieldError(name, value);
    setFieldErrors((errs) => ({ ...errs, [name]: fieldError }));
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
