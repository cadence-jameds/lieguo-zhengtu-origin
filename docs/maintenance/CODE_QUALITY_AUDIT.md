# 程式品質與技術債審查

基準 main `d5a6f544d87c0308c0105075f233bbfa0aeb1329`。本報告根據正式入口、Runtime、Persistence、Projection、AI、測試及既存證據抽樣；未逐行審完所有程式，也沒有以檔案長度或 AI 來源推定錯誤。P1 表示優先降低使用者影響或重大驗證缺口，P2 表示可規劃改善，P3 為低優先。以下除明示外均為風險／缺口，非已重現的產品 bug。

| 編號／優先級／類別 | 證據與實際影響；已確認 bug？ | 最小工作與可驗收條件 | B10／存檔相容測試 |
|---|---|---|---|
| Q01 P1 裝置／可靠性 | `docs/validation/b10-release-unblock/ANDROID-ISOLATED.md` 標記 Android NOT TESTED；#66 仍為 Draft。背景、更新與存檔在實機上的表現未知；未在本次重現 bug。 | 依既有隔離清單用合成戰役測背景／恢復／更新與存取失敗，記錄機型、版本、SHA、每項結果及剩餘缺口。 | 是／是 |
| Q02 P1 容量 | `src/game/persistence.ts:499,524` 和 `GameApp.tsx:89` 限制 100 MiB，長局超限會拒絕匯出／匯入；不是資料已遺失。 | 用合成歷史量測增長與接近上限時提示；先決定容量策略並測回滾，不能自行放寬格式。驗收包括可理解提示、原資料不變與有界復原方案。 | 是／是 |
| Q03 P1 長期可靠性 | `docs/validation/b10-final/ARCHITECTURE.md` 的 ledger 累積與 10 分鐘 soak 不證明多日行為；長期故障未重現。 | 先訂合成多日場景及容量與記憶體量測，記錄重啟後 ledger、pending、結果與原子性；不刪歷史。 | 是／是 |
| Q04 P1 命令確認 | `src/game/runtime.worker.ts:50-53` T3 通知可能丟失，投影錯誤另行提示；T2 不因此回滾。已有查詢機制，未證明無聲丟命令。 | 對 Created→T1→T2→T3 的關機、Quota、Ack 丟失與跨分支情境補原生端到端驗收；以原 ID 查到唯一結果且 UI 說明為完成條件。 | 是／是 |
| Q05 P2 投影效能 | `src/game/worldStream.ts:19-28` 對各實體建 Map、比較與產生差異；`worldProjection.ts:37-38` 逐城市處理。非完整世界傳輸，但城市增長可能增加 CPU／配置；未量測出本次回歸。 | 以固定 seed、不同城市數量採樣 projection／stream 耗時與傳輸 bytes；先定基線並保留 branch、revision 及 parity 測試。 | 是／視修改而定，是若接觸權威資料 |
| Q06 P2 AI 擴展性 | `src/game/formal/aiActions.ts:23,35,38,50` 在決策中篩選勢力、城市或軍隊；99 AI 與多城可能放大掃描成本。尚無本次量測，不宣稱瓶頸。 | 對固定 seed 的長局做 profile，記錄事件數與耗時；若改善，以逐事件 RNG、排序、狀態與戰報完全一致的回歸為前提。 | 是／是 |
| Q07 P2 可讀性 | `src/game/useGame.ts:215` 多個命令處理器集中單行；`src/game/runtime.worker.ts` 的通知、投影、排程同檔。審查操作生命週期的成本較高，非單憑長度斷定設計錯誤。 | 先加公開契約與導覽圖；後續僅抽離純格式化部分，以現有命令／競態測試及 diff 驗證不變。 | 是／若碰命令路徑則是 |
| Q08 P2 初次載入效能 | `docs/validation/b10-release-unblock/PERFORMANCE.md` 記錄單次最高 149ms long task，無法歸因全部來自特定模組；並非 Android 結論。 | 固定設備與多次冷暖樣本採集 trace，定位 bundle、解析、渲染，定量驗收並維持離線啟動。 | 間接／否，若只量測 |
| Q09 P2 規格與文件 | 原 README 稱 v95 唯一現行，`AGENTS.md` 指定 v97；兩者衝突可確認。本次入口改正，保留舊快照。 | 為版本索引與 README 增加核對流程；驗收為指向 v97 並清楚標記歷史規格，避免改寫舊檔。 | 文件／否 |
| Q10 P2 倉庫與 CI | 本次量測 `.git` 約 639 MiB、`docs` 約 699 MiB、1759 個追蹤圖片；CI 在 `.github/workflows/ci.yml` 包含大量 successor／evidence 檢查。這些數字是本地工作副本而非 clone 網路量，且證據有保留價值。 | 先測乾淨 clone 和 CI 各階段時間，建立歷史證據保留清單；在不刪證據、不改歷史及不降測試標準下評估重複，驗收為同等契約覆蓋及可重現。 | 間接／否 |

## 改善順序

- 現在可安全處理：Q09 文件入口與授權證據盤點；Q10 只量測不刪資料。
- B10 穩定後：Q05、Q06、Q08 先量測再選定可證明等價的小變更；Q07 先補導覽。
- 先補測試：Q01–Q04 的原生實機、長局、容量及命令故障情境；涉及持久格式或權威狀態均需相容／復原測試。
- 應保留：Legacy 與歷史規格、不可變 ledger、T1/T2 原子邊界、projection／preview 隔離和既有證據；大檔或重複測試本身不足以證明應刪除。

## 邊界和證據

正式路徑 `src/main.tsx` → `src/App.tsx` → `src/game/GameApp.tsx`，B10 以 `docs/validation/b10-final/ARCHITECTURE.md` 的 Worker／T1／T2／T3、projection 與 preview 邊界為參照。`src/game/runtime.worker.ts` 採正式投影發佈，並非向 UI 任意傳送完整權威狀態。Legacy 仍有獨立入口與相容用途，沒有因命名斷定其不必要。現有原生故障與效能證據的觀測窗口不等於全面驗收。本審查沒有修改遊戲邏輯，也沒有測定每個風險的發生率。
