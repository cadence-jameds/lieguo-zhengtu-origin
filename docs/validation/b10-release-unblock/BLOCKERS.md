# 合併阻塞：SW 啟用停滯

**P0 BLOCKED／MERGE HOLD／PRODUCTION RELEASE HOLD。** 不能因容量縮小、原子故障通過、Node／GitHub CI 綠燈而解除本項。

正式產物 `3a3ae8d`／0.31.16 的後繼完整五組為 4 PASS／1 FAIL。失敗是 Install Reject 恢復正式產物後，保存成功、target 身份核對成功、已發出 SKIP_WAITING，但 15 秒內無 controllerchange。正常更新的獨立重複也可出現同型失敗。

原生證據摘要：

1. 唯一 registration scope 為隔離 origin 的 `/lieguo-zhengtu-origin/`，只有一個 window client。
2. 舊 active 為 0.31.8／`29ade31`，candidate 為預期 0.31.16／`3a3ae8d`，不是錯誤 release identity。
3. candidate 已 installed；自身診斷收到 `skipWaiting:received`、`skipWaiting:start`。
4. 沒有觀察到 `skipWaiting:resolved`、activate、claim 或 controllerchange；候選仍 waiting/installed。
5. UI 在原 15 秒期限顯示保存已確認、更新未完成、保留舊頁與重試入口；原命令 Ack 仍可查，沒有資料刪除或假成功。
6. 在案例正式 FAIL 後額外一次對同 candidate 的診斷重送仍無法解除；沒有把這個診斷延長算入產品期限。

曾以 `355e7f7` 將 waiting message 不再等待 skipWaiting Promise 做對照，仍正常更新 FAIL（4/5），已 `243f68a` revert。不能把尚未證實的 circular-wait 假設作為修好根因的結論。第一輪後繼 5/5、HTTP 503 單項 PASS 與舊 DB 雙 client 升級 PASS 都保留，但不取代此失敗。

使用 `REPRODUCTION.md` 的 immutable pair 與 `production-sw-successor.mjs` 重現，重複正常／Install Reject；`B10_SW_DIAGNOSTIC_RESEND=1` 可收集失敗後一次重送的負面證據。原 `production-sw.mjs`、歷史 503 失敗、原 15／30 秒期限保留。不 unregister、不清除 Site Data、不自動導航關閉舊頁、不提高 timeout。

尚缺可證明安全的 registration／active-worker transition 修復，以及其後**穩定完整五組**原生重跑。沒有這項證據，就不能宣稱 READY FOR TECHNICAL MERGE。main 的兩個 workflow 護欄也還只是可審查提交，尚未安裝；詳見 `MERGE-AND-DEPLOY.md`。Android 仍 NOT TESTED，與此桌面 P0 分開判定。
