import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCategories,
  getItems,
  getModelos,
  getImagenes,
  getColorHistorial,
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
  isSuperAdmin,
  hasPermission,
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
} from "./api";
import AdminLogin from "./AdminLogin";
import AdminUploader from "./AdminUploader";
import styles from "./admin.module.css";

const COLOR_PRESETS = [
  { name: "Azul oscuro", value: "#152238" },
  { name: "Dorado", value: "#d4aa63" },
  { name: "Vino", value: "#5c1a1b" },
  { name: "Verde", value: "#1f3d2b" },
  { name: "Negro", value: "#0a0a0a" },
  { name: "Café", value: "#3e2723" },
];

const DEFAULT_CARD_COLOR = "#152238";

const PERMISSION_OPTIONS = [
  { key: "puede_crear_platos", label: "Crear platos" },
  { key: "puede_editar_platos", label: "Editar platos" },
  { key: "puede_eliminar_platos", label: "Eliminar platos" },
  { key: "puede_gestionar_categorias", label: "Gestionar categorías" },
  { key: "puede_subir_archivos", label: "Subir archivos" },
  { key: "puede_eliminar_archivos", label: "Eliminar archivos" },
  { key: "puede_gestionar_usuarios", label: "Gestionar usuarios" },
];

function formatPriceCLP(value) {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  return "$" + num.toLocaleString("es-CL");
}

function unformatPrice(value) {
  return String(value).replace(/\D/g, "");
}

function isoToDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function datetimeLocalToIso(local) {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function calcDiscountedPrice(priceStr, percent) {
  const base = parseInt(unformatPrice(priceStr), 10);
  if (Number.isNaN(base)) return 0;
  if (!percent || percent <= 0) return base;
  return Math.round(base * (1 - percent / 100));
}

// ============= ONBOARDING MODAL =============
function OnboardingModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: "📋",
      title: "Bienvenido al Admin",
      text: "Este panel te permite gestionar el menú, categorías e imágenes de Route 66.",
    },
    {
      icon: "🍽️",
      title: "Pestaña: Platos del Menú",
      text: "Aquí creas, editas y eliminas los platos. Completa el formulario a la izquierda y verás la vista previa en tiempo real a la derecha.",
    },
    {
      icon: "📂",
      title: "Pestaña: Categorías",
      text: "Organiza los platos en categorías (Bebidas, Platos Principales, etc.). Las categorías aparecen como títulos en el menú del cliente.",
    },
    {
      icon: "🖼️",
      title: "Pestaña: Subir Archivos",
      text: "Sube imágenes de platos y modelos 3D (.glb). Estas imágenes luego las usas en los platos.",
    },
    {
      icon: "💡",
      title: "Consejos",
      text: "✓ Siempre agrega una imagen al plato\n✓ Usa nombres claros (ej: 'Hamburguesa Clásica')\n✓ Los descuentos se muestran automáticamente\n✓ Presiona Ctrl+S para guardar rápido",
    },
  ];

  if (!isOpen) return null;

  const current = steps[step];

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.onboardingModal}>
        <button className={styles.onboardingClose} onClick={onClose}>
          ✕
        </button>
        <div className={styles.onboardingIcon}>{current.icon}</div>
        <h2 className={styles.onboardingTitle}>{current.title}</h2>
        <p className={styles.onboardingText}>{current.text}</p>
        <div className={styles.onboardingDots}>
          {steps.map((_, i) => (
            <div key={i} className={`${styles.dot} ${i === step ? styles.dotActive : ""}`} />
          ))}
        </div>
        <div className={styles.onboardingButtons}>
          {step > 0 && (
            <button className={styles.btnSecondary} onClick={() => setStep(step - 1)}>
              ← Anterior
            </button>
          )}
          {step < steps.length - 1 ? (
            <button className={styles.btnPrimary} onClick={() => setStep(step + 1)}>
              Siguiente →
            </button>
          ) : (
            <button className={styles.btnPrimary} onClick={onClose}>
              ¡Entendido! Empezar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= ADMIN DASHBOARD =============
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
  const [showOnboarding, setShowOnboarding] = useState(false);

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
      if (valid && !localStorage.getItem("admin_onboarding_done")) {
        setShowOnboarding(true);
        localStorage.setItem("admin_onboarding_done", "true");
      }
    });
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    (async () => {
      try {
        await loadData();
      } catch {
        setAuthenticated(false);
      }
    })();
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

  const filteredItems = filterCategory ? items.filter((i) => i.category === filterCategory) : items;
  const canManageUsers = hasPermission("puede_gestionar_usuarios");
  const isSuper = isSuperAdmin();

  return (
    <div className={styles.adminShell}>
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <UsersModal isOpen={showUsersModal} onClose={() => setShowUsersModal(false)} />

      <header className={styles.adminHeader}>
        <div className={styles.adminHeaderLeft}>
          <h1 className={styles.adminBrand}>Route 66 — Admin</h1>
          <button className={styles.linkBtn} onClick={() => navigate("/")}>
            ← Ver Menú Público
          </button>
        </div>
        <div className={styles.adminHeaderRight}>
          <button
            className={styles.helpBtn}
            onClick={() => setShowOnboarding(true)}
            title="Mostrar guía de uso"
          >
            ❓ Ayuda
          </button>
          <button
            className={`${styles.btnSecondary} ${!canManageUsers ? styles.btnDisabledByPerm : ""}`}
            onClick={() => canManageUsers && setShowUsersModal(true)}
            disabled={!canManageUsers}
            title={canManageUsers ? "Gestionar usuarios" : "Sin permiso"}
          >
            👥 Usuarios
          </button>
          <button className={styles.btnDanger} onClick={handleLogout}>
            Cerrar Sesión {isSuper ? "(super)" : ""}
          </button>
        </div>
      </header>

      <nav className={styles.adminNav}>
        <button
          className={`${styles.navBtn} ${activeTab === "items" ? styles.navActive : ""}`}
          onClick={() => setActiveTab("items")}
        >
          🍽️ Platos del Menú{" "}
          {items.length > 0 && <span className={styles.navBadge}>{items.length}</span>}
        </button>
        <button
          className={`${styles.navBtn} ${activeTab === "categories" ? styles.navActive : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          📂 Categorías{" "}
          {categories.length > 0 && <span className={styles.navBadge}>{categories.length}</span>}
        </button>
        <button
          className={`${styles.navBtn} ${activeTab === "upload" ? styles.navActive : ""}`}
          onClick={() => setActiveTab("upload")}
        >
          🖼️ Subir Archivos
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

// ============= SUCCESS MODAL =============
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

// ============= IMAGE MODAL =============
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
          placeholder="🔍 Buscar imagen..."
          className={styles.imageSearchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
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
            <p className={styles.noImagesText}>
              {imagenes.length === 0
                ? "No hay imágenes. Ve a 'Subir Archivos' para crear una."
                : "No hay imágenes que coincidan"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= MODEL MODAL =============
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
          <h3>Seleccionar Modelo AR (.glb)</h3>
          <button className={styles.imageModalClose} onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <input
          type="text"
          placeholder="🔍 Buscar modelo..."
          className={styles.imageSearchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
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
            <p className={styles.noImagesText}>
              {modelos.length === 0
                ? "No hay modelos. Ve a 'Subir Archivos' para crear uno."
                : "No hay modelos que coincidan"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= USERS MODAL =============
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
      setError("Password es requerido (mínimo 6 caracteres)");
      return;
    }
    if (editingUser && password.length > 0 && password.length < 6) {
      setError("Si cambias la password debe tener mínimo 6 caracteres");
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
          <h3>Gestión de Usuarios</h3>
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
              No hay usuarios secundarios. El super admin funciona aparte.
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
                placeholder={
                  editingUser ? "Dejar vacío para mantener la actual" : "Mínimo 6 caracteres"
                }
              />
              <span className={styles.helperText}>
                {editingUser ? "Vacío = mantiene la actual" : "Mínimo 6 caracteres"}
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

// ============= SECTION COMPONENT =============
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

// ============= TOOLTIP COMPONENT =============
function Tooltip({ text }) {
  return (
    <span className={styles.tooltip} tabIndex={0}>
      <span className={styles.tooltipIcon}>?</span>
      <span className={styles.tooltipText}>{text}</span>
    </span>
  );
}

// ============= FIELD STATUS COMPONENT =============
function FieldStatus({ error, value, touched }) {
  if (!touched || !value) return null;
  if (error) return <span className={`${styles.fieldStatus} ${styles.fieldStatusError}`}>✗</span>;
  return <span className={`${styles.fieldStatus} ${styles.fieldStatusOk}`}>✓</span>;
}

// ============= LIVE PREVIEW COMPONENT =============
function LivePreview({ form, categories }) {
  const cardStyle = form.cardColor ? { backgroundColor: form.cardColor } : undefined;
  const categoryLabel = categories.find((c) => c.id === form.category)?.label;

  const percent = parseInt(form.descuento, 10) || 0;
  const hasPreview = percent > 0 && form.price;
  const newPrice = hasPreview
    ? "$" + calcDiscountedPrice(form.price, percent).toLocaleString("es-CL")
    : null;

  return (
    <div className={styles.livePreviewWrap}>
      <div className={styles.livePreviewHeader}>
        <span className={styles.livePreviewLabel}>✨ Vista previa</span>
        {categoryLabel && <span className={styles.livePreviewCat}>{categoryLabel}</span>}
      </div>
      <article className={styles.previewCard} style={cardStyle}>
        {form.cardMessage && <span className={styles.previewBadge}>{form.cardMessage}</span>}
        {form.image ? (
          <img className={styles.previewThumb} src={form.image} alt={form.name || "Preview"} />
        ) : (
          <div className={styles.previewThumbPlaceholder}>
            <span>🖼️ Sin imagen</span>
          </div>
        )}
        <div className={styles.previewContent}>
          <h3>{form.name || "Nombre del plato"}</h3>
          <p>{form.description || "Descripción..."}</p>
          <div className={styles.previewFooter}>
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

// ============= HELPERS =============
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

// ============= ITEMS PANEL =============
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

  const getFieldError = (name, value) => {
    if (name === "category") {
      if (!value) return "Selecciona una categoría";
    }
    if (name === "name") {
      if (!value.trim()) return "El nombre es requerido";
      if (!/^[a-zA-Z\s\-áéíóúñÁÉÍÓÚÑ]+$/.test(value)) return "Solo letras y espacios";
    }
    if (name === "price") {
      const clean = unformatPrice(value);
      if (!clean) return "El precio es requerido";
      if (parseInt(clean, 10) <= 0) return "El precio debe ser mayor a 0";
    }
    if (name === "description") {
      if (!value.trim()) return "La descripción es requerida";
      if (value.length > 500) return "Máximo 500 caracteres";
    }
    if (name === "image") {
      if (!value) return "Debes agregar una imagen";
    }
    if (name === "cardColor") {
      if (value && !/^#[0-9A-Fa-f]{6}$/.test(value)) return "Formato hex inválido";
    }
    if (name === "cardMessage") {
      if (value.length > 40) return "Máximo 40 caracteres";
    }
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
    if (form.descuentoInicio && form.descuentoFin) {
      if (new Date(form.descuentoFin) < new Date(form.descuentoInicio)) {
        errors.descuentoFin = "Fin no puede ser anterior al inicio";
      }
    }
    return errors;
  };

  const isFormValid = () => Object.keys(validateAll()).length === 0;

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
    if (name === "descuento") {
      const n = value === "" ? 0 : parseInt(value, 10);
      if (!Number.isNaN(n)) {
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
        const payloadBase = {
          ...form,
          cardMessage: form.cardMessage.trim() || null,
          descuento: parseInt(form.descuento, 10) || 0,
          descuentoInicio: datetimeLocalToIso(form.descuentoInicio),
          descuentoFin: datetimeLocalToIso(form.descuentoFin),
        };

        if (isEditingItem) {
          await updateItem(form.id, payloadBase);
          setSuccessMessage("🎉 ¡Plato actualizado!");
        } else {
          const payload = { ...payloadBase, id: generateItemId(itemsList) };
          await createItem(payload);
          setSuccessMessage("🎉 ¡Plato creado!");
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
    },
    [form, isEditingItem, itemsList, onReload, canCreate, canEdit],
  );

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
  }, [saving, isEditingItem, showImageModal, showModelModal, handleSubmit]);

  const handleDelete = async (id) => {
    if (!canDeleteItem) return;
    if (!window.confirm("¿Estás seguro? No se puede deshacer.")) return;
    try {
      await deleteItem(id);
      await onReload();
    } catch (err) {
      setError(err.message);
    }
  };

  const formValid = isFormValid();
  const selectedModel = modelos.find((m) => m.id === form.modelAR);
  const submitDisabled = saving || !formValid || (isEditingItem ? !canEdit : !canCreate);

  const computeDiscountStatus = () => {
    const pct = parseInt(form.descuento, 10) || 0;
    if (pct <= 0) return { type: "off", text: "Sin descuento" };
    const now = Date.now();
    const ini = form.descuentoInicio ? new Date(form.descuentoInicio).getTime() : null;
    const fin = form.descuentoFin ? new Date(form.descuentoFin).getTime() : null;
    if (ini && now < ini)
      return { type: "off", text: `Activo en: ${form.descuentoInicio.replace("T", " ")}` };
    if (fin && now > fin) return { type: "off", text: "Expirado" };
    return { type: "ok", text: `✅ Activo ahora (-${pct}%)` };
  };
  const discountStatus = computeDiscountStatus();

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
        <h2>{isEditingItem ? "✏️ Editar Plato" : "➕ Crear Plato"}</h2>
        {imagenes.length === 0 && (
          <div className={styles.warningBox}>
            ⚠️ Primero sube imágenes en la pestaña "Subir Archivos"
          </div>
        )}
      </div>

      <div className={styles.editorLayout}>
        <form ref={formRef} className={styles.editorForm} onSubmit={handleSubmit}>
          {error && <div className={styles.errorMsg}>{error}</div>}

          <Section title="📋 Información Básica" icon="📋" defaultOpen>
            <div className={styles.sectionGrid}>
              <label className={styles.label}>
                Categoría
                <div className={styles.inputWithIcon}>
                  <select
                    className={`${styles.input} ${fieldErrors.category ? styles.inputError : ""}`}
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    required
                  >
                    <option value="">-- Selecciona --</option>
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
                Nombre del plato
                <div className={styles.inputWithIcon}>
                  <input
                    className={`${styles.input} ${fieldErrors.name ? styles.inputError : ""}`}
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Ej: Hamburguesa Clásica"
                    required
                  />
                  <FieldStatus error={fieldErrors.name} value={form.name} touched={touched.name} />
                </div>
                {fieldErrors.name && <span className={styles.helperError}>{fieldErrors.name}</span>}
              </label>

              <label className={styles.label}>
                Precio
                <div className={styles.inputWithIcon}>
                  <input
                    className={`${styles.input} ${fieldErrors.price ? styles.inputError : ""}`}
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="$12.990"
                    inputMode="numeric"
                    required
                  />
                  <FieldStatus
                    error={fieldErrors.price}
                    value={form.price}
                    touched={touched.price}
                  />
                </div>
                {fieldErrors.price && (
                  <span className={styles.helperError}>{fieldErrors.price}</span>
                )}
              </label>

              <label className={`${styles.label} ${styles.fullWidth}`}>
                Descripción
                <textarea
                  className={`${styles.textarea} ${fieldErrors.description ? styles.inputError : ""}`}
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe el plato: ingredientes principales, preparación, etc."
                  rows={3}
                  required
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

          <Section title="🖼️ Multimedia" icon="🖼️" badge={form.image ? "✓" : null}>
            <div className={styles.label}>
              <span>Imagen del plato *</span>
              <button
                type="button"
                className={styles.btnImageSelector}
                onClick={() => setShowImageModal(true)}
                disabled={saving}
              >
                {form.image ? "🔄 Cambiar imagen" : "🖼️ Elegir imagen..."}
              </button>
              {fieldErrors.image && <span className={styles.helperError}>{fieldErrors.image}</span>}
              {imagenes.length === 0 && (
                <span className={styles.helperError}>
                  📌 Primero sube imágenes en "Subir Archivos"
                </span>
              )}
            </div>

            {form.image &&
              (form.image.startsWith("/assets/") || form.image.startsWith("https://")) && (
                <div className={styles.imagePreviewContainer}>
                  <img src={form.image} alt="Preview" className={styles.imagePreview} />
                </div>
              )}

            <div className={styles.label} style={{ marginTop: "1rem" }}>
              <span>Modelo 3D AR (opcional)</span>
              <button
                type="button"
                className={styles.btnImageSelector}
                onClick={() => setShowModelModal(true)}
                disabled={saving}
              >
                {selectedModel
                  ? `🔄 Cambiar (actual: ${selectedModel.label})`
                  : "📦 Elegir modelo .glb..."}
              </button>
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
                  </div>
                  <button
                    type="button"
                    className={styles.btnSmallDanger}
                    onClick={handleClearModel}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}
          </Section>

          <Section
            title="🏷️ Descuento"
            icon="🏷️"
            defaultOpen={false}
            badge={form.descuento > 0 ? `-${form.descuento}%` : null}
          >
            <div className={styles.discountRow}>
              <label className={styles.label}>
                % Descuento
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
              </label>

              <label className={styles.label}>
                Inicio (opcional)
                <input
                  type="datetime-local"
                  className={styles.input}
                  name="descuentoInicio"
                  value={form.descuentoInicio}
                  onChange={handleChange}
                />
              </label>

              <label className={styles.label}>
                Fin (opcional)
                <input
                  type="datetime-local"
                  className={`${styles.input} ${fieldErrors.descuentoFin ? styles.inputError : ""}`}
                  name="descuentoFin"
                  value={form.descuentoFin}
                  onChange={handleChange}
                />
              </label>
            </div>

            <div
              className={`${styles.discountStatus} ${
                discountStatus.type === "ok" ? styles.discountStatusOk : styles.discountStatusOff
              }`}
            >
              {discountStatus.text}
            </div>
          </Section>

          <Section title="🎨 Personalización" icon="🎨" defaultOpen={false}>
            <label className={styles.label}>
              Color de fondo
              <div className={styles.colorPickerRow}>
                <input
                  type="color"
                  name="cardColor"
                  value={form.cardColor}
                  onChange={handleChange}
                  className={styles.colorSwatch}
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
            </label>

            <label className={styles.label}>
              Etiqueta destacada (opcional)
              <input
                className={`${styles.input} ${fieldErrors.cardMessage ? styles.inputError : ""}`}
                name="cardMessage"
                value={form.cardMessage}
                onChange={handleChange}
                placeholder="Ej: ¡Nuevo!, Recomendado, Oferta"
                maxLength={40}
              />
              <span className={styles.helperText}>{form.cardMessage.length}/40 caracteres</span>
            </label>
          </Section>

          <Section title="🥗 Ingredientes" icon="🥗" badge={form.ingredients.length || null}>
            <label className={styles.label}>
              <span>Agregar ingredientes (separados por coma)</span>
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
                  placeholder="Tomate, Cebolla, Palta..."
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
              className={styles.btnPrimary}
              type="button"
              disabled={submitDisabled}
              onClick={handleSubmit}
            >
              {saving ? "Guardando..." : isEditingItem ? "💾 Actualizar" : "✓ Crear"}
            </button>
          </div>
        </div>
      </div>

      {/* ============ LISTA DE PLATOS ============ */}
      <div className={styles.tableHeader}>
        <h2>Todos los platos ({items.length})</h2>
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
                            onClick={() => {
                              if (!canEdit) return;
                              setIsEditingItem(true);
                              setForm({
                                ...DEFAULT_FORM_ITEMS,
                                ...item,
                                cardMessage: item.cardMessage ?? "",
                                descuentoInicio: isoToDatetimeLocal(item.descuentoInicio),
                                descuentoFin: isoToDatetimeLocal(item.descuentoFin),
                                descuento: item.descuento || 0,
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
                            ✏️ Editar
                          </button>
                          <button
                            className={`${styles.btnSmall} ${styles.btnSmallDanger} ${!canDeleteItem ? styles.btnDisabledByPerm : ""}`}
                            disabled={!canDeleteItem}
                            onClick={() => handleDelete(item.id)}
                          >
                            🗑️ Eliminar
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

// ============= CATEGORIES PANEL =============
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
      if (!value.trim()) return "El nombre es requerido";
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
        setSuccessMessage("🎉 ¡Categoría actualizada!");
      } else {
        const payload = { id: generateCategoryId(categories, form.label), label: form.label };
        await createCategory(payload);
        setSuccessMessage("🎉 ¡Categoría creada!");
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
    if (!window.confirm("¿Eliminar esta categoría y todos sus platos?")) return;
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
        <h2>{isEditingCategory ? "✏️ Editar Categoría" : "➕ Nueva Categoría"}</h2>
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
            placeholder="Ej: Bebidas y Jugos"
            required
            disabled={!canManage}
          />
          {fieldErrors.label && <span className={styles.helperError}>{fieldErrors.label}</span>}
        </label>

        <div className={styles.formActions}>
          <button
            className={`${styles.btnPrimary} ${!canManage ? styles.btnDisabledByPerm : ""}`}
            type="submit"
            disabled={saving || !formValid || !canManage}
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
              <th>Nombre</th>
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
                    onClick={() => {
                      if (!canManage) return;
                      setIsEditingCategory(true);
                      setForm({ ...DEFAULT_FORM_CATEGORY, ...cat });
                    }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className={`${styles.btnSmall} ${styles.btnSmallDanger} ${!canManage ? styles.btnDisabledByPerm : ""}`}
                    disabled={!canManage}
                    onClick={() => handleDelete(cat.id)}
                  >
                    🗑️ Eliminar
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

// ============= UPLOAD PANEL =============
function UploadPanel({ onReload }) {
  const canUpload = hasPermission("puede_subir_archivos");

  return (
    <div>
      <div className={styles.panelHeader}>
        <h2>📤 Subir Archivos</h2>
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
