# PR #53：離線滅國時鐘 Delta 審查

2026-11-01（Asia/Taipei）。原 PR #53 的修正與驗證；維持 Draft，未合併、部署、刪除分支或改寫歷史。

## 範圍及結論

遠端審查基準為 `889089aeb0139a18144c14990035a23075832b4d`，分支 `feat/formal-protection-extinction-rebirth`，base main 為 PR #52 merge `9e3233090b634cc38ef280525444a32d0714ae47`。先以新增測試確認失敗，再提交修正：測試提交 `9448793`，最終引擎／測試 source commit `615e8a988a27c6778173df49574dbe3e2f338d4d`。後續提交只補 Gate successor 與本目錄證據。交付 HEAD／GitHub CI 以 PR 最新提交及文末連結為準。

**風險 A 成立。** `finishOffline()` 用補算前世界的暫停狀態判斷，將已於補算途中滅國的結果轉回前景。開發者 50X／100X 的前景與離線有效倍速不同，因此透過 `retimeCombatClock()` 更動另一場尚未處理的戰鬥截止時間。正常 1X／25X 也發生凍結後模式切換，但這兩種情境有效倍速不變，未觀察到截止時間漂移。final receipt 及世界時間在原版已正確凍結；不是最後一城戰鬥重複結算。

**風險 B 未在原基準成立。** 原版完成流程強制轉回前景，codec 亦拒絕所有離線模式存檔，因此不能宣稱原版可載入凍結離線存檔後卡在離線倍速。A 的修正必須同時處理新合法狀態：完整驗證的滅國凍結快照可以保留離線模式，只有成功復國草稿才轉回前景並沿用既有 Worker 保存後重設 monotonic anchor。新增測試證明重載及大量現實時間後，50X／100X 正確恢復，第一次 tick 無跳時或重播。

## 重現與根因

使用原生 Formal 世界（100 勢力、432 據點）和現有 battlefield fixture，尋找真正可建造且未占用的相鄰土地。以正式命令啟動兩場 AI 對 AI 征服並經過實際抵達、戰鬥排程，保留一個同時刻 round 和另一個未來 round。第三支 AI 合法征服玩家最後一城；另一支 AI 行軍、兩個既有 AI 決策及 fixture marker 與失城對齊，另有 T+1 marker。沒有捏造戰鬥收據或手改戰鬥 deadline。離線目標在失城之後。

以直接 Formal 離線模式推進得到的精確凍結快照作為 oracle，對照同步／合作補算結果的世界、全部事件、戰鬥及 final receipt。原始碼修正前為 **1 PASS／12 FAIL**，不是把審查推論直接當 BUG。[修正前結果與原始失敗](before-final-result.json)、[修正前邊界快照](boundary-before.json) 保留。

受影響的四個正式模組及最小修改：

1. `offline.ts` 以補算結果的暫停狀態決定是否完成前景轉換。
2. `campaignTime.ts` 的 `setClockMode` 及直接 `retimeCombatClock` 都拒絕修改已凍結世界。既有同時刻 `at===world.time` 排除規則保留。
3. `reducer.ts` 只在合法 `player.rebirth` 已解除暫停的私有草稿中恢復前景模式。先取得 active Scheduler snapshot，再轉換，防止後續 snapshot 覆蓋合法重算。非法復國及 `player.end` 不啟動時鐘。
4. `saveCodec.ts` 只允許已由完整 Schema 驗證的凍結離線快照保存／載入；一般離線推進草稿繼續拒絕。checksum、reportChecksum、final receipt 歷史、metadata 及嚴格 Schema 完全保留。沒有放寬 Schema。

單一 authoritative Formal world、原 EventScheduler、Worker 佇列、命令優先、IndexedDB 原子保存及時鐘 anchor 均沿用。Worker、persistence、scheduler、extinction 及 Schema 原始碼未修改，沒有新增世界時鐘或平行狀態機。合法恢復邊界仍在 Worker 原子保存成功之後發布；保存失敗時丟棄草稿，不發布已恢復世界。

## 邊界前後對照

時間單位為世界毫秒；FG=foreground，OFF=offline。`#201` 為 `event:0000000000000201`，`#203` 同樣使用完整固定 ID。詳細全部事件 ID、排序與完整 final receipt 見 [before](boundary-before.json)、[after](boundary-after.json)。

|情境|輸入 world.time／前景有效倍速|Formal 失城 T／離線有效倍速|原版 finish 模式／#203 deadline|修正版凍結模式／#203 deadline|修正版成功復國模式／有效倍速／#203 deadline|
|---|---|---|---|---|---|
|正常 1X|300000／1|345000／1|FG／390000|OFF／390000|FG／1／390000|
|正常 25X|750000／25|795000／25|FG／840000|OFF／840000|FG／25／840000|
|開發者 50X（基本1X）|300000／50|345000／1|FG／570000|OFF／390000|FG／50／570000|
|開發者 100X（基本25X）|750000／100|795000／25|FG／975000|OFF／840000|FG／100／975000|

四種情境從失城、凍結、完成補算、保存／載入至成功復國，`world.time` 都是 T；凍結期間事件 ID、deadline 和排序不變。#201 保持在 T，成功復國也不重算它；未來 #203 僅於合法復國邊界套用原有戰術回合倍速換算，ID 不變。最終收據為 battle #3、resolution #3.final、失城 arrival #204，時間 T，征服結果 faction:000→faction:001，僅一筆。

復國後保留的同時刻事件按既有 Scheduler 順序：`army.arrive #205`、`combat.round #201`、`ai.decide #109`、`ai.decide #110`、`fixture.marker #206`。測試 spy 驗證實際 reducer 呼叫順序；重複相同時間推進不再執行。同時刻 `resumedAt` 合法，時間前進後依既有契約移除。

## 新增測試與驗證

本機 Node v24.19.0／npm11.9.0，已執行 `npm ci`；GitHub CI 使用原 workflow 的 Node22。本機2 CPU quota／8GiB，完整回歸一律透過 `node scripts/verify-in-isolation.mjs full`，在拋棄式工作區產生歷史測試輸出，不覆寫正式證據。

新增 **17 PASS／0 FAIL**：Formal 13 項、載入實際 Runtime Worker 模組的4項測試（mock self transport／計時來源，使用真正 FormalPersistence 與 fake-indexeddb transaction）。本輪沒有把此測試稱為真實瀏覽器或實機驗收。測試檔與 fixture 均列於 [修改清單](changed-files.txt)。

|需求|本輪實際覆蓋|
|---|---|
|T1|真實 AI 征服最後一城、其他 AI 戰鬥、同時刻及未來事件；完整 freeze snapshot／final receipt／ID／排序比對|
|T2|1X、25X、開發者50X／100X，滅國前、離線／凍結、復國後及第一次 tick 有效倍速|
|T3|同步 `advanceOffline` 與合作 `advanceOfflineCooperative` 完整世界及收據完全相同|
|T4|凍結 OFF encode/decode、真實 IDB、checksum、備份 Recovery、匯出／匯入、100／200 現實日後重載復國；非法快照繼續拒絕|
|T5|同時刻 AI、行軍、戰鬥按原 Scheduler 順序執行一次；同時刻 round 不重算，未來 round 恢復原戰術 cadence|
|T6|world-write、authority-write 故障注入；凍結及復國失敗真實 transaction rollback；Worker 不發布、不啟鐘，重試無重複 final receipt；保存等待期間 sync／snapshot 依原佇列排序|

原有 P0-C-10 **35 項本輪重跑 PASS**，與新增17合計 **52 PASS／0 FAIL**，見 [focused-result.json](focused-result.json)。不挪用 PR #53 原基準的通過數字。

相關 Formal／Worker／Persistence／Combat／Schema／Scheduler／Admission 回歸在停止其他負載後，以相同 maxWorkers=2、testTimeout=30000 與原測試內門檻單獨重跑，**429 PASS／0 FAIL**，見 [related-sequential-result.json](related-sequential-result.json)。本機完整隔離回歸亦完成 **2201 PASS／0 FAIL／1 skipped**，見 [full-sequential-result.json](full-sequential-result.json)。唯一 skip 為原有 `user late-game save remains valid after six more world hours`，沒有使用私人存檔。Typecheck、Build、PWA scope／fallback／專案路徑與 release artifacts 本輪均 PASS；逐項見 [checks.json](checks.json) 及命令 logs。

引擎／測試／精準 successor 提交 `5e95e5bd8c800e7122bf5abfdef6715f389648e3` 的 [GitHub CI #41219166259](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41219166259) 已 **PASS**：完整隔離回歸 **2201 PASS／0 FAIL／1 skipped**，Typecheck、全部原 Gate＋新 successor、美術／城市／回饋檢查、Build、PWA 專案路徑與 release artifacts 均成功。[CI 結果](github-source-ci.json) 及 [log 摘錄](attempts/github-source-ci-excerpt.txt) 保留。此 source/gate CI 不替代最後證據文件 HEAD 的 CI；交付前仍須確認最新 HEAD Verify 成功。

UI 檔案未改。本輪未重新執行桌面／320px／390px 真實瀏覽器操作；既有三尺寸證據完整保留，僅作歷史基準，不當成本輪瀏覽器驗證。原 UI 自動測試隨35項及完整回歸重跑。Android 實機仍 PENDING。

## 失敗保留與 successor

[attempts](attempts) 保留各次命令文字輸出；JSON 結果摘錄保存原始失敗訊息及完整原始報告 SHA256。被忽略的 `artifacts/` 原始報告仍留在本工作區，不提交私人資料或世界存檔。

- 原版兩次重現均為1 PASS／12 FAIL。
- 第一輪修正測試12 PASS／1 FAIL：測試誤以為偽造移除 defeat 應在 codec 草稿檢查被拒；實際嚴格 Schema 更早拒絕同時刻軍隊事件。修正測試斷言為既有 `Army movement event mismatch`，未改 Schema。下一輪17 PASS。
- 初輪 Typecheck 的 test case union 欄位型別錯誤已修正；沒有放寬 TypeScript 設定。
- 舊 P0 successor 如預期拒絕合法新 source bytes。新有限 successor 首輪產生器遇到 Git 中文路徑 quote，缺少歷史 manifest；改用 `git ls-tree -z` 完整列入中文路徑，原失敗仍保留。
- 相關回歸首輪423 PASS／6 FAIL，含 timeout 與命令受理失敗；與完整回歸及其他檢查同時執行。保留 [related-result.json](related-result.json)。原程式及測試門檻未改，單獨重跑429 PASS／0 FAIL；這些失敗在去除並行負載後未再現。本機 CPU quota 為2 cores，首輪共4個 Vitest workers 加其他檢查，不將首輪結果改寫為 PASS。
- 首輪完整回歸2190 PASS／0 assertion FAIL／12 skipped，但有1個失敗 suite：B9-2 `beforeAll` 240000ms timeout，11項未執行，加原有1項選配skip，**整輪失敗**。保留 [full-concurrent-result.json](full-concurrent-result.json)。移除並行負載、相同設定重跑2201 PASS／0 FAIL／1 skipped，沒有改測試門檻或 acceptance records。

新 [compatibility.json](compatibility.json) 固定原審查 HEAD 與 source commit 615e8a9，僅四個 production source 精確 before／after。原 predecessor、source SHA、歷史 compatibility、全部既有 P0-C-10 證據、v96／v97 主規格保持原位元組。Schema、Worker、Scheduler、PR #52 輸入／命令優先、B9 軍事／AI／經濟／科技、80征途、5佇列、地圖／據點規則均固定 invariant。舊 successor 僅加精確 delegation，CI 加入新驗證，沒有萬用 grant；三項新反竄改測試與原22項合計25項通過。美術／城市／玩家回饋檢查亦通過。

## 交付與待驗

原始碼、精準 successor、本機專項／相關／完整回歸及引擎 CI 均已通過，沒有尚未解決的可重現測試失敗。兩次負載重跑沒有更改來源或門檻；首輪失敗仍保存，不視為 PASS。

技術放行候選的交付條件包含最後證據提交的 **最新 HEAD Verify 成功**；不能只引用上面的5e95e5b。最終文件 HEAD 與實際 CI run 由交付訊息提供，亦可直接查 [PR #53 最新 Checks](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/53/checks)。本文的固定 CI 證據對應引擎／測試／Gate，後續文件提交不改這些程式位元組。

**B5 E1 HOLD；Astra Gate 不宣稱 PASS；Android PENDING。**Android Chrome／PWA 背景終止／重啟、Web Locks 多分頁、下載／載入、觸控／軟鍵盤／系統列及低記憶體仍待實機驗證。本輪自動測試不構成正式發布或實機驗收。未變動軍事平衡、科技、經濟、目標、美術、DEMO、主規格或真實玩家存檔。完成後停在原 Draft PR 等待玩家與中控審查。
