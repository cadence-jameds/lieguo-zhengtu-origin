# v0.30.33｜B5 戰鬥人工測試工具更新報告

日期：2026-10-10（Asia/Taipei）。Authority：v90。本輪範圍只有 B5 人工測試工具。

## Baseline 核對

開工前經 Sites 的既有專案 source workflow 核對遠端與本機最新 source 均為 **v0.30.32**，commit `a5a975972f793e9e35f1491bd3564f0829204933`；沒有改用 v0.30.23 或其他舊 source。本輪接續該 source，發行 v0.30.33。

v90 參考：`docs/scout-v03029/authority-v90.md`。沿用正式 B1～B5、v90 城池偵察單一模式及原有 save/schema，不改正式兵種數值、戰鬥公式、野外據點生成／loot／generation／respawn。未開始 B6／B7／B8、未實作正式 AI。上一輪待辦「建造條件只有未達項目才粗體」未混入本輪。

## 使用方式與完成項目

入口：遊戲設定 → 開發者模式 → B5 戰鬥測試台。

| 需求 | 實作 |
|---|---|
| AI 城市 | 可從原生100城的99座 AI 城市選擇，以相同種子保留原生位置、文明與名稱；套用後目標身分寫入測試 campaign identity，讀檔／易主不改目標。 |
| 情境 | 空城、普通守軍、混編大軍、城牆、反偵察斥候；敵／我牆可設 Lv0～15。 |
| 玩家兵力／攻城器 | 從 Formal unit catalog 顯示兵種、名稱、文明來源，配置重置時兵力與本次派遣數量；不扣徵兵成本，只建立人工測試初始條件。 |
| 敵城庫存 | 四資源逐項設定0～1,000,000，每兵種0～10,000；整數及有效身分驗證。庫存有限，方便驗收負重、掠奪與返城入庫。 |
| 玩家守城 | 可明確觸發一次敵軍 raid／conquest；依敵城所有權與 issuer 建立正式行軍。每次重置限一次；在途任務未完成不允許重注入守軍。 |
| 重置 | 建立新的獨立測試 campaign，恢復設定兵力、牆與庫存；本次視圖不沿用前次戰報／行軍。 |
| 正式流程 | `submitFormalOrder` → Formal army path／scheduler → 既有 resolver／siege → 原子 FormalPersistence → BattleReports。沒有直接呼叫城市易主 primitive 假裝征服。 |
| 人工推進 | 下一抵達／返城／combat round，或＋1世界分。手動測試世界無 interval 與離線快轉；可逐事件檢查 receipt 與狀態。 |
| 存讀檔 | 每次操作完成後保存，另有重讀與完整 `.b5lab` 匯出／匯入；延續在途行軍、battle pools、BattleId、ResolutionId、receipt 及戰報。 |
| 手機／桌機 | 共用原有 Dialog、FormalWorldMap、FormalReportsView；兵力可展開，手機雙欄與可換行操作列。測試地圖不開放拓殖建城，己方城市入口回測試狀態。 |

## 隔離、權限與時間

- 新測試世界沿用進入時原戰役種子與文明；不複製其進度，也不替換原戰役。後續開啟可接續前一次保存的測試世界；兵種選項讀該測試世界實際文明。
- 使用獨立 Worker、獨立 IndexedDB suffix `B5CombatLab-v1` 和獨立 writer lock。讀取目標 intel 與戰報皆查自己的測試資料；不透過原戰役的 TargetIntelContext。
- UI 只載入純設定／顯示函式；存檔與交易服務位於測試 Worker。正式主 Worker 的 authority 與 legacy 邊界不變。
- 測試世界保留既有 developer 50／200倍時間設定，但對 `campaign:b5lab-` 明確排除資源無限補滿；正常 developer 模式仍照舊補滿資源。這是測試 fixture 的資源策略，不修改戰鬥、負重或戰利品公式。
- 完整測試備份加上 `b5-combat-lab` 外層識別。一般遊戲匯入拒絕這種檔案；測試台也拒絕一般遊戲存檔，避免操作錯誤污染正常進度。
- 設定只是人工 fixture：沒有 AI 決策、自動出兵、策略評分或新增兵種科技。正式 combat modifiers 仍讀單位／科技／文明身分。
- 50X 排程每個征服回合25世界分鐘、200X為100世界分鐘，兩者均折合現實30秒，戰術倍率封頂10X。本台按鈕手動跳到事件，沒有要求實際等待30秒。
- 原戰役在測試台開啟時照常運行。原有「開啟開發者模式」本來就修改原戰役的資源與速度，這項既有操作與測試台資料隔離是不同的行為。

## 回歸驗證

測試範圍包含整個 `src/game/formal`、`src/game/presentation`、`saveLock` 與本輪三份 Lab 測試。結果見 `regression-tests.json` 與 `validation.json`；單獨新增的 Lab regression 共23項。

涵蓋五情境、牆Lv1～15、原生432槽不變、兵種catalog不變、正常current／authority／Recovery／BattleReports不變、備份隔離、失敗交易回滾、正式raid負重、v90偵察成功／平手／失敗與返城交付、siege破壞、50／200X多回合征服與易主、敵軍來襲玩家防守、重置、存讀檔續接、正式報告與intel、Worker佇列錯誤後續操作、手機／桌機DOM、分頁鎖及跨文明重開。

`scenarios.json` 為本輪可檢視的正式戰報與receipt evidence。`formal-b5-regression/` 收錄既有B5與v90測試本次輸出的snapshot，原歷史文件保持原版本。

Typecheck與正式build結果記錄於 `validation.json`。沒有可用的受支持瀏覽器QA入口，本輪沒有執行實機瀏覽器或產生實機截圖；人工Checklist提供玩家驗收，未冒稱人工PASS或新Gate結論。

## 交付與停止點

完整source、更新報告、regression evidence、人工Checklist、source-tree SHA256、SHA256SUMS與handoff一併交付。下一步只等待人工驗收／獨立review，本輪完成後STOP，不開始B6。
