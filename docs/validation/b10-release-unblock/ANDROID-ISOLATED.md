# Android 隔離實機流程 — NOT TESTED

本批沒有 Android 實機。桌面 Chromium 結果不能替代手機驗收。B5 E1 HOLD、Astra 非 PASS、既有實機待驗狀態保持。

1. 從最終審核 HEAD 建置正式產物。用單獨 localhost port／獨立測試 origin 提供，透過 `adb reverse tcp:4222 tcp:4222` 讓手機 Chrome 存取該 localhost；不可使用正式網站 origin。
2. 先截記 Android、Chrome、裝置、空間、電量／省電設定與 SHA。只建立合成戰役，不匯入私人玩家存檔，不清除正式網站資料。
3. 驗證新戰役、快速連續建造／訓練／研究／物流／治理／出兵，觀察 Created→Durable Pending→權威結果；預覽 Worker 失敗不應取消正式命令。
4. 在 Durable Pending 後切背景／關頁／終止 Worker／重開，逐筆查詢或恢復；核對沒有重複扣款／出兵、沒有無入口 Pending。
5. 在 99 AI／25X 下執行 0／1k／10k／60k／150k 合成等價世界的載入、Quick／Full 往返、Recovery；記錄原生時間、實際 bytes、儲存失敗與主執行緒長任務。
6. 用第二個分頁驗證原有 writer lock 與重新取得權限；Recovery、匯入、滅國、復國、終局後不接受舊分支封包。
7. 在同一隔離 origin，用審核過的 before／after 正式產物跑原五個 SW 故障情境，保留原 15／30 秒期限。不可 unregister、清空 site data 或放寬期限取得通過。
8. 匯出合成備份後先驗證可再匯入，才考慮清理這個隔離 origin。測試完成不構成 Production 發布批准。
