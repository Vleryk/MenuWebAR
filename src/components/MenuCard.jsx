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

import { useState } from "react";
import styles from "./MenuCard.module.css";

import { CameraIcon } from "./icons/CameraIcon";
import { IngredientsIcon } from "./icons/IngredientsIcon";

import { ArModal } from "./ArModal";
import { IngredientsModal } from "./IngredientsModal";

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

  const openIngredientsModal = () => setIsIngredientsOpen(true);
  const closeIngredientsModal = () => setIsIngredientsOpen(false);

  const openArModal = () => setIsArOpen(true);
  const closeArModal = () => setIsArOpen(false);

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
                <IngredientsIcon className={styles.cameraIcon} />
              </button>

              {/* Boton de AR: solo si el plato tiene modelo 3D asignado */}
              {item.modelAR && (
                <button
                  type="button"
                  className={`${styles.btnAction} ${styles.btnArPrimary}`}
                  aria-label={`Ver ${item.name} en AR`}
                  title="Proyectar en tu mesa"
                  onClick={openArModal}
                >
                  <CameraIcon className={styles.cameraIcon} />
                </button>
              )}
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
