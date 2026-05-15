import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const proxyTarget = "https://kepedimos.com";

  return {
    plugins: [
      react(),
      VitePWA({
        strategies: "injectManifest",
        registerType: "autoUpdate",
        srcDir: "src",
        filename: "sw.ts",
        includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg"],
        manifest: {
          name: "Kepedimos",
          short_name: "Kepedimos",
          description: "PWA mobile-first para pedidos, restaurantes y gestion administrativa.",
          theme_color: "#f97316",
          background_color: "#111111",
          display: "standalone",
          start_url: "/",
          scope: "/",
          lang: "es",
          orientation: "portrait-primary",
          icons: [
            {
              src: "/icons/icon-192.svg",
              sizes: "192x192",
              type: "image/svg+xml",
              purpose: "any"
            },
            {
              src: "/icons/icon-512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any maskable"
            }
          ]
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
        }
      })
    ],
    server: {
      host: "0.0.0.0",
      port: 8015,
      proxy: {
        "/api/v1": {
          target: proxyTarget,
          changeOrigin: true,
          ws: true
        },
        "/media": {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
