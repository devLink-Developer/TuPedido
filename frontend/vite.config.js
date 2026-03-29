import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, ".", "");
    var proxyTarget = env.VITE_PROXY_TARGET || "http://localhost:8016";
    return {
        plugins: [
            react(),
            VitePWA({
                registerType: "autoUpdate",
                includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg"],
                manifest: {
                    name: "TuPedido",
                    short_name: "TuPedido",
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
                workbox: {
                    globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
                    navigateFallback: "/index.html",
                    runtimeCaching: [
                        {
                            urlPattern: /\/api\/v1\//,
                            handler: "NetworkOnly"
                        }
                    ],
                    navigateFallbackDenylist: [/^\/api\//]
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
