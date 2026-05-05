// ErrorBoundary captura errores que ocurren durante el render de los hijos
// y muestra un fallback en lugar de pantalla blanca. Sin esto, cualquier
// error no manejado tira toda la app abajo.
//
// IMPORTANTE: los Error Boundaries SOLO funcionan como class components, no
// hay equivalente con hooks todavia. Por eso usamos sintaxis vieja aca.
//
// Ojo que no captura:
//   - Errores en event handlers (onClick, onChange, etc)
//   - Errores asincronos (setTimeout, promesas, fetch)
//   - Errores en el propio Error Boundary
//   - Errores de SSR
// Para esos casos hay que hacer try/catch manual.

import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // Se ejecuta cuando un hijo tira un error durante el render. Devuelve el
  // nuevo state para que React lo aplique antes del proximo render.
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // Aca podrias mandar el error a un servicio tipo Sentry, LogRocket, etc.
  // Por ahora solo loguea en consola del browser.
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Si el padre paso un fallback custom (prop), lo usamos. Si no,
      // mostramos el fallback default de abajo.
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI de fallback default. Usa estilos inline para no depender de
      // ningun CSS module (por si el error tambien rompio el bundle de CSS).
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "200px",
            padding: "2rem",
            color: "#f7f1e8",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "#d4aa63", marginBottom: "0.5rem" }}>Algo salió mal</h2>
          <p style={{ opacity: 0.7 }}>
            Hubo un error al cargar esta sección. Intenta recargar la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1.5rem",
              background: "#d4aa63",
              color: "#0f1724",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Recargar
          </button>
        </div>
      );
    }

    // Si no hay error, renderea normalmente.
    return this.props.children;
  }
}

export default ErrorBoundary;
