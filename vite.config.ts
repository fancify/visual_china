import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        chinaLowres: resolve(__dirname, "china-lowres.html"),
        pyramidDemo: resolve(__dirname, "pyramid-demo.html")
      },
      output: {
        manualChunks: {
          three: ["three"]
        }
      }
    }
  }
});
