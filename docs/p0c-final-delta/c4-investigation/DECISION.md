# C4 後續架構選項（未授權施工）

本輪只修改Trace直接確認的draft複製及World Stream比較。最終數字見INVESTIGATION與TABLE；原完整1秒目標不變，不能用功能CI、平均數或小樣本取代Gate。

## 已確認的資料放大

長局持續保留完整Receipt；每筆操作要複製、驗證、canonical編碼歷史，交易還會讀完整current、寫完整backup/current及authority。現有合成168h世界約13266筆歷史、5.28MB保存資料。最慢新診斷中，單次save本身超過1秒；另一筆還等待前一個原子背景提交。這些是直接量測，不代表已找出歷史8613.2ms樣本的唯一原因。

|方案|設計與預期影響|安全及相容性風險|必要驗證|
|---|---|---|---|
|A：單一私有Admission draft|在Runtime內明確轉移未公開draft所有權，讓時鐘／事件追算和前景命令共用一個draft；保留最終完整Schema、Checksum及原IDB交易。目標是省掉相同世界的中間clone／驗證，不改Save格式或AI事件順序。|中高：命令拒絕、catchup失敗、重送或CAS衝突時不可讓命令部分修改污染需保存的catchup；公用Reducer仍須保持pure及原輸入隔離。需要新內部契約，中控核准前不施工。|舊／新原始及cooperative Replay逐事件等價；所有命令正負案例；每個await／fault的原子rollback；caller與Worker draft隔離；99AI；原生IDB；完整正式ABBA。|
|B：不可變快照＋指標／獨立歷史ledger|同一revision只存一份不可變世界，current及兩個Recovery點在同一transaction內指向它；另規劃可驗證的append-only Receipt歷史，避免每筆反覆搬移全部歷史。最終快照驗證及Checksum仍不可省略。|高：需DB遷移、舊存檔／匯入／匯出、Authority、Recovery指標與垃圾回收契約；中斷／磁碟配額不足時不能產生懸空指標或漏Receipt。不得本輪直接導入。|雙讀／版本遷移、故障恢復、舊版本相容策略、transaction與ledger完整性、CAS／dedupe／receipt保留、備份可達性與清理、原生瀏覽器、長局／99AI及完整ABBA。|

建議先評估A：以量測到的重複clone與完整驗證為上限估算，每筆可能省數十至數百ms；這是估算，不能宣稱一定達1秒。它不處理IDB完整歷史讀寫與長尾，所以B仍可能必要。B的效益須以prototype量測，不先編造p95或承諾工期。兩者都不應降低AI、刪歷史、提前ACK或移除最終驗證。

未來診斷若針對舊極端值，應保留本輪時間軸、另外取得可對齊的Worker GC／CPU與原生交易觀察，再區分GC、OS／儲存排程和世界工作；目前的GC巢狀總量與main heap不能證明因果。原提交前逾時仍獨立未解，不能拿本輪fixture服務中斷取代其原因。

本輪80筆有界ABBA仍有9/40筆超標，因此保留最小修復，停止擴大昂貴矩陣，交中控選擇下一步。沒有實作以上架構，也沒有宣告Gate PASS。
