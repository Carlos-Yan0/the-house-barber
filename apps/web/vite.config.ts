// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const appVersion = new Date().toISOString();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      plugins: [
        {
          name: "emit-version-json",
          generateBundle() {
            this.emitFile({
              type: "asset",
              fileName: "version.json",
              source: JSON.stringify({ version: appVersion }, null, 2),
            });
          },
        },
      ],
    },
  },
});
