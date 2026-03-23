import { useEffect, useState } from "react";
import styles from "./MenuCard.module.css";

function MenuCard({ item }) {
  const [isArOpen, setIsArOpen] = useState(false);

  useEffect(() => {
    if (!isArOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsArOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isArOpen]);

  useEffect(() => {
    if (!isArOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isArOpen]);

  return (
    <>
      <article className={styles.menuCard}>
        <img className={styles.menuThumb} src={item.image} alt={item.name} />

        <div className={styles.menuContent}>
          <h3>{item.name}</h3>
          <p>{item.description}</p>

          <div className={styles.menuFooter}>
            <strong>{item.price}</strong>
            <button
              type="button"
              className={styles.btnAr}
              aria-label={`Ver ${item.name} en AR`}
              title="Ver Modelo AR"
              onClick={() => setIsArOpen(true)}
            >
              <img src="/assets/IMG/copia.png" alt="Icono AR" />
            </button>
          </div>
        </div>
      </article>

      {isArOpen ? (
        <div className={styles.arModalOverlay} onClick={() => setIsArOpen(false)}>
          <div className={styles.arModal} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.arCloseBtn}
              onClick={() => setIsArOpen(false)}
              aria-label="Cerrar visor AR"
            >
              x
            </button>

            <model-viewer
              src="/assets/modelosAR/plato%20nuevooo.glb"
              ar
              ar-modes="webxr scene-viewer quick-look"
              camera-controls
              auto-rotate
              shadow-intensity="1"
              class={styles.arViewer}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

export default MenuCard;
