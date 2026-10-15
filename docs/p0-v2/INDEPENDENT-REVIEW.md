# P0 v2 獨立審查紀錄

> 此為施工期間的獨立預審封存原文。封存後完成的實測由交付者在文末另列，未冒充獨立審查者重新簽核；最新驗收狀態以 DELIVERY 與聚合證據為準，最終 Gate 仍待中控安排。

本紀錄是 GPT-6.1 Sol 最高可用思考等級的獨立 source 與證據審查，**不是 P0 Gate PASS，也不是發布核准**。截至 2026-10-15 UTC，凍結程式的靜態審查沒有尚未處理的具體資料或規則正確性缺陷；部分 AI 重疊情境仍未達點擊延遲工程目標。Node 同環境 6h 結果完全相等；Chromium / Node 原始世界 hash 仍 FAIL，須補同 Chromium 原始 main 控制。完整 24h 與重複完整回歸仍須補齊。Android 真機 PENDING。

## 審查來源與方法

- 審查起點 main / HEAD：`7b0390a05e5eea4f9fe190d2e772ad7275745751`，package v0.30.50，分支 `fix/p0-v2-replay-player-orders-20261014`。本次審查的是此基準上的凍結修改，不可把基準 SHA 誤認為完成 commit。
- 已核對 AGENTS.md、完整使用者請求與相關 v94 規則。範圍限 replay 性能、玩家指令與必要的保存安全；PR #3 R4、PR #9 UI 不在基準中。
- 最終凍結 production source fingerprint：`25e4fb4d93f066ee42285d3f804eea543bfd8ab54db5146bf0bef286be133ba1`。審查者依 profiling harness v3 的同一排序與內容雜湊方式，獨立計算 219 個非測試 TypeScript/JSON 來源，與 final3 clean/instrumented metadata 相符。這不是完整 git tree hash，測試、文件與工具另行審查。
- 凍結 `reducer.ts` SHA-256：`9c926ca547957c49630f402fc0e3c0fe2bb05ccd4507c12e39e725c789b4a439`；`replayP0.test.ts`：`0943c36468dd62967c2f4734af73f0dc12ec29fcac34a0d0cb25e3c870e3995b`，均已獨立核對。
- 審查者閱讀變更、測試、執行紀錄與私有聚合資料，另執行輕量 fingerprint/比較工具；沒有重跑 CPU 測試，沒有修改產品程式。下列測試結果須區分「已閱讀實際紀錄」與「作者回報待閱紀錄」。
- 完成 commit SHA 由 Draft PR 描述與最終交付訊息固定；審查者可用上述 source fingerprint 及個別檔案 hash 綁定該 head。本文件隨交付 commit 封存，不要求在文件內自我引用尚未產生的 commit SHA。若 production source fingerprint 改變，需重新核對對應變更及證據。

## Source 審查結果

| 項目 | 結果與已核對邊界 |
| --- | --- |
| Replay 純度與回滾 | 公開 submit 保留完整 parse/native clone/最終驗證；replay 先完整 outer clone，內部命令使用相同規則、CAS 與 dedup，最後完整 parse。RuleViolation、意外 exception 與 progress callback failure 不可暴露原始輸入或部分世界。 |
| 較小 command draft | 只允許 `field.upgrade`、`building.upgrade`、`military.recruit` 使用城市副本。已追查 handler 與 settlement writers 的寫入領域；readonly overlap 退回完整 clone，任何跨 root/city alias 都停用城市 scope。非政治命令僅在 autonomy 完全獨立時共用；政治命令仍 clone autonomy。 |
| History 與 cache | 收據索引只存在該次 replay/transaction，保留第一筆命中語義；append-only history 的舊列不被命令改寫。沒有跨 save 的快取或存檔格式變動。 |
| Scheduler 與政治清理 | comparator、priority 與 EventId tie-break 不變；public scheduler 保留 native clone，內部 primitive shortcut 僅供完整隔離後的事件。nested/特殊 descriptor 使用 native fallback；push clone 失敗不污染 ID。政治清理仍刪除舊 predicate 的同一 stale event 集合。 |
| 保存原子性 | transaction-local Map 比較完整 canonical receipt，保留 input/final encode 驗證、checksum、CAS、history、Recovery 與多 store transaction。checkpoint primaryKeys 最佳化保留最新兩筆；revision max 迴圈避免長 history 的引數上限。 |
| Worker 排程與 durable ack | foreground request FIFO 優先於尚未開始的 tick；load/import/restore/away/resume 按同一隊列形成 barrier。當前 replay/save 完成後才開始下一筆；commandReceived 與 durable 成功 ack 分開。 |
| 玩家意圖與拒絕終態 | stamp 來自已 render 的世界；只因無關變化過期的相同意圖可單次 admission rebase，再以實際 admission 時鐘 catch up。新 foreground、campaign/branch、同目標排程與取消退款階段仍受 fence；資源/容量/資格由同一 reducer 驗證。拒絕後無自動重送。 |
| React 與載入進度 | pending/received/ack 按 CommandId 關聯；已檢查 patch 保留 identity。新 load/resume 重設 watchdog 進度，重複同一事件計數不冒充持續進度。 |

較小 draft 的一次性 alias 判斷仰賴已審核的後續 writers 繼續建立獨立快照。未來新增 writer 或擴大 command allowlist 時，必須重審跨領域引用與回滾；現有 full-clone reference、跨城市及 future-event controls 需持續保留。

## 審查中發現並已修正

1. stamp 曾取 Worker 最新 ref，可能與使用者點擊時的 rendered target 不同；現取 rendered world，並有 React commit 前收到新 snapshot 的對照測試。
2. 玩家總督與真人共用 issuer，曾把無關總督收據誤當新真人指令；現由 Worker 在 durable foreground commit 後更新可信 revision fence，並保留 AI 外觀 CommandId 與 ABA 測試。
3. 重複 resume 的 watchdog 曾沿用上次較大的 event count；現於新 read cycle 重設，並有超過 30 秒仍持續前進及真正停滯兩種測試。
4. 取消 stamp 補上 queued/active 退款階段；不跨越 100%/50% 退款轉換。無關完成仍可釋放容量。
5. stale-but-valid 意圖的 rebase 移至 admission-time catchup 之前，避免在舊 durable clock 建造。
6. 新即時 commandReceived 的舊測試斷言只調整相應 receipt；「保存前無 state/成功 ack」仍保留。新增測試已納入 index，避免隔離 full script 漏複製 untracked 測試。

以上修正均由實作者完成。現有靜態審查沒有其他可操作的缺陷；這不替代尚未完成的驗證。

## 已閱讀的執行證據

| 項目 | 狀態 | 審查者確認的內容 |
| --- | --- | --- |
| 真實 6h、10X 完整結果 | PASS | baseline 與 final3 均處理 19,569 events；輸入、完整世界、戰報、輸出聚合、reload、patch 相同。 |
| 真實 6h 記錄順序 | PASS | baseline/final3 instrumented 比較工具 10/10 檢查 PASS；按每個事件 ID/type/at 記錄的 event-order hash 為相同非空值，並非逐事件完整 payload hash。clean run 沒記錄順序，其 empty-stream hash 不作順序證據。 |
| 真實 6h 桌面 Node 性能 | PASS（此測量環境） | baseline clean offline 655.872s；同來源 final3 clean 17.407/17.739s，load 18.424/18.746s，約 37 倍 offline 改善。兩次均無插樁、無暫停，記錄為獨佔 CPU window。 |
| Instrumented 6h | PASS（結果比較） | final3 offline 31.830s、load 34.674s；CPU/timer wrappers 有額外成本。基準插樁測量曾有競爭，故不將此組時間作乾淨速度比或 Android 驗收。 |
| Worker/hook/admission/interaction/stream 專項 | PASS | 已閱讀實際 54/54 紀錄（7 files、20.21s），含 10 項真實 Formal Worker 控制：cooperative receive、FIFO/barrier、總督/真人 fence、當前時鐘、資源/滿 queue 拒絕、IDB authority 寫入故障與同 ID deliberate resend。 |
| Watchdog 最終控制 | PASS | 已閱讀 13/13 hook 紀錄（2.19s）；前次 19,569 完成後新低計數能持續超過 30 秒，相同計數停滯仍會 timeout。 |
| 最終 replay/schema/scheduler 專項 | PASS | 已閱讀第一次最終隔離 full 的實際 JSON：replayP0 38、schema 18、scheduler 12，共 68/68 PASS，含 13 個 scoped success/rollback/跨城市 alias/future-event controls。 |
| 最終 TypeScript / production build | PASS | 已閱讀本次凍結來源的 `npm run build` 紀錄；其先執行 `tsc --noEmit`，再完成 Vite production 與 PWA build。 |
| 最終 Pages 路徑 | PASS | 已閱讀 assets、PWA scope 與 Service Worker fallback 的 `/lieguo-zhengtu-origin/` 路徑檢查成功紀錄。 |
| 最終 Chromium native IndexedDB 安全專項 | PASS | 已閱讀 [browser-validation.json](browser-validation.json) 的最終凍結來源 23/23 聚合：14 個 save/restore/import 原子故障、6 個 exact history 破壞、2-connection CAS、clock reversal retention、Recovery。審查者已核對其 13 個 production module hash 均與現有來源相同。 |
| 最終 Chromium 功能矩陣 | PASS（功能，延遲另列 FAIL） | 已閱讀同一聚合的資源田/中心/兵營建造、雙擊只送一次、同 ID duplicate 不重扣、queued/active 取消、滿 queue/資源不足本地阻擋與 Worker 拒絕、refresh/restore/import/切換 campaign、32 events 正進度取消/重試及第二分頁鎖控制。負例的 UI 拒絕時間為 null，不能宣稱已量到 rejection notice 延遲。 |
| Chromium durable ack 次序 | PASS（17 筆） | 17/17 均有 native transaction complete、同 Worker saveComplete→ackSend、觀察訊息次序及 world/authority 相同收據。某筆跨 context epoch 時間差為 -0.000244140625ms，strict flag 原樣保留 false 並註記一個 double ULP；未用 tolerance 翻轉。次序判斷另外使用 native complete、同 Worker 與訊息順序，不能只排序不同 context 的近同時浮點時間。 |
| 最終 Chromium 0h/6h 載入 | PASS（此環境與工作量） | 0h 為 0 events、4.832s 且 input/world/reports 與 Node exact 相同。兩次 6h/10X 均 19,569 events、load 21.771/17.757s，Chromium 內重複 world digest 完全相同，reports 也與 Node exact 相同；跨 runtime world 差異另列 FAIL。 |
| Chromium / Node 6h 原始世界跨環境比較 | FAIL（不採 tolerance） | 審查者已直接對兩份私有完整世界做 recursive exact 比較，僅 3 個 cities.population 浮點值（最大絕對差 5.4569682106375694e-12、相對差 <7e-16）及 18 個 autonomy.memory.threat 浮點值（最大絕對差 1.6653345369377348e-16）不同，其餘欄位、time/revision 完全相同；reports hash 另已相符。原始 world hash 仍失敗；差異小不能視為 exact PASS。待同 Chromium 原始 main 控制判定是否為本次 regression。 |
| 第一次最終 full regression | FAIL | 實際 1,196 PASS / 1 FAIL / 1 SKIP。唯一失敗為新增 150,000 收據 start/import/Recovery 功能壓力測試達 30s timeout（實際紀錄 30,471.05ms），未顯示語義斷言失敗。保留這次失敗，不當成 PASS。 |
| 150,000 收據功能壓力案例單跑 | PASS（功能） | 已閱讀實際 1/1 PASS，26,943.38ms；其餘 35 案例只是 filter skip，不能算覆蓋。僅此新案例局部預算改為 120s 並補說明，150,000 筆、start/import/restore、digest/revision/input 斷言均未變。不是產品延遲達標證據。 |
| 歷史 art 兩檔本次與基準結果 | PASS（歷史紀錄保留） | 本次及相同環境 main archive 控制均為 batch220 16/16、constructionArt 4/4 PASS。審查者已比對兩份測試均與 main 內容雜湊相同。這不是 P0 修復三項歷史 art 失敗；歷史紀錄仍保留。 |

6h 完整世界 SHA-256：`2a0ecf0e64de312491ef67bf7373ae49017dfc337c6303efb86b6c2f0380fef3`；戰報：`a240ae542871e0d24d4e14474c4efe829a8a9a04167359bd858a31d33ee99a5b`；記錄事件順序：`04a827ec41e0874c5dfdeb8e79ef81327fc52ec0fb99424d98713e52ee4f9fe7`。

Node 環境為 Linux x64、Node v24.19.0、Xeon 8573C、2 CPU cgroup / 8 GiB、fake-indexeddb、受控時鐘與 Node MessageChannel。Chromium 154 使用 native IndexedDB、Vite development server 與私有觀察 hooks；一次獨立 main-thread profile 含 React DEV object-diff 878.7ms 與 jsxDEV 125.7ms self time，因此不能把 DEV 計時直接推定為 production 計時。production-browser latency 尚未測量。兩種環境均不能替代 Android 實機。私有存檔、世界內容、資料庫、CPU profile 與原始 browser trace 均未附入本紀錄。

## 待補證據與驗收邊界

| 項目 | 狀態 | 尚需確認 |
| --- | --- | --- |
| 真實 0h/24h、1X/10X/50X | PENDING | 同來源完整處理、hash/事件比較及清楚的時鐘/倍速口徑；24h ≤120s 目標尚未判定。 |
| 分段、save/load、cooperative 等價 | PENDING | gameplay normalize 與真正 durable revision/CAS 證據分開；不得宣稱分段原始 revision hash 一致。 |
| 重複 full regression | PENDING | 局部功能壓力預算校準後仍需重複隔離 full。首次 timeout 與單跑結果均保留，不放寬產品性能目標。 |
| Chromium 原始 main / 最終來源 6h exact 控制 | PENDING | 相同 Chromium、起始世界、時鐘與完整事件，比對原始 main 與本次結果，不設浮點 tolerance。此功能控制排在性能 windows 後，不作乾淨性能基準，也不預設跨 runtime 差異原因。 |
| Chromium DEV 點擊延遲工程目標 | FAIL（此環境已有未達案例） | 已閱讀最終聚合。99 AI 重疊的 1X/10X/50X durable ack 為 1.567/2.025/3.785s、queue DOM 為 3.575/2.765/4.333s。6h 後兩次 first-field ack 為 1.225/1.456s、DOM 為 3.403/2.103s；另一筆建造 ack 1.037s、DOM 1.355s。繁忙 0h first-field ack 4.425s、DOM 5.143s。部分案例達標不抵銷未達案例；不宣稱所有合法建造 1–2s。50X 包含等待中的 1.296s queue、0.880s catchup save 與 0.963s command save，當前實作保留各完整 durable 邊界。 |
| Production-browser 點擊延遲 | PENDING | 現有 browser 功能與時間矩陣由 Vite DEV 提供；production build 已成功不等於 production runtime 延遲已驗證。 |
| Android 真機 | PENDING | 本環境無真機；desktop mobile viewport 不能替代。6h ≤30s 目標仍須真機驗收。 |

未改 R4 B1/M1、水域、AI 數量/頻率、資源/戰鬥公式或存檔格式。v94 容量 5 與 main 既有容量 3 的差異仍存在，未在 P0 改動。B5 E1 HOLD、Astra 未 PASS、歷史 legacy art 三項失敗紀錄與 Android PENDING 均保留；art 本次執行結果另列。未 merge、部署或修改 release approval；本紀錄不核准這些行動。

## 封存後的交付者補充（非獨立簽核）

以下是獨立預審原文封存後由交付者核對的新增證據，沒有回寫上方審查者當時的 pending 判斷：

- 最終隔離 full：1,197 PASS / 0 FAIL / 1 SKIP；150,000 收據案例 28.962s PASS。最終 typecheck PASS，完整執行前後 production source fingerprint 都是 `25e4fb4d…133ba1`。
- 0/6/24h 的直接、cooperative、六段保存與兩段 save/load，11 項 summary 及全部 internal checks 皆 PASS；只 normalize 已說明的 revision 欄位，真實 authority/history/CAS 另驗證。99 AI 的 1X/10X/50X 0.1h 工作量、reload/patch 皆 PASS。
- 同 Chromium 的原始 main/修復版 6h：19,569 events，完整世界與戰報 exact 相同。跨 Node/Chromium 的 21 個浮點差異仍原樣為 FAIL，未加 tolerance；原版也呈現相同差異，因此本次同環境比較沒有此 regression。
- [production-browser.json](production-browser.json) 補測 production build：6h load 23.591s、19,569 events；兩次可信點擊 durable ack 1.933/3.166s，queue DOM 2.120/3.443s，current/authority 收據與 native commit→ackSend 均通過。高延遲案例與 Android PENDING 仍保留。
- 24h 乾淨回放 144.224s / 全流程 147.717s，93,720 events，未達 120s 工程目標。原版 24h 對照已完成，10/10 比較 PASS，包括完整世界、戰報、事件順序／類型、history、reload/patch。原版 active offline 7,079.840s，暫停 26,639.302s，另有後段共用 CPU；active elapsed 不能冒充連續壁鐘或與乾淨測量作精確倍率。詳見 [performance.json](performance.json)。

以上新增證據請由接手的獨立 Gate 審查者重新核驗。本輪依然沒有 P0 Gate PASS 或發布核准。
