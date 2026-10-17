# PR #19 — R19-01／R19-02 Delta（HOLD）

本輪僅處理候選 Service Worker 資格、驗證證據與 README 靜態待辦；Android 更新安全恢復、README 動態展示、PR #17 版號／可玩內容識別與既有保存契約均保留。沒有 Merge、Deploy、修改 Formal／P0-C Runtime 或提高權限。B5 E1 OWNER WAIVED 與歷史 HOLD／FAIL 原樣保留；CI 成功不代表獨立 Gate PASS。

## R19-01 重現及修正

原受審程式 `4118ee3fad5b53cd13d2613088b99a2f8b724a7f`：C0 為合成標籤 v0.30.53；D 為部署 SHA 改變、可玩 contentSha 不變的 docs-only 建置。先確認 D 原生 waiting，才發布同版號但 contentSha 為 `eeee…` 的 C1。以 localhost HTTP 伺服器讓瀏覽器本身的 `/sw.js` 更新遇到 503、延遲五秒、延遲 150ms 競爭；沒有偽造 ServiceWorkerRegistration.update() 回傳或用 Playwright route 模擬 SW 網路。

三例均重現：ACK → SKIP_WAITING → controllerchange → navigation，實際載入 D 的部署 `dddd…`，而 URL 要求 C1，頁面顯示仍未取得預期新版。這是產品 FAIL；公開 before JSON 中 PASS 僅表示「負向故障成功重現」，沒有將故障改寫為成功。初版探針的兩次 HTTP 503 案例未等前一個 check 完成而超時；補入原生 update 完成屏障後，三例穩定重現，原始失敗檔保留於私有工作區。

最小修正：

- 每個 Workbox SW 匯入建置時產生、以部署 SHA 命名的識別腳本；僅回覆自己的 version／contentSha，不讀線上 API、不碰遊戲資料、不自行啟用。
- 點擊流程對實際候選 Worker 使用獨立 MessageChannel，最多三秒核對；仍使用原 `releaseUpdate()` 判斷可玩更新，並匹配當次已知目標的 version／contentSha。D、未知回覆、畸形資料或錯誤內容均停止在準備階段，提供繁體中文安全重試說明。
- 真 C1 已下載時可離線核對並啟用；保存 ACK 仍是 SKIP_WAITING／重新註冊之前的屏障。保存期間 waiting Worker 被替換時保留已保存結果、停止啟用，不換用未核對的 Worker。
- 註冊已移除時維持上一輪的「先保存再 register」；新註冊可直接 activate，因此此處的 ACK 在 register 之前。正常 waiting 分支則在核對成功後保存。沒有執行本次保存的失敗不能顯示「本次保存已確認」。

修復後三種 HTTP 邊界均須確認：未送 SKIP_WAITING、未發生 controllerchange／navigation、未執行本次保存、IndexedDB 原樣保留。完整結果見同目錄驗證摘要。

## R19-02 稽核方式

[原受審 HEAD 的 18 組公開摘要](../validation/r19-delta-2026-10-17/chromium-18-previous.json) 補齊上一輪缺口；它明確對應 4118ee3，不能當成新 Delta 的驗證。新 Delta 的 18 組另存 `chromium-18-current.json`，逐組保留情境、PASS／FAIL、合成存檔 appVersion、實際程式提交、Metadata 與事件順序。

歷史 before 案例使用當時 PR #17 的 v0.30.52 preview（Metadata commit 6405f7e，dirty=true）；其 update() 與實際 52／53 對應主線逐位元一致，但整個 hook 的 check() 不同，故不把 before bundle 冒稱最終 HEAD。其餘修復後案例才使用本輪程式。

18 組＝兩種合成舊存檔 appVersion（0.30.50／0.30.52）各五組原生 PWA／IndexedDB 操作，加八組桌面／手機正式 Dedicated Worker／IndexedDB／Recovery 回歸。後八組刻意停用 Service Worker 以隔離核心回歸，故應用更新順序明列不適用；不能聲稱它們有觀察到更新 ACK／controllerchange。核心情境保留 99 AI，僅合成 fixture 延後 AI 決策以隔離目的事件，產品 AI 規則完全未改。

公開資料僅白名單輸出狀態、事件名稱、版本與雜湊，不包含存檔內容、requestId、瀏覽器儲存、圖片、憑證或原始 trace。保留原始證據 SHA-256 供中控在有權存取工作區時比對。

上一輪原先兩組 FAIL（原 `browser-fifth-final-result` 的 3 PASS／2 FAIL）分別是：

1. **無效註冊恢復後仍載入舊版**：原流程過早接受舊 controller。既有修復先取得 durable save ACK 才重新註冊，排除 priorController，等新 Worker 安裝／取得控制，再導頁；`clientsClaim` 只在保存後重新註冊的安全流程發揮作用。該修復保留，本輪再核對候選內容。
2. **無法恢復案例的探針資料讀取失敗**：IndexedDB `saves` 第一列可能是 authority，探針改以 `id === 'current'` 讀取正式存檔，並使用真 HTTP 404 代替無法攔截原生 SW 註冊的 Playwright route。這是探針修正，不冒稱遊戲存檔契約缺陷；最終驗證確實檢查已保存、沒有切換、戰役及回復點保留。

舊 FAIL／HOLD／timeout 證據沒有刪除，沒有提高 timeout 或排除測試。Android 實體裝置尚未驗證：Linux Chromium 154 的原生無效註冊錯誤為 TypeError／Not found，Android 原報 InvalidStateError 另有 hook 定向測試，不能宣稱實機完全覆蓋。

## 發行與 README

README 待施工清單明列 P0-C-11／12／13，僅文件變更；原線上 SVG、可讀 HTML、CI／Pages 狀態連結與同源 Release Metadata 架構保留。沒有新增第二份 notes、手改 package 版號、修改 main 或部署。

本輪程式整合提交以 main 作第一 parent、原 PR HEAD 作第二 parent，完整保留 PR 歷史且為 fast-forward；既有自動發行機制仍只對這個 PR 產生一次 v0.30.54 候選。後續證據提交只更新 docs，部署 commitSha 可變、contentSha／版本／日期／notes 不變。正式版本仍以中控審查後的 main 部署為準。

## 執行與公開重現入口

- `npm ci`（初次預設 cache 位於不可寫位置而失敗；使用 workspace cache 成功，未更改 lockfile／依賴）。
- `npx vitest run src/game/useAppUpdate.test.tsx src/game/releaseMetadata.test.ts`。
- `node scripts/verify-in-isolation.mjs full`（在完整來源的可丟棄副本；稀疏工作樹未實體化的歷史 PNG 僅作記錄，不排除任何 source／test）。
- `npm run typecheck`、以 project Pages 環境 `npm run build`，再 `node scripts/check-pages-build.mjs`／`node scripts/check-release-build.mjs`；後者同時執行建置產物的 Worker 識別回覆並核對 Metadata。
- 原五組 PWA 探針：`scripts/verify-update-hotfix-browser.mjs <playwright module> <prepared fixture root> <synthetic save>`，分別使用 .50／.52 appVersion。
- 新負向探針：先用 `scripts/serve-update-boundary-fixtures.py <prepared fixture root>` 啟動 localhost，再跑 `scripts/verify-update-worker-boundary-browser.mjs`（同三參數）；`R19_EXPECT_BUG=1` 僅供舊程式重現。準備 root 的 patched-53、docs-53、content-53 使用相同受測程式，分別套用 C0 Metadata、只改 commitSha 的 D、contentSha 改為 e×40／commitSha 為 f×40 的 C1；每個目錄都是乾淨 build，`web/lieguo-zhengtu-origin` 為切換 symlink。不要使用真存檔或日常瀏覽器 profile。

最終執行統計、來源保全、HEAD、CI 與差異清單另列本輪 `verification.json`，PR 本文補上最終 docs HEAD 對應結果。完成後維持 HOLD，等待中控複審。

## 已完成的程式 checkpoint 驗證

程式提交 `3a318398329cfcaa295f8c74970f5cbc24eb6fbb`：定向 52 PASS／0 FAIL（新增八例）；Chromium 18 PASS／0 FAIL／0 unexpected errors；新 R19-01 三例修復前均重現產品 FAIL、修復後均安全阻擋。Typecheck、Production Build、Pages project path、Release Metadata 及 Worker 自身識別一致性通過。

- [直接 branch SHA 的 Push CI](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/38996622427)：1,367 PASS／0 FAIL／1 SKIP。
- [PR CI](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/38996625293)：同樣 1,367 PASS／0 FAIL／1 SKIP；其 Metadata SHA 為 GitHub 虛擬合併 `979a235e627f17518792908478eb372cb8084d8c`，這不是正式部署。兩者候選版本均為 0.30.54。

後續僅證據／探針提交不變更應用程式內容。最終 HEAD 的實際重跑、CI 及每組摘要會交付到 PR Conversation，避免把早期 checkpoint 的結果冒稱在未執行的最後 SHA 上跑過。

本機完整隔離 Regression 也已完成：150 檔、1,367 PASS／0 FAIL／1 SKIP，未改 runner／timeout／測試範圍。另補「先阻擋 D，再等真正 C1 下載後離線重試」；最後觀察到 `release-query → durable-sync-ack → SKIP_WAITING → controllerchange → beforeunload`，實際載入 C1。

該追加探針曾出現未導頁 FAIL：使用 async truthiness polling／Worker 參照變動當作下載完成，實際候選回覆仍是 C0，因此產品正確阻擋。探針修為同步 registration handle 確認 D waiting、以有界 evaluate 迴圈明確 await C1 的自身回覆後才離線重試。沒有改動 runtime 或提高既有 20 秒探針 timeout；公開 `additional-probe-failures.json` 保留此過程，不能把它冒稱產品曾錯誤啟用。
