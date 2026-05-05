// Config de Vite (build tool del proyecto). Tres cosas importantes aca:
//
// 1. Code splitting: model-viewer + three.js van a un chunk separado para
//    que el bundle inicial sea mas chico. Solo se descarga cuando el user
//    abre un modelo AR.
//
// 2. Proxy de /api en dev: Vite corre en :5173 y el backend en :3001. Sin
//    el proxy, los fetch a /api darian CORS o 404. En produccion no hace
//    falta porque ambos viven en el mismo dominio.
//
// 3. Config de tests con Vitest (jsdom + globals).

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  build: {
    rollupOptions: {
      output: {
        // Saca model-viewer y three a un chunk aparte. Pesan varios MB
        // y solo se usan cuando alguien abre el AR de un plato.
        manualChunks: {
          "model-viewer": ["@google/model-viewer", "three"],
        },
      },
    },
  },

  server: {
    proxy: {
      // En dev, todo lo que va a /api lo redirige al backend Express.
      // changeOrigin reescribe el header Host para que el server crea
      // que la peticion viene de su propio dominio.
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
