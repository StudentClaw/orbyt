import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "electron-vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const configDir = path.dirname(fileURLToPath(import.meta.url))
const uiRoot = path.resolve(configDir, "../ui")

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
      lib: {
        entry: path.resolve(configDir, "src/main.ts"),
        formats: ["es"],
        fileName: () => "main.js",
      },
    },
  },
  preload: {
    build: {
      outDir: "dist/preload",
      lib: {
        entry: path.resolve(configDir, "src/preload.ts"),
        formats: ["es"],
        fileName: () => "preload.js",
      },
    },
  },
  renderer: {
    root: uiRoot,
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        "@": path.resolve(uiRoot, "src"),
      },
    },
    build: {
      outDir: path.resolve(configDir, "dist/renderer"),
      rollupOptions: {
        input: path.resolve(uiRoot, "index.html"),
      },
    },
  },
})
