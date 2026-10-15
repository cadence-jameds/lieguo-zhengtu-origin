# PR #3｜R4 中控複審後最小 Delta

本輪只處理 R4-C1、R4-C3、最新 main 文件整合及必要驗證。**R4 仍為 HOLD，這不是 Astra Independent Gate PASS。** B5 E1 Lv15 維持 OWNER WAIVED，不重新列為阻塞；歷史 HOLD／FAIL／證據全部保留。

## 固定基準與授權

- 受審 PR #3 起點：`a8ae8aa32f1f22421963545694c77913baa46e0f`，遠端 HEAD 已核對一致，施工分支 `stage2-r4-integration`。
- 本輪整合 main：`7c52ab738e1ed8be2416c9e9fb95db32dceb020f`。相對上一輪已整合的 `76d68db5ac4da0bdd87656ded56434e564cb1877`，僅 v94 文件一檔變更，包含 owner 已合併 PR #15 的 P0-C-7／8／9；沒有 Runtime 變更。
- D1–D5、已關閉 B1／M1 均保留，D5 工匠免費興建所屬文明城堡 Lv1 已由玩家再次確認提前納入 PR #3，本輪不移除、不退回 P0-C。
- C3 在重現及查閱 v94 §6.6、§9.8 後，未找到尚未出發常規待命兵的最終處置封口，先提出 A／B 案。玩家明確選擇 **「A：征服時消滅全部尚未出發待命部隊」** 後才修改 C3 清算，原始決策文字見證據目錄 `c3-owner-decision.json`。
- 從文件讀到的規則與本對話玩家決策分開記錄；本輪沒有自行改寫最新 v94 或提前實作 P0-C。

## R4-C1：移動中工匠目的城失守

### 修復前已驗證

正式 `craftsman.move` 命令建立行軍後，使用正式 owner-transfer 清算令原來源城及目的城失守。在靜態合成地形上，最近剩餘自有城四周被山脈封閉，較遠城可達；第二例所有剩餘自有城都被山脈隔開；第三例持有者已無城市。山脈環在出發前存在、不穿越原工匠路線，沒有用移動中的地形變更製造例外。

- 最近城不可達、較遠城可達：**FAIL，`No traversable route`**。
- 全部剩餘自有城不可達：**FAIL，`No traversable route`**。
- 已無城市：**PASS**，原滅國清算會移除工匠及事件。另直接呼叫到達 handler 測試沒有其他事件先行清算的零城市分支。

原 handler 只挑一座幾何最近城市，未處理 A* 失敗，錯誤由世界事件推進向外拋出。修復前結果保留 `before.json`，不覆寫。

### 最小修復及不變條件

`handleCraftsmanEvent()` 從原行軍路線終點開始，依幾何距離排序自有城，以 CityId 作同距離穩定次序，逐一嘗試原正式 `route()`。只有明確的 `No traversable route` 代表該候選不可達，其他異常仍向外拋出，不吞掉未知引擎錯誤。

第一個可達城市建立一段真實路線與原公式耗時；工匠在新截止前仍為在途，不瞬移、不補造出發前狀態。不可達候選不配置 EventId。全部不可達或無自有城時，移除該工匠及已消耗到達事件，不退款、不生流亡據點、不收編、不給工匠或其他獎勵。舊事件重送不再變動狀態，新路線只配置一次 EventId。

已驗證資源快照、既有工匠數、命令 receipts、流亡據點及序號分配沒有額外收益或重複資料；可達路線實際到達指定自有城。

## R4-C3：來源失守的尚未出發聯軍

### 修復前已驗證

由正式 `politics`／`joint.create` 預留 militia 10、scout 3、baggage 2，排定未來出發；另一勢力以正式 `army.dispatch` 征服來源城，抵達及成功 owner-transfer 均早於出發時刻。

- 原勢力尚有其他城市：舊 D1 清掉斥候／輜重車，但保留 militia 待命軍與原 `army.depart`，可從敵城非法出發；初始負向 **FAIL**。
- 原勢力已無城市：原 extinction resolver 會移除這支待命軍，故初始「不非法出發」assertion 為 PASS，但它會生成一個含 militia 10 的流亡據點。
- 玩家選定 A 案後，在未修改 C3 Runtime 前補上「待命軍全部消滅、不得生成流亡獎勵」assertions，兩種情境皆 **FAIL**；保留 `c3-approved-before.json`，不將原有條件式 PASS 冒稱符合新決策。

### A 案實作

成功征服同一個 owner-transfer transition 中，`clearCapturedNoncombatants()` 對仍位於來源城且未出發的 waiting army 清算全部兵力，移除軍隊、對應 movement event、攜帶工匠參照與 joint membership；空 joint 只有在無既有戰鬥參照時才移除。這個清算在既有 `resolveExtinctions()` 之前完成，所以不會把這批城內待命兵轉成流亡據點。

新增共用 `discardCapturedArmies()` 只執行刪除／清理，不返兵、不退款、不分配序號、不重算戰鬥或發獎。原 D1 對已駐防援軍的非戰鬥清算仍保留，不把它們當成尚未出發聯軍全部消滅。

`handleCombatEvent()` 的 `army.depart` 在原狀態／EventId／截止時間核對後，再核對來源城仍屬原領主且未滅國。舊存檔或殘留事件若繞過即時清算，也會使用同一刪除流程，不從敵城建立新 `army.arrive`。未掃描、轉換或清理其他 P0-C 舊存檔資料。

### 已出發、同時事件及聯軍相依

- 已合法出發者不在 waiting 清算集合；母城失守而勢力存續時保留原任務，真正滅國後則由原 resolver 處理，沒有修改流亡軍 Runtime 資格。
- 已出發 militia 3 與待命 militia 10 共存的滅國測試，只讓合法在途的 militia 3 沿原規則生成流亡據點，不額外保留／複製待命兵。
- 同時刻 `army.depart` priority 38 先於 `army.arrive` priority 40，已依法出發者不得追溯刪除。另驗證出發早於征服 1 ms、等時、晚於征服 1 ms 三個邊界，不改 Scheduler priority。
- 移除一個失城待命成員後，其他合法成員與 joint 保留；不存在殘留出發事件或憑空變更受領者。B1 與原 M1 專項繼續通過。

## main 與規格保全

main 無衝突合入，純整合 tree 為 `c2fbad31bcf851f3be9571bf065e42305a200546`。最新 v94 文件 blob 為 **`8215b2324beeed230057d3164d5fab1fbbdb644c`**，本輪保留完整原始內容，不用 PR #3 舊版覆蓋。

PR #15 的偵察戰報權限、全域來襲預警及 AI 主動打野只整合正式文件。P0-C-7／8／9 Runtime 仍未施工；既有完整流亡資格及舊檔清理仍屬後續 P0-C。完整 Regression 綠燈不代表這些新規格已落地。

以下七檔與最新 main 逐位元相同：`runtime.worker.ts`、`persistence.ts`、`orderAdmission.ts`、`interaction.ts`、`useGame.ts`、`formal/reducer.ts`、`formal/scheduler.ts`。本輪僅兩個 production source 檔變更：`formal/extinction.ts` 及 `formal/battles.ts`；精確差異、hash 與整合記錄見證據。

## 水域原始核准紀錄

先前本對話的原始決策問答（questionItemId `call_7cfc331d56494b36b7c19436b9527b14`）已逐字保存 `water-owner-decision.json`。當時提供 1.5 倍與 2 倍耗時，並說明只用於核准後新路線、舊在途截止保留；玩家原文回答：**「2 倍陸地時間」**。

這是玩家對話授權，不是自行推論的 v94 數值。原回覆未提供 timestamp，本輪不補造日期或宣稱中控已寫入規格書。水域倍率與上一輪新舊行軍快照界線保持不變，交由中控引用原文完成規格封口。

## 驗證結果

最終數字與執行狀態以 [summary.json](../validation/r4-central-review-2026-10-16/summary.json) 為準；本報告與完整回歸完成後的最終證據一併提交。

- 新增定向：**21 PASS／0 FAIL**，其中速度 cases 各實際執行三種 C1 或兩種 C3 場景，不另外虛增案例數。
- 原有相關專項：**72 PASS／0 FAIL**，包含 B1、M1、D1–D5、B7 合法工匠流程及水域快照。
- C1 最初 Recovery 額外測試曾因期待回退序號而 **6 PASS／3 FAIL**。依既有 CAS／Recovery 高水位契約，改為核對序號單調、復原 checkpoint 內容及依保留高水位重新推進的完整期望值；未改 persistence／reducer，修正後 **9 PASS／0 FAIL**。原失敗 `c1-persistence.json` 保留。
- Typecheck、production build、Pages 路徑：**PASS**，詳細 log 隨證據保存。
- 最終 production Chromium 154：**4 PASS／0 FAIL，errors=[]**，實際 Worker／原生 IndexedDB，四例均核對 99 agents、到達／清算事件、重新讀取與 Recovery revision 單調。C1 兩例、C3 勢力存續例使用實際設定 UI；C3 滅國畫面依法顯示 RebirthView、沒有設定選單，故該例透過同一正式 Worker 的 `sync/load/backups/restore` 協定驗證，不直接改資料庫、world 或 envelope。
- 首次 browser probe 因滅國後找不到設定選單為 **3 PASS／1 FAIL**；世界事件及刪除斷言已通過，失敗在 probe 的 UI 入口假設。保留 `browser-first-ui-probe-fail.json`／log；只修正獨立 browser harness，未修改產品 UI。修正後重新完整執行四例，並另保存 C1 修復後、C3 修改前的兩例結果。
- 最終完整隔離 Regression：**1290 PASS／0 FAIL／1 SKIP，145 files**，約 **513.82 秒**。既有私人晚期 conditional SKIP 保留；完整原始結果見 `regression-full.json`。本輪沒有新增長局性能 Benchmark，不能把此回歸牆鐘時間與上一輪數字直接比較成性能收益或退步。

完整隔離 runner 與 30,000 ms 全域 timeout 不變，原既有特殊 case timeout 也不放寬。與上一輪相同，35 張歷史 R4 PNG 因 connector 二進位限制未於本機展開，其遠端 tree entries／blob SHA 保留；完整測試使用所有 source／test／public／config 的暫存 checkout，再執行原隔離 runner，沒有排除測試。C1／C3 browser fixture 為合成世界，99 agents 保留，AI 決策延後 30 天以隔離邊界，不作 99 AI 長局性能主張。原私人存檔及 raw traces 不提交。

## 中控交接與剩餘風險

1. 請中控複審 C3 A 案與原始決策是否一致，再安排 Astra Independent Gate；本輪只提供施工及證據，不宣告 Gate PASS。
2. 不可達 C1 候選仍使用原 A* 逐城搜尋；本輪證明安全延續／終止，不宣稱大量不可達城的最壞成本已優化，也不開始 P0-B 事件合併。
3. 只驗證目前程式讀取有效舊狀態及新存檔；未全面清理既有違規流亡據點、未改偵察歷史誤寄或做 P0-C 相容施工。
4. 保留 B5 OWNER WAIVED 與歷史報告，不重新要求相同人工驗收。沒有新增實體手機／GPU／部署後 Service Worker 驗收聲明。

更新 PR #3 施工分支及完整證據後 STOP。禁止合併 PR、部署 Pages、更新 main／release、修改 PR #9 或開始 P0-C。
