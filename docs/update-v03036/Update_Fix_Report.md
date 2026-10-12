# v0.30.36｜正式版更新通知與保存後載入

日期：2026-10-10。baseline：v0.30.35 commit aeca4375a143dabec14e83e9473fa72979152034。

正式GameApp只在玩家點擊時查version.json、顯示字串；沒有接入舊DEMO的PWA等待更新提示、週期檢查或保存後更新操作。已開啟頁面不會自行發現新版；在舊Service Worker等待啟用時，普通重新整理仍可能返回舊快取。

修正：新增共用useAppUpdate；載入、每60秒（前景）、focus、visibilitychange及online檢查版本。version.json使用no-store、獨立查詢參數、8秒逾時及版本格式／遞增驗證。主動請Service Worker檢查新版。首頁、設定與遊戲內新增保存並更新入口；手機通知避開底部導覽。新版發現不自動重載。離線試玩包不登記Service Worker或連網檢查。

更新操作先等待新Worker完成下載，再向Formal runtime發送sync。useGame新增可等待的sync，依requestId收到成功synced才繼續；requestDone、其他保存、一般state更新都不代替成功回覆。Worker回覆帶requestId，未改Formal世界／存檔schema。保存完成後對waiting Worker發送SKIP_WAITING，收到controllerchange後才以帶版本參數的URL載入。保存失敗、下載／啟用逾時不主動重载；原頁面及持久存檔保留。重複點擊不重複提交。

驗證：8檔82項PASS（更新hook／首頁UI8、useGame互動7、正式Worker／持久存檔／Recovery、B5 Worker／戰鬥存檔／戰報UI），TypeScript PASS。最終production build含TypeScript檢查為發布必要檢查。未執行實機瀏覽器人工驗收。

人工驗收：
- 首次由缺少更新流程的舊版升級：保存後關閉此遊戲所有分頁，再重新開啟；首頁確認v0.30.36。
- 下次發布：保持遊戲開啟，60秒內或切回前景時收到更新提示；首頁／設定／遊戲內可更新。
- 點擊更新後先完成保存，顯示新版；城市、部隊、在途戰鬥與戰報仍在。
- 離線或模擬保存失敗：不直接重載，恢復後可重試。
- 手機／桌機：更新入口可點擊，手機浮動提示不與底部導覽重疊。

本輪只修正式更新流程，沒有修改戰鬥數值／攻城規則，沒有開始B6／B7／B8。STOP。
