# Issue #16｜版本與更新資訊自動化交接

本輪建立獨立功能 PR，交 GPT-6 中控審查；未 Merge、未部署、未改 main／PR #9，未開始 P0-C。

## 起點與資料核對

最新 main 為 `6405f7e155b5747c93a063799912b66f1362b9c7`，PR #3 已合併，main CI `38841451869` 與 Pages `38841451942` 均成功。當時 package/public version 仍是 0.30.50，release.ts 人工陣列截前十項，CHANGELOG 頂部 0.30.27，README 仍稱 main 不部署。這些問題已確認，不是部署工作流程失效。

已核對合併 source、既有專項與 [中控最終覆核／Sol Independent Gate 記錄](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/3#issuecomment-6206741736)，只回補 C1、C3、免費工匠城堡 Lv1、水域新舊任務界線及失城非戰鬥／失權工程清算。沒有將 P0-C 的偵察、全域預警、AI 打野或斥候流亡修復寫成完工。

## 架構及唯一規則

選擇建置時產生，避免 Actions 寫受保護 main、額外版本 PR、Token Push 觸發鏈或部署循環。原 contents:read、Pages／OIDC 權限與環境不增加，不新增 Secrets／人工發布核准。

固定 `releases/config.json` 的 0.30.50／PR #3 前 main 為歷史 marker，只沿目標 HEAD 的 first-parent 檢查可玩內容變更。每個功能整合單元末段 +1；docs／spec／review／evidence／tests／測試 helper／測試依賴不加版。日期取 Git Commit 記錄日期，不用現在時間、隨機值、run ID 或不穩定排序；同 SHA、同輸入可重現。部署 SHA 和最後功能 SHA 分開記錄，純文件提交不加版，但仍可識別部署來源。

PR #3 對應 `6405f7e…` 回補 0.30.51／五項已完成變更；本次版本同步也是玩家可見功能，待審建置為 0.30.52。0.30.51 是回補合併紀錄，不宣稱網站曾另行發布該版；本輪沒有改動目前線上版本。

每個功能 PR 提交一份新 `releases/notes/<slug>.json`，並將相同繁中 JSON 放入 PR template 受控欄位。PR CI 由原生 event 檔比對內容，包含 edited 事件，不需 GitHub API 額外權限。檢查中文／格式／1～10 完成事項、禁止計畫／Gate／原始 commit 文案；main 若缺摘要即停止。已合併摘要不可改寫。一般 merge／squash 對應一個整合單元；不支援把未各自附摘要的多筆功能 Commit 逐一 rebase 到 main，避免不受控升版或猜測日誌。

## 原始碼與產物的角色

- package.json/lock 的 0.30.50 是固定歷史計數基準，不是目前部署版本，不必每 PR 人工修改。
- 移除容易失真的 tracked public/version.json；`.release/metadata.json` 是忽略的建置輸出。
- Vite 將同一 metadata 編入 UI／Worker，並產生 dist/version.json、發行 dist/package.json、dist/CHANGELOG.md。開發站也供應同一 version.json，no-store。
- 首頁／戰役設定共用 ReleaseLog，顯示版本、日期、短 SHA、最新摘要、近期版本及原始歷史。原人工清單完整保留為未分版紀錄，舊 CHANGELOG 原文也保留，不憑空分配舊版號。
- CI／Pages 共用產生器與一致性檢查，均 checkout 完整歷史。CI 保存 release metadata artifact；版本產生不等於部署成功。
- 更新偵測比對版號及有效部署 SHA；同版同 SHA 不誤報，不用瀏覽器 GitHub API。JSON 不列入 SW precache；離線使用已編入程式的日誌。
- 原安全流程不變：等待 SW 安裝完成，await durable save，再 SKIP_WAITING、等待 controllerchange，最後導航。離線但已有 waiting worker 時仍可使用已下載更新。

## 驗證

證據見 [本輪目錄](../validation/release-automation-2026-10-16/summary.json)，紀錄為未提交建置預覽；最終 immutable SHA 的 metadata 將由相同腳本在新 PR CI 產生，並在 PR 說明附實際 clean build 結果，不宣稱已部署。

- Typecheck、Production Build、Pages 子路徑／PWA scope、release 產物一致性：PASS。
- 最終完整隔離 Regression：**1300 PASS／0 FAIL／1 SKIP，147 files**，約 **428.77 秒**。原 conditional SKIP 保留，timeout 不變、無排除。最終全部 src bytes 與實際 full runner input 相同。
- 定向 **22 PASS／0 FAIL**，為 full 子集，不重複加總。涵蓋功能／docs 分類、下一功能升版、同 SHA 重建、受控欄位／缺資料／歷史不可改、未核准進位拒絕、同版不同 SHA／相同 SHA／離線、原 save-before-activation 測試及舊 appVersion 的 SaveLoad／Recovery。
- 三組真實 Chromium 154：桌面 1440×900、手機 390×844、同數字版號不同建置的真 SW 更新，均 PASS。UI 首頁／設定、日期／短 SHA、PR #3 歷史及斷網日誌一致；原生 Worker／IndexedDB 的舊 appVersion 0.30.50 存檔，更新後仍保留。真 SW trace 明確為 durable-sync-ack 先於 controllerchange，之後可離線重新載入。
- B 部署 SHA 使用明確合成的 40 個 f 測試，不宣稱該 SHA 是 GitHub 提交。主動斷網產生三個預期 ERR_INTERNET_DISCONNECTED 已標記，**未預期 browser errors=0**；不把預期錯誤刪成零。
- browser 測到的預覽 JS/CSS 與提交前 production build 6 個 JS/CSS 檔逐位元相同；提交後 clean HEAD 建置只更換來源 SHA／預覽標記，實際 metadata 另列 PR 說明與 CI artifact。
- 13 個 schema／compatibility／CAS／持久化／指令／scheduler／reducer／經濟／戰鬥／AI 關鍵檔與 main 逐位元相同。P0 compiler 僅調整 release 常數及版本產物讀取來源，另已成功編譯，不修改模擬或 profiling 方法；沒有新增長局效能聲明。

### 保留失敗

首輪完整 Regression **1299 PASS／1 FAIL／1 SKIP**，唯一舊測試仍要求顯示版號等於 source package 人工版號。改為檢查 package=歷史基準、Release 最新／歷史來源及既有 UI／存檔不變，另以 build artifact checker 驗證實際發行 package 一致。原固定十項人工清單斷言也改成新受控非空摘要契約，不為湊十項捏造功能。

首輪 browser **2 PASS／1 FAIL**：probe 錯誤期待首次 SW 安裝立即控制已開頁；原設定未 clientsClaim。改在沒有戰役的首頁完成首次正常導航，再匯入舊合成存檔驗證更新，不改產品的 SW 安裝／啟用保護，也不放寬 timeout。原 FAIL JSON 保留。所有原 log 以相同 bytes 的 .txt 保存，避免被 *.log ignore 漏存；manifest 只列實際已提交檔案。

## 中控待審與限制

1. 目前無法在規格找到 Issue #16 提及 V0.100／.10 原始進位授權，已向玩家詢問。本輪不自行發明 carry，超過末段 99 會明確停止；需玩家補規則後再延伸，不影響目前 0.30.51／52。
2. 使用 merge／squash 及完整 Git 歷史；rebase 多筆未附摘要的功能提交會被正式產生器拒絕。缺摘要亦阻止 Pages，不猜測已完成內容。
3. 未做實體手機／已上線站點更新或新的 99 AI 長局 Benchmark；手機為真 Chromium viewport，SW 使用本地合成部署。既有私人存檔、raw trace、node_modules／dist 不提交。
4. 待中控審查此 PR。沒有更動 PR #9、P0-C Runtime、Formal Schema/Content/Ruleset/Generator/Terrain 版本或持久化契約。

完成 PR 交付後 STOP，不自行合併或部署。
