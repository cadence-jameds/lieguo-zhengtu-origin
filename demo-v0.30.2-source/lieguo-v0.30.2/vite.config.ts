import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const githubPagesBase =
  process.env.GITHUB_ACTIONS === "true" && repositoryName && !repositoryName.endsWith(".github.io")
    ? `/${repositoryName}/`
    : "/";

export default defineConfig({
  base: githubPagesBase,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      includeAssets: ["icons/lieguo-crimson-lion.png"],
      manifest: {
        name: "列國征途：河谷戰役",
        short_name: "列國征途",
        description: "單機持續世界歷史策略遊戲",
        lang: "zh-TW",
        theme_color: "#121914",
        background_color: "#0a100d",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          {
            src: "icons/lieguo-crimson-lion.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,woff2,webp,png}"],
        globIgnores: ["**/town-wall-*.png"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"]
  },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 850
  }
});
