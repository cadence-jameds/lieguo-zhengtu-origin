# B10-R3-01｜Formal Runtime 玩家命令可靠性 P0

2026-11-01（Asia/Taipei）。功能分支／Draft PR；不合併、不部署、不開始 R3-02。全部情境使用合成世界，沒有私人存檔或玩家個資。

## 基準與範圍

- 最新 main 基準：`443f170b277f71ee26a34ee3b5017687a98e01ab`（PR #53）。先以 GitHub API 核對，再 fetch 並 fast-forward 指定開發分支；未修改 main。
- 分支：`feat/b10-r3-01-durable-player-commands`。
- 固定 source／測試實作：`db6835a3927c28941855553d58782afc0199b170`。交付 HEAD 與 CI 以 Draft PR 為準。
- 正式主規格仍是 v97；v95／v96／v97 原文、Reducer、EventScheduler、遊戲 Schema／Model、AI 決策／平衡、舊收據與 Recovery 規則均保持原位元組。
- 新增一份繁中 Release Notes；不手動改 package 版號。不移植獨立命令帳本、不改 WorldStream 或建造預覽。

## 修改模組與生命週期

|模組|用途|
|---|---|
|`src/game/durableCommands.ts`|收件資料型別、原始意圖、語意重驗、有限重試與正式結果分類|
|`src/game/campaignStorage.ts`|純 writer metadata 不冒充戰役；Inbox 原操作仍按受保護資料保全／原樣匯出|
|`src/game/persistence.ts`|同一 IndexedDB 中新增 Inbox／RuntimeMeta、T1、T2 結果、writer epoch、分支終止與 Migration|
|`src/game/runtime.worker.ts`|獨立收件佇列、單一世界執行佇列、恢復／查詢、T2 合併 AI 補算與玩家命令、T3 通知|
|`src/game/useGame.ts`／`interaction.ts`|立即 Created、逐筆追蹤、原操作 session draft、30 秒查詢／恢復入口、延遲 Ack 不覆蓋新結果|
|`GameApp.tsx`／`presentation/CommandInbox.tsx`|各命令畫面可繼續操作；收件匣可查看原參數、查詢、重送未接收命令或明確重新確認|

`Created` 只是 UI／可恢復 session draft，**不是持久接收成功**。T1 交易完成才發 `commandDurable`，顯示 Durable Pending。T1 格式／issuer／儲存失敗會明確顯示未接收，原請求在記憶體及可用的 sessionStorage 中保留；不自動重送。

Inbox 保存 CampaignId、CommandId、issuer、完整原始 order／Payload、canonical fingerprint、原 Revision、意圖前提、branch、原 writer epoch、單調遞增收件 sequence、狀態、deadline、attempts、nextAttemptAt、錯誤與正式 Ack。唯一索引是 **CampaignId＋CommandId**；不同 issuer／fingerprint 不能替換既有紀錄。

世界仍只有原 Worker 一份權威。RuntimeMeta 是同交易維護的收件路由與寫入 fence，沒有模擬能力，也不取代世界／authority。Web Lock 仍由頁面獨占持有；新 Worker 取得遞增 epoch 後，舊 writer 的世界、收件、結果、重設與戰報動作會被拒絕。原 authority revision CAS 繼續在 T2 內檢查。

## T1／T2／T3 與恢復證據

|邊界|交易／行為|中斷後|
|---|---|---|
|T1|`RuntimeMeta + Inbox` 小型交易；不讀 current 世界、不編碼／掃描歷史收據|失敗沒有 Durable 宣稱；成功的 row 在 Worker 終止後仍存在|
|T2（有世界效果）|單一 `rw` 交易含 `saves + BattleReports + backups + Inbox + RuntimeMeta`；世界、玩家／AI receipts、戰報、Recovery、authority、revision、metadata 與正式 Ack 一起提交|任一寫入點失敗，所有表回到提交前；私有草稿不發布|
|T2（拒絕／重新確認／收據重建）|在同 writer／revision fence 下持久寫入 Inbox 正式結果；沒有額外世界效果|拒絕為終局；不會因查詢或重送而變成成功|
|T3|Ack、畫面 patch、戰報狀態通知；可遺失／重查|不改 T2。相同命令回覆保存的原 Ack，查詢同時重送權威完整畫面，涵蓋 Ack 與 patch 都遺失；不再次扣資源或出兵|

重新載入先取得新 epoch、沿用既有離線／Recovery 流程，再依持久 sequence 恢復 Pending。恢復會先查正式結果及權威世界 receipts，重驗原意圖，不把舊 order 覆寫成最新 Revision。執行用的新 envelope 只有在語意前提相同時才可更新 revision／admission time；原 order、座標、數量、建造目標及 fingerprint 保持不變。未支援安全重驗的舊操作保守要求玩家確認。

T1 時已被較新玩家提交跨越的舊點擊要求重新確認。在同一渲染快照下已持久受理的多筆操作，保持順序，逐筆重驗；互不衝突可提交，前序操作改變目標／佇列時顯示 Needs Confirmation。相同操作多次點擊有不同 ID，亦各有狀態。

自動重試僅限 `AbortError`／`TimeoutError`，**總計最多 3 次執行嘗試**（250／500ms 退避），且不得越過 T1 後 120 秒 deadline。Quota、未知錯誤、CAS、規則拒絕不自動重試。若連結果都無法保存，保留原 Pending，UI 明示 blocked、查詢與重新載入入口；逾時後恢復會記錄 Needs Confirmation。UI 等待 30 秒會查詢並提供恢復操作，不永久停在 spinner。

Start／Import／Restore／Reset 的世界切換及舊 Pending 終止在同一交易內；舊分支不自動執行。Recovery／Import 將已撤銷收據同步標成 rolled-back。終局 rejected、needs-confirmation 或 rolled-back 的 ID 不能再次執行；玩家明確確認會建立新 ID。

## PR #53 保護

- 凍結世界完全略過命令前補算；只有 Reducer 接受的 `player.rebirth`／`player.end` 可進入正式提交。
- 非法復國不改世界、revision、時鐘或同時刻剩餘事件。合法復國提交後才重新錨定時鐘，剩餘事件留給恢復後的正式排程。
- End 改變原復國意圖前提；舊 Pending 不可讓已結束戰役復國。沒有一般「活動勢力」過濾器攔住合法復國／結束命令。
- 未變更正式事件排序、Reducer 規則、保護時間、復國數值或 commandReceipts 保留範圍。

## 故障注入與必要回歸

|需求|證據|
|---|---|
|T1 前中斷／寫入失敗|真實 FormalPersistence rollback、Quota；UI 保留原內容與原 ID 重送；Chromium Inbox 寫入中斷|
|T1 完成、T2 前 Worker 終止|Chromium 在 T2 checksum 暫停處終止實際 Worker，原生交易中斷；新 Worker 恢復一次效果|
|T2 各寫入點|report、backup、world、authority、metadata、result 六點：Node 及原生 Chromium 中斷／有限重試；全部表一致|
|分支切換中斷|Restore／Import／Start／Reset branch-write 中斷，原世界與 Pending 都保持原狀|
|T2 成功、T3／Ack 遺失|Chromium 抑制 Ack，query／repeat 回覆完全相同原 Ack；世界效果只有一次|
|相同 ID／不同 Payload／issuer|唯一鍵、8 次重送、衝突拒絕；原 row 不可被替換|
|六類快速連續操作|合法建造、訓練、科研、物流、治理、出兵；逐筆收件／結果，前提改變需同參數的新確認 ID|
|99 AI＋25 倍速|99 決策排在同一時間，以事件邊界注入讓真實儲存 T1 在私有 replay 結束前完成（功能時序測試，不當作 Node 延遲基準）；不提前發布 T2|
|30,000／60,000 合成歷史|Node 完整保存／讀取／去重；Chromium 原生保存／收件，T1 current 世界讀取次數為 0|
|多分頁／舊 writer／CAS|原生 Web Lock 第二分頁不可取得；epoch fencing 與 revision CAS 拒絕舊寫入|
|Recovery／Import／舊存檔|既有回歸、四類分支原子終止；v1→v2 schema 升級（Node fake-indexeddb＋原生 Chromium）、不完整 v1 snapshot 的既有 Recovery 入口；世界、authority、Recovery 位元組不變|
|滅國／復國／結束|原既有 freeze／clock Delta 與新增真實儲存 Worker 案例；同時刻 remainder、非法／合法復國及舊 Pending end fence|
|QuotaExceededError|T1 未接收、T2 無假成功、無自動重試；原生 Chromium 亦驗證|
|Pending 逾時／有限重試|三次上限、120 秒 deadline、重啟後過期不執行、30 秒 UI 查詢／恢復入口|
|世界前提改變|原 Payload／Revision 保存；目標／佇列變更轉 Needs Confirmation，沒有自動換參數|

主測試：`durableCommands.test.ts`、`durableRuntime.test.ts`、`useGameInteraction.test.tsx`；既有 Worker domain labs 維持各領域的遊戲規則斷言，使用明確 T1／T2 協定 adapter。儲存原子性、Migration、CAS 與故障則使用真實 FormalPersistence；未把記憶體 mock 當成持久化證據。

## 驗證結果與保留失敗

本機與原生案例數量見 `checks.json`；最終 HEAD 的全套結果以 Draft PR 的 Verify／regression-full.json 為準。完整回歸只用 `node scripts/verify-in-isolation.mjs full`，不在已驗證工作樹直接執行全套。測試輸出的私人／完整瀏覽器 trace、dist、node_modules 與原始生成 artifacts 不提交。

- 首輪完整隔離：2188 PASS／32 FAIL／12 skipped；另有 B9-2 `beforeAll` 240 秒 timeout，使 11 項未執行。失敗主要為舊協定預期：沒有 T1 通知、同 ID 終局失敗可再執行、或重送應換成 duplicate 狀態。完整原始報告 SHA 與失敗清單保留在 `attempts.json`；不把它當作 PASS。
- 延伸既有測試時保留資源、人口、軍隊、戰報、事件、凍結與草稿不可見斷言，另加原 ID 不再執行及新確認 ID 的檢查。原「重疊操作」案例改用真實同佇列衝突；獨立合法操作由新 FIFO 案例覆蓋。
- 完整隔離重跑（source b1db6a0）：**2243 PASS／0 FAIL／1 skipped**。既有私人 late-game save 可選案例仍跳過；沒有上傳私人存檔。最後 reader 相容修正另以 22 項 Node＋4 項原生案例驗證；最終 HEAD 由 CI 再跑全部測試。
- 原生瀏覽器為 Chromium 154，Vite source、真 Dedicated Worker／IndexedDB／Web Lock。共 19 項 PASS／0 FAIL；不是 Android 實機，也不是 production Pages／正式發布驗收。
- 初期保留的失敗包含：安裝依賴互相干擾、測試 fixture 欄位／scout 單位錯誤、首次 Vite optimize 重新載入、獨立頁缺 release define、UI locator 名稱錯誤、舊協定測試及一輪 5 秒 targeted timeout。未刪除失敗或加寬專案 full Gate。

精確 successor 僅接受上述固定實作 SHA 的 25 個檔案與單一 predecessor；其餘 source、v95／v96／v97 及 PR53 歷史證據都逐檔鎖定。source anchor 的六個 Gate bootstrap 支援檔案逐一列名，舊 Gate adapter 仍驗證精確轉換，沒有目錄例外。舊紀錄與授權 predecessor 不回寫；CI 保留全部舊 Gate，再加本批反竄改測試。任何改實作 SHA、換雜湊、擴大 grant、刪歷史或改 adapter 都會拒絕。

## 可靠性與效能前後比較

|項目|main 基準|本批|
|---|---|---|
|正式執行前命令|Worker 記憶體佇列|小型 T1 Inbox＋原始意圖；重啟可恢復|
|busy 期間點擊|hook 可直接 return|每筆受理、可追蹤；切換／未就緒則明確未受理|
|Ack 遺失／終局失敗|僅已套用收據可去重；拒絕結果未保存|正式 Ack 與世界同 T2；原 ID 查回原結果|
|收件歷史成本|無 Durable T1，沒有可比較的持久收件延遲|T1 不讀／序列化整個世界；30k／60k receipts 原生量測均無 current 讀取；每組 10 筆，觀察範圍分別約 2.8–39.5ms／1.7–6.6ms|
|持續寫入|既有世界 checkpoint|每命令一次 T1、小型結果納入原 T2；正常 tick 不掃 Inbox。只有實際 draft 變更才寫 sessionStorage|

原生收件時間明細保存在 `browser-results.json`。這是單一虛擬環境、少量合成樣本及 Vite dev 觀察，**不得換算成桌面 p95 100ms／Android p95 250ms 達標**。T2 仍保存完整世界與未裁切歷史，成本隨原世界／收據量增加；R3-03 架構不在本批施工。

## 待驗與後續契約

- Android 真機：Chrome／PWA 背景與系統終止、低儲存空間、實機多分頁／Web Locks、版本更新過程、觸控與效能 p95。桌面 production bundle、跨 app 更新完整服務工作者流程亦不由 Vite 原生測試替代。
- localStorage／sessionStorage 不可用時，未達 T1 的原操作只能保留在當前頁面記憶體；UI 不會稱為 durable。若底層 storage 持續不可讀寫，原 Pending 留存，玩家須釋放空間／重新載入後查詢；沒有假成功或無限自動重試。
- 不新增本批以前已不支援的 content/ruleset 存檔轉換；現行可用的 v1 DB 與既有 Recovery 保持相容。舊版本原始備份入口保留。
- **有影響 R3-02～06 的新增契約**：DB v2 Inbox／RuntimeMeta、原 ID＋fingerprint 的終局結果、branch／epoch fence、`save(..., commandCommit)`、commandDurable／commandStatus／commandList／blocked 等 Worker 訊息與有限恢復規則。後續需向前遷移並維持 T2 原子邊界；不是建立第二套世界或獨立帳本。
- 歷史 B5 E1 仍為 HOLD；Astra Gate 不宣稱 PASS，實體手機驗收仍待驗。自動測試與 Build 不等於正式 release acceptance。
