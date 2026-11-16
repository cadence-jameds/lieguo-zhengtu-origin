# 第二階段建議、正確性風險與施工順序

這是待審方案，**本 PR 沒有實作以下最佳化**。實測表、CPU Profile、事件與 A–J 分段見同目錄報告；此處不把成本占比當成可保證消除的時間，也不宣稱已達到 2–3 分鐘或 30–60 秒。

## 不可改變的契約

逐事件完整重播、AI／總督決策次數、`compareEvents` 的時間／優先級／EventId 順序、決定性 RNG、同時間事件、所有資源與結果、command identity／receipt／outcome／fingerprint、Ledger／Inbox／Fence、Writer epoch／branch、T1／T2／T3、Recovery 與最後一筆原子提交都必須保持。不能用減少決策、抽樣執行、跳過失敗指令或粗化經濟公式獲得分數。

第一階段的完整 Formal 結果比較包含 **每一個 world key**、commandFacts、完整 Ledger archive、所有 Report History 與事件順序觀察。第二階段還需比較每一批的 command Acks／Outcomes、Durable Inbox、RuntimeMeta／Replay Fence、Recovery roots／authority／sequences；目前工具的世界 readback 不能取代這些外部交易測試。

## 優先研究的五個方向

| 順序 | 方向與預期改善 | 正確性風險 | 修改範圍與保護方式 | 正常 25X 適用性 |
|---|---|---|---|---|
| 1 | Replay command draft 對 `commandFacts`／其他未改變分支的 copy-on-write。避免每個已接受命令都深複製愈來愈大的完整 evidence dictionary。將一次重播內隨 command 數累積的複製改為必要寫入，最後只複製／正規化一次 | **高**：這是權威來源，不可刪除 evidence、縮短 retention、改 dedupe 或把一次失敗 draft 的寫入漏到原世界；normalization 會改既有 fact 的 revision | 優先限制於 reducer 私有 replay draft。建立可證明的 ownership／mutation 列表，保留 alias／malformed input 的完整 native-clone fallback。現有 Schema／Fence／commit 不動；拒絕、例外、反覆 replay、Recovery 與 alias fixture 全比對 | 原則上可共用機制；先只開 replay，正常指令須另外證明 rollback／alias／T1–T3 等價，不能直接把 readonly 假設擴張到所有 caller |
| 2 | Pending receipt／original result 的增量索引與 draft history 結構。避免 pending window 在單次補算中長到數萬後，反覆 `.find` 與整個 prefix 的複製 | **高**：不能將「曾存在」當成相同 issuer／fingerprint／disposition 的證明；不能遺失拒絕結果、退休身份或 Replay Reservations | `replayReceipt`、`findReceipt`／autonomous admission 的非權威衍生索引；只加速查找，不改權威 rows、順序、公開表示或 Ledger hash。prefix 被替換、回復、分支、原地修改時失效。先以 Profile 再細分 submit self time，不能把全部 self 都宣稱是線性搜尋 | 可導入，但必須通過 bounded player／automatic windows、ABA、rollback、stale command、重開 Worker 的既有 gate |
| 3 | AI 提交的 scheduler 往返成本：snapshot／native clone／replace／再次 snapshot。研究可交易的排程 draft 或完整事件值可證明安全時的 clone 路徑 | **很高**：借用活動 heap 可能讓 rejected command 已插入／刪除事件；不能變更 tie-break、取消事件、ID 分配或 order | `submitAutonomous`、`submitOrderDraft`、`EventScheduler`。先逐項記錄必需的隔離邊界；只在 ack committed 後安裝排程變更。異常 shape／prototype／descriptor 必須維持現有 native fallback | 是純資料結構方向，理論上可；需 scheduler property／adversarial tests、原版逐事件順序與所有結果一致，先不更動 live command scheduler |
| 4 | 減少已接受命令造成的完整 SpatialIndex 重建；依實際 city／army／reservation 改動更新衍生資料。之後再研究 AI catalog／局部查詢的 memoization | **中高**：索引若仍指向舊 city 物件或漏掉 army time、所有權、征服、respawn、settlement、exile invalidation，就會改 AI 選擇及資源結算 | `spatial` 與 draft index inheritance，保留全量 rebuild 作 oracle。排序、候選集合與距離同分順序必須保持。catalog 只快取與輸入完全相同的純結果，不快取跨事件的可變政治／資源／情報 | 可安全共用的候選，但每種 mutation 都要有 invalidation 證明，不能只測讀取 cache hit。城市／軍隊規模須分開重測 |
| 5 | 在前述配置／GC 成本降低後重測 cooperative budget；如 timer wait 仍占重要比例，再評估有明確上下界的自適應 slice | **中高**：較少 yield 可能推遲 message service、T1、query 或前景控制，並且不能讓 private draft 暴露 | `RuntimeWorkBudget`／CooperativeAdvanceOptions。沿用完整事件邊界與 start service opportunity；pending intake 仍須有優先 service 機會。以原生 Worker round-trip、真實 Durable T1／T2 latency、長事件與失敗回復為門檻 | 需要 Android 前景／熱降頻／背景實測後判定。不能用長時間封鎖 Worker 換取較快的單一 Benchmark |

`commandFacts`／pending history 的改善不是修改 Command Ledger 規則。若證明不了完全相同的權威內容與拒絕行為，該方案就不應施工。前兩項可能互相影響，不應把兩個百分比相加。

## 每事件全域協調的結論

`advanceOneEvent` 確實逐事件呼叫 `resolveExtinctions`、`reconcileWonders`、`reconcileCatchup`、`reconcileVictory`、`retireAutonomy`、`retireGovernors`，並失效 endgame intel。`resolveExtinctions` 掃描 factions／armies，Victory 掃描 ownership／politics，retire 掃描 agents／governors；有重複掃描。

但在 103,409 事件合成案例，A–J 歸屬的全域協調 self 僅約 **19.8 秒／1.52%**，複製與初始化歸屬約 **954.5 秒／73.26%**。奇觀與 catchup 當時大部分沒有實體專案；這不能代表有大量奇觀、帝國、現代化專案的世界。全域函式的 inclusive 時間也不能直接相加，因為會呼叫 SpatialIndex 等共用函式。

因此不建議第一批就刪掉或延後這些呼叫。等主要成本處理後，若真實成熟世界仍證明全域協調是熱點，再為每一種會改變條件的事件與 command 建立 dirty dependency 表。Victory 的人口、政治、軍力與連續維持時間；奇觀的耐久、交戰、所有權、修復與工作時鐘；滅國的城市／軍隊／研究取消，都不能靠「這個事件看起來無關」跳過。

## 分批施工與驗證

1. 固定本階段世界快照、source SHA、seed、起訖時間與 tool mode，建立 count-only／detailed 配對控制。保留目前完整 reducer 作 oracle；先加入大 pending facts、拒絕命令／alias、同時間多種完成與 conquest、late report／世代、Recovery／Fence 的必要隔離測試。
2. 只做 replay evidence draft 的 ownership／copy-on-write。一個 PR 完成一個小的 mutation domain；每個案例比較全部權威資料及報告，不只比較資源。所有例外／取消都驗證原 committed world 不變。
3. Profile 更新後才決定 pending 索引與 scheduler 的先後。每批都跑九格矩陣、真實備份、battle／developed／mature／bounded Ledger，檢查事件種類與次數、AI decisions、accepted／rejected、序列、順序與完整世界結果。
4. 再做 SpatialIndex／純衍生 cache；先逐事件對照全量 rebuild oracle，再測正常 25X。不要將政治／情報／經濟 cache 與索引一次合併成不可定位的大改動。
5. 原生 Worker 與 Android 上再決定 yield policy。報告完成時間外，同時報 T1 durable ack／T2 commit、query／message service p50/p95/p99、最長單事件及最長無 service 時間。count-only 與零插樁正式 runtime 都要回歸。

每批都需 Typecheck、Build、相關 authority／Scheduler／Durable Inbox／Recovery 測試及隔離 full regression。保留歷史 legacy art failures、B5 E1 HOLD、Astra Gate 非 PASS 與手機未驗證狀態；不為取得綠燈改寫舊測試或驗收紀錄。

## 2–3 分鐘與 30–60 秒目標

103,409 事件的插樁合成案例是 1,302.95 秒；「全部複製成本瞬間消失」仍留下約 **348.4 秒**。這是以已測 self 分配計算的 Amdahl 邊界，**不是可以實作或達成的預測**，也不代表 GC／yield 在實際最佳化後保持不變。它說明只修一處全域掃描遠遠不夠，而配置成本下降也可能間接降低 GC、單事件長尾與 timer 次數。

2–3 分鐘值得優先研究，但需多批資料結構改善與 Android 重測。30–60 秒目前沒有實測證據支持。不得為追求任一目標減少 AI 決策、事件或規則精度；不能用桌面 Cloud 數字承諾手機 SLA。

## 是否需要離線補算斷點續算

**先最佳化。斷點續算只減少中斷後的重做，不會消除單次完整補算的 CPU 成本。** 目前已量到分鐘級重播，值得保留獨立設計議題；本 PR 不直接新增 checkpoint，不改現有 `clockMode: offline` 草稿不得正式保存的規則。

建議在主要安全最佳化完成後，符合下列**建議門檻**再投入續算施工；這些數字是決策標準，不是本次已觀察到的 Android 結果：

- 代表性 Android 裝置 12h／25X 的完整補算 p95 仍高於 180 秒，或 p99 高於 300 秒。
- 真實長補算 session 有可重現的 OS 殺程序／reload／分頁回收，並且已完成工作會從零重做；需量中斷比例及重做秒數，不能只依使用者一次觀察宣稱發生率。
- 配置最佳化後的 heap 高水位仍接近實測可用記憶體安全餘裕，或前景續算無法可靠持續；實機應以裝置實際 budget 判斷，不將 Cloud heap 上限套用到 Android。
- 每個 checkpoint 的原生 IDB 寫入／驗證 overhead 可維持在總 CPU／wall time 的 5% 以下，且能證明比中斷重做的實際成本小。若不成立，續算可能反而惡化大多數玩家的時間。

續算若施工，應使用**獨立、非權威的 replay workspace**，綁定原 committed source checksum／Ledger root／revision、固定離線起訖、writer epoch／branch／Replay Fence、完整私有世界／排程／RNG／sequences／報告與命令結果。只能在完整事件邊界記錄；正式世界、Recovery 與 T2 仍在最後完整原子提交後才前進。來源被新指令／分支／Recovery／另一 writer 改變時，必須拒絕 stale workspace 或依正式規則重新計畫；玩家 T1 與查詢不能被 checkpoint 餓死。

不能暫時把 private draft 標成 foreground 來騙過 encodeSave，不能把半段重播當正式世界暴露，也不能讓已暫存的 command identity 在重啟後重做或遺失。這是一項新的協定設計與故障注入工程，應在專案審查與第二階段量測後另開 Draft PR。
