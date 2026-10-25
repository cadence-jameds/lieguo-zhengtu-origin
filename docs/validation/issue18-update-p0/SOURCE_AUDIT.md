# Issue #18 P0 來源與修復邊界

Base：`01247043bf79f51cb5fd5357c2f1c4eb88f027fc`，已確認 PR #35 合併；工作分支 `hotfix/android-update-finite-waits`。PR #19 合併提交為 `06c4cb93779f1f679bb77470515fd8aee1c42de9`。

施工前唯讀追蹤 `useAppUpdate.ts`、`useGame.ts`、`updateEligibility.ts`、`GameApp.tsx`、`FormalHome.tsx`、既有更新／保存測試、`vite.config.ts`，並閱讀 Issue #18 與 PR #19 原修復及 R19 Delta 紀錄。本輪不重做 README 動態版本展示，不改玩法、80 任務、B9、AI、戰鬥、平衡、存檔格式或正式寫入交易。

## 已證實的程式缺陷

原 `refreshRegistration()` 對 `registration.update()`、`getRegistration()`、`register()` 直接 await，沒有有限期限。任一 Promise 不 settle，即不會執行外層 finally，`updates.updating` 與 UI disabled 可一直保持。`prepareUpdate()` 的無活動戰役資料檢查亦可能沒有終結；活動戰役的 `sync()` 本身有 30s watchdog，但 hook 原先不對傳入的保存 Promise 建立邊界。

原 `waitForWaiting()` 只在重建註冊的特殊情境接受 active Worker，且依賴 controller 參照；原 `activateWaiting()` 除進入時的檢查外依賴 controllerchange。已接管但事件遺失、安裝／waiting 屬性不同步時，可能錯誤等待或逾時。原 UI 按鈕的「正在保存並更新…」只看 updating，不能定位真實階段。

修復前以原 main 應用程式＋新增回歸測試執行：原 50 項通過，新增 7 項全部失敗；見 `before.json`。這證明上述程式路徑的缺陷，不證明玩家 Android 裝置實際停住的原生 API 或確切生命週期。

## 期限與恢復

| 階段 | 期限 | 恢復／終止 |
|---|---:|---|
| version.json 與 JSON body | 8s | 中止 fetch、保留已知更新資格，下一次檢查可重試 |
| update／getRegistration／register 各一次觀察 | 各 12s | 本次停止；原生 Promise 不能取消，但晚到結果不得續存檔、啟用或導航 |
| 安裝／waiting／active 重查 | 30s | 事件＋250ms 有限輪詢；失敗解鎖更新 UI |
| Worker 自有 release identity | 3s | 關閉 MessageChannel；不符／未知不啟用 |
| 本機資料枚舉／開啟／唯讀交易 | 各 8s | 不建立／刪除資料庫、不升級 schema；晚到開啟結果關閉連線 |
| 正式保存 ACK／前次尚未 settle 的保存 | 各 35s | 原 useGame sync 30s 保護保留；逾時不聲稱保存成功、不啟用，未結束的保存不得與重試重疊 |
| 啟用與實際控制器核對 | 15s | 事件＋250ms 輪詢＋前景重查；不同 controller 物件須證明相同 version／contentSha |
| location.replace 後 pagehide | 5s | 沒有離開頁面則標示重載未完成，保留已確認保存結果，可明確重試 |
| 整次明確更新嘗試 | 150s | 取消本次觀察與後續回呼，不做自動無限重試 |

所有期限以 wall clock 在 Promise 完成、focus、visibilitychange、pageshow 時重查；頁面完全凍結時 JavaScript 無法執行，不宣稱背景期間準時顯示錯誤。恢復執行後先核對期限，晚到結果不續作。AbortController 取消的是本次應用流程，不能撤回已交給瀏覽器的 native registration／activation 或已開始的 durable transaction。

重建同 scope 註冊仍必須先取得保存／既有歷史保全資格；不解除註冊、不清 Cache Storage／IndexedDB／localStorage。保存失敗保留原頁面；保存成功但啟用／重載失敗，明示已保存、更新未完成。重試不沿用前次晚到 ACK 作為目前世界狀態的保存證明。

## 驗證判準

正式活動戰役的權威仍為 `useGame.sync()` 的 correlated requestId durable acknowledgement；不改 request receipt、revision、CAS、Recovery 或離線補算。`updateEligibility` 的 empty／historical／locked／error 規則保留。PR #17 contentSha／同號異內容／docs-only 判斷、version.json、Worker identity、Pages base、PWA scope 與 fallback 保留。

活動戰役保存失敗時，首頁亦保留唯讀「匯出本機原始備份」出口；文字明示僅包含已寫入資料、不代表本次保存成功。未知或不符的 reload target 不會顯示「已載入預期新版」。

新增導航測試的成功 location.replace mock 會送出 pagehide，以模擬真正離開頁面；另有不送 pagehide 的負向測試驗證 5s 失敗。既有安全斷言未移除或放寬。

目前尚無原 Android 裝置 DevTools／SW 執行階段證據或可用真機，實機原因仍待玩家驗收。原生 Chromium 的受控故障注入用以證明程式缺陷與修復邊界，不冒稱為真機根因。

## 原生唯讀探測追加修正

原生瀏覽器的保存故障測試新增唯讀備份出口後，刪除呼叫 tripwire 捕捉到既有 Dexie.exists() 為不存在 namespace 做 open／abort／deleteDatabase 的內部探測。這不是既有玩家資料被刪除的證據。為符合本輪零建立／零刪除的唯讀邊界，campaignStorage 改用原生 databases 枚舉與 readonly transaction；不支援 databases 時，open 的 upgrade transaction 直接 abort，不呼叫 deleteDatabase。正式持久化／CAS／Recovery 模組未修改。

新增測試在原 main 產生 1 個真實失敗（before-readonly.json）；修正後包含無 databases API 的分支均通過。兩個既有儲存測試的故障注入，從已不使用的 Dexie.exists 改到實際原生 open／databases 邊界，原本「無法讀取不得判定空／歷史」斷言完全保留。

沒有活動戰役及唯讀歷史的確認使用獨立 preserving 階段「正在確認本機資料保全」，不以「正在保存遊戲進度」描述唯讀操作。GameApp 依已載入 world 傳入同一 hook，原 prepareUpdate 資格與正式 ACK 不變。
