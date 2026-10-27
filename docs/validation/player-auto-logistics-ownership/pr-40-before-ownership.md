## 變更與驗證

A：市場可設定自有目的城市、各路線固定商隊、手動預留及四項共用最低保留量；一般自動出貨至少 2,000，優先整支滿載。B：帝國世界奇觀可選來源城市、配置專用商隊並啟停自動補給，正式派車扣庫存、到貨入池、返程釋放；最後資源缺口小於 2,000 可派尾車。

三種用途固定額度不互借；停用、在途調低或市場降級不召回舊商隊。沿用現有結算／返程事件及 `wonder.ship`，沒有新增輪詢事件。奇觀 24,000,000 成本、24 世界小時及 AI 出資策略未變更。設定與用途以可選欄位相容舊存檔，ACK／CAS／Recovery 核心沒有修改。

施工基準：main `f78477fc724b1c79816f7a932e0fd856f7a2ffdd`；HEAD：`5dde3530a5773ebcb3f56af4fae5febd1286aea2`；分支：`feat/player-auto-logistics`。未使用半成品分支 `feat/wonder-player-auto-supply-20261027`（`5854931b4c168738d561e292843f678eb1887642`），僅列待清理，未刪除。

## 本輪結果

- 受影響回歸：205 通過／0 失敗；補強後一般物流 10 通過／0 失敗。新命令衝突補修定向 22 通過／0 失敗，正式 AI 到貨意圖測試加強後另 1 通過。這些是獨立批次，不相加冒充同次全套結果。
- Typecheck、Production Build 及主程式／Worker 建置識別核對通過。
- 最終完整隔離回歸：2050 通過／0 失敗／1 跳過（既有私人存檔案例未提供）。先前尚未完成批次因瀏覽器發現本輪新命令意圖戳過廣而中止；修正後重凍結來源才執行本次，未把舊紀錄當成本輪 PASS。
- 修正後原生 Chromium／正式 Worker／IndexedDB：桌機 1600×1000、手機 320×568／390×844，3／3 通過、0 pageerror；15 張最終截圖。
- 實扣帳本：來源穀 20,000 經正式結算為 20,054；一般扣 2,000、奇觀扣 4,000，派車後為 14,054。最終奇觀池穀 4,010／木 8／石 6／金 5，額外 10／8／6／5 為原有 AI 真實投入。未停用 AI 取得結果。
- 99 AI 一個世界小時：無新增輪詢事件；玩家補給開／關的 AI 狀態及 AI 收據一致，耗時見證據檔。
- GitHub CI：依此 HEAD 的原生 Checks／Actions；完成後在 Conversation 記錄確切 Run URL、測試及建置結果，避免僅更新 CI 文字再次觸發完整 CI。

[完整驗證報告與 15 張截圖](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/feat/player-auto-logistics/docs/validation/player-auto-logistics/README.md) · [正式出貨帳本](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/feat/player-auto-logistics/docs/validation/player-auto-logistics/engine-trip.json) · [750 尾車／正式開工](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/feat/player-auto-logistics/docs/validation/player-auto-logistics/engine-tail.json) · [三尺寸瀏覽器帳本](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/feat/player-auto-logistics/docs/validation/player-auto-logistics/browser-final.json) · [凍結來源](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/feat/player-auto-logistics/docs/validation/player-auto-logistics/source-manifest.json)

## 已知限制與停止條件

舊檔若原有路線超額，讀取相容但停止新派車，待玩家重新分配。最低保留量約束自動物流；手動貨量仍由玩家決定。停用奇觀補給仍保留該固定額度，需明確調低才能重分配。

手機為 Chromium 尺寸模擬；iOS／Android 實機、虛擬鍵盤及 safe-area 待驗。100X 開發者批次未完整收斂，沒有宣告通過；最終三尺寸均以正式 25X 驗證。歷史 legacy art 紀錄、B5 E1 HOLD、Astra Gate 未 PASS 均保留，不宣告 Release Gate。

保持 Draft；不合併 main、不部署、不關閉 Issue。完成後 STOP，等待 GPT-6 中控審查及玩家放行。

## 玩家更新摘要

<!-- release-notes:start -->
```json
{"title":"城市自動物流與奇觀補給","notes":["可指定自動物流目的城市及固定商隊數量，並獨立預留手動商隊。","每城可分別設定穀、木、石、金最低保留量，所有自動出貨共用並保留這些庫存。","一般自動物流等待至少兩千資源，優先滿載整數支商隊。","帝國奇觀可選擇來源城市，設定專用商隊並啟用或停用自動補給。","奇觀補給透過真實商隊運送，到貨才投入工程；停用後既有商隊仍正常往返。"]}
```
<!-- release-notes:end -->
