# P0 v2 交付與驗收狀態

本分支供中控與獨立審查者驗收，不宣告 P0 Gate PASS。Android 真機驗收 PENDING；未合併 main、未部署 Pages。正式發布仍受既有 release approval 與 Gate 約束。

## 版本與施工範圍

- 開工 main：`7b0390a05e5eea4f9fe190d2e772ad7275745751`，package v0.30.50。
- 開發分支：`fix/p0-v2-replay-player-orders-20261014`。
- 完成 commit 與 Draft PR：見本分支 PR 的 head SHA 與網址；文件與程式在同一交付 commit 中。
- 已核對 PR #10 及後續 scheduler/player admission 修復；未併入 PR #3、#9，未修改 R4 B1/M1、水域規則、資源或戰鬥公式、AI 數量與決策頻率。
- 規格權威與已存在的容量差異，見 [PHASE1.md](PHASE1.md)。v94 要求容量 5、main 目前容量 3，這項既有差異未藉本輪性能工作改動。

## 根因與修改

修復前 6h 真實存檔處理 19,569 個事件，乾淨 Node 測量離線回放 655.872 秒、整體讀取 658.677 秒。插樁證明 AI/總督事件占事件成本約 99.3%，主要成本來自 AI 每筆命令完整 clone 與全量 schema/refinement；不是 5.90 MB JSON 的單次讀取。保存另有歷史收據逐筆線性搜尋。完整量測、前十大 CPU 熱點及儀器限制見 [PHASE1.md](PHASE1.md)。

| 模組 | 最終行為與安全邊界 |
| --- | --- |
| `formal/reducer.ts` | 公開命令仍完整解析、native clone、驗證。隔離 replay draft 共用原規則處理器、收據索引與必要的較小副本；跨領域物件別名採保守 fallback。回放完成仍完整驗證。只在完整事件之間 yield。 |
| `formal/schema.ts`、`formal/combatSchema.ts` | 用 Map/Set 改善參照查找，保留重複身分與 malformed history 的拒絕語義。 |
| `formal/scheduler.ts`、`formal/politics.ts` | 公開 scheduler 保留 native clone；內部已隔離的 primitive event 使用受檢查的複製。政治清理只移除與舊 predicate 相同的 stale events，保留 comparator、priority、EventId tie-break。 |
| `persistence.ts` | 交易內建 receipt Map、保留 exact canonical equality、CAS、checksum、所有 history、Recovery 與原子寫入；encodeSave 仍驗證最終世界。剪除 checkpoint 只讀主鍵。大 history 的 revision max 改為迴圈，避免引數數量上限。 |
| `runtime.worker.ts` | Foreground request FIFO 優先於尚未開始的 background tick；當前完整 replay/save 完成後才處理下一個。立即回 `commandReceived`，durable save 完成才回成功 ack。 |
| `orderAdmission.ts` | 對玩家畫面上的同一意圖重新驗證相關目標、排程、資格與 ownership；無關 AI revision 可以單次 rebase，較新 foreground 命令、branch/campaign fence 仍阻擋。真正的資源與佇列衝突交由同一 reducer 拒絕。 |
| `interaction.ts`、`useGame.ts` | 點擊立即顯示受理；ack 與目前 CommandId 關聯，拒絕為終態，不再暗中重送。意圖採已 render 的世界。經檢查的 patch 避免重複整份 JSON reconcile；新的 load/resume 正確重設事件 watchdog。 |
| 專項測試與 `scripts/p0-profile-*` | 驗證 deterministic replay、rollback、alias、CommandId、admission、保存故障與長 history；提供可重現 profiling，私有輸入不進 repository。 |

Cooperative yield 只改善中途接收訊息的能力；本報告分開記錄它與總計算時間。成功 ack 不能早於 durable transaction，UI 的受理訊息也不代表成功。

Replay 的一次性別名檢查以已審核的 engine writers 持續建立獨立快照與 ID 為前提。未來若新增 command/event writer，必須重新核對其寫入領域與跨領域引用，並重跑 alias、拒絕回滾、完整世界對照；不可直接擴大三類城市指令的 allowlist。

## 性能與世界一致性證據

相同凍結來源的兩次無插樁、無競爭 6h 測量，離線回放為 **17.407 / 17.739 秒**，整體讀取為 **18.424 / 18.746 秒**；修復前離線 655.872 秒，約改善 **37 倍**。兩次都完整處理 19,569 個事件，世界、戰報、reload 與 patch hash 相符。這是 Linux/Node 容器的工程測量（CPU quota 2 cores、memory limit 8 GiB），Android 30 秒目標尚待實機驗收。

24h 無插樁測量完整處理 **93,720 個事件**，離線回放 **144.224 秒**、全流程 **147.717 秒**（讀取 0.831 秒、保存 2.663 秒），**未達 120 秒目標**。93,720 個事件全部保留，reload/patch 相符。事件順序記錄與直接／cooperative／分段／save-load 的 24h 一致性測試另已通過；插樁 24h 為 131.584 秒，不能替代無插樁耗時或與其他模式取最小值宣稱達標。

原版完整 24h 插樁對照也已完成：扣除 26,639.302 秒暫停後，active offline 7,079.840 秒、active load 7,086.297 秒；raw load 33,725.599 秒另保留。這不是連續壁鐘測量，後段另與原版 Chromium 功能控制共用 CPU，因此不宣稱精確改善倍率。前後 10 項比較全部 PASS：相同輸入、完整世界、完整戰報、93,720 events、ID/type/at 順序、類型次數、輸出聚合、reload 與 patch；最終 32,468 command receipts、5,141 combat receipts、332 pending events、308 reports 均相同。

24h 插樁仍量到約 2,570 萬次 guarded event copy（累計 21.50 秒）、3,281 次 dynamic-world draft clone（17.23 秒），以及 economicChoices（13.85 秒）與空間索引成本；計時為 inclusive/exclusive 分列，不能相加當總耗時。wrapper 自身的 `performance.now` 約占 CPU sample 8.4%，屬儀器成本。剩餘瓶頸需繼續保留 clone fallback、事件排序及原子性再處理，本輪不放寬規則換取門檻數字。

原生 Chromium 154（同一 Linux 容器、Vite development server、私有觀測 hooks）的首次 6h 載入為 21.771 秒，完整處理 19,569 個事件。載入後第一次田升級在 26.8 ms 顯示受理、1.225 秒正式確認、3.403 秒顯示排程；第二次建築升級為 1.037 秒正式確認、1.355 秒顯示排程。首次可見更新仍較慢，不把 durable ack 當成畫面已完成。

另以已通過 build 的 **production bundle** 補測，6h UI 載入 **23.591 秒**、19,569 個事件、99 AI。可信點擊田升級：受理 7.5 ms、durable ack **1.933 秒**、queue DOM **2.120 秒**；後續建築升級：受理 11 ms、ack **3.166 秒**、DOM **3.443 秒**。兩次 current/authority 收據一致、native commit 均早於同 Worker ackSend。第二次仍超過 1–2 秒目標。DEV profile 的 React 差異檢查成本與 production 測量分開，不用跨模式數字宣稱改善倍率。此補測經實際 UI 匯入、只調整私有 `savedAt`，並不作未匯入 Node gold 的 raw hash 對照；詳見 [`production-browser.json`](production-browser.json)。

| 真實背景 AI 推進期間的 DOM 操作 | 期間新增 AI decisions | click → durable ack | click → queue DOM |
| --- | ---: | ---: | ---: |
| 1X | 1 | 1.567 s | 3.575 s |
| 10X | 1 | 2.025 s | 2.765 s |
| 50X | 7 | 3.785 s | 4.333 s |

這組是自動觸發實際 DOM 按鈕的 Chromium 原生 Worker/IndexedDB 測試，與可信點擊案例分列。1–2 秒工程目標在高倍速案例**未達標**。50X 的主要成本是等待當前背景 replay/save 約 1.296 秒，admission catchup replay 約 0.472 秒及其保存約 0.880 秒，命令驗證約 0.102 秒、命令保存約 0.963 秒。受理畫面約 14.4 ms 即出現；成功 ack 晚於 native IDB complete。現行實作保留 catchup 與命令各自的 durable 邊界；若未來合併交易，必須另證明 revision、receipt、失敗回滾與 Recovery 語義，不能用提早成功 ack 隱藏成本。

另一個 0h 載入後的可信點擊，在開啟城市／田 UI 的 6.567 秒內已進入線上 AI 工作；受理 66.5 ms、durable ack **4.425 秒**、queue DOM **5.143 秒**。這是本次已測建造操作中的較慢案例，也未達 1–2 秒目標，不能列作無 AI 的閒置操作。資源不足正式拒絕約 594.9 ms，沒有稍後自動成功。

最終聚合數據、來源 fingerprint、各階段時間、事件次數、記憶體、倍速、一致性與比較限制：[`performance.json`](performance.json)。

瀏覽器 click/send/receive/queue/admission/save/IDB-complete/ack/render、取消與原子性聚合證據：[`browser-validation.json`](browser-validation.json)。Node fake-indexeddb 與 Chromium native IndexedDB 分別標示；桌面手機 viewport 不能替代 Android 真機。

受控時鐘取代匯出檔缺少的 `savedAt`。6h 使用原有合法上限；24h 只調整私有測試副本。原始檔保持不變。手機截圖的 20,816 個事件與此受控輸入的 19,569 個事件不同，沒有跳過事件。13,963 歷史命令收據、220 個當下待執行事件也各自獨立統計。

單次直接推進與 cooperative 推進比較完整世界、戰報及事件順序 hash。分段與 save/load 有不同的 durable commit 次數，因此只在 gameplay 比較時 normalize `world.revision` 與 `commandReceipts[].committedRevision`；實際 CAS revision、高水位、完整 history、checkpoint 與每次存檔另外逐項驗證，不能宣稱分段的原始 revision hash 相同。

Node 與 Chromium 的跨執行環境 raw world hash 為 **FAIL**，未加 tolerance 或四捨五入。獨立逐欄比較只有 3 個 `cities[].population`（最大絕對差約 5.46e-12）與 18 個 AI `memory[].threat`（最大約 1.67e-16）不同，其餘欄位、世界時間、revision、戰報均相同。兩次 Chromium 完整 6h 的 raw world hash 完全相同；**未修改 main 在同一 Chromium 的完整 6h 對照，世界與戰報 hash 也完全相同**。因此這是本次觀察到的跨執行環境既有差異，本輪變更在同一執行環境結果一致。原版 Chromium 對照與舊版 24h profiler 共用 CPU，只作功能 hash 證據，不作性能比較。

## 驗證清單

最終型別、回歸、建置、倍速與策略一致性聚合見 [`validation.json`](validation.json)。功能測試通過不能抵銷性能未達標與 Android PENDING，本報告不宣布 Gate 驗收成功。

| 必要項目 | 狀態 | 證據 |
| --- | --- | --- |
| P0 profiling / 修復前基準 | PASS | PHASE1、可重現 scripts、私有完整基準 |
| 真實存檔 0h/6h/24h | PASS（功能）；24h 時間目標 FAIL | performance.json；原版前後 exact、完整事件未刪減 |
| 玩家 CommandId/revision/不再 retry | PASS | 專項、最終完整 regression 與 browser；部分時間目標另為 FAIL |
| 99 AI、1X/10X/50X | PASS（功能） | 99 agents、受控 0.1h 倍速工作量及實際背景 AI 重疊；非完整 24h × 全倍速笛卡兒積 |
| SaveLoad / Recovery / CAS faults | PASS | persistence tests、最終 native Chromium 23/23 |
| 事件順序、戰報、資源、AI 一致性 | PASS（同環境）；跨環境 raw hash FAIL 另列 | 0/6/24h 的 11 項策略比較皆通過；0/6/24h Node 原版對照 exact，6h Chromium 原版對照 exact |
| TypeScript | PASS | 凍結來源 typecheck；production build 再次執行 `tsc --noEmit` |
| Full regression | PASS | 最終隔離 full：1,197 PASS / 0 FAIL / 1 SKIP；首輪 1,196/1/1 的 stress timeout 紀錄另保留 |
| Production build | PASS | `npm run build`，CPU/私有量測分開執行 |
| Pages 路徑 | PASS | `/lieguo-zhengtu-origin/` assets、PWA scope、Service Worker fallback |
| Chromium 真瀏覽器 | PASS（功能）；FAIL（部分時間目標） | 完整 DEV 功能／native23／原版同環境 hash 對照；另有 production 補測，數據與限制分列 |
| Android 真機 | PENDING | 此環境沒有 Android 實機 |

## 限制、回滾與下一步

完整回歸首輪唯一失敗是新增的 150,000 筆 history 功能測試超過原訂 30 秒（30,471 ms），沒有資料斷言失敗。此案例連續完成 start、import、Recovery 三次 durable transition，僅為它設定 120 秒的功能測試 budget，保留 150,000 筆、完整 digest/revision/input-immutability 斷言及首輪失敗紀錄；全域測試 timeout 與玩家工程時間目標均未放寬。單跑 26.943 秒通過；最終 full 中 28.962 秒通過。最終 1 SKIP 是既有 `REALM_REGRESSION_SAVE` optional fixture 測試，真實附件由本輪獨立私有 0/6/24h 程序驗證，沒有放入公開 test fixture。

本次 full 中原有兩個美術檔的 20 項測試全部通過；同一環境的未修改 main archive 對照也為 20/20 PASS，不能歸因於本 P0 修復。既有三項歷史 legacy art 失敗紀錄原樣保留。

工程時間目標維持 6h ≤30 秒、24h ≤120 秒、合法建造約 1–2 秒；不能因桌面結果或 pending 項目自行降低標準。保留歷史三項 legacy art 失敗、B5 E1 HOLD、Astra Gate 未 PASS 與 Android PENDING。R4/P0 未來整合後仍須重跑 scheduler、offline、Recovery、CommandId、征服及行軍時序驗證。

存檔格式、schema、資料庫 layout 都未變更，無需遷移或清除瀏覽器資料。交付前只需關閉本 Draft PR 即可撤回；整合後如需回滾，新增 revert commit 撤回本 P0 commit，不 reset/force-push、不刪除玩家資料。舊版本可繼續讀取同格式的有效存檔，但會恢復原有性能限制；實際操作前保留完整匯出與 Recovery。

獨立 GPT-6.1 審查者請依 [`GATE-HANDOFF.md`](GATE-HANDOFF.md) 重新檢查。本輪交付後 STOP，由中控決定後續驗收、整合與發布。
