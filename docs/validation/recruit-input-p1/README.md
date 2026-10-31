# P1 招募輸入效能驗證

基準：最新 main `fd29dd11c04fce806e973e747db55a126c206acf`；修正版實作與量測見證：見 `compatibility.json` 的 `uiCommit`（初版 `f74804200f051c84e470056cbc66802446279d5e` 保留於歷史）。功能分支獨立於 `test/p1-army-recruit-lag-evidence-20261031`，未合併或刪除證據分支。

## 真正瓶頸與修正

原版數量 `setCount()` 重繪 ArmyView，再替整份兵種清單呼叫 `details()`／`recruitmentPreview()`；正式預覽在 UI 執行 `submitFormalOrder()`，連帶複製世界與驗證完整 Schema。後期存檔一輪 16 次編輯觸發 **36 次正式命令**、5 個 Long Task，Schema 驗證約占正式預覽耗時 74～79%，draft 複製約 16～22%。`useLiveCity()` 的本城投影不是主要耗時，無須改動它或 Worker。

改為純計算的 `recruitmentConditions()`／`recruitmentPreview()`，直接重用正式 `unitRecruitCost()`、`unitTrainingDuration()`，只掃描本城最多五筆訓練工作。精銳、文明折扣、現代完整／逆向資格、外文明城堡及 lane 預設規則逐項與正式命令比對。正式 Worker、排程、人口扣除、存檔、Schema、checksum 與歷史憑證的來源檔均未修改。

`RecruitAmount` 局部管理原始字串，空值、`0500`、逐字刪除不被數字轉換或重設；提交才顯示整數 1～100000 的驗證錯誤。桌面保留「每批人數」、各兵種本批費用／人口／時間／停用條件與直接招募；只有局部子樹更新必要的純算術，ArmyView 與世代／現代軍事面板不隨按鍵重繪。選定兵種才透過與手機共用的 `RecruitmentForm` 計算本城佇列與排隊 ETA；詳情編輯不更新背後清單，關閉時才同步草稿。兩條提交路徑均送原 `military.recruit`。沒有 debounce，也沒有用延遲掩蓋世界複製。

## 實際玩家資料與隔離

原始檔 **14,296,328 bytes**，SHA-256 **`16be5971dfec1ca347fef4cbfa898f18f69c59a6c77e0b04517d41c3c2499608`**，量測前後均 PASS。必要欄位確認：100 勢力、102 城、34,236 歷史命令、419 事件、25 倍速。

存檔與 Android 原圖僅還原至 `/tmp/lieguo-recruit-perf`。瀏覽器為全新 disposable context，Worker／IndexedDB 與正式玩家資料隔離；每次測試只讀原檔，遊戲推進只作用於瀏覽器副本。正式功能分支沒有存檔、20 個片段、玩家截圖或原始 trace，`metrics.json` 只包含純量效能摘要。CI 單元測試只用小型合成 Formal fixture，不讀玩家存檔。

另以實際存檔的本城投影，對 1／5／50／500／1000 各執行一次隔離的正式命令作 oracle：可招募狀態、費用、人口與 lane／開始／完成排程全部一致，原檔 SHA 未變。這些 oracle 不在輸入熱路徑，也沒有寫入玩家資料。

## 方法與限制

Chromium 響應式 1440／320／390px，真實 ArmyView、事件捕捉與下一個 requestAnimationFrame 間隔；一輪輸入 `1 → 5 → 50 → 500 → 1000`，共 16 次編輯事件（含刪除）。同一套暫存 Vite probe 在記憶體包裝函式，記錄正式提交、draft 複製、Schema 與 ArmyView render；不改原函式結果，不輸出資料本體。Long Task 門檻為瀏覽器既定 50ms。樣本較短且 Cloud 主機有排程抖動，數字是本次觀測，不能推論所有 Android 裝置。

### 原版與最終修正版（ms）

| 存檔／輸入位置 | 原 p50／p95 | 新 p50／p95 | 正式命令／輪 | ArmyView 重繪／輪 |
|---|---:|---:|---:|---:|
| 後期桌面「每批人數」 | 11.0／1012.8 | 9.4／16.5 | 36 → 0 | 16 → 0 |
| 後期桌面詳情 | 21.5／1439.8 | 5.6／19.2 | 36 → 0 | 16 → 0 |
| 後期 320px 詳情 | 17.1／1512.8 | 5.6／14.3 | 36 → 0 | 16 → 0 |
| 後期 390px 詳情 | 22.0／2147.5 | 7.2／12.3 | 36 → 0 | 16 → 0 |
| 新手桌面「每批人數」 | 9.3／20.9 | 8.4／15.2 | 1 → 0 | 16 → 0 |
| 新手桌面詳情 | 15.5／37.3 | 6.6／34.6 | 1 → 0 | 16 → 0 |
| 新手 320px 詳情 | 8.0／23.3 | 6.0／15.7 | 1 → 0 | 16 → 0 |
| 新手 390px 詳情 | 7.2／20.2 | 7.8／12.1 | 1 → 0 | 16 → 0 |

最終修正版各輪 Long Task、正式提交、世界 draft 複製及 Schema 驗證均為 **0**。初版桌面詳情首輪曾出現 **60.5ms** 尾延遲，完整保留於 `prototypeRuns`；最終版亦獨立重測，沒有覆蓋或刪除舊觀測。

### 實際 Worker 25 倍速持續更新

| 尺寸 | 新版 p50／p95（ms） | 輸入視窗正式命令 | Long Task | ArmyView 重繪 |
|---|---:|---:|---:|---:|
| 1440px | 15.9／38.5 | 0 | 0 | 2（背景更新） |
| 320px | 7.7／24.3 | 0 | 0 | 1（背景更新） |
| 390px | 5.3／14.8 | 0 | 0 | 1（背景更新） |

三組均收到真實 Worker 狀態更新，輸入視窗無完整命令。原版三組背景案例未能完成整個 **30 秒場景探測預算**（包含開頁、靜態輸入及啟動 Worker），隔離 context 被 watchdog 關閉；記為 `UNRESPONSIVE` 並保留失敗，沒有捏造原版背景 p95，也沒有提高測試門檻。

**模擬已驗，Android 實機待玩家驗。** 未模擬 Android 原生 IME、真實硬體 CPU 或觸控鍵盤生命週期。待驗另包括低階手機體感與較長時間輸入。

## 重現與檢查

先依證據分支 README 將檔案還原至 `/tmp` 並校驗 SHA。把基準 commit 與候選來源各以 `git archive` 展開到獨立暫存目錄，連結鎖定的 node_modules、準備相同 `.release`。`serve-recruit-input.mjs` 會拒絕帶 `.git` 的目錄，避免在正式 checkout 建立探測檔。

- `node scripts/serve-recruit-input.mjs <isolated-root> <port> <temporary-save>`：只綁定 loopback，在記憶體包裝計時函式；資料只讀串流。
- `node scripts/measure-recruit-input.mjs <port> <temporary-summary.json> <before|after>`：預設各尺寸詳情與新手／後期案例。
- `RECRUIT_BATCH=1`：桌面每批人數；`RECRUIT_WORKER=1 RECRUIT_ONLY=late-1440,late-320,late-390`：實際 Worker 背景案例。`PLAYWRIGHT_MODULE` 可指定安裝位置。不得把輸入存檔、瀏覽器 trace 或原圖加入輸出／Artifact。

67 項定向測試（含原 B9-3／B9-4 測試）（含六文明、傳統／精銳／現代、折扣／逆向、單／雙通道與 0～5 筆佇列的逐筆正式 oracle，以及原互動保護）PASS。輸入測試斷言零正式命令／零 structuredClone、只計算選中兵種，並驗證背景時鐘、城市與時代更新不更換 input、焦點或 `0500` 草稿。完整結果見 `checks.json`。

本地完整回歸依指令僅執行一輪：初版 **2147 PASS／2 FAIL／1 SKIP**。兩項既有 B9 測試指出桌面原有直接招募契約被改變；修正版恢復該行為與停用條件，原測試不變，定向重跑通過。初版失敗記錄與報告雜湊保留於 `full-regression-initial.json`，未重跑本地完整回歸，也不將該輪改記 PASS；最終 HEAD 的完整回歸由 PR／Push CI 另行執行。

原美術與歷史 Gate 繼續執行。`recruit_input_successor.py` 只授權兩個既有 presentation 來源到固定實作 commit，保護 Worker／規則／存檔／v96 來源與舊 manifest；非招募 action 及行軍／特殊單位呈現仍逐字比對基準。只刷新 JSON 雜湊不能接納未審核編輯；另加三項防竄改測試。既有 B5 E1 HOLD、Astra Gate 非 PASS 與實體手機待驗事實不變。

維持 Draft，不合併 main、不部署、不刪除證據分支。等待玩家與中控審查放行。
