import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: "src/background/index.ts",
        content: "src/content/index.tsx"
      },
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "palette.css";
          }

          return "assets/[name]-[hash][extname]";
        },
        entryFileNames: "[name].js"
      }
    }
  }
});
