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
} from "./api";
import AdminLogin from "./AdminLogin";
import styles from "./admin.module.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  // Datos
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [activeTab, setActiveTab] = useState("items");

  // Formularios
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
      </nav>

      <main className={styles.adminMain}>
        {activeTab === "items" && (
          <ItemsPanel
            items={filteredItems}
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
      </main>
    </div>
  );
}

// ====================
// Panel de Platos
// ====================
function ItemsPanel({
  items,
  categories,
  modelos,
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
    image: "/assets/IMG/comida.jfif",
    modelAR: "Plato3",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // agregue fieldErrors para guardar los errores de validacion de cada campo
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (editingItem) {
      setForm({ ...editingItem, modelAR: editingItem.modelAR || "" });
    } else {
      setForm({
        id: "",
        category: categories[0]?.id || "",
        name: "",
        description: "",
        price: "",
        image: "/assets/IMG/comida.jfif",
        modelAR: "Plato3",
      });
    }
    setFieldErrors({});
  }, [editingItem, categories]);

  // Funcion para validar todos los campos antes de enviar
  const validateFields = () => {
    const errors = {};

    // Valida que el ID no este vacio y sea unico
    if (!form.id.trim()) {
      errors.id = "ID es requerido";
    } else if (!/^[a-zA-Z0-9_-]+$/.test(form.id)) {
      errors.id = "ID solo acepta letras, numeros, guion y guion bajo";
    } else if (!editingItem && items.some((item) => item.id === form.id)) {
      errors.id = "ID ya existe";
    }

    // Valida que la categoria este seleccionada
    if (!form.category) {
      errors.category = "Categoria es requerida";
    }

    // Valida el nombre: solo letras y espacios
    if (!form.name.trim()) {
      errors.name = "Nombre es requerido";
    } else if (!/^[a-zaeiounñ\s]*$/i.test(form.name)) {
      errors.name = "Solo letras y espacios";
    }

    // Valida el precio: solo numeros y punto, y debe ser mayor a 0
    if (!form.price.trim()) {
      errors.price = "Precio es requerido";
    } else if (!/^[\d.]+$/.test(form.price)) {
      errors.price = "Solo numeros y punto";
    } else if (parseFloat(form.price) <= 0) {
      errors.price = "Precio debe ser mayor a 0";
    }

    // Valida que la descripcion no supere 500 caracteres
    if (form.description && form.description.length > 500) {
      errors.description = "Maximo 500 caracteres";
    }

    // Valida que la ruta de la imagen comience con /assets/
    if (form.image && !form.image.startsWith("/assets/")) {
      errors.image = "Ruta debe comenzar con /assets/";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Valida mientras escribe: solo letras en nombre, solo numeros en precio
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si es el campo nombre, rechaza numeros
    if (name === "name") {
      if (!/^[a-zaeiounñ\s]*$/i.test(value)) return;
    }
    
    // Si es el campo precio, rechaza letras
    if (name === "price") {
      if (!/^[\d.]*$/.test(value)) return;
    }
    
    setForm((f) => ({ ...f, [name]: value }));
    // Limpia el error del campo cuando el usuario empieza a escribir de nuevo
    setFieldErrors((errs) => ({ ...errs, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    // Valida todos los campos antes de enviar
    if (!validateFields()) {
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, form);
      } else {
        await createItem(form);
      }
      setEditingItem(null);
      await onReload();
    } catch (err) {
      setError(err.message);
    } finally {
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

  // Deshabilita el boton crear si hay errores o campos vacios
  const isFormValid = form.id && form.category && form.name && form.price && Object.keys(fieldErrors).length === 0;

  return (
    <div>
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
            placeholder="Descripcion del plato..."
          />
          <div className={styles.helperRow}>
            {fieldErrors.description ? (
              <span className={styles.helperError}>{fieldErrors.description}</span>
            ) : (
              // Muestra cuantos caracteres lleva el usuario escribiendo
              <span className={styles.helperText}>{form.description.length}/500 caracteres</span>
            )}
          </div>
        </label>

        <label className={`${styles.label} ${styles.fullWidth}`}>
          Imagen (ruta)
          <input
            className={`${styles.input} ${fieldErrors.image ? styles.inputError : ""}`}
            name="image"
            value={form.image}
            onChange={handleChange}
            placeholder="/assets/IMG/comida.jfif"
          />
          {fieldErrors.image && <span className={styles.helperError}>{fieldErrors.image}</span>}
        </label>

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
          {/* El boton se deshabilita si hay errores o campos vacios */}
          <button className={styles.btnPrimary} type="submit" disabled={saving || !isFormValid}>
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

// ====================
// Panel de Categorias
// ====================
function CategoriesPanel({ categories, editingCategory, setEditingCategory, onReload }) {
  const [form, setForm] = useState({ id: "", label: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingCategory) {
      setForm({ ...editingCategory });
    } else {
      setForm({ id: "", label: "" });
    }
  }, [editingCategory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, { label: form.label });
      } else {
        await createCategory(form);
      }
      setEditingCategory(null);
      await onReload();
    } catch (err) {
      setError(err.message);
    } finally {
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

  return (
    <div>
      <div className={styles.panelHeader}>
        <h2>{editingCategory ? "Editar Categoria" : "Agregar Categoria"}</h2>
      </div>

      <form className={styles.formRow} onSubmit={handleSubmit}>
        {error && <div className={styles.errorMsg}>{error}</div>}

        <label className={styles.label}>
          ID
          <input
            className={styles.input}
            value={form.id}
            onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            required
            disabled={!!editingCategory}
            placeholder="ej: Bebidas"
          />
        </label>

        <label className={styles.label}>
          Nombre visible
          <input
            className={styles.input}
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            required
            placeholder="ej: Bebidas y Jugos"
          />
        </label>

        <div className={styles.formActions}>
          <button className={styles.btnPrimary} type="submit" disabled={saving}>
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