// Visor AR directo via URL. La idea: imprimir un QR por plato apuntando a
// /ar/:itemId y que el cliente lo escanee desde la mesa. El QR abre esta
// vista en pantalla completa con el modelo 3D listo para AR sin tener que
// navegar por el menu.
//
// La ruta esta registrada en main.jsx como: /ar/:itemId
//
// El itemId puede ser:
//   - El id del plato ("item-12")
//   - O el nombre del plato slugificado ("hamburguesa-clasica")
// Asi el QR puede tener URLs mas legibles si el restaurante quiere.

import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";

function DirectARViewer() {
  const { itemId } = useParams(); // Obtenemos el ID desde la URL
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const modelViewerRef = useRef(null);

  useEffect(() => {
    // Reutilizamos el endpoint /api/menu igual que App.jsx. Es un poco
    // wasteful traer todo el menu solo para un plato, pero asi mantenemos
    // un solo endpoint publico y el caching del browser ayuda.
    fetch("/api/menu")
      .then((res) => res.json())
      .then((data) => {
        // Buscamos el plato matcheando por id directo o por nombre
        // slugificado (todo en minusculas, espacios -> guiones).
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

  // Lanza la AR programaticamente. Usamos la misma API que en MenuCard.jsx.
  const launchAr = () => {
    if (modelViewerRef.current) {
      modelViewerRef.current.activateAR(); // Misma función que usas en MenuCard.jsx
    }
  };

  if (loading) return <div style={styles.center}>Cargando experiencia AR...</div>;
  // Si el plato no existe o no tiene modelo, mostramos un mensaje simple.
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
        {/* slot="ar-button" reemplaza el boton AR default de model-viewer.
            Nuestro boton es mas grande y llamativo, optimizado para que el
            cliente lo vea claramente en mobile despues de escanear el QR. */}
        <button slot="ar-button" style={styles.arButton} onClick={launchAr}>
          Ver en mi mesa
        </button>
      </model-viewer>
    </div>
  );
}

// Estilos inline porque este componente es full-screen y no comparte nada
// con el resto del menu. Mantenerlo aislado simplifica.
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
