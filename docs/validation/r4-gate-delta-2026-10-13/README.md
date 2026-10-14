# R4 Gate B1／M1 Delta evidence

受審父 HEAD：`608de8a77a8644b7a3a894685e27ced9d4507ca0`。此目錄只追加本次證據，原 `../r4-2026-10-13/` 不改寫。

`summary.json` 是本次精確結果；`regression-full.json` 保存 137 files／1150 PASS／0 FAIL／1 個既有私人晚期存檔 SKIP 的全部 assertions。`attempts/` 保存原 Astra 反例與本次修復前／測試設置中間失敗；negative probe PASS 代表看見缺陷，不能當修復通過。

`source-diff.patch` 僅包含六個 production 檔案。`scenarios/*.json` 是 controlled Formal 情境結果，不是公平長局。9 個 PNG 與 `browser.json` 為本輪 production headless Chromium 3 cases；Service Worker 在此專项阻擋，測的是真 worker／IndexedDB／reload，不聲稱本輪驗過已部署 SW 升級、browser Recovery 或人工 M3。

重跑：Node 22.13+、`npm ci`、`npm run typecheck`、`npm run build`，完整回歸必須用 `node scripts/verify-in-isolation.mjs full`，以免舊測試改寫 tracked docs。

專項與 synthetic browser fixture 生成（evidence 路徑必須在 repo 外）：

```sh
R4_DELTA_EVIDENCE=/tmp/r4-delta-fixtures node node_modules/vitest/vitest.mjs run src/game/formal/gateDeltaR4.test.ts src/game/formal/gateDeltaPersistenceR4.test.ts --maxWorkers=2 --testTimeout=30000
npm run build
npm run preview -- --host 127.0.0.1 --port 4176
```

另開程序執行 browser；Playwright 使用外部安裝，不改 package／lockfile，Chromium 路徑為 `/usr/bin/chromium`：

```sh
node scripts/verify-r4-gate-delta-browser.mjs /absolute/external/playwright/index.mjs /tmp/r4-delta-fixtures /tmp/r4-delta-browser-evidence
```

Exporter 在無 `R4_DELTA_EVIDENCE` 時直接返回；27 個新 PASS 中有 26 個行為測試與 1 個 exporter。恢復點測試用 fake-indexeddb，browser 用真 IndexedDB。原 M3、實體手機、硬體 GPU、六文明完整人工鏈、私人檔及長測仍見 `docs/recovery/R4_Gate_Delta_Manual_Pending.md`。

Manifest 列 bytes／SHA-256／Git blob，排除 manifest 自身，避免自我雜湊循環。PR 說明記錄發佈後精確 HEAD／tree；manifest 記錄已驗證 source blobs 與父 HEAD，不能用 HEAD 同時包住它本身。
