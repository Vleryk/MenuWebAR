// Card de un plato del menu. Es la pieza visual mas vista del proyecto porque
// se renderea una por cada plato.
//
// Tiene dos modales:
//   1. AR viewer: abre <model-viewer> en pantalla completa para ver el 3D y
//      lanzar la AR (escena real con tu camara)
//   2. Ingredientes: lista los ingredientes del plato
//
// El 3D se carga desde Cloudinary como .glb. Usamos model-viewer de Google,
// que maneja:
//   - WebXR en Android
//   - Scene Viewer en Chrome Android
//   - Quick Look en iOS/Safari
// Todo lo que el usuario tiene que hacer es tocar el boton de la camara.
//
// DESCUENTOS:
// El backend ya nos manda calculado si el descuento esta activo en este
// momento (item.discountActive) y cual es el precio final con descuento
// aplicado (item.discountedPrice). El cliente NO calcula nada, solo renderiza
// lo que viene en los campos. Asi nadie puede hacer trampa con el reloj
// del navegador.

import { useEffect, useRef, useState } from "react";
import styles from "./MenuCard.module.css";

// Icono de camara (SVG inline para evitar una dependencia extra por un icono).
function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.cameraIcon}>
      <path d="M9 4.5a1 1 0 0 0-.8.4l-1 1.3H5A3 3 0 0 0 2 9.2v7.3a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9.2a3 3 0 0 0-3-3h-2.2l-1-1.3a1 1 0 0 0-.8-.4H9Zm3 4a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6Zm0 1.9a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z" />
    </svg>
  );
}

// Icono de lista de ingredientes.
function IngredientsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.cameraIcon}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
    </svg>
  );
}

// Helper para mostrar precios. El backend nos manda el numero como string
// crudo ("12990"), aca lo formateamos a CLP. Acepta numero o string, devuelve
// "$12.990" o el valor original si no es parseable.
function formatPriceDisplay(value) {
  if (value === null || value === undefined || value === "") return "";
  // si ya viene formateado con $, lo dejamos pasar
  if (typeof value === "string" && value.startsWith("$")) return value;
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return String(value);
  return "$" + parseInt(digits, 10).toLocaleString("es-CL");
}

function MenuCard({ item }) {
  const [isArOpen, setIsArOpen] = useState(false);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(false);
  // Progreso de carga del modelo 3D (0-100). Lo mostramos con una barra
  // porque los .glb pueden pesar varios MB y tardar en bajar.
  const [loadProgress, setLoadProgress] = useState(0);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const modelViewerRef = useRef(null);

  const openModal = () => {
    setLoadProgress(0);
    setIsModelLoading(true);
    setIsArOpen(true);
  };

  const closeModal = () => {
    setIsArOpen(false);
    setLoadProgress(0);
    setIsModelLoading(false);
  };

  const openIngredientsModal = () => setIsIngredientsOpen(true);
  const closeIngredientsModal = () => setIsIngredientsOpen(false);

  // Permite cerrar cualquiera de los dos modales con la tecla Escape.
  // Accesibilidad basica.
  useEffect(() => {
    if (!isArOpen && !isIngredientsOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (isArOpen) closeModal();
        if (isIngredientsOpen) closeIngredientsModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isArOpen, isIngredientsOpen]);

  // Mientras un modal esta abierto, bloqueamos el scroll del body para que
  // no se vea la pagina de atras scrolleando.
  useEffect(() => {
    if (!isArOpen && !isIngredientsOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isArOpen, isIngredientsOpen]);

  // Engancha los eventos de model-viewer. <model-viewer> es un web component
  // que no es de React, asi que necesitamos usar addEventListener manual.
  //
  // - progress: disparado mientras se descarga el .glb
  // - load: cuando termino de cargar y esta listo para mostrar
  // - error: si algo falla
  useEffect(() => {
    if (!isArOpen || !modelViewerRef.current) return;

    const modelViewer = modelViewerRef.current;

    const handleProgress = (event) => {
      const rawProgress = event.detail?.totalProgress ?? 0;
      const nextProgress = Math.min(100, Math.max(0, Math.round(rawProgress * 100)));
      setLoadProgress(nextProgress);
      setIsModelLoading(nextProgress < 100);
    };

    const handleLoad = () => {
      setLoadProgress(100);
      setIsModelLoading(false);
    };

    const handleError = () => setIsModelLoading(false);

    modelViewer.addEventListener("progress", handleProgress);
    modelViewer.addEventListener("load", handleLoad);
    modelViewer.addEventListener("error", handleError);

    return () => {
      modelViewer.removeEventListener("progress", handleProgress);
      modelViewer.removeEventListener("load", handleLoad);
      modelViewer.removeEventListener("error", handleError);
    };
  }, [isArOpen]);

  // Lanza AR directamente en vez de que el user tenga que tocar el boton de
  // AR de model-viewer. El setTimeout es necesario porque activateAR() falla
  // si se llama antes de que model-viewer termine de montarse en el DOM.
  const launchAr = () => {
    openModal();
    setTimeout(() => {
      if (modelViewerRef.current) {
        modelViewerRef.current.activateAR();
      }
    }, 50);
  };

  // Color de fondo de la card. Si el admin configuro uno para este plato
  // especifico, lo usamos. Si no, queda el default del CSS.
  const cardStyle = item.cardColor ? { backgroundColor: item.cardColor } : undefined;

  // Banderas de descuento: el backend ya hizo el calculo, aca solo leemos.
  // Compatibilidad: si el backend viejo no manda estos campos, los tratamos
  // como si no hubiera descuento (item.price es el precio que se muestra).
  const hasDiscount = Boolean(item.discountActive);
  const oldPriceDisplay = formatPriceDisplay(item.price);
  const newPriceDisplay = hasDiscount ? formatPriceDisplay(item.discountedPrice) : oldPriceDisplay;

  return (
    <>
      <article className={styles.menuCard} style={cardStyle}>
        {/* Badge con mensaje tipo "Nuevo", "Recomendado", etc. Solo aparece
            si el admin definio cardMessage para este plato. */}
        {item.cardMessage && <span className={styles.cardBadge}>{item.cardMessage}</span>}

        {/* Badge de descuento -X%. Lo ponemos arriba a la izquierda asi no se
            pisa con el cardMessage que va a la derecha. */}
        {hasDiscount && <span className={styles.discountBadge}>-{item.descuento}%</span>}

        {/* loading="lazy" para que las imagenes de platos que no estan en
            viewport no se bajen hasta que el user scrollee. */}
        <img className={styles.menuThumb} src={item.image} alt={item.name} loading="lazy" />

        <div className={styles.menuContent}>
          <h3>{item.name}</h3>
          <p>{item.description}</p>

          <div className={styles.menuFooter}>
            {/* Bloque de precios: si hay descuento mostramos el viejo tachado
                (chico, gris) + el nuevo (grande, dorado). Si no, solo el normal. */}
            {hasDiscount ? (
              <div className={styles.priceBlock}>
                <span className={styles.oldPrice}>{oldPriceDisplay}</span>
                <strong className={styles.newPrice}>{newPriceDisplay}</strong>
              </div>
            ) : (
              <strong>{newPriceDisplay}</strong>
            )}

            <div className={styles.cardActions}>
              {/* Boton de ingredientes: siempre visible */}
              <button
                type="button"
                className={styles.btnAction}
                aria-label={`Ver ingredientes de ${item.name}`}
                title="Ver ingredientes"
                onClick={openIngredientsModal}
              >
                <IngredientsIcon />
              </button>

              {/* Boton de AR: solo si el plato tiene modelo 3D asignado */}
              {item.modelAR ? (
                <button
                  type="button"
                  className={`${styles.btnAction} ${styles.btnArPrimary}`}
                  aria-label={`Ver ${item.name} en AR`}
                  title="Proyectar en tu mesa"
                  onClick={launchAr}
                >
                  <CameraIcon />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </article>

      {/* ==================== Modal de AR / 3D ==================== */}
      {isArOpen ? (
        // Click en el overlay cierra. Click dentro del modal no cierra
        // (stopPropagation en el contenido).
        <div className={styles.arModalOverlay} onClick={closeModal}>
          <div className={styles.arModal} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.arCloseBtn}
              onClick={closeModal}
              aria-label="Cerrar visor AR"
            >
              x
            </button>

            {/* Barra de progreso mientras carga el .glb */}
            {isModelLoading ? (
              <div
                className={styles.loaderWrapper}
                role="status"
                aria-live="polite"
                aria-label={`Cargando modelo 3D: ${loadProgress}%`}
              >
                <div className={styles.loaderTrack}>
                  <div className={styles.loaderBar} style={{ width: `${loadProgress}%` }} />
                </div>
                <span className={styles.loaderLabel}>{loadProgress}%</span>
              </div>
            ) : null}

            {/* El corazon del AR. model-viewer se encarga de todo:
                - Renderiza el .glb con Three.js
                - auto-rotate hace girar el modelo para mostrarlo
                - ar-modes define que tecnologias de AR usar en cada plataforma
                - camera-controls permite rotar con gestos touch */}
            <model-viewer
              ref={modelViewerRef}
              src={item.modelAR}
              ar
              ar-modes="webxr scene-viewer quick-look"
              camera-controls
              auto-rotate
              auto-rotate-delay="300"
              rotation-per-second="30deg"
              shadow-intensity="1"
              class={styles.arViewer}
            />
          </div>
        </div>
      ) : null}

      {/* ==================== Modal de ingredientes ==================== */}
      {isIngredientsOpen ? (
        <div className={styles.ingredientsModalOverlay} onClick={closeIngredientsModal}>
          <div className={styles.ingredientsModal} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.ingredientsCloseBtn}
              onClick={closeIngredientsModal}
              aria-label="Cerrar ingredientes"
            >
              x
            </button>

            <div className={styles.ingredientsContent}>
              <h2 className={styles.ingredientsTitle}>Ingredientes</h2>
              <p className={styles.ingredientsDish}>{item.name}</p>

              {/* Si hay ingredientes los listamos, si no mostramos un
                  mensaje generico. Muchos platos todavia no los tienen
                  cargados en BD. */}
              {item.ingredients && item.ingredients.length > 0 ? (
                <ul className={styles.ingredientsList}>
                  {item.ingredients.map((ingredient, index) => (
                    <li key={index} className={styles.ingredientItem}>
                      <span className={styles.ingredientBullet}>•</span>
                      {ingredient}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.noIngredientsMessage}>
                  <p>No hemos actualizado los ingredientes</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default MenuCard;
