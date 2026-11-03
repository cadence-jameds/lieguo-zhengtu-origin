# P1：下載中斷後重試，候選 SW 啟用逾時

**狀態：FAIL／發布前需處理或明示決策。** 沒有修改遊戲程式、SW、保存規則或原期限來消除此紀錄。最後完整五情境結果為 4 PASS／1 FAIL；前次成功樣本與單項診斷不能覆蓋整輪失敗。

## 已確認的觀察

- Chromium 154.0.8037.57，Linux／2 CPU quota／8GiB，真正 production JS、native SW／CacheStorage／IndexedDB。僅 localhost 合成戰役。
- 前版是 PR58 `c370ff8…`／0.30.99；目標 PR59 `8d40f63…`／0.31.4。兩者由各自 source 與真實 Release Metadata 建置。
- 更新前有一筆正式已提交改名命令；初次下載回 503 時，頁面安全拒絕啟用，原 Ack 可查。
- 恢復服務並按實際更新重試後，觀察到 **durable-save-ack → SKIP_WAITING**；未觀察到 controllerchange 或導航。
- 約既有 15 秒 activation 預算後，UI 顯示「遊戲進度已成功保存（本次保存已確認）；新版啟用等待逾時，目前頁面保留，更新未完成；可安全重試。」
- 外層原 30 秒 navigation 觀察以 TIMEOUT 結束，`data-update-phase=failed`。保存成功與更新失敗分開呈現；沒有宣稱新版已載入。

最後一輪時間戳（UTC epoch ms）：

| 事件 | at |
|---|---:|
| release-probe | 1793722674781 |
| save-request | 1793722674783 |
| durable-save-ack | 1793722674904 |
| SKIP_WAITING | 1793722674904 |
| controller identity fallback probe | 1793722674911 |

完整結果：[production-sw.json](evidence/production-sw.json)。同一完整五情境中，正常更新＋離線重開、安裝失敗後重試、保存失敗不啟用、T1 後關頁再開等其他四項 PASS。

## 最小操作與重現命令

1. 在隔離 Origin 安裝前版，載入合成戰役，提交合法命令並保存原 CommandId／Ack。
2. 提供後版 version.json，但 SW 腳本暫回 503；按更新，確認失敗且仍保留舊頁及原結果。
3. 恢復後版 SW 與全部實際 assets；檢查更新，再按保存並更新。
4. 記錄 durable save、候選 release identity、SKIP_WAITING、registration waiting／active 狀態、controllerchange 及實際 UI 版本。失敗若出現，保存完整時序，不能清資料或改 timeout 來代替。

Cloud 中從 repo root、已安裝 npm dependencies／Playwright／Chromium 的環境：

```sh
node docs/validation/b10-final/prepare-production.mjs /workspace/b10-final-production
node docs/validation/b10-final/production-server.mjs /workspace/b10-final-production
```

在另一個 shell 執行原完整五情境：

```sh
node docs/validation/b10-final/production-sw.mjs /workspace/b10-final-production
```

問題有間歇性，須保留完整前序與初次故障；單項診斷可用 `B10_SW_ONLY=offline-sw` 與獨立 `B10_SW_OUT`，但不能當完整 Gate PASS。每步 30000ms、產品 activation 15000ms／download 30000ms 等保持原值；沒有擴充數量或刪除失敗情境。

## 根因定位與後續

已定位到 `useAppUpdate.ts:activateWaiting` 及原生 SW 啟用／接管邊界：保存、候選身份確認、發送啟用訊息均已完成，當前 controller 尚未被確認為目標版本，程式依既有界限安全停止。**Chromium 原生 activation／claim／cache 時序的確切根因尚未證實**，本輪沒有足夠證據把它歸因於特定 cache 或擅改程式。

下一次應在隔離 Origin 捕捉 active／waiting／installing 的 statechange、各 Worker 自身 GET_APP_RELEASE 回覆、controller identity 及 CacheStorage activation 工作；在 Chrome 與實體 Android 重現後，才提出最小補修。保留 durable-save-before-activation 與錯誤版本拒絕，不能 unregister、清除玩家資料、延長 Gate 或略過身份核對來取得綠燈。

本輪未觀察到資料損毀、錯誤 campaign 或重複效果，分類為 **P1 更新可靠性／發布條件**；不把此結論解讀成 Production Release Gate 完成。
