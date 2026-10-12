# R2a AI 基礎自治與 Scheduler

來源：RECONSTRUCTED_FROM_R1_V0.30.44_SECOND_R2_RECOVERY。R1 HEAD eb4d5bf9422e36fd0dcf589e071717de739d5512，source ZIP 60abd9998a4e16404c979a202ecf8a53a5c5bfff6a8a71c0be368a9800f70b2a；bundle b40638a6bb6412231438327dfa5a6c28b19e40793cd1cdddba3e3f5b5f46d87d；v92 SHA 2bb36aed23595b52b38e15ab5c76be883ec854c57517eaf61187af1f2c43e0e6。CRC、966來源逐檔及實際 clone HEAD 已確認。未改 R0/R1 封存、未假冒原 B8 commit。

99 AI 每人11項 seed連續人格，獨立活躍／錯峰20～85分鐘決策；低活躍不新建戰爭或擴張。依自己的 ownership index、真實庫存、人口、施工佇列及正式前置建立建設／徵兵／科研／時代／City選項；100資源儲備及20～50%資源預算。全部經 submitFormalOrder，不增加免費資源、軍隊或資格。AI事件與內部命令同一 advanceFormal 原子存檔，revision只提交一次，穩定EventId/CommandId去重；滅國終止自治事件。

既有R1存檔可讀（autonomy optional）；正式runtime新局啟用，舊存檔在載入後先保存啟用狀態才發布，不回溯補跑尚未存在的 AI 事件。AI資料保存在既有save/schema/IndexedDB/Recovery內；B5Lab fixture不啟用。舊根目錄checkpoint移至docs/recovery/ORIGINAL_B7_checkpoint.json原樣保留；封存ZIP的根checkpoint由本批實際封存生成。

本批實際驗證：3測試檔31項PASS、0FAIL；typecheck PASS；production build PASS。包括99AI公平初值、反事實敵方隱藏資料隔離、正常付款／隊列、單次revision、同時刻重播去重、Save/Load／切片／離線等價、Schema防篡改、IndexedDB失敗回滾／重試／Recovery，以及R1帝國17案例與B7滅國回歸。先前測試輔助取decodeSave回傳值錯誤已修正，初次失敗日誌保留Evidence。這是本批 targeted，完整Regression留R2c；歷史831與遺失856不當本批PASS。

R2b：政治／外交、軍事／拓殖與合法情報尚待完成。R2c：城市治理UI與完整整合尚待完成。v92§10.8 B9兵種／認知／終局執行不提前實作；後续策略介面可依已存在正式資格驗證。R3地圖動態、雙劍、Art及真實瀏覽器未開始。B5 E1 HOLD；Astra NOT_EXECUTED；B9 NOT_STARTED；Sites NOT_UPDATED。
