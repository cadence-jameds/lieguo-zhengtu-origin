import {serviceWorkerReleaseSource} from './src/game/serviceWorkerRelease';
import {createHash} from "node:crypto";
import {readdirSync} from "node:fs";
import {readFileSync} from "node:fs";
import { fileURLToPath, URL } from "node:url";
import {loadMetadata} from "./scripts/release-metadata.mjs";
import {readmeReleaseAssets} from "./scripts/readme-release.mjs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const githubPagesBase =
  process.env.GITHUB_ACTIONS === "true" && repositoryName && !repositoryName.endsWith(".github.io")
    ? `/${repositoryName}/`
    : "/";

// Per-file keys survive docs/code-only updates. No save or release identity changes.
const artRevisions:Record<string,string>={},legacyArt:Record<string,{revision:string;legacy:string}>={};
for(const entry of readdirSync('public/art',{recursive:true,withFileTypes:true}))if(entry.isFile()){
 const file=entry.parentPath+'/'+entry.name;
 const path=file.slice('public/'.length),data=readFileSync(file);
 artRevisions[path]=createHash('sha256').update(data).digest('hex').slice(0,20);
 if(/\.(webp|png|svg)$/.test(path))legacyArt[path]={revision:artRevisions[path],legacy:createHash('md5').update(data).digest('hex')};
}
// Adopt unchanged legacy Workbox art before activation removes obsolete precache entries.
// Only artwork CacheStorage is touched; this optional migration cannot veto an update.
const workerArtFile=`sw-art-${createHash('sha256').update(JSON.stringify(legacyArt)).digest('hex').slice(0,20)}.js`;
const workerArtSource=`self.addEventListener('install',event=>event.waitUntil((async()=>{try{const revisions=${JSON.stringify(legacyArt)},target=await caches.open('lieguo-art-content-v1');for(const name of await caches.keys()){if(!name.startsWith('workbox-precache-'))continue;const old=await caches.open(name);for(const key of await old.keys()){const u=new URL(key.url),path=u.pathname.slice(${JSON.stringify(githubPagesBase)}.length),entry=revisions[path];if(!entry||u.searchParams.get('__WB_REVISION__')!==entry.legacy)continue;u.search='?art='+entry.revision;if(await target.match(u.href))continue;try{const response=await old.match(key);if(response?.ok)await target.put(u.href,response);}catch{}}}}catch{}})()));`;
const release=loadMetadata();
// A unique import URL binds the reply to this worker's build across docs-only deployments.
const workerReleaseFile=`sw-release-${release.commitSha}.js`;
const workerReleaseSource=serviceWorkerReleaseSource({version:release.version,contentSha:release.contentSha});
export default defineConfig({
  define: {__APP_RELEASE_METADATA__:JSON.stringify(release),__ART_REVISIONS__:JSON.stringify(artRevisions)},
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
      const readme=readmeReleaseAssets(release);
      this.emitFile({type:"asset",fileName:workerReleaseFile,source:workerReleaseSource});
      this.emitFile({type:"asset",fileName:workerArtFile,source:workerArtSource});
      this.emitFile({type:"asset",fileName:"release/latest.svg",source:readme.svg});
      this.emitFile({type:"asset",fileName:"release/index.html",source:readme.html});
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
        // The release import owns extendable activation/message lifetimes.
        // Workbox's fire-and-forget clientsClaim must not race that handler.
        clientsClaim: false,
        importScripts: [workerReleaseFile,workerArtFile],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,woff2,webp,png}"],
        // Gameplay art is prepared incrementally by the homepage; never eagerly precache it.
        globIgnores: ["art/**","**/town-wall-*.png","release/**"],
        runtimeCaching: [{urlPattern: /\/art\/.*[?&]art=[a-f0-9]+$/,handler:'CacheFirst',options:{cacheName:'lieguo-art-content-v1',cacheableResponse:{statuses:[200]},expiration:{maxEntries:800,purgeOnQuotaError:false}}}],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/\/release(?:\/|$)/],
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
