// Punto de entrada de la aplicacion. Vite arranca aca. Sus responsabilidades:
//   1. Configurar React Router con las 3 rutas del proyecto
//   2. Envolver toda la app en un ErrorBoundary para capturar crashes
//   3. Importar el web component <model-viewer> globalmente para que ande
//      en cualquier componente que lo use
//   4. Importar los estilos globales

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import AdminDashboard from "./admin/AdminDashboard";
import ErrorBoundary from "./components/ErrorBoundary";
import DirectARViewer from "./components/DirectARViewer";
// Esta importacion registra el custom element <model-viewer> en el navegador.
// Solo hay que hacerlo una vez, aca, y queda disponible en toda la app.
import "@google/model-viewer";
import "./globals.css";
import { MenuPrint } from "./components/MenuPrint";

ReactDOM.createRoot(document.getElementById("root")).render(
  // StrictMode hace doble-render en dev para detectar side effects mal hechos.
  // No afecta produccion.
  <React.StrictMode>
    {/* ErrorBoundary captura cualquier error de render no manejado y muestra
        un fallback en lugar de pantalla blanca. */}
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Menu publico: lo que ven los clientes */}
          <Route path="/" element={<App />} />
          <Route path="/menu/print" element={<MenuPrint />} />
          {/* Panel admin protegido por login */}
          <Route path="/admin" element={<AdminDashboard />} />
          {/* AR directo via QR. Util para imprimir un QR por plato y que el
              cliente lo escanee desde la mesa para abrir directo el modelo. */}
          <Route path="/ar/:itemId" element={<DirectARViewer />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
