# P0 v2 — 修復前量測與施工邊界

開工日期：2026-10-14（Asia/Taipei）。基準是 GitHub 開工當下的 main `7b0390a05e5eea4f9fe190d2e772ad7275745751`，package v0.30.50；GitHub branch API 與本機 HEAD 相符。分支：`fix/p0-v2-replay-player-orders-20261014`。

權威：v94 > v93 > v92 > 有效歷史規則 > source。本輪採現行 main 的實際模擬作性能等價性對照，沒有把未合併規則當產品基準。PR #10 已於 `570b3d5` 合併；`70f491b` 已改善 scheduler heap 重建；`554faf8` 已加入玩家語義 admission。本輪先檢查其實作，再針對仍存在的瓶頸施工。Draft PR #3（R4）、#9（v94 UI）均未併入本分支。

## 私有輸入與受控時鐘

原始玩家存檔只留在 repository 外的私有工作區，不作公開 fixture、CI artifact 或日誌。原始檔沒有改寫；速度與 24h cap 的調整只作用於隔離記憶體副本。匯出檔不含 IndexedDB 的實際 `savedAt`，測試將受控時間注入隔離資料庫；事件總數與手機截圖可能不同，不把桌面重現稱作 Android 實測。

| 輸入項目 | 實際核對 |
| --- | ---: |
| 檔案大小 | 5,897,901 bytes |
| appVersion / schema | 0.30.49 / 3 |
| 世界 revision | 1,381 |
| 速度 / 離線上限 | 10X / 6h |
| 勢力 / AI agents / 城市 | 100 / 99 / 100 |
| 歷史命令收據 | 13,963（57 玩家、13,906 AI） |
| 當下待執行事件 | 220 |
| 戰鬥結算收據 | 1,997 |
| 匯出附帶戰報 | 22 |

220 筆待執行事件為：100 economy.settle、70 ai.decide、29 construction.complete、11 governance.decide、5 military.train、3 army.return、2 army.arrive。歷史命令收據、待執行事件、離線實際處理事件分別統計，沒有混用。

## 修復前完整 6h profiling

環境：Linux x64、Node 24.19.0、V8 CPU sampling、fake-indexeddb、Node MessageChannel，CPU quota 2 cores、memory limit 8 GiB。此組包含函式與事件插樁，初段另有短期診斷及 Chromium 共用 CPU；保留這項限制，另跑無插樁、無競爭的 6h 基準作耗時比較。這組 profiling 適合判斷成本與函式次數，不能直接當作 Android 效能證明。

| 階段 | 插樁 baseline |
| --- | ---: |
| IndexedDB 讀取、驗證、checksum、migration | 916.1 ms |
| 完整離線回放（6 真實小時、10X） | 769,030.2 ms |
| 原子保存 | 2,403.3 ms |
| loadWithOffline 全流程 | 772,349.8 ms |
| 已處理事件 | 19,569 |
| 峰值 RSS | 1,463,545,856 bytes |

5,266 筆 AI 決策累計 590,647 ms（平均 112.16 ms、最高 1,450.52 ms）；951 筆總督決策累計 170,462 ms（平均 179.25 ms、最高 984.47 ms）。兩者占事件處理耗時約 99.3%。全量世界驗證 4,396 次、累計 537,566 ms；完整世界 clone 4,424 次、累計 181,128 ms。驗證耗時已包含其內部收據查找，巢狀計時不可再次相加。

| 前十大 CPU 熱點（依相同 callframe 合併） | CPU sampling share |
| --- | ---: |
| native structuredClone | 23.42% |
| garbage collector | 11.39% |
| ZodObject._parse | 10.14% |
| schema.ts 世界契約 refinement | 9.44% |
| schema.ts 施工收據 predicate | 5.47% |
| validateCombatContracts | 4.48% |
| Zod _parseSync | 3.44% |
| ZodString._parse | 2.90% |
| receiptLookup（插樁 wrapper） | 2.87% |
| Zod mergeObjectSync | 2.09% |

完整 scheduler snapshot 共 13,238 次、累計約 10.94 秒，比 AI 命令 clone/schema 小得多；不先重寫 scheduler。另測完整世界 stringify 約 42.1 ms、clone 約 42.0 ms、worldPatch 約 43.1 ms；MessageChannel full-world/patch 約 34.8/49.4 ms，僅作 Node 跨執行緒近似，Chromium 另測。

完成回放後：18,353 command receipts、2,910 combat receipts、269 pending events、44 persisted reports。私有完整世界與資料庫快照已保留。重新載入與 patch 套用得到相同 canonical world hash；修復後須再比較 world、report history、event order，不能只比較總數。

## 0h 與玩家命令根因

0h 插樁 loadWithOffline 2,413 ms：讀取 389.8 ms、回放 3.7 ms、保存 2,018.9 ms。保存對每筆 durable receipt 執行 `.find`，13,963 次累計 1,334.2 ms。另一個相同 canonical equality 迴圈對照，中位數為 `.find` 963 ms、Map 60.8 ms（該迴圈約 15.8 倍），並未略過任何收據欄位或去重驗證。

Node/fake-indexeddb 合法建造：reducer 約 115–134 ms，durable save 約 1,714–2,495 ms，Worker patch 與前端 reconcile 合計約 74–92 ms。UI semantic stamp 小於 0.3 ms。無關的背景推進及存檔等待還會疊加於以上耗時。

Chromium 原版兩次合法 UI 操作也取得 click/send/receive/queue/admission/save/IDB-complete/ack/render 時間。此組與 profiling 共用 CPU，僅證明完整鏈路可觀測：田升級 click→durable 約 14.07s、render 約 18.77s；建築升級約 8.18s/8.67s，不能用此受競爭數字宣稱精確改善倍率。兩次 durable world 與 authority 收據一致。

已重現的命令問題：

- Worker 全部 foreground requests 與 background tick 共用 Promise FIFO；同步回放阻塞接收，隨後還須等待完整保存。沒有與正式 ack 分開的接受訊息。
- 前端在「版本已更新」拒絕之後仍會同 CommandId 自動重送，可能形成失敗顯示之後成功的時序。
- 不相關資源田完工會改變整份施工佇列指紋，拒絕仍合法的城市中心升級；同一操作在當前 revision 可以正式提交。純 clock-only 的建築指紋在已測案例中沒有改變，不能把未證實的 queue-progress 假設當作根因。

## 最小修復與安全約束

1. 保留公開 submitFormalOrder 的完整隔離、命令解析與世界驗證。僅在完整隔離 replay draft 內使用同一規則處理器的較小命令副本，避免重複複製不會改動的地圖與歷史；歷史陣列先複製再 append。整段回放結束仍強制完整驗證。
2. Schema 用 applied CommandId → issuer set 改善參照查找，保留 duplicate 檢查及 malformed duplicate 的 `.some` 語義。
3. 保存使用 transaction-local receipt Map，保留 exact canonical equality、CAS、checksum、全體歷史與 Recovery 原子交易。只移除 encodeSave 之前的同義重複驗證；encodeSave 本身仍完整驗證。只讀 checkpoint 主鍵以保留最新兩個 checkpoint。
4. Background replay 在完整事件之間 cooperative yield。Foreground requests 依 FIFO 排在待執行 tick 之前，仍等候當前回放與保存的原子邊界；不在未完成世界上插入玩家變更。
5. 立即顯示受理中，但只有 durable commit 才發成功 ack。移除前端拒絕後重送；只允許具有相同目標前置狀態的單次 admission rebase，保留較新玩家命令與 branch/campaign fences。資源、資格、所有權與實際排程仍由 reducer 判定。

不改事件優先序、AI 次數、資源或戰鬥公式，不丟棄事件、命令或戰報，不改存檔格式，不併入 R4，不 merge/deploy。另記錄既有 v94/source 差異：v94 第 17 章要求建築／軍事容量各 5，main 仍為 3；本輪性能等價修復沒有順帶實作此玩法差異。

Android 實機驗收 PENDING。最終測試結果、乾淨 6h／24h 數據、回滾與獨立審查交接，另見本目錄交付報告；本 Phase 1 文件不宣告 P0 Gate PASS。
