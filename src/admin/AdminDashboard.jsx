import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCategories,
  getItems,
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

  // Data
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState("items"); // items | categories | password

  // Forms
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");

  const loadData = async () => {
    try {
      const [cats, itms] = await Promise.all([getCategories(), getItems()]);
      setCategories(cats);
      setItems(itms);
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
        const [cats, itms] = await Promise.all([getCategories(), getItems()]);
        if (!cancelled) {
          setCategories(cats);
          setItems(itms);
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
    return <div className={styles.loading}>Verificando sesión...</div>;
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
            ← Ver Menú
          </button>
        </div>
        <button className={styles.btnDanger} onClick={handleLogout}>
          Cerrar Sesión
        </button>
      </header>

      <nav className={styles.adminNav}>
        <button
          className={`${styles.navBtn} ${activeTab === "items" ? styles.navActive : ""}`}
          onClick={() => setActiveTab("items")}
        >
          Platos del Menú
        </button>
        <button
          className={`${styles.navBtn} ${activeTab === "categories" ? styles.navActive : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          Categorías
        </button>
      </nav>

      <main className={styles.adminMain}>
        {activeTab === "items" && (
          <ItemsPanel
            items={filteredItems}
            categories={categories}
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
// Items Panel
// ====================
function ItemsPanel({
  items,
  categories,
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
    modelAR: "/assets/modelosAR/Plato3.glb",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
        modelAR: "/assets/modelosAR/Plato3.glb",
      });
    }
  }, [editingItem, categories]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
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
    if (!window.confirm("¿Eliminar este plato?")) return;
    try {
      await deleteItem(id);
      await onReload();
    } catch (err) {
      setError(err.message);
    }
  };

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
            className={styles.input}
            name="id"
            value={form.id}
            onChange={handleChange}
            required
            disabled={!!editingItem}
            placeholder="ej: ap-7"
          />
        </label>

        <label className={styles.label}>
          Categoría
          <select
            className={styles.input}
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
        </label>

        <label className={styles.label}>
          Nombre
          <input
            className={styles.input}
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="Nombre del plato"
          />
        </label>

        <label className={styles.label}>
          Precio
          <input
            className={styles.input}
            name="price"
            value={form.price}
            onChange={handleChange}
            required
            placeholder="$12.990"
          />
        </label>

        <label className={`${styles.label} ${styles.fullWidth}`}>
          Descripción
          <textarea
            className={styles.textarea}
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={2}
            placeholder="Descripción del plato..."
          />
        </label>

        <label className={`${styles.label} ${styles.fullWidth}`}>
          Imagen (ruta)
          <input
            className={styles.input}
            name="image"
            value={form.image}
            onChange={handleChange}
            placeholder="/assets/IMG/comida.jfif"
          />
        </label>

        <label className={`${styles.label} ${styles.fullWidth}`}>
          Modelo AR (ruta .glb)
          <input
            className={styles.input}
            name="modelAR"
            value={form.modelAR}
            onChange={handleChange}
            placeholder="/assets/modelosAR/Plato3.glb"
          />
        </label>

        <div className={styles.formActions}>
          <button className={styles.btnPrimary} type="submit" disabled={saving}>
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
          <option value="">Todas las categorías</option>
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
              <th>Categoría</th>
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
// Categories Panel
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
    if (!window.confirm("¿Eliminar esta categoría y todos sus platos?")) return;
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
        <h2>{editingCategory ? "Editar Categoría" : "Agregar Categoría"}</h2>
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
