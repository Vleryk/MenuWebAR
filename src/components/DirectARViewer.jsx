import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";

function DirectARViewer() {
  const { itemId } = useParams(); // Obtenemos el ID desde la URL
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const modelViewerRef = useRef(null);

  useEffect(() => {
    // Reutilizamos tu lógica de App.jsx para obtener los datos
    fetch("/api/menu")
      .then((res) => res.json())
      .then((data) => {
        // Buscamos el plato específico. Asumiendo que tus items tienen una propiedad 'id' o 'name'
        const foundItem = data.menuItems?.find(
          (m) => m.id === itemId || m.name.toLowerCase().replace(/\s+/g, "-") === itemId,
        );
        setItem(foundItem);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando el plato:", err);
        setLoading(false);
      });
  }, [itemId]);

  const launchAr = () => {
    if (modelViewerRef.current) {
      modelViewerRef.current.activateAR(); // Misma función que usas en MenuCard.jsx
    }
  };

  if (loading) return <div style={styles.center}>Cargando experiencia AR...</div>;
  if (!item || !item.modelAR) return <div style={styles.center}>Modelo no encontrado</div>;

  return (
    <div style={styles.fullScreenContainer}>
      <model-viewer
        ref={modelViewerRef}
        src={item.modelAR}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        auto-rotate
        style={styles.viewer}
      >
        {/* Botón HTML superpuesto para invitar a interactuar al usuario e iniciar AR */}
        <button slot="ar-button" style={styles.arButton} onClick={launchAr}>
          Ver en mi mesa
        </button>
      </model-viewer>
    </div>
  );
}

const styles = {
  fullScreenContainer: {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#000",
    display: "flex",
    flexDirection: "column",
  },
  viewer: {
    width: "100%",
    height: "100%",
  },
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    color: "#fff",
    fontFamily: "sans-serif",
  },
  arButton: {
    position: "absolute",
    bottom: "30px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "15px 30px",
    backgroundColor: "#ff4757", // Tu color primario o uno que destaque
    color: "white",
    border: "none",
    borderRadius: "25px",
    fontSize: "18px",
    fontWeight: "bold",
    boxShadow: "0px 4px 10px rgba(0,0,0,0.5)",
    cursor: "pointer",
    zIndex: 10,
  },
};

export default DirectARViewer;
