import { defineConfig } from "electron-vite"

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
      rollupOptions: {
        input: "src/main.ts",
      },
    },
  },
  preload: {
    build: {
      outDir: "dist/preload",
      rollupOptions: {
        input: "src/preload.ts",
      },
    },
  },
  renderer: {
    // During dev, electron-vite proxies to the UI Vite dev server
    // For production, it builds from the UI package
    build: {
      outDir: "dist/renderer",
    },
  },
})
