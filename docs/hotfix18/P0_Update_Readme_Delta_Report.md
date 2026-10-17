# Issue #18｜P0 更新可靠性＋README 自動展示 Delta Report

本輪僅施工應用程式更新安全及 README 發行展示。施工 PR 為 #19，基準 main `3d1760864f3b9d9a55108c80225764ef8e3099e1`。完整回歸檢查點為 `fdf442c4fb12fb780359c3f26f5257559e09ed1f`；之後最後追加「背景更新失敗時丟棄失效 waiting 記憶體參照」與一筆負向回歸，隨本報告提交。最終 HEAD、完整 CI 與最終建置 SHA 以 PR 正文交付紀錄為準。未合併、未部署、未關 Issue、未開始 P0-C；此報告不宣告正式獨立 Gate PASS。

## A：已驗證問題與修復

修復前針對原 main hook 的新增測試為 17 PASS／3 FAIL：失效註冊未重新取得可用參照、保存前失敗仍固定顯示「已保存」、durable save 失敗仍帶相同誤導文字。原始 Vitest before 結果保留於本目錄對應證據。

Chromium 154 原生解除 localhost 合成測試的註冊後，舊參照 `update()` 回傳 TypeError／Not found，而非玩家 Android 截圖的 InvalidStateError。兩者不能視為已證明完全同一根因；前者仍重現無本次 sync ACK 卻顯示「已保存」的錯誤。歷史 v0.30.52 fixture 的 `update()` 函式與正式 main 的 v0.30.52／0.30.53 相同，完整 hook 的 check() 屬歷史候選版本，來源差異與雜湊另列 provenance。InvalidStateError 則以明確的 DOMException 負向測試覆蓋。

修復採以下有限次流程：

1. 保留受控 metadata 及 contentSha 判定，先檢查既有正式範圍與 `sw.js` 的活 Worker；有安裝中的新版時等待其完成，不提前啟用舊 waiting Worker。
2. 舊參照失敗後只查詢一次目前 BASE_URL 的註冊；最多兩次 update 呼叫。InvalidStateError 可重試合法註冊，其他原生錯誤只有查詢證明註冊已替換／移除才恢復；同一有效註冊的一般網路錯誤不重試。
3. 背景檢查不重新註冊。明確的更新操作確實需要重新註冊時，先等待原有 engine.sync() 的 request-correlated durable save acknowledgement，再註冊唯一合法 script／scope。首次重新註冊可能立即啟用，因此這個保存時點必須提前。
4. 重新註冊可能保留原控制器，不能把它誤認成新 Worker。等待新 waiting Worker，或新控制器真正接手。Workbox 保留 prompt／手動 SKIP_WAITING，僅加入 clientsClaim，讓保存後重新註冊的新 Worker 可接手舊頁面；沒有自動 skipWaiting。
5. 一次操作最多一次保存，重複點擊與背景／前景事件不能重複啟用；保存失敗則連重新註冊也禁止。沒有開啟戰役時明確回傳 no-campaign，不能宣稱已進行本次保存。
6. 背景刷新已失敗時丟棄舊 registration 記憶體參照，避免下一次操作仍啟用孤立 waiting Worker；不解除或刪除實際註冊。
7. 準備失敗、未取得保存確認、已保存但啟用失敗／逾時、重載後仍非預期版本，分別提供繁體中文提示。原生錯誤不直接顯示在手機頁面，慢速背景檢查不能覆蓋操作中的保存狀態。

沒有 unregister、刪除 IndexedDB／回復點、清除網站資料、全站 Cache Storage 或 localStorage.clear 的應用程式修復碼。測試腳本中的 unregister 只用於隔離 localhost 合成瀏覽器情境，以原生 API 製造失效參照；不進入玩家建置。

## B：README 長期同步

沿用唯一 Release Metadata，建置產生 `release/latest.svg` 與 `release/index.html`。固定 README 圖片連結在未來成功 Pages 部署後自動取用新產物，不逐版修改 README，不自動回寫 main、不提高 contents:read、不新增 Secrets／人工核准或循環。

圖片顯示版本、更新日期、更新重點與部署 Commit；文字頁提供完整 SHA、內容 SHA、近期／歷史紀錄及 JSON／CHANGELOG 退路。資料已轉義，沒有前端 GitHub API、script 或 foreignObject。CI 與 Pages 使用分開的官方 main badge，最新部署失敗時仍呈現上次成功部署的版本圖片。圖片代理可能快取，刷新時間無法保證，文字頁／JSON 可核對 SHA。建置產物沒有把 CI 成功宣告為已發布或 Gate PASS。

README 將 1,115 舊統計明列為 2026-10-13 歷史結果；說明 PR #3／#17／#9 已合併、B5 E1 OWNER WAIVED，保留舊 HOLD。五筆排程、80 任務及 Issue #14 P0-C-5／7／8／9／10 明列待施工。

README 產物排除遊戲 precache／navigation fallback，避免文件頁被攔截為遊戲首頁。遊戲原有嵌入式離線日誌保留。架構與平台限制詳見 docs/README_RELEASE_DISPLAY.md。

## 版本與提交歷史

根 package.json 仍為基準 0.30.50，沒有人工升版。保留 0.30.51（PR #3）、0.30.52（PR #17）及 0.30.53（PR #9）歷史；本 PR 待審建置由既有計數自動產生 0.30.54。曾在開發中出現的 0.30.55 dirty 預覽只屬未提交工作的分支計數，未發布、未寫入正式版本歷史。

`0a0d6e9` 初始施工檢查點保留；`fdf442c` 以最新 main 為第一 parent、初始檢查點為第二 parent，讓整個功能 PR 維持單一正式升版，同時保留完整歷史與 fast-forward 更新。沒有 hard reset、amend、force push 或 main 寫入。最後修正同樣以 main 為第一 parent、既有分支 HEAD 為第二 parent，維持一次升版並保全先前提交。這次最終提交包含 Runtime hook 的最後一行修正，因此 contentSha 是該功能提交；未來純文件提交才只改部署 commitSha、保留版號及內容識別。

## 核心保全

相對基準 main，src/game/formal 全目錄、persistence.ts、useGame.ts、runtime.worker.ts、release.ts／releaseTypes.ts、release-metadata.mjs、兩個 workflow、package.json／lock 均逐位元保留。Formal Save Schema、Content／Ruleset／Generator／Terrain versions、CAS、Recovery、Command Receipt、Scheduler 與遊戲規則不變。GameApp 只標明未開啟戰役沒有本次保存。Save/Load 與舊 appVersion 相容以測試及原生 IDB 證據核對。

## 驗證結果

- 原 main 新增負向測試：17 PASS／3 FAIL；最後 waiting 參照負向：0 PASS／1 FAIL（只選該測試）。兩份 before 均保留。
- 最後修正後更新／發行定向測試：44 PASS／0 FAIL。
- fdf442c 檢查點本地完整隔離 Regression：1,358 PASS／0 FAIL／1 既有條件 SKIP，150 檔；同一檢查點 Push／PR CI 也皆 1,358 PASS。最後一筆待命參照修復後的最終完整 CI 統計，由 PR 正文與最新 HEAD 的 CI 連結補登；不把舊統計當成最新提交結果。
- 原生 Chromium 154：兩份舊 appVersion（0.30.50／0.30.52）各 5 組更新／README 情境通過；C1／C3 桌面與手機共 8 組 Worker／IndexedDB／Recovery 情境通過，99 agents 保留。控制測試將 AI 決策延後 30 天，只用於隔離證明，未修改產品 AI 活躍度。
- Typecheck、Production Build、Pages 子路徑與 Release Metadata／SVG／HTML 一致性：通過。最終 Commit 產物會再重建並於 PR 本文列出 SHA、版本與 contentSha；歷史標籤合成測試與實際 0.30.54 產物分開。
- docs-only 不升版、相同 Commit 重跑、same-content 不提示、同號不同內容提示、離線 waiting、durable save 失敗、啟用失敗／逾時、重複點擊、前景／背景事件、舊 appVersion 匯入與回復點保留均有定向或原生證據。
- CI 檢查點：[Push](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/38988420640)／[PR](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/38988423542)。最終提交 CI 請見 PR 正文最終交付區。

## 保留的失敗與限制

- 第一輪本地隔離完整回歸：1,349 PASS／3 FAIL／1 SKIP；3 FAIL 分別是 C1 10X、C1 50X（原有 30 秒）與 v85 wall 長測（原有專項 60 秒）逾時。當時與額外核心定向測試及多輪建置同時競爭 CPU。另一次定向 C1 1X／10X 曾在 30 秒逾時。保留原始結果，沒有放寬 timeout、刪除測試或豁免這些項目；降低額外負載後重驗。
- 初期 git fixture 測試因本地 sandbox child-process EPERM 失敗，使用正常授權的執行環境重跑後通過；沒有改測試繞過功能判斷。
- 保留原生測試歷次失敗：首版 fixture 含舊版不支援的 reports 外層、錯把原生 Not found 當 InvalidStateError 的訊息斷言、等待 initial controller 而非 ready 後重載的測試前置，以及以 saves[0] 誤取 authority row 的探針錯誤，均修正測試前置／定位，不放寬 timeout。
- 測試前置另曾遇到 happy-dom hidden 屬性唯讀、Playwright page route 無法攔截瀏覽器層級的 SW 註冊，以及 TypeScript 閉包 phase narrowing；分別修正前置、改用 localhost 真實 404、明確標示實際失敗階段。原始失敗未刪除。
- 原生測試也發現實際恢復缺陷：重新註冊直接啟用、舊 controller 被誤認為新版、舊 waiting 擋住真正下載。應用程式按證據修正並補負向測試。曾重載仍舊版時，新增提示確實指出未取得預期新版，沒有假報更新成功。
- v0.30.52 → v0.30.53 的 patched 歷史測試使用合成 metadata 與本輪修復碼，不能冒充已部署歷史 bundle 或 Android 實機完成驗收。已經載入的舊 JavaScript 不會被 PR 自動改寫；需在玩家核准正式發布後，以備份進度及一般重新載入取得修復。禁止清除站台資料作為解法。
- 環境未提供 adb、USB Android 裝置或遠端 Android 連線，實體 Android Chrome 的原始 InvalidStateError 根因與修復仍待玩家實機複核。本輪是 Chromium 原生 SW／Worker／IndexedDB 與手機 viewport 的證據。
- 未部署本 PR，因此正式 GitHub README 的新圖片 URL／Camo 刷新只能在玩家核准合併及成功部署後驗證；不以本地或 CI 產物冒稱目前已上線。

完成後 STOP，等待 GPT-6 中控審查；Astra 獨立 Gate 由中控另行安排。
