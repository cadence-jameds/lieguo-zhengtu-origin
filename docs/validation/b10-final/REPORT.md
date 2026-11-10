# B10 Final Integration Report

> **整體結論 B：CONDITIONAL PASS。** 核心命令可靠性、確定性、Persistence／Recovery、完整回歸與既有六個 PR 的 CI 可接受；Production SW 故障後重試仍有一個 FAIL，Android 實機 NOT TESTED，冷載入及容量／記憶體條件尚待決策。**正式發布維持 HOLD，不能宣稱 Release Gate 完成。**

專案：《列國征途：始源》／`cadence-jameds/lieguo-zhengtu-origin`。本輪只作正式引擎整合審查、驗證與文件；產品、遊戲規則與既有測試斷言未修改。原始完整來源固定為 **`8d40f63c5efbd08ee252f533719d5f58fc95b3dd`**；最後可玩 source／content SHA 為 `803b174db5d2be0adef24b94b22782856ae365b9`。

工作分支：`validation/b10-final-integration`，Base 為 #59 `feat/b10-r3-06-ai-scheduling`。main、#54～59 既有提交歷史與 Draft 保留，未合併、未部署、未轉 Ready。B5 E1 **HOLD**、Astra **未 PASS**、Android 實機待驗事實不變。

## 1. PR、祖先與 CI

| PR | HEAD | Base | 狀態 | 最新 HEAD 對應成功 CI |
|---|---|---|---|---|
| #54 | `edca2f29805f0cdc4b0f89cd3cd00a8f9a819e39` | `main`／`443f170…` | Open／Draft／未合併／mergeable | [41282458194](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41282458194) |
| #55 | `4e56b69d1af107ee454213d0276f06a2ca10976f` | #54／`edca2f2…` | Open／Draft／未合併／mergeable | [41296235796](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41296235796) |
| #56 | `1737d14a8f210fb2d33eb5dadbde18c3bb375586` | #55／`4e56b69…` | Open／Draft／未合併／mergeable | [41426784041](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41426784041) |
| #57 | `dfa574a4de24fe9069df2a90d3edae6a64f191da` | #56／`1737d14…` | Open／Draft／未合併／mergeable | [41548741684](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41548741684) |
| #58 | `c370ff8a492de8711e764a82c8f1d43efef1a00e` | #57／`dfa574a…` | Open／Draft／未合併／mergeable | [41579721205](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41579721205) |
| #59 | `8d40f63c5efbd08ee252f533719d5f58fc95b3dd` | #58／`c370ff8…` | Open／Draft／未合併／mergeable | [41629201376](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41629201376) |

GitHub 實查六個 HEAD 皆與需求提供的一致，每個 Base SHA 都等於前一階段 HEAD；main 仍是 `443f170b277f71ee26a34ee3b5017687a98e01ab`。每階段包含上游全部提交，增量依序 12／11／17／12／11／16，共 **79**；stable patch-id 比對沒有重複 patch。與最新 main 沒有新增衝突，六階段逐階 merge 模擬 tree 完全等於各原 HEAD tree。

六個成功 run 均逐一檢查 Verify 工作步驟。#59 CI 使用 Node **22.23.4**，實際測試擬合併 SHA **`df1a008437dc05de8e4be75d2bb160b838b8a3f7`**：**2419 PASS／0 FAIL／1 SKIP**，Typecheck／Build／Pages 路徑／Release／Worker identity 成功。這不是把舊 HEAD 的綠燈借給新來源。原查詢亦保留同 HEAD 較早 cancelled runs。

證據：[GitHub 快照](github-snapshot.json)、[六個工作步驟摘要](github-ci54-58.json)、[#59 日誌摘錄](github-ci59.json)。

## 2. 架構與可靠性

完整架構圖、權威／交易邊界、玩家命令生命週期、Ledger／Save／Recovery 流、Projection／Preview 隔離與六階段交界見 [ARCHITECTURE](ARCHITECTURE.md)。20 項 P0 情境與測試對照見 [RELIABILITY-MATRIX](RELIABILITY-MATRIX.md)。

正式原則保持：Created ≠ T1 Durable；T1 可與私有 AI 補算交錯，原 Payload／身份不變；正式效果與不可覆寫 Original Result 同一 T2；T2 成功才 Ack／公開新世界；T3 遺失仍以原 CampaignId＋CommandId 查回。Recovery 的 rolled-back 是分支 disposition，不能讓舊身份重新生效。

最終格式核對：DB **`lieguo-formal-ledger-v1`**、Dexie **3**、Save **`lieguo-formal-ledger-save-v1`**、WorldStream **v2**。Native ruleset **`v97-p0c10.1`**、content `lieguo-formal-p0c10-time3`、generator `formal-world-384-v1`、terrain **3**，與應用程式版本獨立。R3-03 後格式相容；沒有重新加入更舊 migration 或覆寫舊 DB。

## 3. 確定性、Gate 與完整回歸

| 項目 | 本輪結果與範圍 |
|---|---|
| Typecheck | PASS，Node 24.19.0，正式來源不變 |
| `npm run build` | PASS，含 TypeScript、Vite Production Build、Runtime／Preview bundle、PWA generateSW |
| 正式 Successor／歷史證據 | 全部正向 Gate PASS，v95／96／97、PR53 與歷史來源保留 |
| 反竄改 | **51 項 PASS**，原期限／數量／2 workers／斷言不變 |
| Projection／Preview boundary | PASS，正式讀模組／schema 等價及唯讀能力隔離 |
| Reference／Optimized | **31／31 PASS**，固定 PR58 原始碼獨立 module graphs；正式 Schema、每個事件／玩家與 AI 命令／Ack／RNG cursor／最終世界／必要 60k history hash 一致 |
| 完整隔離回歸 | **2419 PASS／0 FAIL／1 SKIP**，237 個報告 suites；758.58 秒，`verify-in-isolation.mjs full`，沒有直接在驗證工作樹跑舊產檔測試 |
| 原 Runtime／30 秒測項 | PASS，最重既有 developer speed／AI catch-up 測項 **9.989 秒**；同檔其他正式 Runtime 測試皆 PASS |
| 原 150k／120 秒測項 | PASS，**36.632 秒**；合法 150000 receipts 的 start／import／Recovery／全歷史 hash 保留 |
| GitHub 完整 CI | #54～59 最新 HEAD 對應成功；#59 **2419 PASS／0 FAIL／1 SKIP** |

唯一 SKIP 是既有可選的私人 late-game save 測項；本輪沒有提供或讀取私人存檔。不將本機單次 150k／Runtime 耗時拿來與不同批次作精確效能比率。

31 組涵蓋合法 1／3／6／10／25X、0／99 AI、dense tie、兩帝國奇觀、軍事戰鬥、治理與建訓研、科技與 RNG、人口／資源、保護、滅國／復國／結束、勝利條件、真正 offline API、24 世界小時及 60k 身份。沒有發現 Reference 與最終正式結果分歧，沒有為效能改遊戲規則。

## 4. 真實 wall-clock soak

**PASS：600.268 秒實際經過時間**，固定完整 Stack，100 勢力／99 AI／25X，實際 React `useGame`＋唯一 Runtime＋native IndexedDB。六筆合法 DOM 操作均在本輪期間提交；重新載入查每個原 ID 為 committed，正式效果各一次。所有 99 AI 至少決策 4 次、總計 552 次；觀測 1330 個正式事件處理呼叫。最終世界時間 `15031492ms`，不能與實際 600 秒混為一談。

| 延遲，毫秒 | p50 | p95 | n |
|---|---:|---:|---:|
| 點擊 → Durable | 10.8 | 23.9 | 6 |
| T1 工作 | 9.7 | 20.2 | 6 |
| T2 工作 | 63.3 | 87.9 | 6 |
| 點擊 → UI 收到 Ack | 115.2 | 171.1 | 6 |
| Ack → 可見終局 | 0.6 | 0.9 | 6 |

整個 cgroup CPU 使用 86.257 CPU 秒，占兩 CPU 配額的實際區間約 7.18%；含瀏覽器、伺服器與 harness，非純引擎 CPU。Worker 使用中 heap 六點約 25.6／33.7／20.2／36.9／46.2／19.0MiB，觀察到回落；這不是 retained heap 或連續峰值。量測窗最小 React Surface 沒有觀察到 Main Long Task，不能外推完整 GameApp／手機。沒有在 soak 中強制 GC 或發合成時鐘訊息。

Headless 曾切到另一頁並記錄 visibility，但不代表 Android 背景暫停；沒有 OS 真正休眠、實機程序回收或觸控。本輪另有合成世界時間測試與獨立 forced-GC heap 診斷，分開報告，不能充作更長真實 soak。

## 5. 原生故障、效能、冷載入與 Production SW

### 5.1 原生正確性

Chromium **154.0.8037.57**／Linux／兩 CPU quota／8GiB；真正 Dedicated Worker、IndexedDB、Structured Clone 與 Web Lock，資料皆為合成。Runtime **4 組 PASS**、GameApp／Projection **6 組 PASS**、Persistence **9 組 PASS**、Ledger **7 組 PASS**。含 11 個有效果 T2 寫入邊界、七個無效果寫入點、T1／T2 Quota、Segment／Result／Manifest 損毀、Index／checksum Recovery、真 Worker 終止、Ack／最後 frame 遺失、真雙頁 Writer 交接、原始結果及 readonly Preview 對照。

0／1k／10k／30k／60k 合法歷史重跑原生 roundtrip／Recovery，150k 另走真正 Worker。原生舊 Ledger 工具的一個 v1 `state.world` 讀取已在**新衍生 adapter** 改接實際 v2 PresentationStore；原檔與所有斷言／數量／期限保持原文。所有初次失敗與原因另保留，沒有用刪測項取得 PASS。

### 5.2 完整來源效能

以下均為本輪資料，**不與舊批次相加或換算全流程加速**。Native Runtime 表使用真正 `useGame`／Runtime／IndexedDB，DOM 合成點擊、固定 backlog 合成時鐘、真實經過延遲；啟動排除，每筆／批次新瀏覽器與 DB。不是實機觸控、OS 休眠或 SLA。

| 情境：點擊 → Durable，ms | p50 | p95 | 樣本 |
|---|---:|---:|---:|
| 空閒 | 12.4 | 15.9 | 20 筆 |
| 一般 1X 補算 | 44.3 | 58.1 | 20 筆 |
| 99 AI／25X | 49.8 | 60.5 | 20 筆 |
| 實際戰鬥回合＋99 AI／25X | 52.0 | 70.6 | 20 筆 |
| 100 城市建造／訓練／科研 | 30.7 | 45.2 | 20 筆 |
| 長前景補算 | 47.7 | 67.2 | 20 筆 |
| 真 away／resume 離線 API，合成間隔 | 15.3 | 22.2 | 20 筆 |
| 99 AI／25X，50 筆連發 | 390.8 | 908.7 | 5 批／250 筆，累積等待 |
| 離線 API，50 筆連發 | 414.3 | 707.3 | 5 批／250 筆，累積等待 |

50 筆的最慢最後一筆等待分別 1141.1／819.1ms；不能將 pooled 250 筆百分位冒稱 250 次獨立單點操作。每筆原 Payload 與終局結果核對，合法的 needs-confirmation／rejected 保留。最初 battle 窗口僅有到達事件，**不當作大型戰鬥數據**；補充 3 世界小時窗口的 20 筆都確認 `combat.round`，保留原 30 秒等待與斷言。這不是增加測試 wall-clock 期限。

10 分鐘 soak 的自然自動 Tick T2 另有 **723 筆，p50／p95 62.3／92.0ms**；排除玩家 T2 與首次操作前啟動，不與上述點擊延遲混加。玩家的正式結果仍須等待所有先行事件：99 AI／25X 點擊至終局可見 p50／p95 **617.2／665.7ms（20 筆）**，長補算 **4635.5／5340.8ms**、離線 **4660.8／5458.6ms**。T1 快速持久接收不代表立刻完成遊戲效果。

原生 Dedicated Worker 的正式 Persistence，100 勢力／99 AI state／25X：

| 60k 操作，ms | p50 | p95 | n |
|---|---:|---:|---:|
| T1 | 11.1 | 18.0 | 20 |
| T2 | 51.4 | 55.8 | 20 |
| 原結果查詢 | 1.7 | 4.7 | 20 |
| 重開 DB 讀取（模組／proof 溫熱） | 2563.3 | 2572.5 | 5 |
| Recovery | 3319.1 | 3587.2 | 5 |
| Quick Export | 1657.4 | 1898.2 | 5 |
| Full Export | 1660.6 | 1920.7 | 5 |
| Quick Import（同 Worker） | 4627.0 | 5894.6 | 5 |
| Full Import（同 Worker） | 4492.1 | 4828.0 | 5 |

這是持久函式成本，不是完整 UI 操作耗時或冷 Worker 匯入 SLA。另附 0～60k 的 Main harness 原生函式量測，明確與 Worker／GameApp 分列。

150k 真 Worker 五次重開 p50／p95 **5802.5／7538.8ms**，Recovery **8192.4／10297.9ms**；T1 **7.7／14.0ms**、T2 **61.8／84.6ms**，皆 n=5。建立完整 150k fixture 單次 **18.58 秒，n=1**，不是新建一般空歷史戰役的延遲，也沒有可靠 p95 分布。

Projection 60k 同版合法 RAM fixture：Tick **309 bytes**、命令 **1800 bytes**、snapshot **467736 bytes**。Worker Tick 建構 p50／p95 **2.8／10.2ms（30）**、命令 **2.8／7.6ms（30）**；Main Patch 套用 **0.4／0.9ms（66）**。這些是不同階段，不可相加成端到端數字。混合 Tick／resync／command 的原生 React Profiler **0.2／0.8ms（68 次）**，兩城市各 render 68 次；一般共享世界時間會觸發更新，沒有宣稱所有元件零重繪。獨立單城庫存 100 次的參照／selector 保護另由 React 定向測試驗證。

### 5.3 冷載入調查

實際 GameApp、每次全新瀏覽器／Authority Worker／原生 DB。fixture 在另一個終止的 Worker 建立，proof 不共享；量測從 navigation 到城市可操作，含測試 networkidle 等待，**不是只量載入按鈕最後一小段**。每格 n=5，秒：

| 歷史 | Dev p50／p95 | Production p50／p95 | Production Main Long Task p50／p95，ms |
|---|---|---|---|
| 0 | 未補同輪 Dev 分布 | 1.095／1.243 | 78／130，15 tasks |
| 60k | 5.937／6.340 | 5.865／6.346 | 65／78，10 tasks |
| 150k | 11.919／13.772 | 12.477／13.038 | 81／109，10 tasks |

本輪 Production 仍重現**長讀檔等待**，不能歸咎於 Vite dev。正式冷 Worker 完整驗證 Ledger、Manifest／原始結果及逐批精確 Index 是主要成本；例如 60k 的一筆 Dev inclusive `loadAnchored` 3824.7ms，內含 `readLedger` 1869.1ms、其中 `verifyLedgerArchive` 1491.5ms、`readLedgerArchive` 377.2ms；其餘含世界 decode、精確身份核對等。這些 inclusive 巢狀時間不能相加。

Production 15 個樣本 Main **沒有 Ledger／Index 的 IndexedDB object-store 操作**，正式讀取在 Worker；Native IDB Structured Clone 仍是 Worker 讀取成本的一部分，不是把整份歷史搬回 React。額外單筆 Main CPU 診斷大部分為 idle（約 5.84 秒），其餘見 UI bundle、schema／React 及 GC；診斷加插樁，不替換五次分布。

60k／150k 最長 Main task 78／109ms；五次 0 歷史啟動也有 130ms。Heartbeat 最大間隔分別 145／165ms（0 歷史 183ms），60k 代表樣本接到 18 個 phase／progress 訊息。這支持「多秒等待主要不在 UI Main，期間有進度」，**不等於完全沒有短暫卡頓**。`status !== ready` 及載入狀態持續保護操作；城市入口等完整提交世界可用後才進入，沒有用舊世界假裝已載入。

歷史 **11.53 秒／795ms** 離群值本輪未重現；**795ms 的確切根因仍未證實，不能宣稱已解決**。單次 CPU 診斷不能排除其他機器的 GC、排程或初次 UI 成本。冷載入與 Main 50ms 目標仍列 P1：需實機 production trace、更多樣本與具體體驗預算，再決定是否另立優化工作；本輪不重構，也不跳過完整身份驗證。

### 5.4 記憶體、GC 與容量

獨立 CDP 診斷走 8 次每次 3 世界小時（合成世界時鐘），保留 99 AI、2986 次決策、1743 筆歷史；9 個 heap 採樣後才強制 GC，V8 retained **12.71MiB，n=1**，另有 backing／embedder 數值。這不是實際一天 soak、連續峰值或原生 GC 次數，亦未納入任何延遲資料。

Node 專用 GC 診斷三情境各 n=1：simultaneous-99 觀察 3 次／13.33ms，legacy-30-day 96 次／94.12ms；短 first-decision 的零筆可能受 Observer 交付時點影響，不能證明無 GC。**Native GC 完整次數未量測**，與 CDP 的單次 Main GC CPU 取樣分列。

150k 大型匯出觀測到顯著暫存記憶體：另一次單點最大 Chromium process RSS 約 **3.24GiB**；六秒採樣 renderer 約 1.58～2.09GiB、cgroup 約 4.26～4.78GiB。包含瀏覽器／harness／OS cache，不是純 Worker retained heap，也不是連續峰值；不能拿 12.71MiB 的小歷史 retained 結論覆蓋大型備份成本。Android 記憶體壓力仍未驗。

此合法 150k fixture 的 **五次 Quick＋五次 Full 匯出均安全拒絕 100MiB 上限**。拒絕等待 Quick p50／p95 3972.7／6938.6ms、Full 4039.4／5971.0ms；這是**拒絕耗時，非成功匯出效能**。之後逐次 load／Recovery 身份仍完整，最後 150005 筆身份與歷史保留；原生 origin estimate 約 109.8MiB IndexedDB 使用量，quota 為該桌面環境回報值，非手機承諾。

因此這份 oversized fixture 的 Quick／Full **匯入 NOT TESTED（無可合法產生的檔案）**。較短 fingerprint 的既有 150k 隔離 Gate 確有往返 PASS，但不能拿不同 fixture 掩蓋此容量限制。必須由使用者在發布前決定上限／支援範圍及後續記憶體方案；不能截斷帳本、刪身份或放寬上限取得 PASS。

### 5.5 Production SW

真實 PR58 `c370ff8…`／0.30.99 與最終 PR59 `8d40f63…`／0.31.4 兩份 production source／metadata，各自產生 UI、Runtime、Preview、SW；僅在隔離 localhost 的 project path 提供，未公開部署。最後完整五情境：

| Production native 情境 | 結果 |
|---|---|
| 正常更新、原戰役與精確原 Ack 保留、離線重開 | PASS |
| 初次 SW 下載回 503，再恢復並更新 | **FAIL：重試 activation 逾時** |
| 真正 install reject，保留舊頁與資料，後續重試 | PASS |
| 真 IDB 保存 abort，不啟用、不宣稱保存成功 | PASS |
| T1 Durable 通知後實際關頁，重開查原 ID 一次效果 | PASS |

成功更新的 native 時序核對為 durable Ack → SKIP_WAITING → controllerchange → navigation。保存 abort 不出現成功 Ack、啟用或導航；T1 關頁可能發生於 T2 已完成之後，因此另由 Runtime 私有事件 barrier 故障測試證明「確實在 T2 前中止」。

最後失敗樣本則是 **正式保存成功 → SKIP_WAITING → 沒有接管，既有 15 秒 activation 預算後明確失敗**，原頁保留；外層 30 秒導航觀察 TIMEOUT。沒有觀察資料遺失、重複效果或錯誤版本成功宣告，但此更新可靠性情境 **未通過**。已提供 [最小重現、時序、根因定位與補修方向](PRODUCTION-SW-REPRO.md)；原生 activation／claim／cache 的精確根因尚待定位。各輪失敗保留，不將不同輪成功結果拼成整體 PASS，也未延長期限取得綠燈。

補充 **Production Preview／Runtime／WorldStream v2／離線 PASS**：真正 GameApp 建造面板啟動編譯後 Preview bundle，正式命令經編譯 Runtime committed；重開離線仍有精確原 Ack／Payload，Preview 仍能計算；只收到 protocol v2，畫面訊息沒有完整命令歷史。Production project path／fallback、Release artifacts／Worker identity 檢查均 PASS。正式公開 Origin 更新與 Android PWA 仍未驗。

## 6. Android 與發布條件

**Android 實機：NOT TESTED。** Cloud 無實體裝置；19 項可直接操作的驗收列於 [ANDROID-CHECKLIST](ANDROID-CHECKLIST.md)。桌面 Chromium、headless、模擬觸控與合成時鐘均不可填實機 PASS。

B5 E1 HOLD／Astra 未 PASS 保留。Production SW 即使 localhost 通過，仍須與 Android／正式部署 Origin 準備分開評估；CI 通過不代表正式發布 PASS。

## 7. 版本與安全合併

已驗證方案見 [MERGE-PLAN](MERGE-PLAN.md)。本機順序 merge 模擬 #54 → #55 → #56 → #57 → #58 → #59，每一步 strict metadata 及單份 release note 成功，當前 main 的預期正式版本為 **0.30.76 → 0.30.81**。功能分支 0.31.4 與 #59 擬合併 CI 0.31.0 來自不同 first-parent 歷史，並非人工改版。

合入上游後才將下一 PR Base 改為 main，保留原 HEAD，確認祖先／差異／單份 note，再重跑改 Base 後的最新 CI。本輪只驗證 merge-commit 路徑；不以 squash／rebase 或重複 cherry-pick 套上游。若 main 新增內容，必須重新模擬。本輪沒有實際合併或改 Base，也未授權會由 main merge 觸發的 Pages 發布。

## 8. 最終判定與交付證據

**程式碼技術合併條件：B／CONDITIONAL PASS。** 沒有確認的 P0 命令遺失、重複效果、非原子 T2、錯誤 Recovery 身份、多 Writer、錯誤 campaign 或事件不確定性。正式 source 的 CI 與完整回歸通過。Production SW 故障重試 FAIL 與以下 P1 須由使用者審核；main 合併會連動現有 Pages workflow，不能將技術接受解讀成自動發布授權。

**Android／Production Release Readiness：HOLD／未完成。** Android 19 項實機 NOT TESTED、Production SW 最終 4 PASS／1 FAIL、公開 Origin 未驗。B5 E1 HOLD／Astra 未 PASS 不解除。

| 分類 | 風險／影響 | 建議與必要條件 |
|---|---|---|
| P0 | 本輪未確認核心正確性／資料安全缺陷 | 不需要修改產品程式；繼續保留不可變身份、T2／CAS、正式規則與原 Gate。 |
| P1 | Production SW 下載故障後重試，activation 逾時 | 保留 FAIL；依重現表補原生 lifecycle／controller identity 證據，驗證最小補修後重跑完整情境，或由使用者明示發布處置。 |
| P1 | Android 真機、觸控、背景／鎖屏／程序回收、真記憶體壓力未驗 | 逐列執行 Android 表；不能用桌面、emulator 或 headless 填 PASS。 |
| P1 | 60k／150k production cold p95 約 6.35／13.04 秒；795ms 歷史離群根因未證實 | 保留進度／輸入保護，取得實機 production trace 與明確體驗預算；未授權另行架構重構。 |
| P1 | 合法 150k 大檔超過 100MiB，不能產生可匯入備份；編碼暫存記憶體顯著 | 決定支援規模／上限與後續預估容量或有界編碼方案；維持完整身份、原格式與安全拒絕，不截歷史或自動放大上限。 |
| P1 | 10 分鐘真實 soak 通過，數天／Android 長運行與實際 OS 暫停未知 | 不外推長期穩定性；另以真機及更長實際時間驗證，記錄 wall-clock／世界時間。 |
| P2 | 共享世界時間引起部分合法 React 重繪；部分診斷工具仍有舊協定假設 | 可後續改善 selector／診斷可讀性；不得繞過正式規則或把工具錯誤當產品 PASS。 |

所有量測有 n 與環境；n=1 的建立、CPU／retained 診斷沒有可靠分布結論。原始大型量測、私有瀏覽器 profile、dist、archive 與 raw traces 未加入 Git；交付的是合成資料摘要及可重跑程序。

交付索引：[完整架構](ARCHITECTURE.md)／[20 項可靠性](RELIABILITY-MATRIX.md)／[Android 實機表](ANDROID-CHECKLIST.md)／[合併方案](MERGE-PLAN.md)／[Production SW 重現](PRODUCTION-SW-REPRO.md)／[重跑與證據索引](README.md)。`evidence/` 保存精確 SHA、完整測項計數、31 組 hashes、各情境 p50／p95／n、故障結果及保留失敗摘要。新文件 PR 的 CI 以其最新 Checks 為準；本報告的 2419 PASS 指已完成的固定正式 source 與 #59 對應 CI，不預先宣稱尚未完成的文件 PR run 成功。

本批驗收完成即停止，保留六個原 Draft PR，等待使用者審核與合併／發布授權。
