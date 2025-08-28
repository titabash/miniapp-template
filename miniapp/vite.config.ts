import { defineConfig } from "vite";
import rsc from "@vitejs/plugin-rsc";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import checker from "vite-plugin-checker";

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    hmr: {
      protocol: process.env.HMR_HOST ? "wss" : "ws",
      host: process.env.HMR_HOST || "localhost",
      port: 5173,
      clientPort: 5173,
    },
  },
  preview: {
    port: 8080,
  },
  plugins: [
    tailwindcss(),
    checker({
      typescript: true,
    }),
    rsc({
      entries: {
        rsc: "src/entry.rsc.tsx",
        client: "src/entry.browser.tsx",
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
