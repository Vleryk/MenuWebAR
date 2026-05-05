import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";

import styles from "./ArModal.module.css";

const MIN_PROGRESS = 0;
const MAX_PROGRESS = 100;
const DEFAULT_PROGRESS = MIN_PROGRESS;

export const ArModal = ({ isOpen, close, item }) => {
  const modelViewerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(DEFAULT_PROGRESS);

  // Engancha los eventos de model-viewer. <model-viewer> es un web component
  // que no es de React, asi que necesitamos usar addEventListener manual.
  //
  // - progress: disparado mientras se descarga el .glb
  // - load: cuando termino de cargar y esta listo para mostrar
  // - error: si algo falla
  useEffect(() => {
    const model = modelViewerRef.current;
    if (!model || !isOpen) return;

    const handleProgress = (event) => {
      const rawProgress = event.detail?.totalProgress ?? DEFAULT_PROGRESS;
      // el valor va de 0 a 1
      const nextProgress = Math.min(
        MAX_PROGRESS,
        Math.max(MIN_PROGRESS, Math.round(rawProgress * MAX_PROGRESS)),
      );
      setProgress(nextProgress);
      setLoading(nextProgress < MAX_PROGRESS);
    };

    const handleLoad = () => {
      setProgress(MAX_PROGRESS);
      setLoading(false);
      // Lanza AR directamente en vez de que el user tenga que tocar el boton de
      // AR de model-viewer.
      if (model.canActivateAR) {
        model.activateAR();
      }
    };

    const handleError = () => setLoading(false);

    model.addEventListener("progress", handleProgress);
    model.addEventListener("load", handleLoad);
    model.addEventListener("error", handleError);

    return () => {
      model.removeEventListener("progress", handleProgress);
      model.removeEventListener("load", handleLoad);
      model.removeEventListener("error", handleError);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} close={close} title={item.name}>
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
        className={styles.modelViewer}
        style={{ width: "100%", height: "100%" }}
      >
        <div slot="progress-bar" />
      </model-viewer>
      {loading && <ModelLoader progress={progress} />}
    </Modal>
  );
};

const ModelLoader = ({ progress }) => {
  return (
    <div
      className={styles.loaderWrapper}
      role="status"
      aria-live="polite"
      aria-label={`Cargando modelo 3D: ${progress}%`}
    >
      <div className={styles.loaderTrack}>
        <div className={styles.loaderBar} style={{ width: `${progress}%` }} />
      </div>
      <span className={styles.loaderLabel}>{progress}%</span>
    </div>
  );
};
