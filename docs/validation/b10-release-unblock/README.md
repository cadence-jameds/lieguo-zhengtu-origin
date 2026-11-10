# B10 最終合併封版驗收入口

目前有效結論、精確HEAD、原始完整Gate與新CI見 [最終驗收](final-seal/RESULTS.md)。本輪只修舊格式新局及完成合併前驗證，不新增架構或效能優化。

- SW：後續原生六輪完整五情境 **30 PASS／0 FAIL**，舊啟用停滯已取得受測Chromium修復證據。原15／30秒期限及舊失敗均保留。
- 存檔瘦身：Quick 10k／60k／150k均3,034,499 bytes，Full約3,034,596 bytes；100MiB上限不變。
- B9記憶體：三組A/B加工具控制88次PASS，未見持續線性累積，4096上限與清理有效；此項正式結案，不追改單次RSS。
- 使用者2026-11-10取消main部署隔離護欄。Pages保持原main自動部署，無需workflow-only PR或718a71e／dc14401；護欄未安裝不再構成MERGE HOLD。
- Android NOT TESTED安排合併後，不阻擋單人測試階段技術合併，不能宣稱真機PASS。B5 E1 HOLD／Astra非PASS仍屬發布事項。
- 本批不合併、不轉Ready、不部署；#54～61仍Draft。後續需另取得使用者明確合併授權。

<details>
<summary>本輪以前的歷史原文（失敗與來源保留，現行狀態以前文／最終驗收為準）</summary>

# B10 Release Unblock：P0 BLOCKED

正式有界持久化、新存檔及防重播已完成接線，並通過原生 IndexedDB 故障／恢復測試。**整批尚不可授權合併 main**：Production SW 在完整與獨立重複測試中仍有啟用停滯，保存成功後 candidate 保持 installed，未在原 15 秒內接管。不能選用較早單輪 5/5 或 CI 綠燈宣稱修好。

- Draft PR：[#61](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/61)。
- Base：`validation/b10-final-integration`／PR #60 `aaaee9d3b9e16f2bad6ee8a96d1ef2902d0c4607`。
- Branch：`fix/b10-release-unblock`。最後程式／量測來源與版本見 [SOURCE.md](SOURCE.md)；最終文件 HEAD 以 PR 顯示為準。
- #54～#60 均保留原 HEAD、Base、open Draft；未修改 main、force-push、合併、轉 Ready 或部署。

## 實際資料流與版本

玩家點擊原意 → T1 Durable Inbox＋Replay Fence → 唯一 Runtime／正式 Reducer → T2 World／Authority／Inbox／近期結果／精確索引／Root／Recovery／必要戰報原子提交 → T3 近期查詢／UI Projection v2。Preview Worker 維持獨立唯讀，AI Cooperative Scheduling、事件排序、RNG 與滅國／復國規則保留。

新 DB `lieguo-formal-bounded-v1`，Dexie Schema **1**，原生 World Schema **4**，Save `lieguo-formal-bounded-save-v1`。rules／content／terrain／generator 版本未改。舊 DB（含 R3-03 ledger-v1）保留，不 Migration、不刪除、不自動覆寫，舊格式明確要求重新建立戰役。新舊 formal 版本共用原 writer Web Lock。

不再永久保留完成命令流水帳：每戰役 1,024 玩家＋1,024 自動近期結果，最近四個 campaign heads、兩個實際引用的 Recovery；Pending／Retryable 不按此容量清理。所有舊 ID 由持久 incarnation／writer／branch／接受水位拒絕重播。過期只承諾不能再執行，不承諾永久查回原 Ack，UI 不虛構結果、不自動換 ID 或改玩家參數。

必要來源改存最小正式領域事實：治理 ABA、初始文明、隊列／軍隊／科研／物流來源、已領任務、一次性標記及尚待處理事件的有限 replay reservation。沒有完整 Payload／Ack／Fingerprint 的隱藏永久副本。詳見 [CONTRACT.md](CONTRACT.md)、[引用矩陣](REFERENCE-MATRIX.md)；`Ledger*` 名稱及 store 仍重用，但正式實作是完整小窗口，未使用舊候選 AVL。

## 施工模組與正確性

| 模組 | 變更及保護 |
|---|---|
| replayFence／durableCommands／RuntimeMeta | T1 唯一身份、序號缺口、安全拒絕、writer／branch 旋轉、完整 metadata checksum |
| commandLedger／recentReceiptIndex／ledgerStore | Verified 小窗口、精確 Map／IDB 索引、不可變近期 Original Result、獨立 branch disposition、Root 完整性 |
| commandEvidence／正式業務 readers／schema | 有效世界圖的最小來源，任務權威跨 Recovery／campaign head 清理；known rolled-back 不能靠殘留 fact 重新授權 |
| persistence／saveCodec／campaignStorage／versions | 新格式、T2 同交易、兩個帶校驗回復點引用、原子清理、Quick／Full 全部必要權威資料、保留 100 MiB 上限 |
| runtime.worker／useGame／CommandInbox／retention | 每筆 Created／Durable／終局狀態，原意、FIFO、有限重試、獨立等待計時、舊 Ack 保護、過期身份的明確恢復入口 |
| World Projection／Admission readers | 使用必要領域來源，不傳歷史；保留 Projection v2、Preview generation／revision、原始點擊前提 |
| useAppUpdate／serviceWorkerRelease／Vite | 捕捉快速 redundant installer、明確 claim 生命週期與身份核對；**啟用停滯仍 BLOCKED** |
| workflows／successor／release checker | 主分支推送只驗證的可審查護欄、exact owner/ref/SHA/token dispatch；有限 hash grant、反竄改、完整原有 Gate |

逐檔 diff／前後 checksum 在 `compatibility.json`；歷史 v95／96／97 主規格、舊交付與測試期限未改。新增一份繁體中文 Release Notes，沒有手動提升 package baseline。

T1 fence／Inbox 同一交易；T2 世界、Authority、結果、索引、窗口、Head、Recovery 及清理同一 RW 交易，失敗不發布草稿。T3 不改 T2 結果。14 個原生故障點逐一比對整庫回滾，解除故障後同 ID 僅正式執行一次；Quota 是真 IDB 上的 DOMException 注入，不是假稱實體磁碟耗盡。完整矩陣見 [FAULT-MATRIX.md](FAULT-MATRIX.md)。

新增原生 **1,025 次真 T1/T2** 跨窗口案例抓到一個真實問題：Recovery 新增確認結果後，舊備份重帶已退休收據的 terminal Inbox。已修正為在同一正式交易隨該收據退休，不復活 Original Result，不改快照玩法；新增精確 Node 回歸及原生重啟／Recovery／匯入重送全部通過。原始 FAIL 留存。

## 原生容量與效能

同環境 100 勢力／99 排程 AI／25X、等價最終世界；暖 n=20、重操作與 fresh Worker 冷載入各 n=5。這不是 150k 次真命令吞吐，真正 AI 競爭另測 soak。詳細表、p50／p95、方法與 SHA 見 [PERFORMANCE.md](PERFORMANCE.md)、[measurements.json](measurements.json)。

| 累積歷史 | 舊 Quick bytes | 新 Quick bytes | 新 Full bytes |
|---:|---:|---:|---:|
| 0 | 1,664,105 | 1,654,578 | 1,654,675 |
| 1k | 2,337,358 | 2,361,559 | 2,361,656 |
| 10k | 8,395,621 | 3,034,499 | 3,034,596 |
| 60k | 42,051,151 | 3,034,499 | 3,034,596 |
| 150k | 102,522,696* | 3,034,499 | 3,034,596 |

`*` 舊 150k 正式 n20／5 renderer crash，FAIL；容量數字來自另外 n2／1 診斷，不能當完整量測 PASS。歷史另一份 150k fixture 超過 100 MiB 的證據也保留。新版無壓縮仍 60k→150k 完全等大，世界 Snapshot 513,542 bytes、兩個 Recovery rows 1,028,001 bytes、全表 JSON 4,986,781 bytes。世界內容／戰報可成長，100 MiB 安全上限未提高。

60k Recovery 舊 **4,440.9／6,403.5ms** → 新 **585.2／636.9ms**；fresh Worker 載入、Quick／Full 往返均完成。真正 GameApp 60k 導航至開啟改名並輸入：舊 **7,902.8／8,311.9ms** → 新 **2,439.8／2,451.1ms**；新版 25/25 首屏樣本 PASS。不能把 Worker 微量測當 UI／Android。

代價保留：60k T2 舊 **56.2／71.4ms**，新 **237.3／304.0ms**，拒絕 T2 亦較慢。新窗口重寫及清理是固定成本，未隨 60k→150k 歷史量線性增加；仍需後續評估，未為速度拆交易或截斷 Pending。冷啟動仍有 149ms Long Task，沒有達成所有場景 50ms 的宣稱。

獨立 n2／1 的 150k 抽樣最大 renderer RSS 舊 2,958,392→新 530,200 KiB；heap／backing／GC 的完整限制與數據另列。這是抽樣，不是瞬間峰值上界，不是 PSS，不能替代舊 n20／5 FAIL，也不能當 Android 結果。

## 十分鐘穩定性與失敗保留

真正 Production GameApp／Runtime／IDB 跑 **600,486ms** wall clock，99 AI／25X；552 次 AI 決策，每 AI 至少 4 次。6 筆 DOM 命令均 committed、最終權威效果各 1 次，695 次投影無命令歷史；第二 tab writer lock 正常。T1 從 Worker post 到 Durable 通知 n=6，p50／p95 **41.4／232.9ms**，正式 Ack **338.2／712.3ms**，不是密集 n20 校準，桌面 p95 100ms 尚未達成。

末次 main heap 約 11.36 MB，整輪 8 個 Long Task、最大 156ms。headless `bringToFront()` 後 visibility 仍 visible，**不宣稱真的 hidden／Android 背景已測**；原生 Runtime 最後明確 away barrier 後，在原頁持有的排他 lock 下讀取權威結果，沒有建立第二個 writer。

第一輪 600 秒與六筆操作完成，但檢查工具把 lab 導航進 SW 首頁 fallback，再等待自己的 writer lock，造成末段自鎖；記為 `INCOMPLETE_POST_SOAK_INSPECTION`，保留原檔。修正工具後才有上述重新完整跑十分鐘的 PASS，不拿前一輪冒充。

## SW 與合併阻塞

歷史原五組 4/5（503 activation timeout）完整保留。未改的原腳本本批 4/5（Install Reject 的 obsolete probe 等待），後繼改為更強原生 installing→redundant 證據，保留五故障條件與所有期限。後繼第一輪曾 5/5，但後續完整 4/5；正常及 Install Reject 各 6 次獨立重複均 5 PASS／1 FAIL。失敗後對同一候選診斷重送也不解除停滯。不能宣稱全部 SW Gate PASS。

移除 skipWaiting Promise 等待的實驗仍失敗，已正式 revert。新舊 DB 同 origin、雙 client 真更新、新格式新戰役及 reload 已 PASS；舊版完成經授權的更新前保存後，新版建局／重載未再改舊 DB checksum；這項 PASS 不等於更新停滯已修好。最終 `1f44074`／0.31.19 五組亦 **4 PASS／1 FAIL**（同型啟用停滯）。全部批次摘要見 [SERVICE-WORKER.md](SERVICE-WORKER.md)、[BLOCKERS.md](BLOCKERS.md)、`measurements.json`。

## 回歸與 Gate

所有原失敗保留，不以單項 PASS 覆蓋完整 Gate。150k 維持 150,000 筆／120 秒；Runtime 維持 30 秒；B9-2 hook 維持 240 秒；隔離 runner 及 2 workers 未改。

| 執行 | 真實結果 |
|---|---|
| 第一輪本機完整 | 2,402 PASS／50 FAIL／12 SKIP，另有套件錯誤；FAIL |
| 第一輪 CI `07f04c7` | 2,460 PASS／12 FAIL／1 SKIP；FAIL |
| CI `6795996` | 2,472 PASS／0 FAIL／1 SKIP；PASS |
| CI `72e0e45` | 2,473 PASS／0 FAIL／1 SKIP；PASS |
| CI `243f68a` | 2,462 PASS／0 FAIL／12 SKIP，B9-2 240 秒 hook timeout；整體 FAIL |
| 本機 `243f68a` 完整 | 同上 2,462／0／12，B9-2 240 秒 hook timeout；整體 FAIL；150k 實際 7,564ms PASS |
| 最小剪枝定向 | 44 PASS／0 FAIL，包含原 B9-2；不等於完整 Gate |
| 最終本機 `1f44074` 完整 | 2,462 PASS／0 FAIL／12 SKIP，B9-2 原 240 秒 hook timeout；整體 FAIL。150k 7,325.7ms、Runtime 9,419.5ms PASS |
| CI `1f44074` | 2,473 PASS／0 FAIL／1 SKIP，整體 PASS；與本機環境分開 |
| Typecheck／Build／Pages／Release identity | PASS，0.31.19／1f44074／content bf63a6c；本機所有 Gate 最終摘要見 SOURCE.md |

最後只移除 raw 純 Reducer replay 建立卻不用的完整引用集合掃描。raw 模式本來只選 stableSources；正式 bounded 世界及保存前仍收集完整必要引用，沒有減工作量、改玩法／斷言或放寬期限。Node 定向通過後再跑完整隔離與 CI；CI 已通過，但本機完整仍有該 hook timeout，不能宣稱已解除本機效能 Gate；此修正不影響已量測的 bounded 正式 T2／GameApp 分支。原 `243f68a` 的本機、CI FAIL 仍留存。

31 世界對照使用**完整不可變 PR #60 module graph**與目前 source，對照事件、命令、RNG、全部玩法欄位、戰報及 Ack；只排除正式取消的 transport layout，且每筆保留收據與 reference 相等。沒有用三個舊檔混接新依賴假扮舊引擎。本機完整 successor／防竄改、Preview／Projection boundary、部署 3 項保護均 PASS，31/31 世界對照 PASS；CI 與本機分開記錄，環境及 artifact checksum 見摘要。

## 部署隔離、Android 與交付判定

main **仍未安裝**護欄，不能直接開始合併。先由使用者另行授權安裝 workflow-only `718a71e`＋`dc14401`，核對 push main 只完整驗證／建置／上傳 artifact、不 deploy；再依 #54→55→56→57→58→59→60→61 的祖先順序整合。detached 模擬無衝突，strict metadata 為 0.30.82；合成 SHA 不是實際 main，與開發分支 first-parent 預覽版不同。詳見 [MERGE-AND-DEPLOY.md](MERGE-AND-DEPLOY.md)。本批沒有建立額外 PR 或修改 main／部署。

日後發布僅指定 owner、exact main、完整匹配 SHA 與 exact PUBLISH_B10 的手動 dispatch；GitHub expression 的 case-insensitive 比對另由 shell exact guards 補上。沒有假稱 Environment 人工 approval 已配置。Android **NOT TESTED**，安全隔離流程見 [ANDROID-ISOLATED.md](ANDROID-ISOLATED.md)。B5 E1 HOLD、Astra 非 PASS 及既有手機待驗狀態保留。

## 九項答案

1. **停止永久完整命令歷史：是。** 正式窗口與 reachability 清理已接線，150k 詳細結果縮至最多 2,048；必要領域來源另存，不是隱藏流水帳。
2. **60k／150k 存檔：** 兩者 Quick 3,034,499 bytes、Full 3,034,596 bytes，這份無戰報等價 fixture 實測。
3. **匯出／匯入／Recovery：** 新版每組五輪正式原生往返通過，含 Pending、近期拒絕身份、回復點與失敗原子保留。
4. **舊 ID 意外重執行：** 已測安全拒絕，含 1,025 真提交後淘汰、重啟、Recovery、Import、序號缺口與 writer fencing；不承諾永久原 Ack。
5. **T1／T2：** 原生 14 故障點及重試／Ack 遺失／FIFO 通過，最終完整 Gate 的狀態另列，不把定向當整批 PASS。
6. **SW 五組全部 PASS：不能宣稱。** 曾有完整 5/5，重複仍有真實啟用 FAIL，尚未解除 Gate。
7. **main 部署已隔離：尚未。** 可審查 workflow、exact guard 測試與先行提交已備妥，main 未安裝，無假稱配置完成。
8. **合併順序：** 兩個 workflow 護欄先行，再 #54→#55→#56→#57→#58→#59→#60→#61；仍須技術審核與明確授權。
9. **正式授權合併：不可。** P0 BLOCKED／MERGE HOLD；不是 READY FOR TECHNICAL MERGE。Production Release HOLD，Android 另為 NOT TESTED。

原始私人存檔、trace、ZIP、dist、node_modules、大型 runner artifact 未提交；僅合成方法、摘要與可重現工具。沒有開始 B11、R3-07 或其他玩法施工。

</details>
