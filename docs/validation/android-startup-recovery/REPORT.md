# Android 啟動失敗與本機戰役恢復 P0

Base：main `233130edd7608c455dc1ebe429aaad99db10b452`（B10 v0.30.82）。本批不合併、不部署。

## 根因與修正邊界

原 Hook 在 30 秒 watchdog 終止 Worker 後，仍等候只在元件卸載時才會 resolve 的 Promise，因此保留 Web Lock；沒有重新建立 Runtime 的生命週期，首頁同時停用新局且沒有獨立清理入口。Worker error 亦沒有完整終止／釋放流程。

`before-native.json` 以原 main Production Build、真實 Chromium／Worker／Web Locks 重現：30 秒後 Worker 關閉、鎖仍持有、新局停用、沒有管理入口。測試的 PASS 表示已確認此舊版失敗，**不是舊版功能通過**。未取得使用者私人存檔，不宣稱已診斷 Android 為何最初停在啟動階段；本批不延長 30 秒或調整效能。

修正會立即隔離舊 Worker 訊息、釋放其鎖生命週期，再建立新 Worker。恢復新局先重新檢查資料；只有已確認空白／歷史封存或取得正式不相容 consent token，才能進入設定。未知損毀、Authority 不一致、未完成 Inbox 等不自動覆寫。原正式新局、T1／T2、Replay Fence、Schema、Reducer、Scheduler、Preview／Projection 協定皆保留。

管理入口由主頁的獨立唯讀 IDB 流程操作，先停止本頁 Runtime 並等候釋放鎖。只接受 `storageRecovery.ts` 明列的六個本遊戲戰役 namespace；不以列舉結果直接刪除。預設無選項，逐項列出資料庫與範圍，可選備份，永久刪除前再次確認。取消不發出刪除操作。不使用 localStorage.clear、Clear-Site-Data、SW unregister 或 CacheStorage 清理。

刪除前取得現行及已退役版本的已知 Writer Locks；可讀資料庫先以會 abort 的版本升級探測其他連線。blocked 時不發出 deleteDatabase，延後完成的探測仍會 abort。只有明確確認後，無法讀取但未 blocked／逾時的指定 DB 才能走清理途徑。逐項核實結果，第一項失敗即不執行後續項目；跨資料庫不宣稱可原子回滾。

原生 deleteDatabase 本身不可取消。若在探測後出現新的非協作連線而使真正刪除請求 blocked／逾時，畫面會標示「結果未確認」，不宣稱成功、不自動重啟；須關閉其他分頁並重新檢查；確認不存在，或能完成唯讀開啟且明確標示仍未清理完成後，才可返回。正常已知寫入者同時受 Web Locks 保護。永久不可讀儲存／瀏覽器安全限制仍可能使清理失敗，會明確回報，不會當作空白戰役。

## 驗證

`native.json` 是本機 Production Build、Chromium 154、390×844 的原生 IDB／Dedicated Worker／SW 結果，**不是 Android 真機**。覆蓋逾時／中止／Worker error、直接新局、不備份、取消、舊新並存指定刪除、高版本 DB、不可讀 DB、blocked 後保留、部分失敗、Writer Lock、T2 Quota 回滾、重載與 SW／Cache／UI 設定／非遊戲資料保留。

CI 結果以此 PR 當前 HEAD 的 Verify 與 Actions artifacts 為準，不把舊 SHA 的 PASS 冒充新 SHA。所有既有測試期限、負載及 2 workers 保持原樣。新的 successor 只允許從 immutable implementation commit 推導的有限來源與兩個精確 adapter；舊驗收檔、v95／96／97、遊戲規則與原測試不放寬。

### 最終本機結果

- Node 22.23.4，2 CPU quota／8GiB，原 2 workers，預設 heap 約 2.19GB，未增加 heap 或任何測試期限。
- 定向 109 PASS；Production Build 原生 Chromium 154、390×844：14／14 PASS。包含真正舊 Formal Writer Lock 與現行鎖衝突、部分刪除及真實 Runtime 原子交易內 Quota 注入。
- `node scripts/verify-in-isolation.mjs full`：**2533 PASS／0 FAIL／1 SKIP**；完整 JSON 雜湊及環境見 `checks.json`。未以單檔 PASS 或 CI 取代本機完整 Gate。
- Typecheck、Build、Pages 路徑、Release／Worker identity：PASS，dirty=false。Pages 檢查的首次命令缺少 CI 環境旗標而拒絕，補上正式旗標後原檢查通過，未修改斷言。
- 既有完整 31 個 CI safety commands 於來源 `bd306f6…` 通過；最終僅補齊管理模組的舊鎖與重新檢查狀態，原世界確定性／AI／交易來源逐位元未變。最終有限 successor、父 Gate 與反竄改測試另行重驗 PASS；GitHub CI 仍會在當前 PR HEAD 執行完整流程。
- 原新局取代的 12 個故障點：branch、report、backup、world、authority、metadata、ledger segment／result／index／manifest／head、retention 均回滾原資料。原生 Runtime 的世界寫入 Quota 注入亦保留所有 DB rows，不顯示新局成功。這是故障注入，不宣稱實際填滿 Android 儲存空間。

最終程式內容 anchor 為 `547e0bcb981c489380168bfa94ba0d3cd5873048`；原生完整測試與本機完整 Gate 來源為 `de7c40c…`，後續只補驗證文件。分支 preview 版本由正式 metadata 程序產生，與未來 main first-parent 合併版本不應混用；沒有手動提高 package baseline。

## Android 手動實測

1. 此 PR 尚未部署。需使用此 PR 的 HTTPS 測試建置，或在使用者另行授權合併／部署後測試；現行正式 v0.30.82 不是修正版。可用 USB `adb reverse tcp:4173 tcp:4173` 將桌面 Production preview 連到 Android 的 localhost 安全環境，但它與正式站是不同 Origin，沒有原手機正式站存檔。
2. 在修正版原本 Origin 測試時，保留舊資料。透過正常更新流程載入；必要時關閉所有遊戲分頁再開啟，讓已安裝候選 SW 正常接管。不要清除網站資料或取消註冊 SW。先確認修正版號與 Content SHA。
3. 重試舊存檔；遇到啟動失敗／停止讀取，確認畫面可操作「開始全新戰役」及「管理本機戰役存檔」，沒有永久 loading。
4. 先不勾選任何資料，確認 DB 名稱與範圍。可自願匯出備份。勾選一項後按刪除，在確認窗取消，確認資料與入口保留。
5. **只有確定願意丟棄的測試存檔才確認永久刪除。** 先只刪舊 DB，核對現行 DB 保留；再明確重設現行 DB，核對引擎重建並回到新局首頁。
6. 選文明、領主、種子、速度與離線時間，建立新局；重新開啟後載入同一戰役，確認保存正常。
7. 另開分頁持有戰役，於第二頁進入管理並嘗試刪除，確認拒絕且第一頁仍保有資料；關閉持有頁後才能重新操作。核對 UI 設定、SW、快取與其他本機應用資料未清除。

Android 真機：**NOT TESTED**。本批僅交付 Draft，等待技術審查及使用者後續授權。
