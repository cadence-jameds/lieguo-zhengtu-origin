# B10-R3-03 正式帳本交付（新版格式）

本報告接續 `c5683f5` 候選，依 2026-11-02 使用者決議取消舊存檔相容。舊 REPORT、候選、失敗與 BLOCKED 紀錄保持原樣；它們不是這批正式實作的結果。

Base：`feat/b10-r3-02-async-construction-preview`／`4e56b69d1af107ee454213d0276f06a2ca10976f`。只更新 Draft PR56；PR54／55、main、部署與 R3-04 不在施工範圍。

## 資料流與原子性

- `formal/commandLedger.ts`：引用已驗證的 persistent AVL／不可變收據區段核心，新增不可變原始結果索引、版本化 Manifest、branch disposition、順序前綴及 Verified Snapshot。世界只帶版本 anchor 與當批增量；`commandReceipts` 是不可列舉唯讀 reader，JSON／structuredClone／正式存檔不攜完整歷史。
- `ledgerStore.ts`：不可變收據／結果區段、精確 CampaignId＋CommandId 派生索引、Manifest、head。使用複合主鍵範圍；普通追加只寫增量，重匯入略過不變索引。
- `persistence.ts`：真正的 DB T2 同時提交世界／checksum、Authority／revision、Inbox 結果、Ledger、Manifest／head、戰報與 Recovery 引用。沒有 synthetic marker 代替世界，也沒有交易外先發布區段。
- 無世界效果的 rejected／needs-confirmation 亦有 T2，更新世界帳本引用、Authority 與 Inbox，但不增加遊戲 revision、不改世界時間錨點。T3 通知與顯示快取失敗不撤回 T2。
- 原始 committed／rejected／needs-confirmation 不可覆寫；rolled-back 是某個分支的投影，duplicate 是重送查詢。Recovery、Import、Reset 均保留 canonical 身份；舊 Pending 終局化，不跨分支執行。
- 任意直接持久化的草稿也不能讓 rejected 身份增加成功收據。同 ID 不同 issuer／fingerprint 明確拒絕，AI/T1 碰撞保留玩家 envelope 的衝突拒絕，不能借用 AI 的成功 Ack。

詳細契約見 [CONTRACT](CONTRACT.md)。既有引用盤點保留於 [DEPENDENCIES](../DEPENDENCIES.md)，以下是正式接線：

| 依賴 | 新讀取／驗證契約 | 保留語意 |
|---|---|---|
| Reducer 去重、clone／replay | 已驗證版本的精確 AVL＋私有增量 | 原 ID、原結果、純草稿；不複製完整歷史 |
| Schema、科技／任務付款、現代化／奇觀來源 | `findReceipt`／`receiptIndex`／完整 reader | 完整來源證據與所有原斷言 |
| 建造、工匠、城堡、軍事、物流 | 來源 reader 與既有遊戲處理器 | 費用、資格、事件排序不變 |
| 治理與滅國第一筆來源 | 版本綁定的完整順序 reader | 普通追加順序；分支切換沿用原 Persistence 的排序前綴 |
| R3-02 Preview Worker | 原精簡唯讀上下文、共用建造規則 | 無 DB／Inbox／Authority 寫入；不與 Runtime AI 佇列共用 |
| UI／WorldStream | T3 明確 materialized 完整投影 | 仍有完整 UI 歷史投影成本，留 R3-04 |
| 儲存與 Recovery | World checksum＋Authority＋精確 Manifest root＋epoch／revision | 不能用目前 head 冒充歷史證明 |

## 新格式與舊資料

DB namespace：`lieguo-formal-ledger-v1`；IndexedDB schema：3；StorageMeta：`formal-command-ledger-v1`；Ledger／Manifest：format 1；Save：`lieguo-formal-ledger-save-v1`。這些是資料格式版本，沒有提升遊戲規則 metadata 或 v97 主規格。

Quick／Full 都帶完整命令身份與原始結果（包含 rejected）、去重區段、Inbox、永久成長事實及 Recovery 引用。Full 另帶戰報。Bundle 依 hash 去重共用區段，世界與可攜證據各有 checksum；匯入前驗證所有引用，循環／無界區段數立即拒絕。100 MiB 上限同時套用匯出與匯入，避免產生無法接續的成功檔案。

舊 time2／schema1 DB 保持獨立唯讀，舊 quick/full 明確拒絕並提示重新建立戰役。不做 Migration、Inbox 回填或 Recovery 猜測，不自動覆寫舊空間。偵測到不可證明完整命令歷史的損毀 active Ledger 時，保留原資料並停止載入；不能自動退回少了身份的舊點。**同 DB 的損毀 immutable 區段尚無自動修復入口**；良好新版完整備份可匯入全新 namespace／獨立驗證 DB，原損毀 DB 應保全。

## 故障與相容性證據

| 測項 | 證據 |
|---|---|
| T1 失敗／Worker 終止、Ack 遺失、重送、payload 衝突 | 保留 R3-01 定向測試；原生 Worker T1→終止→重啟→正式結果查詢 |
| T2 有效果 11 點 | report、backup、world、authority、metadata、result、ledger segment／result／index／manifest／head：每點失敗後全部表不變，Pending 保留；重試效果一次 |
| T2 無效果 7 點 | world、authority、result、ledger result／index／manifest／head：每點完整回滾；後續拒絕結果可查 |
| 原始結果／分支狀態 | Recovery 舊 ID rolled-back；原始成功不變；匯入 applied 快照後 Inbox 回復 committed；拒絕身份隨 Quick 匯入 |
| AI／玩家碰撞與直接草稿繞過 | 不借用其他身份的成功結果；拒絕身份不能新增世界收據；caller mutation 不改持久原 Order |
| 多分頁／CAS | 真實同 context 雙頁 Web Lock 排他、交接及舊 writer epoch 拒絕；既有交易內 revision CAS 測試 |
| 0／1k／10k／30k／60k | 合法 100 勢力世界：逐筆身份／五欄收據、新 quick/full、Recovery、相同目標 Reducer 對照 |
| 損毀／版本 | 原生及定向 Manifest／區段／綁定拒絕；舊資料明確不相容，原表保留 |
| R3-01／02、PR53 | 定向 Worker 26 PASS，含六類快速操作、99 AI／25X、有限重試、滅國／復國／終局；另有 Preview 規則／協定／React 定向通過項目 |
| 原生 99 AI／25X | T1 於私有 catch-up 完成前持久化；獨立 Preview Worker 故障注入停滯後於 T1 終止，正式 field upgrade 保留一次效果，99 個 AI 都完成決策 |

[原生最終結果](native-final.json) 為 Chromium 154、實際 IndexedDB／Dedicated Workers，6 組正式流程；QuotaExceededError 為注入，沒有宣稱真實磁碟耗盡。舊 R3-02 原生 React harness 的本次重跑因 setup navigation 30 秒逾時未完成，不算通過；本批以無 React setup 的原生正式流程證明 Worker／IDB，React 互動由定向與完整回歸檢驗。

## 效能（毫秒，p50／p95）

[原生數據](native-perf.json)：同一桌面 Linux 容器 Chromium，100 勢力、25X，每種歷史 5 個慢操作樣本，p95 即最大值；start 僅 n=1。偶有 successor Gate 背景活動，不能當硬體校準。原生計時取 `a741ed4` 正式實作；後續只補身份矛盾／循環拒絕及 harness，不能冒稱是最終 HEAD 的逐項重測。不是 R1-C 同環境基準，不換算精確改善比例，也不是 Android 結果。

| 歷史 | 同版陣列參考 Reducer | 帳本 Reducer | T1 | 正式 T2 | 載入 | Quick 匯出／匯入 | Full 匯出／匯入 | Recovery |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 11.5/13.1 | 10.7/18.5 | 8.8/10.0 | 47.2/52.7 | 32.6/62.6 | 90.8/92.1；173.0/227.0 | 84.0/87.4；165.5/171.8 | 89.4/89.5 |
| 1000 | 14.4/16.8 | 11.0/12.8 | 5.9/6.4 | 55.6/56.6 | 122.3/141.1 | 183.9/191.0；391.7/414.7 | 166.8/198.9；339.5/384.6 | 252.5/255.2 |
| 10000 | 36.3/43.7 | 12.3/19.8 | 11.2/19.5 | 57.1/69.0 | 889.6/1172.0 | 1071.6/1568.0；2801.2/3227.1 | 1017.6/1193.2；2486.1/3030.2 | 1676.8/2571.6 |
| 30000 | 66.5/83.7 | 12.3/14.2 | 10.8/15.6 | 52.9/96.7 | 2728.4/3446.7 | 2966.3/4331.0；7922.7/9228.3 | 2930.8/3312.5；6724.6/8493.9 | 4886.4/6038.6 |
| 60000 | 109.2/245.1 | 15.6/49.7 | 9.4/27.9 | 60.5/169.1 | 5929.5/11357.5 | 6336.2/11931.8；18671.1/24915.3 | 6099.6/8081.9；14105.6/17676.7 | 9997.2/12794.2 |

身份查詢在原生計時解析度內多為 0 ms，不能宣稱零成本。[Node 微基準](node-perf.json) 是 Node22、Vite SSR、fake-indexeddb 僅供建 fixture；30 樣本＋3 warmup，查詢每樣本取 100 次均值。純 append 是 RAM 準備，不能當 T2。

| 歷史 | Node 精確查詢 | RAM 追加準備 | 帳本 Reducer | 同版陣列參考 Reducer |
|---:|---:|---:|---:|---:|
| 0 | 0.0003/0.0009 | 2.8/31.5 | 21.5/52.1 | 25.0/47.4 |
| 1000 | 0.0006/0.0020 | 0.6/30.4 | 22.1/81.1 | 26.2/62.0 |
| 10000 | 0.0007/0.0012 | 0.7/2.5 | 21.2/37.9 | 51.2/69.2 |
| 30000 | 0.0006/0.0009 | 1.1/34.5 | 26.2/64.7 | 165.9/250.8 |
| 60000 | 0.0005/0.0008 | 0.8/5.6 | 14.0/22.2 | 129.2/265.6 |

| 歷史 | 熱世界 JSON bytes | Quick bytes | 邏輯 Ledger＋結果＋索引 JSON bytes | Chromium 程序 heap snapshot bytes |
|---:|---:|---:|---:|---:|
| 0 | 454470 | 1382127 | 14257 | 170300454 |
| 1000 | 454476 | 2120950 | 1837686 | 47962351 |
| 10000 | 454478 | 8808066 | 18356782 | 248104512 |
| 30000 | 454478 | 23703044 | 55151756 | 1282152851 |
| 60000 | 454478 | 46045550 | 110344262 | 2482790901 |

邏輯儲存大小不含原生 DB 頁面／索引配置；heap snapshot 包含比較用陣列、匯入、驗證暫存及 harness，沒有經強制 GC，不是熱世界 retained size，也不能推斷 Android 足夠。60k 約 46 MB Quick、110 MB 邏輯帳本／派生索引、2.48 GB 該量測程序 heap，完整路徑的記憶體與編碼成本仍需 R3-05。每次普通命令不再 clone／JSON 全部 30k／60k 收據，但順序掃描、T3 UI 全投影、載入、匯出匯入、Recovery 仍有全歷史成本。Manifest／區段引用陣列亦有隨區段數成長的成本，不宣稱 O(1) 全 Runtime。

## 驗證狀態與保留失敗

最終 Typecheck／Build、Gate、隔離完整回歸與 CI 結果將列於 `checks.json`；未完成執行不得宣稱 PASS。Runtime 30 秒與舊 150k 120 秒期限保持原樣。

施工過程保留：最初大型 fake-IDB 10k／30k／60k 各 120 秒逾時；原因為不變派生索引的二次寫入，改複合主鍵範圍與略過不變列。下一輪 22 PASS／60k OOM，透過單次持有驗證資料、有限強快取＋活 proof 弱引用及顯式 VerifiedLedger 傳遞解決，沒有增加 heap。之後 128 項定向為 127 PASS／1 FAIL（重試次數覆蓋），修正後 9 項補驗通過；150k 當輪 116.175 秒通過。Worker 第一輪 58 PASS／14 FAIL，源於測試 resetModules 建立兩套 proof 與舊 mock 回傳 Ack；改為共享同一已驗證 reader、mock 回傳世界，保留完整遊戲／收據欄位對照，26 項重跑通過。沒有提高期限、刪安全測試或改遊戲規則。

原生 harness 初輪另有 Vite dependency reload／HMR 模組版本、缺原意圖、關閉 DB 後讀取、隔離 context 不能互鎖等 setup 失敗，均不算 PASS；最終使用一致模組圖、明確共享兩頁 context 與完整意圖。舊候選失敗與 B5 E1 HOLD、Astra 未 PASS、實機手機待驗等歷史不改寫。

## 結論與邊界

權威命令歷史已真正脫離高頻世界；完整歷史仍持久保存，精確身份與順序讀取不以最近 N 筆代替。普通保存寫世界及本批帳本增量；仍可能有完整順序讀取及 T3 全量投影。載入、Quick／Full、Import、Recovery 仍處理全歷史。

新戰役可靠性以定向、原生與最終 Gate 為準；Draft／BLOCKED 最終判斷見 `checks.json` 與 PR 正文。不合併、不部署、不啟動 R3-04。Android、真實裝置配額、正式部署待驗。沒有同 DB 損毀區段的自動修復；應保存原資料，使用良好完整備份與新空間。
