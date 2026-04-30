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

import { useState } from "react";
import styles from "./MenuCard.module.css";
import { currencyFormatter } from "../config/currencyFormatter";
import { CameraIcon } from "./icons/CameraIcon";
import { IngredientsIcon } from "./icons/IngredientsIcon";
import { IngredientsModal } from "./IngredientsModal";
import { ArModal } from "./ArModal";

function MenuCard({ item }) {
  const [isArOpen, setIsArOpen] = useState(false);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(false);

  const openIngredientsModal = () => setIsIngredientsOpen(true);
  const closeIngredientsModal = () => setIsIngredientsOpen(false);

  const openArModal = () => setIsArOpen(true);
  const closeArModal = () => setIsArOpen(false);

  // Color de fondo de la card. Si el admin configuro uno para este plato
  // especifico, lo usamos. Si no, queda el default del CSS.
  const cardStyle = item.cardColor ? { backgroundColor: item.cardColor } : undefined;

  return (
    <>
      <article className={styles.menuCard} style={cardStyle}>
        {/* Badge con mensaje tipo "Nuevo", "Recomendado", etc. Solo aparece
            si el admin definio cardMessage para este plato. */}
        {item.cardMessage && <span className={styles.cardBadge}>{item.cardMessage}</span>}

        {/* loading="lazy" para que las imagenes de platos que no estan en
            viewport no se bajen hasta que el user scrollee. */}
        <img className={styles.menuThumb} src={item.image} alt={item.name} loading="lazy" />

        <div className={styles.menuContent}>
          <h3>{item.name}</h3>
          <p>{item.description}</p>

          <div className={styles.menuFooter}>
            <strong>{currencyFormatter.format(item.price)}</strong>

            <div className={styles.cardActions}>
              {/* Boton de ingredientes: siempre visible */}
              <button
                type="button"
                className={styles.btnAction}
                aria-label={`Ver ingredientes de ${item.name}`}
                title="Ver ingredientes"
                onClick={openIngredientsModal}
              >
                <IngredientsIcon className={styles.cameraIcon} />
              </button>

              {/* Boton de AR: solo si el plato tiene modelo 3D asignado */}
              {item.modelAR ? (
                <button
                  type="button"
                  className={`${styles.btnAction} ${styles.btnArPrimary}`}
                  aria-label={`Ver ${item.name} en AR`}
                  title="Proyectar en tu mesa"
                  onClick={openArModal}
                >
                  <CameraIcon className={styles.cameraIcon} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </article>

      {/* ==================== Modal de AR / 3D ==================== */}
      <ArModal isOpen={isArOpen} close={closeArModal} item={item} />

      {/* ==================== Modal de ingredientes ==================== */}
      <IngredientsModal isOpen={isIngredientsOpen} close={closeIngredientsModal} item={item} />
    </>
  );
}

export default MenuCard;
