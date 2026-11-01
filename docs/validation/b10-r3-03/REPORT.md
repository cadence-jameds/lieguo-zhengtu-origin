# B10-R3-03 — BLOCKED：未啟用的帳本候選

本批**尚未完成權威命令歷史與熱世界的分離**。僅交付可審查的依賴盤點、不可變 receipt 候選、精確索引、合成交易實驗及阻擋原因重現。正式 Runtime、DB v2、Schema、Reducer、Scheduler、WorldStream、saveCodec、Inbox、Preview Worker 均維持 PR55 原碼；沒有正式 Migration，也沒有新增可玩的功能或 Release Note。

依使用者第十五節的安全出口保留 Draft／BLOCKED：安全遷移所需的「原始結果、分支狀態、已驗證快照與可攜命令證據」契約尚未接線。測試綠燈代表候選與既有回歸通過，不代表 R3-03 的正式啟用 Gate 通過。

## 版本與範圍

- 起點：未合併 Draft PR55，`4e56b69d1af107ee454213d0276f06a2ca10976f`。
- Base：`feat/b10-r3-02-async-construction-preview`。
- Branch：`feat/b10-r3-03-command-ledger`。交付 HEAD 與 CI 見 PR／交付回覆，避免文件自我雜湊循環。
- PR54 保留 `edca2f29805f0cdc4b0f89cd3cd00a8f9a819e39`，PR55 保留上述 HEAD；不合併、不部署、不開始 R3-04。
- [完整引用盤點與契約](DEPENDENCIES.md)、[最小解決方案](ACTIVATION-CONTRACT.md)、[量測原始摘要](candidate-benchmark.json)、[原生 Chromium 摘要](native-candidate.json)。沒有私人存檔或原始 trace。

## 候選資料流與資料格式

`receipts → prepareLedger(已驗證舊版本) → 新 segments + Manifest + 持續 AVL index → verifyLedger → 合成發布交易`。

`scripts/command-ledger-candidate.mjs` 是獨立實驗，正式遊戲沒有匯入。身份鍵為 CampaignId＋CommandId，Branch 不參與唯一性；issuer、fingerprint、原 committedRevision 衝突拒絕。純記憶體精確索引採 persistent AVL，追加只複製搜尋路徑，舊節點／區段不變。Archive 驗證從完整區段重建索引，不能僅信任記憶體 WeakMap。

格式為 `command-ledger-candidate-v1`，非正式存檔版本。Manifest 包含 campaign、ledgerVersion、worldRevision、branch、writerEpoch、唯一 recordCount、eventCount、segmentCount、lastSegmentHash、SHA-256 checksum。區段以連續序號、firstOrdinal、previousHash 串接，保存 identity／disposition 事件。Manifest 指向確定的前綴集合；缺段、亂序、跨 campaign、校驗或數量不符即拒絕。此處 checksum 提供完整性檢查，並非防偽簽章。

每段最多 128 事件，canonical 事件資料目標 256KiB；單筆超大 fingerprint 必須獨立成段保留，不裁切。此數字是候選工程界線，尚未校準正式 IDB 長交易／裝置容量。每次追加仍複製 O(segments) 的區段參照陣列；不是完全常數成本。

候選目前只承載既有五欄 receipt；**沒有完整 original rejected／needs-confirmation outcome schema，也沒有 FormalWorld 的權威 root 綁定**。`assertFormalActivationSupported()` 永遠拋出 BLOCKED。合成 DB 只允許 `synthetic-ledger-r303-` 名稱，不能開正式資料庫。

## 原子性、Recovery 與故障證據的邊界

合成交易同時保存 delta segments、精確身份表、版本 Manifest、合成 marker、head。Marker 明確是 `synthetic-test-marker-not-a-world`，不含世界、Authority、Inbox、戰報或 AI；**不是正式 T2 接線證據**。沒有交易外預寫區段，abort 不留下孤兒。

SHA-256 在交易外完成；交易內重新讀取、精確比對已驗證來源資料，再 CAS 舊 root／版本／writer epoch 並提交。這是刻意保守的實驗：每次發布仍全量驗證、序列化比對。正式熱路徑不能照搬並宣稱 R3-05 效益。

Recovery 候選追加 disposition 事件，不改原區段；歷史 Manifest 讀取自身前綴，不使用今天的 mutable 身份表。相同 ID 無法因 branch 改變而成為新身份。此模型尚未涵蓋正式原始結果與各分支 Ack 的完整關係。

| 故障／情境 | 已驗證範圍 | 結論 |
| --- | --- | --- |
| 五寫入點 segment/index/manifest/marker/head 注入 QuotaExceededError | fake-indexeddb＋Chromium 原生 IDB | 全表 abort；marker 不是世界 |
| 成功後通知遺失、關閉重開 | 合成 DB | 查回同 ID，重發 duplicate，不新增身份 |
| 舊 root CAS／缺段／損毀／跨 campaign | 候選 | 拒絕發布／載入 |
| Recovery 後讀歷史版本 | 候選＋原生 IDB | 舊 applied、目前 rolled-back，各自保持 |
| 真實裝置配額耗盡、Runtime Worker 被終止、頁面被殺 | 新帳本未接線 | 未驗證，不以 injected DOMException 冒充 |
| 正式新 T2 世界／Authority／Inbox／帳本一致 | 未實作 | BLOCKED；既有 R3-01 T2 回歸另驗 |
| 正式 Migration 所有故障點 | 未實作 | BLOCKED；未嘗試改寫原存檔 |

開發實驗失敗也保留：第一版在 Dexie.waitFor 中巢狀讀取交易，17 項中 1 項逾時（16 PASS）；第二版 11 PASS／6 FAIL，出現 PrematureCommitError 與合成表局部提交。移除交易內外來 crypto await，改為交易外驗證、鎖內逐字比對後，17 項全通過；再補歷史版本及超大 fingerprint，共 19 項通過；交付前再補「已驗證但歷史前綴不同」的 CAS 對抗測試，總共 20 項通過。這些失敗只操作合成 DB，從未接入正式持久化。

## 必要測試矩陣

新增 `commandLedgerR303.test.ts` 20 項，0／1k／10k／30k／60k 的所有五欄逐筆 roundtrip、前綴共享、不變舊快照、重送／衝突、完整性、五故障點、重啟／CAS、歷史版本及兩項正式舊行為重現。大筆數 transport 測試使用合成 receipt；效能世界另經 `validateFormalWorld` 驗證為合法 100 勢力世界，不能混稱候選 archive 為正式新存檔。

| 使用者項目 | 本批證據／未完成事項 |
| --- | --- |
| 1～3 追加、去重、fingerprint 衝突 | 候選逐筆與衝突測試通過；正式仍使用舊 receipts |
| 4 玩家／AI 交錯 | 既有 Runtime 完整回歸；沒有新帳本整合證據 |
| 5～12 建造、訓練、出兵、科研、治理、物流、獎勵、城堡、工匠、完成事件 | 所有正式引用原碼不變；既有完整回歸覆蓋，未改讀新索引 |
| 13 拒絕 | 正式舊匯出遺漏拒絕身份重現；新 outcome schema 未實作 |
| 14 rolled-back、15 Ack 遺失 | 候選＋既有可靠性回歸；正式新格式未接線 |
| 16 任意 T2 失敗 | 五點合成原子性與既有 T2 回歸；不能等同新正式 T2 |
| 17 Worker、18 多分頁 | 既有 durableRuntime／完整回歸；候選僅 close/reopen、CAS，非真實雙分頁或新 Runtime Worker |
| 19 Recovery | 候選歷史版本及現有 FormalPersistence 矛盾狀態重現；新正式 Recovery BLOCKED |
| 20 Migration、21 新舊完整遊戲檔 roundtrip | 正式新格式未實作；候選 30k／60k archive roundtrip 不替代此 Gate |
| 22 99 AI／25X、23 滅國／復國／結束 | durableRuntime、offlineExtinctionClockWorkerDelta 及完整回歸；正式原碼不變 |
| 24 Inbox／等待 UI、25 Preview 隔離 | R3-01／02 定向與完整回歸；本批未接入任何 UI／Worker |

初輪定向共 7 檔、108 tests PASS（候選 19 項）；前綴補修後候選 20 項另重驗通過，完整最終定向結果見交付回覆。原 7 檔命令（Node24，maxWorkers=2，testTimeout=30000）：commandLedgerR303、durableCommands、durableRuntime、constructionPreviewR302、asyncConstructionPreview、constructionPreviewController、offlineExtinctionClockWorkerDelta。最終 Typecheck／Build、Node22 隔離完整回歸、精確 successor／防竄改及 CI 結果以交付回覆與 CI artifact 為準，不預先列未結束執行為 PASS。既有測試與逾時門檻完全不變。

## 效能：只有候選微基準，正式遊戲尚無改善

Linux 開發容器 Node24.19.0，30 次量測＋3 warmup，合法 100 勢力世界，history 為合法 rolled-back city.rename 收據；不是實際執行 60k 次命令。開發容器曾並行定向測試，非安靜硬體驗收。單位 ms，表內為 p50／p95。

| 歷史 | 舊陣列末筆查詢 | 候選 AVL 查詢 | 候選準備單筆追加 | 完整 archive 驗證 | archive bytes |
| --- | --- | --- | --- | --- | --- |
| 0 | .00058／.00159 | .00044／.00327 | .122／.250 | .056／.124 | 380 |
| 1k | .0161／.0406 | .00303／.00344 | .258／.605 | 14.49／19.51 | 320,550 |
| 10k | .362／.634 | .00751／.00916 | .364／3.445 | 144.61／187.67 | 3,231,931 |
| 30k | .721／1.165 | .01587／.01777 | .408／.590 | 490.87／576.32 | 9,739,180 |
| 60k | 1.190／1.688 | .01972／.02223 | .515／13.411 | 970.03／1073.93 | 19,500,082 |

候選 archive 因事件與校驗欄位更大，60k 原完整世界 JSON 18,011,883 bytes，不能宣稱空間減少。60k heapUsed 約 487MB 為整個 benchmark process（來源世界、候選、驗證複本等）瞬間值，非帳本獨占量／峰值／瀏覽器記憶體。記錄數對應區段數 0／8／79／235／469。

| A～J 量測要求 | 實際交付範圍 |
| --- | --- |
| A 身份查詢、B 追加 | 上表同環境 Node 微基準；追加不含 IDB／T2 |
| C Reducer | 原碼與完整歷史不變；未聲稱新實作數據或效益 |
| D 分段／索引寫入 | 原生正確性驗證；未量 p50/p95，不適用正式熱路徑驗收 |
| E 正常載入 | 上表完整候選 archive 驗證；非正式 load latency |
| F Migration | 未實作，BLOCKED |
| G 匯入／匯出 | 候選 transport 驗證；非新正式 quick/full save |
| H 整體 T2 | 未接線，無前後改善證據 |
| I 記憶體／大小 | JSON bytes、過程 heapUsed 見 JSON，非裝置 profile |
| J 全量掃描 | 正式所有原始成本仍在；候選發布也全量驗證／比對 |

未用 R1 舊環境絕對時間計算改善比例。原生 Chromium 154.0.8037.57 僅跑合成交易正確性 18 個檢查；不是瀏覽器效能或 Android 結果。Android 實機、真正配額耗盡、正式新 Runtime／Migration／T2、Worker 中斷與多分頁新帳本流程均待驗。

## 明確回答與剩餘風險

- 權威歷史是否分離？**否**，正式世界仍保留完整 receipts；新候選不能啟用。
- 哪些正式查詢使用新索引？**沒有**。精確索引只在候選 API／測試／benchmark 使用。
- 是否仍需全量收據？是，Schema、草稿、Authority、快照、checksum、舊 UI/Wire 等完整成本全部保留，詳盤點。
- 如何確保效果一次？正式仍靠 R3-01 Inbox／Reducer receipts／T2；候選只證明身份與合成發布去重，不能宣稱世界效果 once。
- Migration 失敗如何保護舊檔？未啟動正式 Migration、未升 DB／save format、未寫原資料，不刪任何收據或舊檔。未來方案須先保留原件、驗證所有 roots/outcomes 並原子啟用，見契約文件。
- R3-04／05 邊界？UI full-history Patch／projection 成本留 R3-04；全量編碼／驗證／持久化熱路徑留 R3-05。R3-03 的 verified snapshot／outcome／portable evidence 契約本身尚未完成，不能交給後續批次掩蓋。
- 新不相容／不可逆風險？正式格式與 DB 無變更；候選格式不相容正式 save，明確拒絕啟用。若未來接線，必須先完成 [ACTIVATION-CONTRACT](ACTIVATION-CONTRACT.md)，不能直接套用此實驗 store。

歷史 B5 E1 HOLD、Astra 未 PASS、實體手機待驗保持。沒有放寬 Gate、改寫 v95／v96／v97、覆寫 PR54／55 或進行任何部署。

## 重現入口

- 定向：`node node_modules/vitest/vitest.mjs run src/game/formal/commandLedgerR303.test.ts --maxWorkers=2 --testTimeout=30000`。
- 全套：先 stage 新測試／script，再以 Node22 執行 `node scripts/verify-in-isolation.mjs full`；不可直接在工作樹跑全套。
- 微基準：`node scripts/benchmark-command-ledger-candidate.mjs`，輸出忽略的 artifacts；沒有讀取玩家存檔。
- 原生：啟動本機 `npm run dev -- --host 127.0.0.1`，再執行 `node scripts/verify-command-ledger-candidate-browser.mjs`；`PLAYWRIGHT_MODULE`／`CHROMIUM_PATH` 可指定既有外部工具，`LAB_ORIGIN` 可指定本機 port。本次使用環境已安裝的 Playwright／Chromium，沒有新增專案依賴。頁面只載入合成實驗模組，並非正式遊戲 Worker／UI。
- 精確 Gate：`python3 -m unittest discover -s scripts -p 'test_*successor.py'`；另外沿用 CI 的 validators／clock delta／preview capability audit，沒有修改既有 Gate。

Pages 路徑檢查初次因缺少 `GITHUB_ACTIONS=true`／`GITHUB_REPOSITORY` 前置設定而拒絕執行；此結果不是 PASS。後續使用相同原碼、本機 Pages base 建置重驗，以交付結果為準，並非部署。
