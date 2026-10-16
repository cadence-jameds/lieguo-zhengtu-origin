# PR #3 R4 最小 Delta 修復報告（2026-10-16）

本報告是施工及驗證交接，**不是 Astra Independent Gate PASS**。R4 保持 HOLD，等待 GPT-6 中控安排獨立審查。歷史 HOLD／FAIL／舊報告及原始證據不改寫。B5 E1 Lv15 人工驗收依本輪玩家授權為 OWNER WAIVED，不重新要求相同人工驗收。

## 基準與範圍

- PR #3 施工起點：`7258b126a7fc33303b24a861e8ac4fd0be54a8d0`，遠端 HEAD 與交接一致；分支 `stage2-r4-integration`。
- 交接指定 main：`49d521003d83975955c2e89e0a05aaa6720e054c`（PR #11）。實際遠端 main 已由 owner 合併 PR #12，變為 `0769b778fb42bb6e95d590f5a98a16ca3aef0872`。
- 已核對兩個 main 提交之間只變更 v94 文件；PR #12 最新文件分支 HEAD 為 `7527e3968b5fe14041b66847c0dd4a57c9c6fa17`。本輪沒有合併 PR #12。
- 正式優先權：玩家本輪明確決策／已核准 PR #12 v94 補充 > 其他有效 v94 > v93 > v92 > 有效歷史規格 > source。
- 在 PR #3 開發分支整合 main，保留兩個 parent，不改寫歷史。沒有 merge PR、更新 main／release、部署 Pages、啟動 P0-C／B9／B10 或修改 PR #9。

提交前第二次遠端核對發現 main 已由 owner 合併 PR #13，成為 `76d68db5ac4da0bdd87656ded56434e564cb1877`；相對 `0769b77` **只有 v94 文件變更，source／scripts／package 無差異**。已保留最新文件 blob `3f110232ced1c5368156a13b31b894f14d249bda`。玩家另明確回覆「擴充本輪實作 PR #13 城堡新規則」，因此在 D1–D4 外新增下述 D5；沒有擴張 P0-C。最終整合 main 與 merge parent 為 `76d68db5…`。

## D1：成功征服的城市內清算

在原有成功征服的 owner-transfer transition 使用同一個 Scheduler 清算，並保留 B1 的合法受領者檢查。

1. 移除 `evacuateCraftsman()` 及其未經授權的戰後自動撤離。城內失權工匠消滅，不查找最近自有城、不建立離城事件、不配置新 EventId。
2. 城內斥候與輜重車清除；駐防及尚未出發的聯軍編組也清除其城內非戰鬥部分。混編的常規戰鬥兵／攻城器沿用原有戰鬥、返程及滅國規則。同步清除 resident army 的非戰鬥 initialUnits，防止之後輜重損失計算把已清算單位重新帶回。
3. 來源城內 preparing／ready 拓殖工程與已產生的待命單位消滅；移除相依 ready 事件，不退款、不返還 400 人口。不清除 travelling 拓殖隊、已離城工匠及 outbound／returning 部隊；正式滅國後仍交由既有 resolver 處理。
4. 外文明城堡失權工程及其升級依賴沿用已通過 M1 的取消機制：取消事件、釋放特殊空槽、不退款、不替新領主完工。普通施工與已合法完工城堡保留原處理。
5. 在既有終戰報告擷取 defender.after 之前清算，因此戰報不再把已死亡城內斥候列為生還；主戰傷亡、攻城輪次、聯軍受領及 final receipt 不另行重算。

清算以實體仍在城內及任務狀態判斷，不以 originCityId 一律刪除。已合法出發、母城被征服但勢力尚未滅亡的單位保留既有任務與 EventId。合法在途工匠到達失去所有權的目的城時，仍沿用既有 reroute 機制；本輪沒有新增跨山脈或瞬移能力。原 RISK-R4-01 的未授權自動撤離觸發路徑已移除。

## D2：水域及山脈

PR #12 v94 §1.1 明確要求「水域可通行但較慢、不可建城；山脈不可通行、不可建城；河流沿用既有規則」，並要求減速數值另行核准。搜尋 v94／v93／v92 未找到有效核准倍率。

本輪先提出水域耗時為陸地 1.5 倍或 2 倍的候選值；玩家明確回覆 **「2 倍陸地時間」** 後才施工。此數值依據是本輪玩家決策，不冒稱早已存在於 v94。

- 水域每個進入格的時間成本為一般陸地 2 倍；斜向幾何距離照原規則乘 `hypot(dx,dy)`。河流／森林／一般陸地保持原成本。
- A* 使用同一加權成本；Euclidean heuristic 仍是成本下界，原 score／座標 tie-break 與禁止斜穿山脈角落的規則保留。
- `route.distance` 表示耗時等價陸地距離。軍隊 segmentTimes 與路徑成本一致，工匠／拓殖／物流的新路線由既有 route 呼叫取得加權耗時。沒有改動兵種基礎速度及 1X／10X／50X 公式。
- 新軍隊行軍快照存 optional `marchTerrainVersion: 2`，validator 對新快照核對加權時間；沒有該欄位的既有軍隊沿原陸地公式核對。舊在途路徑、segmentTimes、抵達時間、EventId 不重算。返程等後續新建立的路線適用新規則。
- 沒有變更世界地形資料、建城資格、地圖生成、schemaVersion、IndexedDB 結構或寫入原子性。舊程式對新增欄位的新存檔之向前相容不在本輪保證範圍；本輪測試的是新程式安全讀取有效舊存檔及新快照往返。

## D3：合法測試前置與 P0-C 邊界

`gateDeltaTestSupport.craftWorld()` 及 B7 外文明城堡前置改用 `{militia:4}`，仍經正式派兵、擊破流亡據點、取得工匠及返城流程。B7 persistence 的無常規戰鬥兵 setup 亦改成合法混編。原 B1 行為 assertions 與工匠取得、完工、文明衛隊生產等斷言保留。PR #13 擴充後，工匠 Lv1 原本正數扣款的斷言明確改為四資源 0；普通建堡及後續升級的正常付費另有對照。資格不繼承的 B5 測試改成先合法離城的 militia／catapult 混編，再征服留有斥候的城市，保留原資格／科技不轉讓與流亡結果斷言，同時核對城內斥候消滅。

舊 M1 中「失城後自動撤離」的 assertions 與 browser probes 明確改成新核准的消滅結果；其他 M1 授權、取消、退款、完工優先序、Save/Load／Recovery／dedupe assertions 保留並適配結果。原始測試及舊報告仍存在於原 commit／歷史證據。

**本輪沒有修復 `createExile()` 的完整 Runtime 資格，也沒有清理既有違規流亡據點。** 既有 B7 中純斥候生成／混編斥候收編等測試仍反映待修 Runtime；不能用其綠燈宣稱符合 PR #12 新資格。這些項目及原子化舊存檔相容清理依指示留待 P0-C。

## D4：PR #11 整合

main 合入 PR #3 無衝突；Git 自動合併 `politics.ts` 與 `schema.ts`。兩檔同時保留原 B1／M1 規則及 PR #11 查找／事件處理優化。沒有以較舊 source 覆蓋 replay、receipt、玩家指令版本協調或 persistence。

`runtime.worker.ts`、`persistence.ts`、`orderAdmission.ts`、`interaction.ts`、`useGame.ts`、`formal/reducer.ts`、`formal/scheduler.ts` 七個關鍵檔與整合 main **逐位元相同**。本輪 production Delta 為 `formal/{extinction,economy,terrain,routing,armies,combatModel,combatSchema,autonomy}.ts`、`developer/checks.ts` 及 `presentation/ExtinctionView.tsx`。相對無修復的純 merge tree `536050a589f9152c18244482bab4aada2fbc70d8`，精確 source 差異見 `source-delta.patch`。

## D5：玩家追加授權的 PR #13 工匠城堡

- 同文明與外文明合法工匠均可建造該工匠文明的城堡 Lv1；移除同文明拒絕條件，保留自有城市、唯一待命工匠、每城一座、前置、槽位及佇列限制。
- 資源豁免由原始已驗證 `craftsman.castle` 命令及真實待命工匠授權。普通 `building.upgrade` 無法透過 public payload flag 取得免費資格。先決定 `paidResources={food:0,wood:0,stone:0,gold:0}` 再進入既有 spend／排程，不採先扣後退。
- 正常 Lv1 工期不變（center Lv5 fixture 的 world duration 為 2,072,619 ms）；不即時完工。完工消耗綁定工匠一次，城堡文明與工匠標籤一致，不授予文明身分或外文明科技。
- 普通未用工匠建造 Lv1，以及所有 Lv2～Lv15 升級，仍使用原 `buildingCost`／工期／前置。免費只適用 `fromLevel===0` 的工匠命令。排隊的普通 Lv2 依賴仍付費，失城取消不退。
- AI 與玩家總督共用的 `economicChoices` 也回傳 0 報價，空庫存仍能依合法資格選擇免費工匠城堡；不改變 AI 決策頻率、99 agents 或候選分數／排序。工匠介面同步標示 Lv1 免四資源、正常工期及升級收費。
- 新免費工程直接保存既有 paidResources 的零值，取消退款自然為零，取消後解除同一工匠綁定；失城依 D1 消滅工匠／取消工程。征服者即使與工匠同文明，也不繼承原勢力授權。
- 不追溯改寫已付款舊工程的歷史快照；舊 paidResources、工期與既有取消退款保持原樣。新程式讀取舊工程、full import、Recovery、寫入故障回滾與 CommandId rolled-back／duplicate 均有回歸。

## 驗證與證據

詳細機器結果見 [本輪證據目錄](../validation/r4-minimal-delta-2026-10-16)。以下數字以最終 summary 為準，施工中失敗另保留，不覆寫成 PASS。

- 修復前、合法 fixture 的 14 項新規則 probes：**3 PASS／11 FAIL**，含自動撤離 `No traversable route`、待命拓殖殘留、城內斥候存活與水域不通。
- D1–D4 修復後專項：**47 PASS／0 FAIL**，含原 27 項 B1／M1 及 20 項新 Delta cases。涵蓋玩家／AI、存讀檔、full import、Recovery、重複命令、切片、單次終戰、外文明城堡優先序、合法在途單位、1X／10X／50X 與水域軍隊快照。
- 初次完整 Regression 為 **1249 PASS／3 FAIL／1 SKIP**：開發診斷仍否定水域通行、B5 資格測試仍期待城內斥候生還，及其連帶的證據筆數失敗。修正診斷及合法在途 fixture 後，兩個檔案 **15 PASS／0 FAIL**。D1–D4 的後續完整回歸 **1252 PASS／0 FAIL／1 SKIP**，已保留 `regression-pre-d5-pass.json`。D5 修復前 15 probes 為 **5 PASS／10 FAIL**；首次修復後 **14 PASS／1 FAIL**（queued fixture 未填第二條合法 lane），補齊兩條 lane 後，D1–D5 最終相關專項 **72 PASS／0 FAIL**。D5 的三個速度 cases 各實際跑同／異文明 × 玩家／AI 四種組合；fixture exporter 在未指定輸出環境時為 conditional 輔助 case，不冒稱獨立行為驗收。首次 D5 完整回歸 **1268 PASS／1 FAIL／1 SKIP**；唯一失敗是 R4 跨批 AI 工匠建堡仍要求扣石，依 PR #13 改為庫存不變及付款四資源 0。原失敗結果保留 `full-d5-cost-assert-fail.json`；production／build／browser source 未因此更動。最終完整 Regression：**1269 PASS／0 FAIL／1 SKIP，144 files**，約 514.44 秒。原 runner、無排除、無新增 timeout 放寬；既有私人晚期 conditional SKIP 保留。Typecheck、production build、Pages 路徑檢查 PASS。詳細結果見 summary.json／regression-full.json。

### Production Chromium 與玩家命令

Chromium 154／Linux headless，實際 production bundle、Worker、原生 IndexedDB：B1、待命工匠失城、特殊城堡工程失城 **3 PASS／0 FAIL**，三者均執行重新讀取及 UI Recovery，revision 單調上升；console／pageerror／HTTP errors 為空。場景透過正式派兵與工匠命令生成；為隔離邊界，browser fixtures 的 AI 決策延後 30 天，不當作長局 AI 性能證據。

另一組 production bundle 以原真實存檔執行 **10X × 6h** 離線載入：**15,154 ms、19,730 事件、99 AI agents**。田地指令 pending／ack／畫面佇列分別約 **6.8／1099.2／1183.9 ms**；建築約 **12.5／1960.9／2049.0 ms**。兩者都先完成包含 saves／backups／BattleReports 的原生 readwrite transaction，再送 committed acknowledgement；snapshot receipt 與 authority receipt 一致。

同一 CommandId 重送回覆 duplicate，目標施工／receipt／authority 各維持 1 筆。首次新增 observer 使用「全世界施工總數不變」導致失敗；活動 AI 正常推進時全世界施工由 67 減為 66，而目標指令三項計數均為 1。最終 probe 直接核對 IndexedDB 中該 CommandId；原 observer FAIL 記錄仍保留，沒有以修改遊戲來凍結 AI。

另有 **2 PASS／0 FAIL** 的 production UI 工匠案例：同文明與外文明各由真實按鈕送命令，核對原生付款快照四資源 0、正常工期與單一 receipt，重新讀取後再只移動 checkpoint 的 wall timestamp，讓原生 offline loader 執行原正常截止事件，確認城堡 Lv1／文明標籤與工匠單次消耗。這兩例未編輯 world／envelope；均保留 99 agents、errors=[]。

真實存檔 browser 僅注入固定 Date.now 及 transaction／postMessage 觀測，不修改遊戲 reducer 或保存流程；原始存檔、完整世界／資料庫、私人截圖及 raw trace 不提交。沒有實體 Android、GPU FPS 或已部署 Service Worker 升版驗收的新增聲明。

### PR #11 性能保護證據

同一 Linux／Node 環境（2 CPU quota／8 GiB），固定輸入與時鐘，未與本輪完整回歸或 browser 測試同時執行。重用未插樁的既有 P0 v2 harness；main production source 與 `b77dda6` 逐位元相同，baseline source hash `25e4fb4d93f066ee42285d3f804eea543bfd8ab54db5146bf0bef286be133ba1`。本輪編譯 source hash `81dbacbbecd1618d43a2d1e7e8863592834d2268bd6033fa52ed71e30a7a2e13`。

| 情境 | main 離線重播 | 本輪離線重播 | main／本輪事件數 |
| --- | --- | --- | --- |
| 10X × 6h，A | 16.659 s | 16.269 s | 19,569／19,730 |
| 10X × 6h，B | 16.958 s | 14.580 s | 19,569／19,730 |
| 50X × 0.1h，單次短測 | 1.532 s | 1.511 s | 1,622／1,626 |

兩次 6h 的包含讀取／重播／保存總耗時：main **17.654～18.019 s**，本輪 **15.539～17.250 s**。process peak RSS：main **432～563 MB**，本輪 **437～448 MB**；GC／樣本變異使這些數字不能直接推論普遍記憶體收益。這些已實測樣本未見實質退步；不拿歷史 17～18 秒與本次不同環境狀態直接比較，也不宣稱統計保證或所有長局性能通過。

原私人存檔含 99 筆 AI，但本來已有 29 國滅亡，即 70 個仍持城 AI；兩支分支 6h 後均為 65 個仍持城 AI。沒有減少 faction／agent 數量、降低決策頻率或跳過 AI。水域與失城規則刻意改變可行路徑及後續世界行為，因此本輪不以與舊規則的全世界 hash 或事件總數相同作為正確性主張；正確性由新規則 assertions、同規則切片／存復原及重播測試驗證。

24h、50X × 6h／24h 未在本輪新增長測，不把短測外推當作已驗證結果。完整數值與限制見 `performance.json`；D5 擴充前的測量另保留在 `performance-pre-d5.json`，不與最終 source 混用。

隔離環境說明：GitHub connector 無法以 UTF-8 取回二進位 blob，大於 1 MiB 的 contents base64 亦回空內容。35 張舊 R4 歷史 PNG 未在本機展開；其 Git tree entries／遠端 blobs 保持原 SHA。為完整執行原 `node scripts/verify-in-isolation.mjs full`，另建暫存 source checkout，複製所有 source／test／public／config，僅缺上述歷史截圖；runner 不改、測試不排除、不修改 timeout。首次執行另遇 sandbox Node spawnSync EPERM，改以環境支援的執行權限重跑。額外 D3 fixture 稽核後中止一次舊 fixture snapshot run，最終重新完整執行。詳細清單及原始失敗記錄保留。

## 最新規格符合矩陣

| 規則／範圍 | 本輪結果／證據 |
| --- | --- |
| 已滅國勢力不可取得征服城市 | 保留 B1；原單軍／聯軍／復國／final／exile tests |
| 城內待命工匠成功征服時消滅 | D1，新清算與 production browser |
| 城內斥候、輜重車、待命拓殖隊消滅 | D1，玩家／AI、preparing／ready、混編駐軍 probes |
| 終戰前已合法離城者沿用原任務 | 在途工匠／斥候／拓殖隊與既有 B1／B7 回歸 |
| 未完工外文明城堡失權取消、無退款 | 保留 M1；工程依賴／stale event／duplicate command tests |
| 同時合法完工優先於征服、已完工城堡保留 | 原 priority 5／40；SaveLoad／Recovery 回歸 |
| 水域通行、2 倍耗時、不可建城 | §1.1 + 本輪玩家明確核准；weighted A*／快照／1X／10X／50X tests |
| 山脈不可通行及建城；河流原合法通行 | 原 mountain suites + 新角落阻擋／terrain tests |
| 工匠測試前置含有效常規戰鬥兵 | 合法 fixture 修正，不改正常取得流程 |
| 同／異文明工匠 Lv1 四資源 0，正常工期 | PR #13 + 本輪明確追加授權；12 組速度／身分／文明流程及兩個真 UI browser cases |
| 普通 Lv1、Lv2～Lv15 正常成本／舊付款快照 | 正常付費對照、原表不改、legacy roundtrip／取消退款 tests |
| 免費工程取消／失城／單次消耗／存復原 | zero refund、匹配文明征服者失權、full import／Recovery／world-write fault |
| 純斥候／無常規兵 Runtime 資格與舊檔清理 | **DEFERRED P0-C；未施工、未宣稱修好** |
| 混編斥候排除／AI 同權 Runtime 資格 | **DEFERRED P0-C**；本輪 AI 同權僅指 D1 清算 |
| PR #11 replay／玩家命令／receipts／CAS／IDB | 關鍵 7 檔與 main 相同；完整回歸＋實測另附 |
| v94 五筆排程／80 任務等非本輪事項 | 不施工，不宣稱整份 v94 已落地；保留既有差異 |
| B5 E1 人工驗收 | OWNER WAIVED；歷史 HOLD 保留 |
| R4 正式 Gate | **HOLD，等待獨立審查** |

## 中控交接與 STOP

請獨立審查本輪 D1 清算的實體所在位置、D2 新／舊快照界線、同時事件、失權工程取消及 main 整合；不要把 P0-C 未施工事項或歷史 B5 HOLD 改寫為已修復／已通過。

本輪不觸發合併、部署或後續施工。施工分支更新及最終證據提交完成後 STOP，等待 GPT-6 中控安排獨立 Gate Review。
