import { useEffect, useRef, useState } from "react";
import styles from "./MenuCard.module.css";

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.cameraIcon}>
      <path d="M9 4.5a1 1 0 0 0-.8.4l-1 1.3H5A3 3 0 0 0 2 9.2v7.3a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9.2a3 3 0 0 0-3-3h-2.2l-1-1.3a1 1 0 0 0-.8-.4H9Zm3 4a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6Zm0 1.9a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.cameraIcon}>
      <path d="M12 5c5.4 0 9.8 4.3 10 6.9v.2c-.2 2.6-4.6 6.9-10 6.9s-9.8-4.3-10-6.9v-.2C2.2 9.3 6.6 5 12 5Zm0 2c-4.1 0-7.8 3.2-8.1 5 .3 1.8 4 5 8.1 5s7.8-3.2 8.1-5c-.3-1.8-4-5-8.1-5Zm0 1.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Zm0 1.9a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z" />
    </svg>
  );
}

function MenuCard({ item }) {
  const [isArOpen, setIsArOpen] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const modelViewerRef = useRef(null);

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

  useEffect(() => {
    if (!isArOpen) {
      setLoadProgress(0);
      setIsModelLoading(false);
      return;
    }

    setLoadProgress(0);
    setIsModelLoading(true);
  }, [isArOpen]);

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

    const handleError = () => {
      setIsModelLoading(false);
    };

    modelViewer.addEventListener("progress", handleProgress);
    modelViewer.addEventListener("load", handleLoad);
    modelViewer.addEventListener("error", handleError);

    return () => {
      modelViewer.removeEventListener("progress", handleProgress);
      modelViewer.removeEventListener("load", handleLoad);
      modelViewer.removeEventListener("error", handleError);
    };
  }, [isArOpen]);

  const open3DPreview = () => {
    setIsArOpen(true);
  };

  const launchAr = () => {
    setIsArOpen(true);
    setTimeout(() => {
      if (modelViewerRef.current) {
        modelViewerRef.current.activateAR();
      }
    }, 50);
  };

  return (
    <>
      <article className={styles.menuCard}>
        <img className={styles.menuThumb} src={item.image} alt={item.name} loading="lazy" />

        <div className={styles.menuContent}>
          <h3>{item.name}</h3>
          <p>{item.description}</p>

          <div className={styles.menuFooter}>
            <strong>{item.price}</strong>
            
            <div className={styles.cardActions}>
              {item.modelAR ? (
                <>
                  <button
                    type="button"
                    className={styles.btnAction}
                    aria-label={`Ver ${item.name} en 3D`}
                    title="Ver Modelo 3D"
                    onClick={open3DPreview}
                  >
                    <EyeIcon />
                  </button>

                  <button
                    type="button"
                    className={`${styles.btnAction} ${styles.btnArPrimary}`}
                    aria-label={`Ver ${item.name} en AR`}
                    title="Proyectar en tu mesa"
                    onClick={launchAr}
                  >
                    <CameraIcon />
                  </button>
                </>
              ) : null}
            </div>
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
    </>
  );
}

export default MenuCard;
