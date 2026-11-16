# B10 P0：離線世界補算效能剖析

本次只新增 Benchmark／Profiler、隔離測試、CI 測試步驟與報告。正式遊戲的 `src/`、`public/`、dependencies、遊戲規則、AI 頻率、倍速／離線上限、Schema、Ledger、Inbox、Recovery、UI／美術及 Runtime 權威架構均未修改。沒有第二階段最佳化，也沒有合併／部署。

## 核心答案：為什麼十萬事件會要二十多分鐘？

**真實備份實測：113,924 個世界事件，Node 詳細剖析 1,262.126 秒（21 分 2 秒）；原生 Chromium 較少插樁對照 1,304.966 秒（21 分 45 秒）。** 原生讀取僅 0.412 秒，最後提交 9.950 秒；世界重播占 99.21%。不是拿玩家「十幾分鐘」當成已測手機基準；這是同一份備份、受控 12 小時 absence 的 Cloud 實測。

主要原因是每次 AI／總督行動提交會重複複製已累積的私有資料，並反覆把活動排程轉成 snapshot 再重建。真實資料中，城市 draft 的 **19,019 次整份 commandFacts 深複製花了 656.167 秒**，4,518 次較大 command draft body 複製另花 **203.683 秒**。整體明確複製／初始化歸屬 **904.788 秒、71.69%**。13,238,328 次 scheduler native event clone 合計 30.430 秒，另有 snapshot／replace、pending receipt 查找與大量配置／GC。

已提交的近期 Ledger 始終是 1,155 筆，單次私有 replay 的 pending receipts 卻從零長到 **23,483**；commandFacts 也在重播途中累積，直到結尾才依原規則收斂。原碼在每個城市命令 draft 複製整份 evidence dictionary，因而有隨一批命令數成長的重複 prefix 複製成本。這與「存檔檔案只有 5.32 MiB」是不同問題，也不是 heap pop 本身慢。

原生 CPU 抽樣的主要 leaf 歸屬是 cloneReplayCityDraft **48.37%**、cloneReplayCommandDraft **14.12%**、GC **10.56%**。Node 的明確呼叫點計時與原生 count 模式均指向相同熱點，不能把二十多分鐘歸因於詳細 span 工具。

## 55% 進度為何還要等很久？

正式進度是 **世界時間比例**。以下是原生完整重播中最多 21 個進度取樣的一部分；「剩餘」是完成後回算的實測餘量，沒有拿預測充當實測。

| 世界進度 | 已處理事件 | 已耗時秒 | 占完整耗時 | 完成後回算剩餘秒 |
|---|---:|---:|---:|---:|
| 25.00% | 25,350 | 98.692 | 7.56% | 1,206.274 |
| 50.00% | 51,186 | 324.157 | 24.84% | 980.809 |
| 55.01% | 56,684 | 380.468 | 29.16% | 924.498 |
| 75.00% | 79,691 | 646.694 | 49.56% | 658.272 |
| 100.00% | 113,924 | 1,294.340 | 99.19% | 10.625 |

**55.01%／56,684 事件時，只花掉整體 29.16% 的時間，後面仍需 924.498 秒。** 這與玩家觀察的 54%／約 56,000 事件很接近；不能據此聲稱玩家當時的起訖／裝置與此實驗完全相同。後半段私有集合更大，單次 AI 成本也更高，進度比例不能解讀為 CPU 已完成比例。

## Source、環境與資料安全

- 開工時最新 main：`c8b3554ff9643b74b624e4e77f381653afcccc20`，即 PR #66 merge commit；原 checkout 的分支／歷史未重寫。獨立分支 `perf/b10-p0-offline-profile`，最終 HEAD 另列 Draft PR 描述。
- Cloud Linux 6.18.57／x64、Intel Xeon Platinum 8573C；cgroup CPU `200000 100000`（2 CPU quota）、記憶體 8 GiB。Node v24.19.0／V8 13.6.233.17-node.51；Chromium 154.0.8037.57，未加 CDP CPU throttle。不是 Android。
- Node 使用 Vite library bundle／fake-indexeddb；同 process 的 setup 可能保有已驗證 proof cache。原生資料使用新 headless browser、獨立 localhost origin、seed Worker 終止後再由新 DedicatedWorker 冷載入。
- 原始檔為 5,573,724 bytes 的 `lieguo-recovery-archive-v1`，不是一般 portable save envelope。只把完整 table 集合還原到隨機 suffixed DB；沒有開啟玩家正式 IndexedDB。原版 loader、Writer epoch／Fence、checksum／Ledger／identity 驗證及正式 full-export/import 的 Inbox／Recovery／domain authority 稽核均通過；未使用 Recovery、pending Inbox 為 0。
- 私人資料起始為 100 勢力、99 AI registry，其中 88 個持城 AI、100 城市、8 軍隊、1,155 retained receipts／outcomes、149 evidence。固定缺席 12 現實小時，25X，完整推進 1,080,000,000 world ms。結果自然成為 110 城市、48 個持城 AI；沒有凍結死亡／建城、減少決策或跳過事件。
- 私人原檔的前後 SHA-256 在私有暫存區比對：**未改變**。不公布該 digest、存檔、世界內容、ID、資源數值、報告文字或 raw CPU／Heap traces。只提交去識別化彙整 JSON。38 項比對的 digest 留在私有環境，公開結果只有欄位名稱與 pass/fail。

## 固定九格：合成戰役實測

Seed 90217、native 正式生成器、100 勢力／99 AI／100 城市，同一初始幾何與狀態，僅使用表中要求的合成 speed；每格獨立 Node process。savedAt 固定 1,800,000,000,000，離線終點固定為 savedAt + hours。每格完成整個 load／replay／T2，資料為單次觀察，沒有把九格當成重複樣本。

| 速度 | 離線現實時數 | 完整秒 | Read 秒 | Replay 秒 | Save 秒 | 事件數 | Replay events/s | 抽樣 heap MiB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1X | 1 | 1.062 | 0.108 | 0.654 | 0.301 | 326 | 498.85 | 109.9 |
| 1X | 4 | 2.633 | 0.099 | 2.135 | 0.399 | 1,261 | 590.65 | 182.0 |
| 1X | 12 | 6.506 | 0.139 | 5.779 | 0.587 | 3,587 | 620.65 | 217.7 |
| 10X | 1 | 6.404 | 0.081 | 5.864 | 0.458 | 3,007 | 512.75 | 209.1 |
| 10X | 4 | 23.751 | 0.074 | 23.084 | 0.592 | 11,708 | 507.18 | 219.1 |
| 10X | 12 | 174.704 | 0.083 | 173.559 | 1.062 | 38,908 | 224.18 | 775.8 |
| 25X | 1 | 14.603 | 0.074 | 13.981 | 0.548 | 7,364 | 526.73 | 598.7 |
| 25X | 4 | 117.296 | 0.066 | 116.503 | 0.728 | 31,283 | 268.52 | 796.4 |
| 25X | 12 | 1,302.946 | 0.176 | 1,301.225 | 1.545 | 103,409 | 79.47 | 1,021.8 |

早期 Node collector-v1 包含事後 readback，heap 是該 Benchmark process 的 sampled high-water mark，不是零插樁遊戲／手機的精確 peak。長 99 AI 案例曾與短輔助診斷共用 VM；它是診斷資料，不是獨占機器 SLA。後續真實 12h Node 與原生執行依序進行，沒有其他長 Benchmark 同時執行。早期基本探針與後續 callsite／Ledger／arrow 探針不同，不能拿兩種探針間的小幅差異宣稱遊戲加速。

## AI、建築、戰鬥、成熟與 Ledger 規模

| 場景 | 起始持城 AI | 城市 | 離線 h／speed | 完整秒 | 事件 | 抽樣 heap MiB |
|---|---:|---:|---|---:|---:|---:|
| AI scaling | 0 | 100 | 12h／25X | 4.452 | 30,001 | 109.1 |
| AI scaling | 25 | 100 | 12h／25X | 126.600 | 49,394 | 831.6 |
| AI scaling | 50 | 100 | 12h／25X | 411.816 | 67,737 | 1,066.6 |
| developed | 99 | 100 | 1h／25X | 59.469 | 18,014 | 235.1 |
| combat | 99 | 100 | 1h／25X | 63.668 | 18,773 | 236.4 |
| mature | 82 | 100 | 1h／25X | 23.724 | 8,453 | 298.9 |
| 最大合法 retained Ledger | 99 | 100 | 1h／25X | 13.970 | 7,364 | 257.5 |
| 城市擴張 fixture | 99 | 200 | 1h／25X | 21.801 | 10,106 | 228.2 |

- Schema 固定要求 100 factions／99 AI registry。0／25／50 AI 是重新分配 100 城市後的 **持城 AI 數**；其餘依正常 extinct／retire 規則處理。這是合法的決策工作量對照，並非只改單一變量而維持所有拓樸相同。
- developed：人工已完成狀態、100 城市、建築等級總和 13,800；combat 再以正式命令／合法鄰接行軍建立 **30 場真實同時進行的戰鬥**。fixture 明確是人工準備，不宣稱曾執行 13,800 個施工命令。
- mature：正式世界跑 7 world days，每 world hour 經正式 Persistence checkpoint，再量 1h absence。起始 82 個持城 AI。原先 30-day setup 遇 Node 約 2 GiB heap OOM（最後 GC 的 process-relative 時刻為 563.5 秒，非已測完整 setup 時長），**未進入測量、沒有完整補算時間**，另存失敗紀錄；不能把它當成 Android／正式 replay OOM 的證據。fake-IDB／checkpoint／engine retained heap 尚未分離定位。
- 額外 developed 12h exploratory 長跑在未完成時中止；不列為成功結果。固定九格、AI scaling 的 12h 均完成，四個額外壓力情境明確採 1h 完整重播，額外 12h 壓力組仍未完成。
- 大型 Ledger 準備 60,000 個候選，但原版 retention 正常留下前景／自動各 1,024，共 **2,048**；不能稱為 60,000 retained Ledger。相對 fresh 1h 的 14.603 秒，2,048 retained 組 13.970 秒，n=1 無法判定小差異。這與私有 replay 中 23,483 筆 pending 的成長完全不同。
- 200-city fixture 使用 native initialCity／economy 初始化，仍有 99 AI。相對 100-city fresh 的 7,364 事件／14.603 秒，此組 10,106 事件／21.801 秒。城市拓樸與發展／事件組合也不同，不宣稱線性係數；軍隊壓力亦以完整場景呈現，沒有把時間差都歸因於單一 army 數。

## A–J：真實備份 12h 的實測分段

下表由進度邊界 wall time，加上 replay 內 **self time** 歸屬計算。A／原子 save 是實際階段；B–H 是巢狀子系統的互斥操作歸屬，C 收納未歸屬及量測 bookkeeping。**不可再加 inclusive 父層**。B 包含每命令 draft 複製，不能誤解成最初一次 world clone 花了十五分鐘。E 的共用 economy handler 也處理建造，施工完整事件另列下表；不是假造十個天然互不重疊的業務階段。

| 分段 | 邊界／操作歸屬 | 秒 | 佔完整耗時 |
|---|---|---:|---:|
| A | IndexedDB 讀取／完整性驗證進度段 | 0.217 | 0.02% |
| B | Replay 初始化、World／command draft 明確複製 | 904.788 | 71.69% |
| C | 事件排程、dispatch、未歸屬及 observer bookkeeping | 46.830 | 3.71% |
| D | AI／總督決策、admission／receipt 處理 | 86.580 | 6.86% |
| E | 經濟／城市資源及共用 economy handler | 4.739 | 0.38% |
| F | 戰鬥、行軍、科研、訓練、定居、軍力／wild lifecycle | 32.326 | 2.56% |
| G | 奇觀／外交／勝利／滅國／retire／growth 全域協調 | 26.955 | 2.14% |
| H | SpatialIndex／衍生 cache | 19.305 | 1.53% |
| I | Cooperative yield 等待 | 136.719 | 10.83% |
| J | Replay 最後驗證／Ledger 正規化及原子提交 | 3.666 | 0.29% |

原生 count 模式只報 Read 0.412、Replay 1,294.603、Save 9.950 秒與 yield；沒有詳細探針的 B–H 回傳 null，不拿 0 或推估冒充實測。真實 1h 原生詳細剖析也完成，資料附於 evidence。

## 真實事件類別

每個 event label 只計真正進入 advanceOneEvent 的完整事件；scheduler pop 亦可能用於清空／重建 heap，不拿 pop 次數當世界事件數。累計／平均用全部呼叫，分位數為最多 2,048 個固定種子 reservoir 的實測樣本估計；p50／95／99 至少 20／100／1000 次才輸出，— 表示不足。

| 類別 | 次數 | 累計 inclusive 秒 | 平均 ms | p50 ms | p95 ms | p99 ms |
|---|---:|---:|---:|---:|---:|---:|
| ai.decide | 24,523 | 645.614 | 26.327 | 7.713 | 102.302 | 182.114 |
| governance.decide | 7,532 | 420.183 | 55.786 | 51.171 | 106.404 | 187.927 |
| military.train | 30,501 | 17.613 | 0.577 | 0.262 | 1.642 | 2.837 |
| wild.respawn | 504 | 11.610 | 23.036 | 20.645 | 39.216 | — |
| army.arrive | 3,451 | 8.701 | 2.521 | 1.911 | 5.506 | 12.597 |
| economy.settle | 30,397 | 7.846 | 0.258 | 0.179 | 0.584 | 1.069 |
| construction.complete | 14,031 | 4.842 | 0.345 | 0.236 | 0.733 | 1.538 |
| army.return | 2,115 | 2.065 | 0.977 | 0.684 | 2.355 | 3.892 |
| combat.round | 75 | 0.237 | 3.163 | 1.918 | — | — |
| research.complete | 203 | 0.176 | 0.865 | 0.503 | 2.170 | — |
| logistics.return | 229 | 0.103 | 0.449 | 0.308 | 0.936 | — |
| logistics.arrive | 243 | 0.090 | 0.370 | 0.281 | 0.967 | — |
| settlement.arrive | 10 | 0.019 | 1.864 | — | — | — |
| age.complete | 74 | 0.017 | 0.226 | 0.185 | — | — |
| settlement.ready | 12 | 0.009 | 0.739 | — | — | — |
| army.depart | 9 | 0.007 | 0.826 | — | — | — |
| city.promote.complete | 14 | 0.007 | 0.496 | — | — | — |
| victory.complete | 1 | 0.001 | 1.226 | — | — | — |

最昂貴的是 ai.decide 與 governance.decide；高頻的 economy.settle、construction.complete、military.train 單次很便宜。低頻 wild.respawn 單次約 23ms，須保留獨立觀察，但不是目前主因。正式科研、訓練、定居、物流、戰鬥及 victory 事件均照原序執行，沒有跳過／批次近似。

## 最昂貴的前十項操作

以下是 replay 內不重複相加的 self，含 yield **等待**。不是十項 CPU leaf；CPU 抽樣另列。

| 操作 | 次數 | Self 秒 | 佔完整耗時 |
|---|---:|---:|---:|
| native:structuredClone:formal/reducer.ts:L91:current.commandFacts | 19,019 | 656.167 | 51.99% |
| native:structuredClone:formal/reducer.ts:L81:body | 4,518 | 203.683 | 16.14% |
| yield:event | 23,990 | 136.715 | 10.83% |
| formal/commandLedger.ts:findReceipt | 48,743 | 32.649 | 2.59% |
| native:structuredClone:formal/scheduler.ts:L23:event | 13,238,328 | 30.430 | 2.41% |
| formal/commandLedger.ts:appendReceipt | 23,483 | 21.713 | 1.72% |
| formal/scheduler.ts:snapshot | 90,125 | 21.636 | 1.71% |
| formal/scheduler.ts:replace | 94,277 | 20.500 | 1.62% |
| formal/autonomy.ts:economicChoices | 32,055 | 18.131 | 1.44% |
| spatial:fullRebuild | 51,205 | 15.585 | 1.23% |

| 原生 CPU leaf 抽樣 | 抽樣秒 | Profile 比例 |
|---|---:|---:|
| cloneReplayCityDraft @ lab.mjs | 631.297 | 48.37% |
| cloneReplayCommandDraft @ lab.mjs | 184.255 | 14.12% |
| (garbage collector) @  | 137.853 | 10.56% |
| (idle) @  | 84.841 | 6.50% |
| (anonymous) @ lab.mjs | 65.269 | 5.00% |
| structuredClone @  | 27.529 | 2.11% |
| cloneEvent @ lab.mjs | 26.058 | 2.00% |
| cloneReplayEvent @ lab.mjs | 25.060 | 1.92% |
| buildingLevel @ lab.mjs | 11.718 | 0.90% |
| findReceipt @ lab.mjs | 7.725 | 0.59% |

矩陣各格都有函式／事件計時；統計式 CPU 抽樣集中於代表性的真實 1h／12h 與原生對照，並非九格每格都取得 CPU sampling profile。CPU 是 1,000µs 統計抽樣，可能把 native 內部成本歸到 caller；用明確呼叫點計時交叉確認，不把 sampleMs 當精確函式計時。GC 的抽樣／observer 時間與 clone／yield wall time 可能重疊，**不能再加到總時間**。

## 成長中的 pending、全域掃描與快取

| AI 事件起始 pending 範圍 | AI 次數 | 平均完整 AI ms |
|---|---:|---:|
| 0–1,023 | 1,409 | 4.634 |
| 1,024–2,047 | 1,365 | 6.885 |
| 2,048–4,095 | 2,563 | 10.511 |
| 4,096–8,191 | 4,959 | 16.787 |
| 8,192–16,383 | 8,599 | 28.966 |
| 16,384–32,767 | 5,628 | 48.050 |

這是同一 replay 的分組觀察，世界成熟、軍隊／城市／政治亦在變，不能當單一變量因果實驗；但實際整份 evidence clone 點已直接量到 656.167 秒。最大觀察值是 110 城市、20 軍隊、441 queued events、23,483 pending。

advanceOneEvent 逐事件全域協調與 AI 重複城市／軍隊掃描確實存在。真實資料的 reconcileWonders inclusive **0.170 秒**、reconcileCatchup **0.037 秒**、invalidateEndgameIntel **0.058 秒**；reconcileVictory inclusive 15.239 秒、resolveExtinctions 16.789 秒、retireAutonomy 2.938 秒、retireGovernors 7.245 秒（inclusive 有共用子呼叫，不能相加）。全部 G self 約 26.955 秒／2.14%，不應先刪除或延後呼叫。

SpatialIndex 完整重建 51,205 次，self 15.585 秒；已接受 AI command 會使不同 draft／主物件的 cache 反覆重建。AI 的 publicSituation 建 faction map／掃城市、incomingAlerts 掃軍隊、經濟候選遍歷 catalogs，chooseEconomic 在排序中 JSON.stringify；這些值得後續精確 cache／索引研究，但目前直接成本比整份 commandFacts clone 小得多。經濟採 anchored lazy settlement，不是每個小時再把所有世界狀態粗化；不得用聚合跳過中間 AI 可見狀態。

## Yield 與 Worker 反應

- 原版 RuntimeWorkBudget 保持 8ms、start 開口 4ms；pending intake 2ms CPU 門檻／2ms requested pause 未改。單一 event 仍是原子單位。
- 真實 Node 有 23,991 次 yield、等待 136.827 秒；原生 23,514 次、等待 172.641 秒。大多是 no-pending 的 0-delay timer 請求，並非 0ms 實際等待。這包含 timer clamp、host 排程與可能 GC，沒有把它稱作純 timer API CPU overhead。
- 原生最長觀察 work slice **12.750 秒**；每 50ms 合成 ping 共 25,380 次，mean 71.413ms，max 12,745.100ms，2,421 次 >100ms、630 次 >250ms。wall 長尾包含 host／GC／取樣干擾，不能稱為相同長度的純 CPU。
- **8ms 是完整事件之後才檢查的工作預算，不是 8ms 回應保證。** ping 是開發 Worker 的 round trip，不能當成正式玩家 T1 durable ack／T2 commit latency。正式 intake／FIFO／Fence／Recovery 由未修改的 runtime 與既有相關隔離測試保護；完整長 replay 與新玩家命令並發的真機延遲仍待測。
- 不能為分數延長封鎖。先降低每個事件的配置／複製及長尾，再重測是否值得自適應預算。

## 記憶體、工具干擾與失敗紀錄

- Node 詳細 12h sampled heap 1,172.2 MiB，觀察 44,668 次；GC observer 137.652 秒／6,064 次。原生 DedicatedWorker sampled heap **224.0 MiB**，21,676 個 50ms CDP 取樣。均是該受測 process／isolate 的抽樣高水位下界，包含工具影響，不是精確 live game heap／總 RSS／手機 RAM。
- Node compiler／fake-IDB 與原生 Worker／實體 IDB 的保留資料、V8 版本、GC 及 CDP 取樣不同。不能把 heap 差異當成遊戲最佳化收益，也不能把 Node OOM 推給 Android。GC／sampling 對最長事件的因果尚無時間關聯 raw trace 證明。
- 私人 1h 交錯 count／sites／sites／count：25.474、24.325、28.161、25.868 秒；count 平均 25.671 秒、sites 平均 26.243 秒（約 +2.23%）。n=2 且與壓力 fixture 共用 2 CPU，只是工具干擾診斷，不能宣稱精確 overhead 上限。四次 8,512 事件及所有權威欄位／完整 Ledger／Report History 完全相同。
- 原生冷載入曾發現 Profiler 對 async tail-return Promise 太早關閉 span；只修正測量 transform，加入不改原 catch／rejection 語意的 regression，1h 原生詳細重跑成功。初期 Node 大案例的 A／J 進度牆鐘與同步 clone／event 點有效；早期 readLedgerArchive 子方法 inclusive 不作冷載入延遲證據。舊失敗不假裝是遊戲 Runtime 故障。
- 30-day mature setup OOM 與未完成的 developed 12h exploratory case，均未列完整時間／throughput。沒有為通過而放大 heap、略過事件或更改規則。

## 結果等價性與驗證

真實 12h Node／原生的 World Time、Factions、Cities、Armies、Events、Autonomy、Economy（城市／勢力內）、Research、Combat、Politics、Wonders／Victory（世界專案／勝利）、Sequences、完整 Ledger archive、完整 Command Receipts／Outcomes、commandFacts 與全部 Report History，**38 組 SHA-256 比對均相同**；事件順序觀察值也相同。沒有刪除 commandFacts 或只比玩家資源、城市／事件數。非密碼學事件 checksum 是補充，後續最佳化仍需原版 oracle／嚴格順序測試。

1h Node count／修正後原生詳細的完整結果也相同；原子提交後再由正式 loader readback 驗證。沒有把 private replay draft 發給 UI。工具只在 Benchmark library build 插入探針；Production Build 中找不到 __b10p0／fixture／工具錯誤字串，正式發行沒有常態事件紀錄負擔。

最終驗證結果列於 [VALIDATION.md](VALIDATION.md)。工具、私人本機與 Android USB 操作見 [README.md](README.md)。完整數據見 [evidence](evidence/)；不含原始存檔或 raw traces。

## 優先方向與是否需要斷點續算

**有實測根據優先研究安全最佳化**：先縮小 replay commandFacts／mutable draft 複製，再做 pending 索引、scheduler 往返、SpatialIndex／純衍生 cache，最後重測 yield。前五項各自的改善方向、正確性風險、修改範圍、正常 25X 適用條件及分批順序見 [PHASE-2-PLAN.md](PHASE-2-PLAN.md)。所有項目都可能因 alias／stale cache／排序／rollback／身份而改結果，沒有僅靠「cache」就自動安全的方案。

2–3 分鐘值得研究，**尚未證明能達成**；30–60 秒沒有支持的實測。以合成案例固定其他成本的算術殘額看，即使全部 B 複製消失，仍約 348 秒；這不是可達速度的預測，實際 GC／yield 亦會改變。只砍全域協調不足以達標，也不允許降低行為／精度。

斷點續算不減少一次完整補算的 CPU。先最佳化，保留獨立設計議題；目前沒有 Android OS 中斷／回收率，不能判定必須立即施工。建議在安全最佳化後，實機 12h／25X p95 仍 >180 秒／p99 >300 秒，並可重現 OS 中斷造成重做、heap 接近實測安全餘裕，且 checkpoint overhead <5% 且小於實際重做成本時，再另開協定工程。必須是綁 source root／epoch／branch／Fence 的**非權威 replay workspace**，最後仍一次 T2；不能把 offline draft 改成 foreground 偽裝正式保存。

## 尚未驗證

Android 真機熱降頻、背景 timer throttling／freeze／OS kill、整頁與 Pixi／圖片的總記憶體、原生 IDB 磁碟／配額、完整 Runtime request loop／WorldStream／renderer 成本、長 replay 中真正玩家命令的 T1／T2 延遲分位數；大型奇觀／現代化協調專用壓力、30-day mature setup 的 retained heap 根因，以及其他 seeds／裝置的多次 p95／p99 整次完成時間。Cloud／headless 結果不代表手機 SLA。歷史 B5 E1 HOLD、Astra Gate 非 PASS 與既有驗收紀錄不因此改寫。
