import {readFileSync} from "node:fs";
import { fileURLToPath, URL } from "node:url";
import {loadMetadata} from "./scripts/release-metadata.mjs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const githubPagesBase =
  process.env.GITHUB_ACTIONS === "true" && repositoryName && !repositoryName.endsWith(".github.io")
    ? `/${repositoryName}/`
    : "/";

const release=loadMetadata();
export default defineConfig({
  define: {__APP_RELEASE_METADATA__:JSON.stringify(release)},
  base: githubPagesBase,
  server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  plugins: [
    react(),
    {name:"release-artifacts",configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!==githubPagesBase+'version.json'){next();return;}res.setHeader('Content-Type','application/json;charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(release));});},generateBundle(){
      this.emitFile({type:"asset",fileName:"version.json",source:JSON.stringify(release,null,2)});
      this.emitFile({type:"asset",fileName:"package.json",source:JSON.stringify({name:"guozhan-game-mvp",private:true,version:release.version,commitSha:release.commitSha})});
      this.emitFile({type:"asset",fileName:"CHANGELOG.md",source:release.history.map(r=>`# v${r.version} — ${r.date}\n\n${r.notes.map(n=>"- "+n).join("\n")}`).join("\n\n")+"\n\n"+readFileSync("releases/legacy-changelog.md","utf8")});
    }},
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      includeAssets: ["icons/lieguo-crimson-lion.png"],
      manifest: {
        name: "列國征途：始源",
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
