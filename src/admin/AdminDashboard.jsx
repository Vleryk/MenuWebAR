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
//   - UsersModal          -> modal de gestion de usuarios secundarios
//   - Section             -> wrapper de seccion colapsable con header
//   - Tooltip             -> icono "?" con texto al hacer hover/focus
//   - FieldStatus         -> icono ✓/✗ inline para mostrar validacion
//   - LivePreview         -> vista previa en vivo de la card del plato
//   - generateItemId      -> helper: ids de plato tipo "item-N"
//   - generateCategoryId  -> helper: ids slug de categoria
//   - formatPriceCLP      -> helper: formatea numero a "$12.990"
//   - unformatPrice       -> helper: extrae digitos de un precio
//   - ItemsPanel          -> formulario y vista tipo menu de platos
//   - CategoriesPanel     -> formulario y tabla de categorias
//   - UploadPanel         -> wrapper del uploader a Cloudinary
//
// PERMISOS:
//   - El super_admin (admin.json) tiene todo y bypasea checks.
//   - Los usuarios de la tabla `usuarios` en Supabase tienen permisos
//     granulares. Cada accion sensible (crear plato, eliminar imagen, etc.)
//     se controla en backend con middlewares y en frontend ocultando o
//     deshabilitando los botones.
//
// DESCUENTO POR PLATO (NUEVO):
//   - Cada plato tiene un porcentaje (0-100) y opcionalmente fechas de
//     inicio y fin. El backend calcula si esta activo en el momento del
//     fetch y manda banderas listas para usar.
//   - El admin lo edita en una seccion nueva del form. La live preview
//     muestra el resultado con tachado en tiempo real.
// =============================================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  // Lecturas
  getCategories,
  getItems,
  getModelos,
  getImagenes,
  // historial de colores: lo cargamos al montar el dashboard
  getColorHistorial,
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
  // Auth + helpers de permisos
  logout,
  verifyToken,
  isSuperAdmin,
  hasPermission,
  // Usuarios
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
} from "./api";
import AdminLogin from "./AdminLogin";
import AdminUploader from "./AdminUploader";
import styles from "./admin.module.css";
import { currencyFormatter } from "../config/currencyFormatter";

// Presets de colores de la marca para el color picker.
const COLOR_PRESETS = [
  { name: "Azul oscuro", value: "#152238" },
  { name: "Dorado", value: "#d4aa63" },
  { name: "Vino", value: "#5c1a1b" },
  { name: "Verde", value: "#1f3d2b" },
  { name: "Negro", value: "#0a0a0a" },
  { name: "Café", value: "#3e2723" },
];

const DEFAULT_CARD_COLOR = "#152238";

// Lista canonica de permisos que se muestran como checkboxes en el modal de
// gestion de usuarios.
const PERMISSION_OPTIONS = [
  { key: "puede_crear_platos", label: "Crear platos" },
  { key: "puede_editar_platos", label: "Editar platos" },
  { key: "puede_eliminar_platos", label: "Eliminar platos" },
  { key: "puede_gestionar_categorias", label: "Gestionar categorías" },
  { key: "puede_subir_archivos", label: "Subir archivos" },
  { key: "puede_eliminar_archivos", label: "Eliminar archivos" },
  { key: "puede_gestionar_usuarios", label: "Gestionar usuarios" },
];

// Formatea cualquier valor a precio chileno: "12990" -> "$12.990".
function formatPriceCLP(value) {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  return "$" + num.toLocaleString("es-CL");
}

// Extrae solo los digitos de un precio formateado.
function unformatPrice(value) {
  return String(value).replace(/\D/g, "");
}

// Convierte un ISO timestamp ("2026-05-10T12:00:00Z") al formato que necesita
// el input type="datetime-local" ("2026-05-10T12:00"). Si recibe null/undefined
// devuelve "" (input vacio).
//
// OJO: el input datetime-local trabaja en hora LOCAL del navegador, no en UTC.
// Para que coincida lo que el admin ve con lo que se guardo, ajustamos el
// offset de zona horaria al armar el string.
function isoToDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // restamos el offset para que toISOString() devuelva la hora local
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

// Inversa: del formato del input ("2026-05-10T12:00") a un ISO completo.
// Si el string esta vacio devuelve null para que el backend guarde NULL.
function datetimeLocalToIso(local) {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Helper para calcular el precio con descuento aplicado en el frontend (lo
// usamos solo para la live preview, mientras el admin todavia no guardo).
// Cuando ya esta guardado, el server manda discountedPrice listo.
function calcDiscountedPrice(priceStr, percent) {
  const base = parseInt(unformatPrice(priceStr), 10);
  if (Number.isNaN(base)) return 0;
  if (!percent || percent <= 0) return base;
  return Math.round(base * (1 - percent / 100));
}

// =============================================================================
// COMPONENTE RAIZ: AdminDashboard
// =============================================================================
export default function AdminDashboard() {
  const navigate = useNavigate();

  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [imagenes, setImagenes] = useState([]);
  const [colorHistory, setColorHistory] = useState([]);

  const [activeTab, setActiveTab] = useState("items");
  const [filterCategory, setFilterCategory] = useState("");

  const [showUsersModal, setShowUsersModal] = useState(false);

  const loadData = async () => {
    try {
      const [cats, itms, mods, imgs, hist] = await Promise.all([
        getCategories(),
        getItems(),
        getModelos(),
        getImagenes(),
        getColorHistorial().catch(() => []),
      ]);
      setCategories(cats);
      setItems(itms);
      setModelos(mods);
      setImagenes(imgs);
      setColorHistory(hist);
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
        const [cats, itms, mods, imgs, hist] = await Promise.all([
          getCategories(),
          getItems(),
          getModelos(),
          getImagenes(),
          getColorHistorial().catch(() => []),
        ]);
        if (!cancelled) {
          setCategories(cats);
          setItems(itms);
          setModelos(mods);
          setImagenes(imgs);
          setColorHistory(hist);
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

  const canManageUsers = hasPermission("puede_gestionar_usuarios");
  const isSuper = isSuperAdmin();

  return (
    <div className={styles.adminShell}>
      <UsersModal isOpen={showUsersModal} onClose={() => setShowUsersModal(false)} />

      <header className={styles.adminHeader}>
        <div className={styles.adminHeaderLeft}>
          <h1 className={styles.adminBrand}>Route 66 — Admin</h1>
          <button className={styles.linkBtn} onClick={() => navigate("/")}>
            ← Ver Menu
          </button>
        </div>
        <div className={styles.adminHeaderRight}>
          <button
            className={`${styles.btnSecondary} ${!canManageUsers ? styles.btnDisabledByPerm : ""}`}
            onClick={() => canManageUsers && setShowUsersModal(true)}
            disabled={!canManageUsers}
            title={canManageUsers ? "Gestionar usuarios" : "Sin permiso para gestionar usuarios"}
          >
            👥 Usuarios
          </button>
          <button className={styles.btnDanger} onClick={handleLogout}>
            Cerrar Sesion {isSuper ? "(super)" : ""}
          </button>
        </div>
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
            colorHistory={colorHistory}
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
// =============================================================================
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

// =============================================================================
// ImageModal
// =============================================================================
function ImageModal({ isOpen, imagenes, onSelectImage, onDeleteImage, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const canDelete = hasPermission("puede_eliminar_archivos");

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
                  className={`${styles.imageDeleteBtn} ${!canDelete ? styles.btnDisabledByPerm : ""}`}
                  onClick={(e) => canDelete && handleDeleteClick(e, img)}
                  disabled={deletingId === img.id || !canDelete}
                  title={canDelete ? "Eliminar imagen" : "Sin permiso para eliminar"}
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
// =============================================================================
function ModelModal({ isOpen, modelos, onSelectModel, onDeleteModel, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const canDelete = hasPermission("puede_eliminar_archivos");

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
                  className={`${styles.imageDeleteBtn} ${!canDelete ? styles.btnDisabledByPerm : ""}`}
                  onClick={(e) => canDelete && handleDeleteClick(e, model)}
                  disabled={deletingId === model.id || !canDelete}
                  title={canDelete ? "Eliminar modelo" : "Sin permiso para eliminar"}
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

// =============================================================================
// UsersModal
// =============================================================================
function UsersModal({ isOpen, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editingUser, setEditingUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [perms, setPerms] = useState(() =>
    Object.fromEntries(PERMISSION_OPTIONS.map((p) => [p.key, false])),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    resetForm();
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await getUsuarios();
      setUsers(data);
    } catch (e) {
      setError(e.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingUser(null);
    setEmail("");
    setPassword("");
    setPerms(Object.fromEntries(PERMISSION_OPTIONS.map((p) => [p.key, false])));
  }

  function startEdit(user) {
    setEditingUser(user);
    setEmail(user.email);
    setPassword("");
    const merged = Object.fromEntries(PERMISSION_OPTIONS.map((p) => [p.key, false]));
    for (const k of Object.keys(user.permissions || {})) {
      if (k in merged) merged[k] = Boolean(user.permissions[k]);
    }
    setPerms(merged);
  }

  function togglePerm(key) {
    setPerms((p) => ({ ...p, [key]: !p[key] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email es requerido");
      return;
    }
    if (!editingUser && password.length < 6) {
      setError("Password es requerido (minimo 6 caracteres)");
      return;
    }
    if (editingUser && password.length > 0 && password.length < 6) {
      setError("Si vas a cambiar la password debe tener minimo 6 caracteres");
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const payload = { email: email.trim(), permissions: perms };
        if (password.length > 0) payload.password = password;
        await updateUsuario(editingUser.id, payload);
      } else {
        await createUsuario({ email: email.trim(), password, permissions: perms });
      }
      resetForm();
      await refresh();
    } catch (e) {
      setError(e.message || "Error al guardar usuario");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user) {
    if (!window.confirm(`¿Eliminar al usuario "${user.email}"?\nEsta acción no se puede deshacer.`))
      return;
    try {
      await deleteUsuario(user.id);
      if (editingUser && editingUser.id === user.id) resetForm();
      await refresh();
    } catch (e) {
      setError(e.message || "Error al eliminar usuario");
    }
  }

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.usersModalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.imageModalHeader}>
          <h3>Gestión de usuarios</h3>
          <button className={styles.imageModalClose} onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <div className={styles.usersListWrap}>
          {loading ? (
            <p className={styles.usersListEmpty}>Cargando...</p>
          ) : users.length === 0 ? (
            <p className={styles.usersListEmpty}>
              No hay usuarios secundarios registrados. El super admin sigue funcionando aparte.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.usersTable}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Permisos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const activePerms = PERMISSION_OPTIONS.filter((p) => u.permissions?.[p.key]);
                    return (
                      <tr key={u.id}>
                        <td>{u.email}</td>
                        <td>
                          {activePerms.length === 0 ? (
                            <span style={{ opacity: 0.5 }}>(sin permisos)</span>
                          ) : (
                            activePerms.map((p) => (
                              <span key={p.key} className={styles.permPill}>
                                {p.label}
                              </span>
                            ))
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.btnSmall}
                            onClick={() => startEdit(u)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={`${styles.btnSmall} ${styles.btnSmallDanger}`}
                            onClick={() => handleDelete(u)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form className={styles.userForm} onSubmit={handleSubmit}>
          <h4 className={styles.userFormTitle}>
            {editingUser ? `Editar usuario: ${editingUser.email}` : "Nuevo usuario"}
          </h4>

          <div className={styles.userFormGrid}>
            <label className={styles.label}>
              Email
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="usuario@dominio.com"
              />
            </label>

            <label className={styles.label}>
              {editingUser ? "Nueva contraseña (opcional)" : "Contraseña"}
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingUser ? "Dejar vacío para no cambiarla" : "Mínimo 6 caracteres"}
                minLength={editingUser ? 0 : 6}
              />
              <span className={styles.helperText}>
                {editingUser
                  ? "Vacío = mantiene la actual. Si la completas, la reseteas."
                  : "Mínimo 6 caracteres."}
              </span>
            </label>
          </div>

          <div>
            <span className={styles.label} style={{ marginBottom: "0.5rem" }}>
              Permisos
            </span>
            <div className={styles.permGrid}>
              {PERMISSION_OPTIONS.map((p) => (
                <label key={p.key} className={styles.permItem}>
                  <input
                    type="checkbox"
                    checked={Boolean(perms[p.key])}
                    onChange={() => togglePerm(p.key)}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? "Guardando..." : editingUser ? "Actualizar" : "Crear usuario"}
            </button>
            {editingUser && (
              <button type="button" className={styles.btnSecondary} onClick={resetForm}>
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Section
// =============================================================================
function Section({ title, icon, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.section}>
      <button type="button" className={styles.sectionHeader} onClick={() => setOpen(!open)}>
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
        {badge && <span className={styles.sectionBadge}>{badge}</span>}
        <span className={`${styles.sectionChevron} ${open ? styles.sectionChevronOpen : ""}`}>
          ▼
        </span>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

// =============================================================================
// Tooltip
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
// FieldStatus
// =============================================================================
function FieldStatus({ error, value, touched }) {
  if (!touched || !value) return null;
  if (error) return <span className={`${styles.fieldStatus} ${styles.fieldStatusError}`}>✗</span>;
  return <span className={`${styles.fieldStatus} ${styles.fieldStatusOk}`}>✓</span>;
}

// =============================================================================
// LivePreview
// -----------------------------------------------------------------------------
// Vista previa en vivo de la card. Replica el aspecto publico incluyendo
// ahora el TACHADO de descuento cuando el form tiene un porcentaje > 0.
//
// La preview NO valida fechas en este lado (mostrar siempre el efecto
// visual mientras el admin completa). El check real de "esta activo o no"
// lo hace el server al servir el menu publico.
// =============================================================================
function LivePreview({ form, categories }) {
  const cardStyle = form.cardColor ? { backgroundColor: form.cardColor } : undefined;
  const categoryLabel = categories.find((c) => c.id === form.category)?.label;

  // Si hay descuento > 0 mostramos el viejo precio tachado y el nuevo grande.
  // Aca no chequeamos fechas: el preview muestra el efecto incluso si todavia
  // no llego la fecha de inicio, asi el admin ve como va a quedar.
  const percent = parseInt(form.descuento, 10) || 0;
  const hasPreview = percent > 0 && form.price;
  const newPrice = hasPreview
    ? "$" + calcDiscountedPrice(form.price, percent).toLocaleString("es-CL")
    : null;

  return (
    <div className={styles.livePreviewWrap}>
      <div className={styles.livePreviewHeader}>
        <span className={styles.livePreviewLabel}>Vista previa en vivo</span>
        {categoryLabel && <span className={styles.livePreviewCat}>{categoryLabel}</span>}
      </div>
      <article className={styles.previewCard} style={cardStyle}>
        {form.cardMessage && <span className={styles.previewBadge}>{form.cardMessage}</span>}
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
            {/* Si hay descuento mostramos el nuevo precio + el viejo tachado
                + el badge -X%. Si no, solo el precio normal. */}
            {hasPreview ? (
              <div className={styles.previewPriceWrap}>
                <span className={styles.previewOldPrice}>{form.price}</span>
                <strong className={styles.previewNewPrice}>{newPrice}</strong>
                <span className={styles.previewDiscountBadge}>-{percent}%</span>
              </div>
            ) : (
              <strong>{form.price || "$0"}</strong>
            )}
            <div className={styles.previewActions}>
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

// =============================================================================
// ItemsPanel
// -----------------------------------------------------------------------------
// El form ahora incluye una nueva seccion "Descuento" con:
//   - input numerico de porcentaje (0-100)
//   - inicio (datetime-local, opcional)
//   - fin (datetime-local, opcional)
//   - estado en vivo: "Activo ahora" / "Programado" / "Expirado" / "Sin
//     descuento" segun el calculo en frontend
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
  // descuento por defecto: 0% = sin descuento. Las fechas en "" para que el
  // input datetime-local arranque vacio.
  descuento: 0,
  descuentoInicio: "",
  descuentoFin: "",
};

function ItemsPanel({
  items,
  allItems,
  categories,
  modelos,
  imagenes,
  colorHistory,
  filterCategory,
  setFilterCategory,
  onReload,
}) {
  const [isEditingItem, setIsEditingItem] = useState(false);

  const canCreate = hasPermission("puede_crear_platos");
  const canEdit = hasPermission("puede_editar_platos");
  const canDeleteItem = hasPermission("puede_eliminar_platos");

  const formRef = useRef(null);

  const [form, setForm] = useState(DEFAULT_FORM_ITEMS);
  const [newIngredient, setNewIngredient] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);

  const itemsList = allItems || items;

  // ---------------------------------------------------------------------------
  // VALIDACION
  // ---------------------------------------------------------------------------
  const getFieldError = (name, value) => {
    if (name === "category") {
      if (!value) return "Categoria es requerida";
    }
    if (name === "name") {
      if (!value.trim()) return "Nombre es requerido";
      if (!/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]+$/.test(value)) return "Solo letras y espacios";
    }
    if (name === "price") {
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
      if (value && !/^#[0-9A-Fa-f]{6}$/.test(value)) return "Formato hex invalido (#RRGGBB)";
    }
    if (name === "cardMessage") {
      if (value.length > 40) return "Maximo 40 caracteres";
    }
    // descuento: debe ser un entero entre 0 y 100
    if (name === "descuento") {
      const n = parseInt(value, 10);
      if (Number.isNaN(n) || n < 0 || n > 100) return "Debe ser entre 0 y 100";
    }
    return "";
  };

  const validateAll = () => {
    const errors = {};
    [
      "category",
      "name",
      "price",
      "description",
      "image",
      "cardColor",
      "cardMessage",
      "descuento",
    ].forEach((field) => {
      const err = getFieldError(field, form[field] ?? "");
      if (err) errors[field] = err;
    });
    // chequeo cruzado de fechas: si las dos estan, fin >= inicio
    if (form.descuentoInicio && form.descuentoFin) {
      if (new Date(form.descuentoFin) < new Date(form.descuentoInicio)) {
        errors.descuentoFin = "Fin no puede ser anterior al inicio";
      }
    }
    return errors;
  };

  const isFormValid = () => Object.keys(validateAll()).length === 0;

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "name") {
      if (value !== "" && !/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]*$/.test(value)) return;
    }
    if (name === "price") {
      const formatted = formatPriceCLP(value);
      setForm((f) => ({ ...f, price: formatted }));
      setFieldErrors((errs) => ({ ...errs, price: getFieldError("price", formatted) }));
      setTouched((t) => ({ ...t, price: true }));
      return;
    }
    if (name === "description") {
      if (value.length > 500) return;
    }
    if (name === "cardMessage") {
      if (value.length > 40) return;
    }
    // descuento: lo guardamos como numero para que la live preview pueda
    // hacer cuentas sin parsear cada vez
    if (name === "descuento") {
      // permitimos vacio momentaneo (input number con backspace) pero al
      // guardar lo sanitizamos a 0
      const n = value === "" ? 0 : parseInt(value, 10);
      if (!Number.isNaN(n)) {
        // clamp a [0, 100] para que no se pueda escribir 200
        const clamped = Math.max(0, Math.min(100, n));
        setForm((f) => ({ ...f, descuento: clamped }));
        setFieldErrors((errs) => ({
          ...errs,
          descuento: getFieldError("descuento", clamped),
        }));
        setTouched((t) => ({ ...t, descuento: true }));
      }
      return;
    }

    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((errs) => ({ ...errs, [name]: getFieldError(name, value) }));
    setTouched((t) => ({ ...t, [name]: true }));
  };

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

  const handleSelectImage = (imageUrl) => {
    setForm((f) => ({ ...f, image: imageUrl }));
    setFieldErrors((errs) => ({ ...errs, image: "" }));
    setTouched((t) => ({ ...t, image: true }));
    setShowImageModal(false);
  };

  const handleDeleteImage = async (imageId) => {
    await deleteImagen(imageId);
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

  const handleClearModel = () => {
    setForm((f) => ({ ...f, modelAR: "" }));
  };

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
  const handleSubmit = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault();
      setError("");

      if (isEditingItem && !canEdit) {
        setError("No tienes permiso para editar platos");
        return;
      }
      if (!isEditingItem && !canCreate) {
        setError("No tienes permiso para crear platos");
        return;
      }

      const errors = validateAll();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setTouched({
          category: true,
          name: true,
          price: true,
          description: true,
          image: true,
          cardColor: true,
          cardMessage: true,
          descuento: true,
        });
        return;
      }

      setSaving(true);
      try {
        // Convertimos las fechas del input local a ISO. Si estan vacias,
        // mandamos null para que el backend guarde NULL.
        const payloadBase = {
          ...form,
          cardMessage: form.cardMessage.trim() || null,
          descuento: parseInt(form.descuento, 10) || 0,
          descuentoInicio: datetimeLocalToIso(form.descuentoInicio),
          descuentoFin: datetimeLocalToIso(form.descuentoFin),
        };

        if (isEditingItem) {
          await updateItem(form.id, payloadBase);
          setSuccessMessage("EL PLATO SE HA ACTUALIZADO CON EXITO");
        } else {
          const payload = { ...payloadBase, id: generateItemId(itemsList) };
          await createItem(payload);
          setSuccessMessage("EL PLATO SE HA AGREGADO CON EXITO");
        }

        setShowSuccessModal(true);
        resetForm();
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [form, isEditingItem, itemsList, onReload, canCreate, canEdit],
  );

  // Atajos de teclado
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

  const handleDelete = async (id) => {
    if (!canDeleteItem) return;
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

  const submitDisabled =
    saving || !formValid || (isEditingItem ? !canEdit : !canCreate);

  const submitDisabledReason = isEditingItem
    ? !canEdit
      ? "Sin permiso para editar platos"
      : ""
    : !canCreate
      ? "Sin permiso para crear platos"
      : "";

  // Estado del descuento para el panel "Descuento": calculamos en frontend
  // si esta activo, programado o expirado segun NOW(). Es solo informativo.
  const computeDiscountStatus = () => {
    const pct = parseInt(form.descuento, 10) || 0;
    if (pct <= 0) return { type: "off", text: "Sin descuento aplicado" };
    const now = Date.now();
    const ini = form.descuentoInicio ? new Date(form.descuentoInicio).getTime() : null;
    const fin = form.descuentoFin ? new Date(form.descuentoFin).getTime() : null;
    if (ini && now < ini) return { type: "off", text: `Programado: arranca ${form.descuentoInicio.replace("T", " ")}` };
    if (fin && now > fin) return { type: "off", text: "Expirado" };
    return { type: "ok", text: `Activo: -${pct}% aplicado ahora` };
  };
  const discountStatus = computeDiscountStatus();

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
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
        <h2>{isEditingItem ? "Editar Plato" : "Agregar Plato"}</h2>
        <span className={styles.shortcutHint}>
          Atajos: <kbd>Ctrl+S</kbd> guardar · <kbd>Esc</kbd> cancelar
        </span>
      </div>

      <div className={styles.editorLayout}>
        <form ref={formRef} className={styles.editorForm} onSubmit={handleSubmit}>
          {error && <div className={styles.errorMsg}>{error}</div>}

          {/* SECCIÓN 1: INFORMACIÓN BÁSICA */}
          <Section title="Información básica" icon="📋" defaultOpen>
            <div className={styles.sectionGrid}>
              <label className={styles.label}>
                Categoria
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
                {fieldErrors.name ? (
                  <span className={styles.helperError}>{fieldErrors.name}</span>
                ) : (
                  <span className={styles.helperText}>Solo letras y espacios</span>
                )}
              </label>

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
                    <span className={styles.helperText}>
                      {form.description.length}/500 caracteres
                    </span>
                  )}
                </div>
              </label>
            </div>
          </Section>

          {/* SECCIÓN 2: MULTIMEDIA */}
          <Section title="Multimedia" icon="🖼️" defaultOpen badge={form.image ? "✓" : null}>
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
              {imagenes.length === 0 && (
                <span className={styles.helperError}>
                  No hay imágenes registradas. Primero sube una.
                </span>
              )}
            </div>

            {form.image &&
              (form.image.startsWith("/assets/") || form.image.startsWith("https://")) && (
                <div className={styles.imagePreviewContainer}>
                  <img src={form.image} alt="Vista previa" className={styles.imagePreview} />
                </div>
              )}

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

          {/* SECCIÓN NUEVA: DESCUENTO
              Tiene un porcentaje y dos fechas opcionales. Si dejas todo en
              blanco/0, no hay descuento. Si solo pones porcentaje, el descuento
              esta activo siempre. Las fechas dan ventana de vigencia. */}
          <Section
            title="Descuento"
            icon="🏷️"
            defaultOpen={false}
            badge={form.descuento > 0 ? `-${form.descuento}%` : null}
          >
            <div className={styles.discountRow}>
              <label className={styles.label}>
                % Descuento{" "}
                <Tooltip text="Porcentaje a descontar del precio base. 0 = sin descuento, 100 = gratis." />
                <input
                  type="number"
                  className={`${styles.input} ${fieldErrors.descuento ? styles.inputError : ""}`}
                  name="descuento"
                  value={form.descuento}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="1"
                  inputMode="numeric"
                />
                {fieldErrors.descuento && (
                  <span className={styles.helperError}>{fieldErrors.descuento}</span>
                )}
              </label>

              <label className={styles.label}>
                Inicio (opcional){" "}
                <Tooltip text="Si lo dejas vacío, el descuento está activo desde ya. Si pones fecha, el descuento se activa automáticamente cuando llega ese momento." />
                <input
                  type="datetime-local"
                  className={styles.input}
                  name="descuentoInicio"
                  value={form.descuentoInicio}
                  onChange={handleChange}
                />
              </label>

              <label className={styles.label}>
                Fin (opcional){" "}
                <Tooltip text="Cuándo termina el descuento. Si lo dejas vacío, no expira automáticamente y queda activo hasta que pongas el porcentaje en 0." />
                <input
                  type="datetime-local"
                  className={`${styles.input} ${fieldErrors.descuentoFin ? styles.inputError : ""}`}
                  name="descuentoFin"
                  value={form.descuentoFin}
                  onChange={handleChange}
                />
                {fieldErrors.descuentoFin && (
                  <span className={styles.helperError}>{fieldErrors.descuentoFin}</span>
                )}
              </label>
            </div>

            {/* Estado calculado del descuento (informativo) */}
            <div
              className={`${styles.discountStatus} ${
                discountStatus.type === "ok" ? styles.discountStatusOk : styles.discountStatusOff
              }`}
            >
              {discountStatus.type === "ok" ? "🟢" : "⚪"} {discountStatus.text}
            </div>
            <span className={styles.helperText}>
              El cliente verá el precio anterior tachado y el nuevo precio destacado en la card.
            </span>
          </Section>

          {/* SECCIÓN 3: PERSONALIZACIÓN */}
          <Section title="Personalización de la card" icon="🎨" defaultOpen={false}>
            <div className={styles.sectionGrid}>
              <label className={styles.label}>
                Color de fondo <Tooltip text="Color de fondo de la tarjeta del plato en el menú." />
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

                <div className={styles.colorHistoryWrap}>
                  <span className={styles.colorHistoryLabel}>Usados recientemente</span>
                  {colorHistory && colorHistory.length > 0 ? (
                    <div className={styles.colorHistoryRow}>
                      {colorHistory.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={styles.colorHistoryBtn}
                          style={{ background: c }}
                          title={c}
                          onClick={() => setForm((f) => ({ ...f, cardColor: c }))}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className={styles.colorHistoryEmpty}>
                      Aún no hay colores guardados. Se irán agregando al guardar platos.
                    </span>
                  )}
                </div>

                {fieldErrors.cardColor ? (
                  <span className={styles.helperError}>{fieldErrors.cardColor}</span>
                ) : (
                  <span className={styles.helperText}>Click en un color o ingresa hex #RRGGBB</span>
                )}
              </label>

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

          {/* SECCIÓN 4: INGREDIENTES */}
          <Section
            title="Ingredientes"
            icon="🥗"
            defaultOpen={false}
            badge={form.ingredients.length > 0 ? form.ingredients.length : null}
          >
            <label className={styles.label}>
              Agregar ingredientes{" "}
              <Tooltip text="Puedes agregar varios separados por coma. Presiona Enter o el botón + para añadir." />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  className={styles.input}
                  value={newIngredient}
                  onChange={(e) => setNewIngredient(e.target.value)}
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

        <aside className={styles.previewColumn}>
          <LivePreview form={form} categories={categories} />
        </aside>
      </div>

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
            {isEditingItem && (
              <button type="button" className={styles.btnSecondary} onClick={resetForm}>
                Cancelar
              </button>
            )}
            <button
              className={`${styles.btnPrimary} ${submitDisabledReason ? styles.btnDisabledByPerm : ""}`}
              type="button"
              disabled={submitDisabled}
              onClick={handleSubmit}
              title={submitDisabledReason}
            >
              {saving ? "Guardando..." : isEditingItem ? "💾 Actualizar Plato" : "✓ Crear Plato"}
            </button>
          </div>
        </div>
      </div>

      {/* ============ VISTA TIPO MENU CLIENTE ============ */}
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
                    <article
                      key={item.id}
                      className={styles.menuCard}
                      style={{ backgroundColor: item.cardColor || DEFAULT_CARD_COLOR }}
                    >
                      {item.cardMessage && (
                        <span className={styles.menuBadge}>{item.cardMessage}</span>
                      )}

                      {item.image && (
                        <div className={styles.menuImageWrap}>
                          <img src={item.image} alt={item.name} className={styles.menuImage} />
                        </div>
                      )}

                      <div className={styles.menuBody}>
                        <div className={styles.menuTopRow}>
                          <h4 className={styles.menuName}>{item.name}</h4>
<<<<<<< HEAD
                          <span className={styles.menuPrice}>
                            {currencyFormatter.format(item.price)}
                          </span>
=======
                          {/* Si el descuento esta activo mostramos el precio
                              tachado + el nuevo. Si no, solo el normal. */}
                          {item.discountActive ? (
                            <span className={styles.menuPrice}>
                              <span
                                style={{
                                  textDecoration: "line-through",
                                  opacity: 0.5,
                                  fontSize: "0.75rem",
                                  marginRight: "0.3rem",
                                }}
                              >
                                ${parseInt(item.price, 10).toLocaleString("es-CL")}
                              </span>
                              ${parseInt(item.discountedPrice, 10).toLocaleString("es-CL")}
                            </span>
                          ) : (
                            <span className={styles.menuPrice}>
                              ${parseInt(item.price, 10).toLocaleString("es-CL")}
                            </span>
                          )}
>>>>>>> b9ee9eb (guardar ultimos colores usados/agregar superadmin/admin/agregar descuento)
                        </div>

                        <p className={styles.menuId}>{item.id}</p>

                        {item.description && <p className={styles.menuDesc}>{item.description}</p>}

                        {item.ingredients?.length > 0 && (
                          <div className={styles.menuIngredients}>
                            {item.ingredients.map((ing, i) => (
                              <span key={i} className={styles.ingredientBadge}>
                                {ing}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.modelAR && <span className={styles.menuAr}>AR ✓</span>}

                        <div className={styles.menuActions}>
                          <button
                            className={`${styles.btnSmall} ${!canEdit ? styles.btnDisabledByPerm : ""}`}
                            disabled={!canEdit}
                            title={canEdit ? "" : "Sin permiso para editar"}
                            onClick={() => {
                              if (!canEdit) return;
                              setIsEditingItem(true);
                              setForm({
                                ...DEFAULT_FORM_ITEMS,
                                ...item,
                                cardMessage: item.cardMessage ?? "",
                                // Convertimos los ISO de la BD al formato local
                                // del input. El usuario los ve en su zona horaria.
                                descuentoInicio: isoToDatetimeLocal(item.descuentoInicio),
                                descuentoFin: isoToDatetimeLocal(item.descuentoFin),
                                // descuento como numero (la BD lo guarda asi)
                                descuento: item.descuento || 0,
                                // Forzamos price formateado por si viene como int
                                price:
                                  typeof item.price === "string" && item.price.startsWith("$")
                                    ? item.price
                                    : formatPriceCLP(item.price),
                              });
                              setTouched({});
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
                            className={`${styles.btnSmall} ${styles.btnSmallDanger} ${!canDeleteItem ? styles.btnDisabledByPerm : ""}`}
                            disabled={!canDeleteItem}
                            title={canDeleteItem ? "" : "Sin permiso para eliminar"}
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
// =============================================================================
const DEFAULT_FORM_CATEGORY = { id: "", label: "" };

function CategoriesPanel({ categories, onReload }) {
  const canManage = hasPermission("puede_gestionar_categorias");

  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM_CATEGORY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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
    if (value !== "" && !/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]*$/.test(value)) return;
    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((errs) => ({ ...errs, [name]: getFieldError(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!canManage) {
      setError("No tienes permiso para gestionar categorías");
      return;
    }

    const errors = validateAll();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      if (isEditingCategory) {
        await updateCategory(form.id, { label: form.label });
        setSuccessMessage("LA CATEGORIA SE HA ACTUALIZADO CON EXITO");
      } else {
        const payload = { id: generateCategoryId(categories, form.label), label: form.label };
        await createCategory(payload);
        setSuccessMessage("LA CATEGORIA SE HA AGREGADO CON EXITO");
      }
      setShowSuccessModal(true);
      setIsEditingCategory(false);
      setForm(DEFAULT_FORM_CATEGORY);
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
    if (!canManage) return;
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
            disabled={!canManage}
          />
          {fieldErrors.label ? (
            <span className={styles.helperError}>{fieldErrors.label}</span>
          ) : (
            <span className={styles.helperText}>
              {canManage ? "Solo letras y espacios" : "Sin permiso para gestionar categorías"}
            </span>
          )}
        </label>

        <div className={styles.formActions}>
          <button
            className={`${styles.btnPrimary} ${!canManage ? styles.btnDisabledByPerm : ""}`}
            type="submit"
            disabled={saving || !formValid || !canManage}
            title={canManage ? "" : "Sin permiso para gestionar categorías"}
          >
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
                    className={`${styles.btnSmall} ${!canManage ? styles.btnDisabledByPerm : ""}`}
                    disabled={!canManage}
                    title={canManage ? "" : "Sin permiso para gestionar categorías"}
                    onClick={() => {
                      if (!canManage) return;
                      setIsEditingCategory(true);
                      setForm({ ...DEFAULT_FORM_CATEGORY, ...cat });
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className={`${styles.btnSmall} ${styles.btnSmallDanger} ${!canManage ? styles.btnDisabledByPerm : ""}`}
                    disabled={!canManage}
                    title={canManage ? "" : "Sin permiso para gestionar categorías"}
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
// =============================================================================
function UploadPanel({ onReload }) {
  const canUpload = hasPermission("puede_subir_archivos");

  return (
    <div>
      <div className={styles.panelHeader}>
        <h2>Subir Archivos</h2>
      </div>

      <div className={styles.uploadContainer}>
        {canUpload ? (
          <AdminUploader
            onUploadComplete={async (asset, type) => {
              console.log(`${type === "model" ? "Modelo AR" : "Imagen"} subida:`, asset);
              await onReload();
            }}
          />
        ) : (
          <p className={styles.usersListEmpty}>
            No tienes permiso para subir archivos. Contacta al super admin.
          </p>
        )}
      </div>
    </div>
  );
}