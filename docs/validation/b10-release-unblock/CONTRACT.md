> **最終封版狀態更新（2026-11-10）：** [最新驗收與合併策略](final-seal/RESULTS.md)。SW已有30/30後續證據，B9記憶體結案；使用者取消部署護欄要求，Android安排合併後且不阻擋單人技術合併。以下歷史量測與失敗保留，不作當前MERGE HOLD判定。

# B10 Release Unblock — 正式新契約／整批 P0 BLOCKED

本文件記錄使用者本批正式授權的新資料契約，取代 R3-03 的永久原始命令追溯要求。歷史規格及舊交付證據不改寫。持久化契約已有正式接線與原生故障驗證；整批仍因間歇性 SW 啟用停滯 P0 BLOCKED，不是合併或發布放行。

## 持久資料

- DB：`lieguo-formal-bounded-v1`，Dexie Schema 1；正式世界 Schema 4。
- Portable Save：`lieguo-formal-bounded-save-v1`。
- 舊 DB（含 `lieguo-formal-ledger-v1`）僅辨識並提示不相容，不升版、不轉換、不刪除。建立新戰役只寫新 namespace。
- 保留目前世界、兩個可驗證 Checkpoint、必要戰報、未完成 Inbox、近期結果及防重播水位。正式世界及 Scheduler、RNG、規則版本維持原語意。Authority 對完整自身內容有 checksum，明確綁定 world checksum／savedAt，以及兩個 Checkpoint 的 ID／時點／root／checksum；普通清理讀取這些小型引用。匯出不會默默略過遺失的已引用回復點。新舊 DB 版本共用原有 `lieguo-formal-ledger-v1-writer` Web Lock，避免兩個版本分頁同時執行。
- 近期窗口：每戰役最多 1,024 筆玩家結果及 1,024 筆自動結果；分開計數，避免 99 AI 補算立即擠出玩家 Ack。另保留最近四個戰役的查詢 head，以及兩個 Checkpoint 實際引用的版本。數量窗口不承諾最短保存天數；未完成操作不受此上限淘汰。
- 超過窗口只保證舊身份不能重新執行，不承諾原始 Ack 永久可查。UI 顯示結果窗口結束，保留核對目前世界及原操作後明確建立新命令的入口，不能回覆虛構成功或失敗。

## T1 與防重播

資料庫持有UUID 128-bit 編碼的 incarnation（122 個隨機位元）；這個接收端身份不由 Quick／Full／Recovery 還原。每次取得 writer 或切換 branch 都關閉前一個 intake epoch。命令 ID 直接編碼 incarnation、writer、branch 與序號，不能把舊 UUID 加上新標籤來重新送出。

在同一交易中：先查既有持久 Inbox／近期結果並驗證 issuer、fingerprint；未找到時，要求當前 epoch 且序號嚴格大於 acceptedThrough，原子保存新水位與 Inbox。序號缺口可存在；尚未接收的較小序號往後安全拒絕，不會曾被宣稱 Durable。RuntimeMeta 整體（含水位、戰役路由、writer／branch）有 checksum，另檢查 writer／branch 一致性，寫入時使用既有 writer fencing。

既有 Pending／Retryable 在 fence 檢查前精確命中，故 Worker 重啟不會使已 Durable 操作失效。未知舊 epoch／舊水位身份只能安全拒絕。匯入到新裝置沿用接收端 incarnation，舊裝置延遲封包不能變成新操作。

## T2／T3 與清理

世界、Authority、Inbox 正式結果、近期收據／結果根、精確近期索引、Checkpoint／戰報及清理在同一原子交易中提交。保留中的 Original Result 不可改寫；Recovery 的 applied／rolled-back 是分支 disposition，與原始 Ack 分開。若目標快照已清理某個較舊結果，且無法從版本證明它在快照之後執行，該結果退休，不捏造 rolled-back。

清理只刪除已終局且已退出近期窗口的 Inbox 及索引，不刪 Pending／Retryable。從 active heads 與兩個 Checkpoint 根做 reachability 清理，不保留無限舊 Manifest／Segment。T3 可以重查近期原結果，不能修改 T2 世界效果。

## 領域來源

`commandFacts` 明確保存治理 ABA stamp、已生效效果計數、玩家操作版本與依世界實體引用所需的最小來源事實。最小來源不保存原始 Ack、完整 order envelope、fingerprint 或不需使用的玩家參數。工作完成且無任何世界實體引用後，來源事實可回收。

撤退來源保留每勢力的第一筆及字典序最小來源，分別維持一般追加與 Recovery 排序後的原有選擇語意。80 項任務領獎的來源跟隨不可逆的領域 claimed 狀態；Recovery 不會再發一次獎勵。已知戰役的最小領獎證據與實驗室一次性領域標記，不隨四個近期戰役 head 一起刪除；其成長取決於實際戰役／任務數，不是每筆命令。

兩個 Checkpoint 只保留「當時仍待處理的事件（含戰鬥／移動鏈）所產生、後來已執行的自動命令」的有限 replay reservation，避免回復舊排程後重做已撤銷身份。事件被處理後即移除；不是永久 AI 操作流水帳。正式 AI 決策與事件順序不變。領域驗證維持單次建立精確索引；最小來源重建 Canonical 文字使用最多 4,096 筆衍生快取，每次逐欄比對實際完整來源，持有自有凍結副本，不以 Revision／物件引用代替驗證，也不作任何命令去重或權威判定。

## 驗收狀態

正式持久化 0～150k 原生往返、14 原子故障點、50 FIFO、真 Worker terminate、1,025 次實際 T1/T2 後退休身份的重啟／Recovery／匯入均通過。後者額外發現並修正舊 portable terminal Inbox 在收據已退休後被復活的不一致；失敗與精確回歸保留。新舊 DB 同 origin 升級、雙 client、真正新戰役及重載也已驗證，舊版更新前保存完成後，新版建立／重載未再改舊 DB checksum。

第一輪完整隔離為 2,402 PASS／50 FAIL／12 SKIP，另有套件錯誤，保留原結果。修正 source `72e0e45` 的 GitHub CI 為 2,473 PASS／0 FAIL／1 SKIP；最終本機完整隔離、實機與完整回歸狀態另見主報告，不以該 CI 替代。原始測試期限、2 workers 與所有歷史反竄改 Gate 保留。

SW 後繼五組第一輪曾 5/5，但後續 4/5，獨立正常／Install Reject 重複也各出現一次 activation timeout。移除 waitUntil 的對照無效且已 revert；故不能宣稱修好或選綠燈。詳見 SERVICE-WORKER.md。Android NOT TESTED；main 未安裝兩個先行 workflow 護欄、未合併、未部署。最終狀態維持 P0 BLOCKED／MERGE HOLD／PRODUCTION RELEASE HOLD。

## 既有測試契約替代記錄（持續補齊）

- `durableCommands.test.ts` 的 30k／60k 及 `ledgerFormalR303.test.ts` 的 0／1k／10k／30k／60k：保留同樣輸入量、正式 T1／T2、去重、往返及 Recovery；永久筆數斷言改為精確窗口筆數，另驗證全部輸入身份不是精確保留就是被 fence 拒絕，並實際重送已清理身份。世界資源、城市、勢力、事件、時間及 seed 另外對照。
- `persistence.test.ts` 的 150k：仍建立及驗證 150,000 筆合法收據，仍做 start、Quick 往返及 Recovery，保留原 `120000ms`。不再要求每個階段永久攜帶 150k 詳細資料；改驗精確近期內容、固定容量、原始 150k 輸入未改動、正式世界一致、舊身份重送無任何交易效果。不是把負載數量降成 1,024。
- 測試用舊的可讀命令標籤，在調用真正 T1 前由 `durableIdentityTestSupport.ts` 明確組裝為 writer 通知所授予的 epoch／序號。這不是產品的舊 ID 相容層；產品 T1 拒絕未編碼或已關閉的身份。既有 Payload、Revision、意圖、故障及存檔原子性斷言保留。
- 歷史候選 AVL／永久 Ledger 測試仍作為原始交付證據存在，但不當成新持久模型的正式通過證明。新模型由 `boundedPersistence.test.ts`／`replayFence.test.ts` 及更新後的正式流程測試負責。

- `campaignTime`／`playerFeedback` 的測試時鐘：原先只覆寫 world row.at，現在此欄位與 Authority／Recovery 引用共同校驗，孤立修改會正確觸發 Recovery。替代測試在建立正式快照前注入 Date.now，保留相同離線時間、故障及不重複補算斷言，不繞過正式 checksum。
- `schema` 的缺失來源測項：舊版只刪 CommandReceipt；新版的權威證據為最小領域來源，因此同時移除該來源，仍須拒絕缺乏付款／研究證據。新 Schema 額外檢查治理 ABA 與撤退來源身份綁定。
- `ProjectionTestBridge`／`scenarioWorld` 在各自完整 Schema、Root、結果與唯一性驗證後，比較同一有界近期窗口及全部玩法欄位；raw 工程 fixture 的額外已完成詳細歷史是本批明確取消的格式契約，不當作玩法差異。
- 三個部署隔離測試移至 `scripts/test-deployment-isolation.mjs` 由 CI 直接執行，因原有隔離 runner 明確不複製 `.github`；原 runner 不改動。測試解析實際 workflow，涵蓋 GitHub 字串比較不分大小寫與 shell 精確字串守門，不用替身 workflow。

最終程式 source 1f44074 的 CI 為 2,473 PASS／0 FAIL／1 SKIP；本機同 source 完整為 2,462 PASS／0 FAIL／12 SKIP，另 B9-2 hook timeout，整體 FAIL。所有本機 successor／反竄改、31 世界、Preview／Projection boundary 另為 PASS。細項與精確版本見 SOURCE.md，不混寫成全綠。
