# 科技研發正式 UI 重構｜待中控審查

基準：最新 main `b8130b7bb4bd6c78f3b6510d733a149013f78d95`。施工分支：`ui/research-tech-tree`。最終 HEAD 與 GitHub CI 連結列於 Draft PR 正文。本輪只交付待審變更，未合併 main、未部署 Pages、未關閉 Issue，未開始 B10／B11。

## 玩家行為與正式資料

桌機以封建、城堡、帝王三欄呈現傳統科技，依正式 ID／category 分組，連線只來自 `prerequisites`。可用原生捲動及鍵盤瀏覽。手機改用世代、時代與可獨立收合的分類，詳情使用底部 modal；預留 66px 導覽及安全區，320px 亦可捲動查看完整資格與操作。分類、世代與時代偏好只寫入本機 UI preference；城市切換不再重掛整個研究頁。

科技目錄仍為 66 項傳統、16 項現代（科研協同體系、9 項共通、6 項文明專屬），黑暗時代沒有傳統科技。每個文明只顯示自己的專屬科技。沒有編造科技、前置、平衡數值或圖示；圖示沿用 `techArt()`。

未研發維持暗圖與普通框；正式資格、資源與共用佇列均滿足才顯示暗圖金框。研究中使用正式 project 的暫時標記、暗圖金框與倒數；只有 `f.techIds` 確認後才亮圖並標記完成。研究頁不顯示進度條，包含既有 Shell 的研究進度條。

現代共通／專屬科技依原引擎允許先建立多城籌資，並不要求發起城市獨力負擔全部成本。單城資源不足時維持普通暗框，詳情明示「可先建立籌資」，仍可使用正式建立籌資指令；這保留原有多城操作。研究佇列已占用、未取得完整現代資格或協同體系前置時，不能另建專案。籌資保留四項投入、總額、目標與剩餘需求，且沒有假倒數。

詳情保留所有正式條件、本文明科技上限、人口里程碑、建築等級、資源與研究操作。正式目錄有 19 項效果文字為空：15 項鐵匠科技直接比較既有 `combatStats()` 前後結果，以可展開兵種清單顯示；4 項精銳科技直接列出 `UNIT_CATALOG` 的正式解鎖兵種。未增加第二份效果數值表。

## 時間與效能

倒數共用 `useDisplayTime()`／既有 DisplayClock，沒有另建 timer。以 `startedAt + durationSnapshot.durationMs` 作固定期限，除以 `effectiveSpeed(world)` 顯示現實時分秒；研究前預估則用 `researchQuote()`。切城及學院改變不重算既有研究工期。畫面歸零只顯示「完成確認中」，由正式事件確認後才更新完成。

| 尚餘一個世界小時 | 現實時間 |
|---|---|
| 1X | 1 時 0 分 0 秒 |
| 3X | 0 時 20 分 0 秒 |
| 6X | 0 時 10 分 0 秒 |
| 10X | 0 時 6 分 0 秒 |
| 50X | 0 時 1 分 12 秒 |

50X 測試使用原有 developer effective speed，普通世界 speed 仍遵循原本 schema 上限 25X；沒有放寬 schema 或更動引擎倍率。測試涵蓋秒更新、速度切換、暫停／恢復、恢復後的新 world anchor、正式完成與存檔讀回。

科技幾何只依目錄、文明及世代計算；SVG 使用 memo，倒數不重建連線。資格與 quote 分開 memo，不隨純倒數 tick 重算。資源負擔使用既有每秒本城投影，只複製本城，不複製完整 100 勢力世界。沒有新增 FormalWorld／存檔欄位。

## 驗證與證據

- 最終定向 UI／目錄測試：39 通過、0 失敗；包含新增 20 項測試。[逐項紀錄](targeted.json)
- 加跑正式研究、現代效果、持久化與 live interaction 的初輪擴展測試：179 通過、1 項既有 offline codec 案例達預設 5s 時限。[原始結果摘要](targeted-initial.json)
- 該既有 developmentB4 檔使用完整回歸相同 30s 時限重跑，60 通過、0 失敗；未改斷言。[重查](legacy-timeout-recheck.json)
- 本機完整隔離回歸：1,996 通過、4 失敗、12 略過，**不是 PASS**。[全部逐項紀錄](regression-full.json)。`runtime.test.ts` 有 3 個逾時及 1 個 catch-up 斷言失敗；`breakthroughB92.test.ts` 的 240s beforeAll 逾時使 11 項未執行，另 1 項是既有缺玩家私人存檔的 skip。兩個受影響檔案均沒有修改，已安排無建置／瀏覽器競爭的隔離單 worker 重查，結果與最終 HEAD GitHub CI 連結記於 PR 正文；不把重查合併冒稱一次全套綠燈。
- Typecheck、根目錄 Production Build、Pages Build、Pages 路徑／manifest scope／SW fallback、release artifact／Worker identity 均通過。[建置資料](build.json)
- 原生 Chromium 最終 Pages 路徑矩陣與真實 SW 離線結果：[瀏覽器報告](browser.json)。使用真 Worker、IndexedDB 與合成存檔，沒有讀取玩家私人戰役。

第一輪手機測出面板與 66px 底欄相差 2px；修正底部間距後重跑完整尺寸矩陣。沒有放寬「面板不得覆蓋導覽」斷言。另縮短手機頁首並將大量鐵匠兵種預覽預設收合，讓正式資格與成本更容易閱讀。

本機完整回歸副本建立於 UI 收尾前；其後只修正手機 2px 間距／配色、收合兵種預覽，並補強完成存檔讀回斷言。最終 source 已重新 Typecheck、Build、39 項定向測試及 Pages 路徑 11 情境驗證；最終 HEAD 的完整回歸以 GitHub CI 為準，不混用來源快照。

## 截圖

| 情境 | 證據 |
|---|---|
| 桌機科技樹與未研發／可研發／完成三態 | [1600px](1600x1000-traditional-states.jpg)、[1024px](1024x768-traditional-states.jpg) |
| 手機科技分類 | [320px](320x568-traditional.jpg)、[360px](360x640-traditional.jpg)、[390px](390x844-traditional.jpg)、[430px](430x932-traditional.jpg) |
| 手機分類收合、完整科技詳情 | [收合](390x844-collapsed.jpg)、[詳情](390x844-detail.jpg) |
| 現代科研桌機／手機 | [桌機科技樹](1600x1000-modern-overview.jpg)、[手機分類](390x844-modern-overview.jpg) |
| 多城科研投入後切城，仍為籌資中 | [桌機](desktop-funding.jpg)、[手機](mobile-funding.jpg) |
| 研究中現實時間與暗圖金框 | [桌機倒數](desktop-active-countdown.jpg)、[手機詳情](mobile-active-detail.jpg) |
| 真實 PWA 離線重載後恢復研究 | [離線](offline-PWA.jpg) |

## 修改範圍與限制

`ResearchView.tsx`、`researchTree.ts`、`research.css` 實作正式研究 UI；`DevelopmentViews.tsx` 保留原匯出介面；GameApp 傳入 mobile 並保留切城瀏覽狀態；Shell 在研究頁隱藏研究進度條。另新增對應測試、兩支合成 fixture／原生瀏覽器驗證腳本、一份玩家 release note，並更新兩項既有測試以操作新的世代分頁／節點。

`src/game/formal`、研究指令、研究時間／成本、科技數值、排程、AI 權限、存檔 schema、ACK、CAS 與 Recovery 均無程式修改。正式完成仍由 reducer／scheduler 決定。

Chromium viewport／觸控模擬不等於實體手機驗收；實體手機與瀏海安全區仍待玩家驗收。保留 repository 既有 B5 E1 HOLD、Astra Gate 非 PASS 與實機待驗事實；本輪測試不替代這些正式驗收，也不宣告 R3／R4 放行。

重現命令：`npm ci`；`npm run typecheck`；`node scripts/verify-in-isolation.mjs full`；`npm run build`；`node scripts/check-release-build.mjs`。Pages 建置與 preview 設定 `GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin`，再執行 `scripts/check-pages-build.mjs`。以 `scripts/prepare-research-ui-fixtures.mjs <temporary-dir>` 產生合成存檔；`RESEARCH_BROWSER_URL=<Pages-preview-base>/ node scripts/verify-research-ui-browser.mjs <playwright/index.mjs> <temporary-dir> <ignored-evidence-dir>` 重跑原生矩陣。不要將合成 save、dist、node_modules 或原始 browser trace 提交到 Git。
