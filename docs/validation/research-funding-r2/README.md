# PR #39 第二輪｜現代科研可建立籌資與三城直接投入

本輪起點：`4365b6ea5be60ffd50d4ac9ca73b621a56077b0e`；PR Base main：`b8130b7bb4bd6c78f3b6510d733a149013f78d95`。沿用 `ui/research-tech-tree` 與 Draft PR #39，沒有重做科技樹或另開 PR。最終 HEAD 見 PR 正文與 Checks。

## 這一輪完成的補修

現代共通與本文明專屬現代科技，只要正式資格符合且唯一科研佇列空閒，即使發起城市不能獨力付清，也呈現暗圖金框與「可建立籌資」，詳情允許「建立科研籌資」。單城資源足夠時也是相同操作；籌資中、研究中維持金框，只有正式完成後亮圖。狀態仍使用原有 locked／available／done 與 project 的暫時標記，沒有增加永久科技狀態。

傳統科技與科研協同體系仍須單城付清才可啟動。這次只修改 UI 的 eligibility 呈現與文字，`research.start`／`research.contribute`、成本、效果、工期快照、完成事件、唯一佇列、ACK／CAS、存檔與 Recovery 核心都沒有修改。未新增物流、商隊需求或運輸費用。

玩家本輪決議取代第一輪「現代科技單城不足仍普通暗框」的顯示選擇。第一輪 [報告及證據](../research-tech-tree/README.md) 完整保留；更新前的 [PR 正文快照](pr-39-before-r2.md) 也保留，包含當時的失敗、重查與 CI 紀錄。沒有把不同輪次拼成一次全套 PASS。

## 正式引擎整合測試與扣款證據

合成世界含玩家三城 A／B／C；A 有 Academy15 與 Barracks15，已取得完整現代資格及科研協同體系。B、C 沒有市場或額外科研建築。目標科技取正式目錄「現代步兵武裝」，四資源總需求如下；任何單城都不足以獨力付款。

| 階段／來源 | 糧 | 木 | 石 | 金 | 狀態 |
|---|---:|---:|---:|---:|---|
| 正式總需求 | 180,000 | 160,000 | 140,000 | 420,000 | — |
| A 初始庫存／投入 | 90,000 | 80,000 | 70,000 | 210,000 | 投入後 50%，funding |
| B 初始庫存／投入 | 45,000 | 40,000 | 35,000 | 105,000 | 累計 75%，funding |
| C 初始庫存／投入 | 45,000 | 40,000 | 35,000 | 105,000 | 累計 100%，researching |

建立 funding 不扣整筆成本、不設 startedAt、不建立完成事件。每一城投入時只扣其庫存，其餘兩城不再次扣款；相同指令重送為 duplicate。A、B、C 各投入一次後，三城測試時點庫存均為四資源 0，帳本剛好達標，沒有物流或商隊事件。

只有 C 補足最後需求才建立一個 `research.complete`，事件期限恰為 `startedAt + durationSnapshot.durationMs`。本 fixture 的正式工期為 11,376,000 世界毫秒，1X 為 **3 時 9 分 36 秒（現實時間）**。工期取原正式快照，沒有因 B／C 的建築或切城重算。

測試依正式排程完成後，科技只加入一次、佇列釋放、完成事件重放不重複產生效果；實際 `combatStats('modern.militia')` 攻擊變為原值 ×1.08。新指令不能再次研究同科技。各個 50%／75%／剛開始研究／完成階段都驗證 encode/decode、真 IndexedDB Save/Load、完整備份與損壞 current 後 Recovery；研究中進行離線補算與在線排程得到一致成果、庫存及收據。

[引擎逐階段庫存、投入帳本、事件與收據](engine-ledger.json)。非法案例涵蓋他國城市、不同勢力、超庫存、超剩餘需求、負數、小數、NaN、Infinity、超安全整數、佇列占用與重複投入。格式非法資料依原契約在 submit 入口拋出「命令格式無效」，其餘合法格式但不合法的操作回 rejected ACK；兩者均驗證世界與庫存不變，沒有改動核心拒絕機制。

## 本輪測試結果

| 驗證 | 本輪結果／證據 |
|---|---|
| npm ci、Typecheck | 通過 |
| 新舊科研定向測試 7 檔 | **133 通過、0 失敗、0 略過**；[逐項結果](targeted.json) |
| 新正式引擎三城整合測試 | 11/11，已包含於上述 133；沒有重複加總 |
| 新視覺資格案例 | 現代共通／文明專屬的足額／不足、無資格、前置、佇列；傳統與協同體系維持單城付款 |
| 原生 Production 瀏覽器 | **5/5，0 pageerror**；[完整庫存與畫面紀錄](browser.json) |
| Production Build | 根目錄及 Pages 均通過；PWA base／scope／SW fallback、release artifacts／Worker identity 通過；[建置資料](build.json) |
| 本輪完整隔離 Regression | **2,027 通過、1 失敗、1 略過，非 PASS**；唯一失敗為原有 runtime 開發速度／AI catch-up 測試達 30s 時限。[本輪完整回歸摘要](regression-full.json) |
| 最終 HEAD GitHub CI | 見 PR Checks 及 [本分支 CI 執行紀錄](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions?query=branch%3Aui%2Fresearch-tech-tree)；最終執行 ID 與結果交付於聊天 |

全部產品 source 在完整回歸前已凍結；[source SHA256](source-manifest.json) 供核對，完整回歸開始後只整理報告與證據。沒有以修改正式時限、刪除或放寬既有斷言換取通過。原生瀏覽器會以官方 `settleCity()` 將扣款前城市結算至命令時間，再逐項核對真正扣款，因此不將正常生產增量誤認成扣款錯誤。

本輪完整回歸的 1 項失敗來自未修改的 `runtime.test.ts`（`developer speed changes bridge due AI catch-up only with unchanged intent, retain durable rollback and reject concurrent settings`），是原定 30 秒時限到期，沒有新科研案例失敗。該檔在同一隔離副本原樣單 worker 重查，**64 通過、0 失敗、0 略過**，結果另存 [runtime-recheck.json](runtime-recheck.json)；不將重查結果拼成一次全套 PASS。1 項 skip 為既有 `batch210` 私人存檔案例，未提供 `REALM_REGRESSION_SAVE`。最終 HEAD 的獨立全套 CI 另列於 PR Checks。

## 原生桌機與手機實際操作

每個 viewport 都操作真實遊戲 Worker／IndexedDB：點擊現代科技節點，從詳情建立 funding，填四項資源，切 A→B→C 投入，再驗證唯一研究事件與逐秒現實倒數。切城前後的已投入、總需求與剩餘需求逐項核對一致。手機同時檢查詳情面板與投入按鈕都在底部導覽列上方；籌資無倒數，研究頁沒有進度條。

| 可建立籌資金框 | 截圖 |
|---|---|
| 桌機 1600×1000 | [節點](1600x1000-available.jpg) · [詳情可建立](1600x1000-create-detail.jpg) |
| 手機 320×568 | [節點](320x568-available.jpg) |
| 手機 360×640 | [節點](360x640-available.jpg) |
| 手機 390×844 | [節點](390x844-available.jpg) · [底部詳情](390x844-create-detail.jpg) |
| 手機 430×932 | [節點](430x932-available.jpg) |

| 實際扣款階段 | 桌機 | 手機 |
|---|---|---|
| A 城 | [投入前](1600x1000-city-A-before.jpg) · [投入後](1600x1000-city-A-after.jpg) | [投入前](390x844-city-A-before.jpg) · [投入後](390x844-city-A-after.jpg) |
| B 城 | [投入前](1600x1000-city-B-before.jpg) · [投入後](1600x1000-city-B-after.jpg) | [投入前](390x844-city-B-before.jpg) · [投入後](390x844-city-B-after.jpg) |
| C 城 | [投入前](1600x1000-city-C-before.jpg) · [投入後](1600x1000-city-C-after.jpg) | [投入前](390x844-city-C-before.jpg) · [投入後](390x844-city-C-after.jpg) |
| 全額到齊，開始現實倒數 | [桌機](1600x1000-researching.jpg) | [手機](390x844-researching.jpg) |

## 修改檔案、限制及重現

產品 UI 僅修改 `researchTree.ts` 與 `ResearchView.tsx`；兩個既有研究 UI 測試檔隨新決議更新。新增 `modernFundingIntegration.test.ts` 與純測試 fixture `modernFundingTestSupport.ts`，以及 `prepare-modern-funding-fixture.mjs`、`verify-modern-funding-browser.mjs`。PR 原有未合併 release note 補上一項可建立籌資提示；沒有新增第二份 release note、調整 package 版號或改寫歷史記錄。

沒有發現需要修改正式引擎的缺陷。Chromium 觸控／viewport 模擬不能代替實體手機與瀏海安全區驗收；保留原有 B5 E1 HOLD、Astra Gate 非 PASS 與實機待驗事實。PR #39 保持 Draft，未合併 main、未部署 Pages、未關閉 Issue，未開始 B10／B11。完成後停止，等待 GPT-6 中控最終審查與玩家放行。

重現：`npm ci` → `npm run typecheck` → `RESEARCH_FUNDING_EVIDENCE=<ignored-dir> node node_modules/vitest/vitest.mjs run src/game/formal/modernFundingIntegration.test.ts src/game/formal/modernResearchB94.test.ts src/game/formal/developmentB4.test.ts src/game/formal/runtimeB4.test.ts src/game/presentation/researchTree.test.ts src/game/presentation/ResearchView.test.tsx src/game/presentation/modernCatchupB94.test.tsx --testTimeout=30000 --maxWorkers=1`。完整回歸仍用 `node scripts/verify-in-isolation.mjs full`。Production／Pages 建置沿既有腳本；以 `node scripts/prepare-modern-funding-fixture.mjs <tmp-dir>` 產生 fixture，再以 `RESEARCH_BROWSER_URL=<local-Pages-preview>/ node scripts/verify-modern-funding-browser.mjs <playwright/index.mjs> <tmp-dir> <ignored-dir>` 重跑 5 個原生案例。不要提交合成 save、dist、node_modules 或 raw trace。
