import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, ".", "");
    var proxyTarget = "https://kepedimos.com";
    return {
        plugins: [
            react(),
            VitePWA({
                strategies: "injectManifest",
                registerType: "autoUpdate",
                srcDir: "src",
                filename: "sw.ts",
                includeAssets: ["icons/app-icon-192.png", "icons/app-icon-512.png", "icons/app-icon-1024.png"],
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
                            src: "/icons/app-icon-192.png",
                            sizes: "192x192",
                            type: "image/png",
                            purpose: "any"
                        },
                        {
                            src: "/icons/app-icon-512.png",
                            sizes: "512x512",
                            type: "image/png",
                            purpose: "any maskable"
                        },
                        {
                            src: "/icons/app-icon-1024.png",
                            sizes: "1024x1024",
                            type: "image/png",
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
