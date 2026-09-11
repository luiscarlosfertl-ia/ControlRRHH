import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5190,
    strictPort: true,
    // La API valida Origin contra Host para proteger escrituras de CSRF. El
    // proxy debe conservar el Host público (localhost:5190); si lo reemplaza
    // por localhost:3100, una petición legítima de Vite se rechaza con 403.
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        changeOrigin: false,
      },
    },
  },
  build: { chunkSizeWarningLimit: 1200 },
});
