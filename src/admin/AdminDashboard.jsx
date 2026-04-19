import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCategories,
  getItems,
  getModelos,
  createItem,
  updateItem,
  deleteItem,
  createCategory,
  updateCategory,
  deleteCategory,
  logout,
  verifyToken,
  uploadImage,
} from "./api";
import AdminLogin from "./AdminLogin";
import ImageUploader from "./ImageUploader";
import styles from "./admin.module.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [activeTab, setActiveTab] = useState("items");

  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");

  const loadData = async () => {
    try {
      const [cats, itms, mods] = await Promise.all([getCategories(), getItems(), getModelos()]);
      setCategories(cats);
      setItems(itms);
      setModelos(mods);
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
        const [cats, itms, mods] = await Promise.all([getCategories(), getItems(), getModelos()]);
        if (!cancelled) {
          setCategories(cats);
          setItems(itms);
          setModelos(mods);
        }
      } catch {
        if (!cancelled) setAuthenticated(false);
      }
    })();
    return () => { cancelled = true; };
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

  const filteredItems = filterCategory
    ? items.filter((i) => i.category === filterCategory)
    : items;

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
          Subir Imagen
        </button>
      </nav>

      <main className={styles.adminMain}>
        {activeTab === "items" && (
          <ItemsPanel
            items={filteredItems}
            allItems={items}
            categories={categories}
            modelos={modelos}
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
        {activeTab === "upload" && (
          <ImageUploader onUploadComplete={(url) => console.log("URL subida:", url)} />
        )}
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

function ItemsPanel({
  items,
  allItems,
  categories,
  modelos,
  filterCategory,
  setFilterCategory,
  editingItem,
  setEditingItem,
  onReload,
}) {
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  const itemsList = allItems || items;

  useEffect(() => {
    if (editingItem) {
      setForm({ ...editingItem, modelAR: editingItem.modelAR || "", ingredients: editingItem.ingredients || [] });
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
    setSelectedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [editingItem, categories]);

  const getFieldError = (name, value) => {
    if (name === "id") {
      if (!value.trim()) return "ID es requerido";
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) return "Solo letras, numeros, guion y guion bajo";
      if (!editingItem && itemsList.some((item) => item.id === value)) return "Este ID ya existe";
    }

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
    ["id", "category", "name", "price", "description", "image"].forEach((field) => {
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

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((errs) => ({ ...errs, image: "La imagen es muy grande (máximo 5MB)" }));
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setFieldErrors((errs) => ({ ...errs, image: "Solo imágenes (JPEG, PNG, WebP, GIF)" }));
      return;
    }

    setSelectedFileName(file.name);
    setUploadingImage(true);
    setFieldErrors((errs) => ({ ...errs, image: "" }));

    try {
      const result = await uploadImage(file);
      setForm((f) => ({ ...f, image: result.image }));
    } catch (err) {
      setFieldErrors((errs) => ({ ...errs, image: err.message || "Error al subir imagen" }));
      setSelectedFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setForm((f) => ({ ...f, image: "" }));
    setSelectedFileName("");
    setFieldErrors((errs) => ({ ...errs, image: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddIngredient = () => {
    if (newIngredient.trim() && !form.ingredients.includes(newIngredient.trim())) {
      setForm((f) => ({
        ...f,
        ingredients: [...f.ingredients, newIngredient.trim()],
      }));
      setNewIngredient("");
    }
  };

  const handleRemoveIngredient = (index) => {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.filter((_, i) => i !== index),
    }));
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
        await createItem(form);
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
      setSelectedFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
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

      <div className={styles.panelHeader}>
        <h2>{editingItem ? "Editar Plato" : "Agregar Plato"}</h2>
      </div>

      <form ref={formRef} className={styles.formGrid} onSubmit={handleSubmit}>
        {error && <div className={styles.errorMsg}>{error}</div>}

        <label className={styles.label}>
          ID
          <input
            className={`${styles.input} ${fieldErrors.id ? styles.inputError : ""}`}
            name="id"
            value={form.id}
            onChange={handleChange}
            required
            disabled={!!editingItem}
            placeholder="ej: ap-7"
          />
          {fieldErrors.id && <span className={styles.helperError}>{fieldErrors.id}</span>}
        </label>

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
          {fieldErrors.category && <span className={styles.helperError}>{fieldErrors.category}</span>}
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

        <div className={`${styles.label} ${styles.fullWidth}`}>
          <span>Imagen</span>
          
          <div className={styles.fileInputWrapper}>
            <input
              ref={fileInputRef}
              type="file"
              id="imageInput"
              accept="image/*"
              onChange={handleImageChange}
              disabled={saving || uploadingImage}
              style={{ display: "none" }}
            />
            <label 
              htmlFor="imageInput"
              className={`${styles.fileInputLabel} ${(saving || uploadingImage) ? styles.fileInputDisabled : ""}`}
            >
              <span className={styles.fileInputText}>
                <span className={styles.fileInputMain}>Seleccionar imagen</span>
                <span className={styles.fileInputSub}>o arrastra aquí</span>
              </span>
            </label>

            {uploadingImage && (
              <div className={styles.fileInputUploading}>
                <span className={styles.fileInputSpinner}></span>
                <span>Subiendo imagen...</span>
              </div>
            )}

            {fieldErrors.image && !uploadingImage && (
              <div className={styles.fileInputError}>
                <span className={styles.fileInputErrorIcon}>⚠️</span>
                <span className={styles.fileInputErrorText}>{fieldErrors.image}</span>
              </div>
            )}

            {form.image && !uploadingImage && (
              <div className={styles.fileInputSelected}>
                <span className={styles.fileInputSelectedIcon}>✓</span>
                <span className={styles.fileInputSelectedName}>{selectedFileName || "Imagen cargada"}</span>
                <button
                  type="button"
                  className={styles.fileInputSelectedRemove}
                  onClick={handleRemoveImage}
                >
                  ✕
                </button>
              </div>
            )}

            {!fieldErrors.image && !uploadingImage && !form.image && (
              <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "rgba(212, 170, 99, 0.6)", textAlign: "center" }}>
                Máximo 5MB (JPEG, PNG, WebP, GIF)
              </div>
            )}
          </div>
        </div>

        {form.image && form.image.startsWith("/assets/") && (
          <div className={`${styles.fullWidth} ${styles.imagePreviewContainer}`}>
            <img 
              src={form.image} 
              alt="Vista previa" 
              className={styles.imagePreview}
            />
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
          <button
            className={styles.btnPrimary}
            type="submit"
            disabled={saving || uploadingImage || !formValid}
          >
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
                <td>{item.ingredients && item.ingredients.length > 0 ? item.ingredients.length : "—"}</td>
                <td className={styles.mono}>{item.modelAR ? "✓" : "—"}</td>
                <td>
                  <button
                    className={styles.btnSmall}
                    onClick={() => {
                      setEditingItem(item);
                      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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

  useEffect(() => {
    if (editingCategory) {
      setForm({ ...editingCategory });
    } else {
      setForm({ id: "", label: "" });
    }
    setFieldErrors({});
  }, [editingCategory]);

  const getFieldError = (name, value) => {
    if (name === "id") {
      if (!value.trim()) return "ID es requerido";
      if (!/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]+$/.test(value)) return "Solo letras y espacios";
      if (!editingCategory && categories.some((cat) => cat.id === value)) return "Este ID ya existe";
    }

    if (name === "label") {
      if (!value.trim()) return "Nombre visible es requerido";
      if (!/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]+$/.test(value)) return "Solo letras y espacios";
    }

    return "";
  };

  const validateAll = () => {
    const errors = {};
    ["id", "label"].forEach((field) => {
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

    // Solo permitir letras, espacios, guiones y acentos
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
        await createCategory(form);
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
          ID
          <input
            className={`${styles.input} ${fieldErrors.id ? styles.inputError : ""}`}
            name="id"
            value={form.id}
            onChange={handleChange}
            required
            disabled={!!editingCategory}
            placeholder="ej: Bebidas"
          />
          {fieldErrors.id ? (
            <span className={styles.helperError}>{fieldErrors.id}</span>
          ) : (
            <span className={styles.helperText}>Solo letras y espacios</span>
          )}
        </label>

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
          <button 
            className={styles.btnPrimary} 
            type="submit" 
            disabled={saving || !formValid}
          >
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
                  <button
                    className={styles.btnSmall}
                    onClick={() => setEditingCategory(cat)}
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