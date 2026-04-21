import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@student-claw/contracts": path.resolve(__dirname, "../contracts/src/index.ts"),
      "@student-claw/shared-runtime": path.resolve(__dirname, "../shared-runtime/src/index.ts"),
    },
  },
});
