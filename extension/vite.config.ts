import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// Builds the React-powered popup into extension/popup/.
// Outputs index.html + a single hashed JS+CSS bundle that the manifest's
// default_popup points to.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: resolve(__dirname, "popup-src"),
  base: "./",
  build: {
    outDir: resolve(__dirname, "popup"),
    emptyOutDir: false, // keep existing popup.html etc. for now; we'll switch the manifest
    rollupOptions: {
      input: resolve(__dirname, "popup-src/index.html"),
      output: {
        // Predictable output names — easier for the manifest + CSP
        entryFileNames: "assets/popup-[hash].js",
        chunkFileNames: "assets/chunk-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    target: "chrome111",
    minify: "esbuild",
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "popup-src"),
    },
  },
});
