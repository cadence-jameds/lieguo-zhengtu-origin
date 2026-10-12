# v0.30.19｜獨立時鐘與操作穩定性修正

2026-10-06（台灣時間）。範圍：B4 Player Feedback 收尾。B5 尚未開始。

## 問題與修正

v0.30.18 將背景推進提高至每秒，修正了短工程延遲，但同時每秒提交、傳回整份世界；任何 Worker 訊息也會解除 foreground busy。純時間推進持續增加 revision，可能使剛送出的玩家命令碰上版本衝突。

本次保留 v85 > v84 > source 與 Formal 規則，不改成本、工期、速度選項、事件排序或存檔格式：

- 一般 checkpoint 每 10 秒合併一次；仍每 100ms 檢查正式到期事件，重要完成事件優先進入原子提交。
- 玩家命令、完成事件及匯出前進度，仍先確認 IndexedDB transaction 成功，才發布正式結果。慢提交期間合併輪詢，失敗至少隔一秒重試。
- 新命令以實際 admission time 起算。沒有到期事件時，純時間補算與命令合併成一筆提交，revision 只增加一次；若已有到期事件，先提交事件，原 stale order 仍拒絕，不偷偷多升一級。
- 顯示時鐘以 monotonic elapsed × speed 計算。倒數、進度、HUD 資源與人口獨立更新；投影只讀，不回寫 authority，也不自行判定完工。到期但尚未提交時顯示「完成確認中」。經濟投影不越過未提交的事件邊界。
- 開啟中的建造、科研、徵兵及拓殖／商隊表單，約每秒更新目前城市的可用資源與資格；城景維持原元件，預覽快取避免同一正式版本反覆克隆世界。
- Worker 首次傳完整 snapshot，後續只傳已提交且改變的資料區段，保留地形及其他不變區段的參照。patch 的 campaign/base revision 不符時要求完整 snapshot，不套用不完整狀態。
- 每個 foreground request 分別追蹤完成；背景 state、phase、notice 或其他 requestDone 不能解除正在提交的操作。快速重複點擊在前端拒絕，正式 command receipt/dedupe 機制保留。
- 若命令被 strict revision gate 拒絕，且其間只有可證明的純時間 checkpoint，前端以同一 CommandId／同一 payload、最新 revision 重送最多一次。Reducer 仍逐次驗證所有規則；遇到實際事件、其他操作、戰役切換或 Recovery，不自動重送。
- 地圖重繪依可見實體及圖層變化觸發；純時鐘、庫存、駐軍數量不重新繪製地圖。既有選取光暈、縮放、拖曳與底圖快取保留。

## 五種倍數驗證

下表均為自動測試，非實機計時承諾。

| 倍數 | 建設到期前／後 | 徵兵、科研 | 拓殖整備、商隊抵達 | 離線一致 | 操作／投影／實際存檔 |
|---|---|---|---|---|---|
| 1X | PASS | PASS | PASS | PASS | PASS |
| 3X | PASS | PASS | PASS | PASS | PASS |
| 6X | PASS | PASS | PASS | PASS | PASS |
| 10X | PASS | PASS | PASS | PASS | PASS |
| 50X | PASS | PASS | PASS | PASS | PASS |

- 使用正式新世界、正式命令與事件 Reducer，在倍率換算的毫秒期限前後驗證；50X 林地工程的現實時間預覽取整為兩秒。
- 各倍數比較前景完成與離線補算的城市、事件、科研、拓殖及商隊結果；驗證新工程以實際操作時間開始。
- 各倍數使用實際 FormalPersistence + fake-indexeddb 驗證 admission 只有一筆 revision、存檔／讀回一致、重複命令不重複寫入及兩個 Recovery checkpoint。
- 各倍數 DOM 測試驗證倒數及 HUD 更新不重建外層表單；完成確認前不提升正式建築等級。建造／徵兵資格更新不需等十秒保存。
- React DOM 模擬驗證徵兵完成後，原 dialog、輸入數量37、焦點和內外捲動位置保留；背景訊息不誤解除 busy，時鐘衝突重送期間不短暫解除 busy。
- 額外驗證慢／失敗提交、重送上限、真正 stale order 拒絕、patch 還原與完整 snapshot 復原，以及原 B1/R1、B2、B3、B4、v85 與 Presentation 回歸。

完整結果：32 個測試檔、339 項全部通過，0 failed、0 skipped。機器結果見 `test-results.json`。TypeScript 與 Vite/PWA build 納入發布前檢查。

## 驗證界線

DOM 使用 Happy DOM，持久化使用 fake-indexeddb；這些結果不代表手機瀏覽器實際 FPS、磁碟延遲或背景分頁限流。此環境沒有可用的指定瀏覽器 QA 技能，因此未宣稱 browser／手機人工 Smoke 或 Astra Gate PASS。完成顯示仍須加上事件輪詢、原子保存與裝置繪製時間。

既有正式存檔相容。待玩家確認手機與桌機操作體感後，再決定進 B5。
