# B10 P0 離線世界 Benchmark（第一階段）

此工具只量測正式的 `FormalPersistence.loadWithOffline()`、Formal reducer 與 `RuntimeWorkBudget`。不修改 `src/`、遊戲規則、AI 決策頻率、存檔格式、Ledger、Recovery 或 Runtime 權威架構。不得將本 PR 當成第二階段最佳化或發行驗收。

閱讀 [實測報告](REPORT.md)、[第二階段方案與風險](PHASE-2-PLAN.md)、[驗證結果與未完成項目](VALIDATION.md)；[evidence/](evidence/) 僅含去識別化統計。

## 安裝與最小測試

使用 Node >= 22.13（本次實測版本見報告），在 repository 根目錄執行：

```sh
npm ci
node --test scripts/offline-benchmark/metrics.test.mjs scripts/offline-benchmark/isolation.test.mjs
node --expose-gc scripts/benchmark-offline.mjs --speed 1 --hours 1 --out artifacts/b10-p0/smoke.json
```

預設是 seed `90217`、100 勢力（99 AI）、100 城市、25X、離線 12 現實小時。`savedAt = 1800000000000`，結束時間由該固定錨點加離線時數決定。所有排程仍由正式 reducer 逐事件執行。合成 fixture 與匯入屬於 setup，不計入完整載入／重播／提交耗時。

```sh
# 固定九格 + 0/25/50 AI（12h）+ 建築／戰鬥／成熟／大型 Ledger（1h）；每格獨立 Node process
node scripts/benchmark-offline.mjs --matrix --out artifacts/b10-p0/matrix.json

# 分開跑，避免與其他 Benchmark 爭用 CPU
node --expose-gc scripts/benchmark-offline.mjs --mode count --cpu --out artifacts/b10-p0/count-cpu.json
node --expose-gc scripts/benchmark-offline.mjs --mode sites --out artifacts/b10-p0/clone-sites.json

# 重點場景與 Ledger 候選數（仍受正式 retention 限制）
node --expose-gc scripts/benchmark-offline.mjs --scenario combat --hours 1
node --expose-gc scripts/benchmark-offline.mjs --scenario developed --hours 1
node --expose-gc scripts/benchmark-offline.mjs --scenario mature --mature-days 7 --hours 1
node --expose-gc scripts/benchmark-offline.mjs --ledger 60000 --hours 1

node scripts/offline-benchmark/summarize.mjs artifacts/b10-p0/matrix.json
```

`--mode detailed`（預設）收集分段與事件耗時；`--mode count` 僅留下逐事件計數／順序檢查碼、尺寸觀察及正常 yield，供插樁開銷對照；`--mode sites` 另分辨各原始碼位置的 `structuredClone`。count 仍不是零開銷的正式遊戲。CPU Profile 只輸出抽樣 leaf CPU 統計，不寫出原始 trace。完整耗時不含 build、fixture、匯入、Writer acquisition、事後世界 fingerprint／readback 及清除隔離 DB。

## 私人原始備份：本機唯讀操作

請將原始檔留在私人目錄。不要複製到 `public/`、`docs/` 或任何會提交的目錄。以下命令以引號保護包含空白／中文的路徑：

```sh
node scripts/benchmark-offline.mjs --mode count --validate-only \
  --private '/private/path/列國征途-刪除前原始備份.realm-save.json' \
  --out artifacts/b10-p0/private-validation.json

node --expose-gc scripts/benchmark-offline.mjs --mode sites --hours 12 \
  --private '/private/path/列國征途-刪除前原始備份.realm-save.json' \
  --out artifacts/b10-p0/private-statistics.json
```

工具接受正式 portable envelope，以及只有現行 `lieguo-formal-bounded-v1` namespace 的完整 `lieguo-recovery-archive-v1` 原始資料庫備份。後者是 **Benchmark 專用隔離還原器**，不是新增正式遊戲匯入能力，也不是存檔遷移。它要求完整 table 集合，以 `bulkAdd` 拒絕重複主鍵，在單一交易複製至隨機 `-b10p0-UUID` namespace；不開啟檔案內指定的任何 DB。接著由原版 Writer Fence、Ledger 驗證、`loadSave`、Recovery 與完整 Formal Schema 判定是否可用。完整 Inbox／Recovery／domain authority 也經正式 full-export/import 邊界在第二個拋棄式 DB 驗證，主要 raw clone 保留原分支／Fence／Inbox。失敗即刪除隔離 DB，保留原檔；不修補或重算任何既有 checksum。

若正式載入器選用了 Recovery，輸出 `sourceRecovered: true`，不能將它當成原 current snapshot 的測量。工具在隔離 DB 中增加一次正式保存，設定固定的離線錨點；保存後的世界時間、倍速、離線上限、已提交結果與所有遊戲規則保持由正式程式決定。私人存檔的倍速／離線上限不會被命令列覆寫。本次指定 12 小時是受控 absence，原始 raw archive 不提供玩家實際回來時的完整時鐘情境。

Node 使用記憶體 fake-indexeddb；不讀取 Chrome 的 user profile。瀏覽器測量只在獨立 localhost origin 使用隨機命名 DB。正常結束會刪除隔離 DB；若瀏覽器被系統終止，可以在該 **Benchmark localhost origin** 的開發者工具只清除 `-b10p0-` 結尾資料庫，請勿清除正式遊戲 origin。

JSON 不含玩家名、戰役／城市／軍隊／命令 ID、資源數值、指令 payload、報告文字、原始備份路徑或世界內容。私人輸出也移除世界 fingerprint。只分享經人工檢查的統計 JSON；不要上傳原始備份、DB、CPU／Heap raw trace 或瀏覽器 profile。`artifacts/`、`local-saves/`、`work/` 均被 Git 忽略。若研究人員使用可選 `--private-proof work/proof.json`，檔案只含供本機比對的單向欄位 digest，也應留在私人環境，勿附到 PR。輸出路徑若等於輸入，或經 symlink／hardlink 指向輸入，工具會拒絕執行。

## 原生 Chromium / Android Chrome

桌面自動測量需要 Playwright（既有環境可用時不必安裝）。指定既有模組與 Chromium：

```sh
PLAYWRIGHT_MODULE='/absolute/path/to/playwright/index.mjs' \
CHROMIUM_PATH='/absolute/path/to/chromium' \
node scripts/benchmark-offline-browser.mjs --mode count --cpu --pings --hours 12 \
  --out artifacts/b10-p0/native-count.json

# 可加相同 --private 參數；輸入僅經本機 automation IPC 傳入隔離 Worker
node scripts/benchmark-offline-browser.mjs --serve
```

`--serve` 只綁定 `127.0.0.1:5197`，只提供三個固定資產，不記錄 request、沒有 upload API。用本機瀏覽器開啟印出的網址，選擇私人檔案；檔案只在瀏覽器記憶體讀取。seed Worker 在建立 fixture 後終止，再使用新 DedicatedWorker 進行冷載入。與正式遊戲相同的 8ms 工作預算與完整事件邊界仍生效。

Android 實機可用 USB 連線：

```sh
adb reverse tcp:5197 tcp:5197
```

在手機 Chrome 開啟 `http://127.0.0.1:5197`，選取手機私人存檔；完成後下載統計 JSON。不要連到正式遊戲 origin，不要用正式遊戲匯入檔案。記錄手機型號、Android／Chrome 版本、電量／溫度、背景程式、前景／背景狀態及是否被系統終止。頁面不宣稱量得 Worker heap；桌面 CDP runner 才有定時 `Runtime.getHeapUsage`。Android 遠端 CPU／Heap 剖析若另行啟用，原始資料也只留在私人環境。

## 指標與解讀界線

- `stages.read/offline/save` 是實際進度邊界 wall time；`totalMs` 是一次完整 `loadWithOffline()`。
- operation 有 inclusive 與 self；self 扣除已插樁子呼叫。**不可相加 inclusive 時間**。`summarize.mjs` 用 replay checkpoint 差值與 self 分配 A–J；C 包含未歸屬時間及量測 bookkeeping。B 包含事件期間命令 draft 複製；E 包含共用 economy handler 中的建造分支，F 的獨立事件統計另列 `construction.complete`，避免把跨子系統 self 分配誤認為完全獨立業務階段。
- A–J 是有明確函式邊界的操作歸屬；正式載入、重播、提交的巢狀驗證不能假裝是互不重疊的十次完整流程。
- 每 label 最多保留 2,048 個 Algorithm R reservoir 樣本。count、累計、平均與最大值來自全部呼叫；p50/p95/p99 是抽樣估計，分別至少 20/100/1000 次才輸出。事件數不足時是 `null`，不能作 p99 主張。
- `event:TYPE` 是**實際執行**的完整事件次數及 inclusive 時間；scheduler pop 也可能被取消／重建使用，不能當世界事件數。
- event-order checksum 是額外的非密碼學順序觀察，不取代逐項結果等價性。隔離測試比較全部 world keys、完整 Ledger archive 與完整 Report History，包含 commandFacts；不採用會截短或省略權威欄位的既有 scenarioWorld comparator。
- Node heap 每 20ms、每 256 事件及每 yield 抽樣；原生 Worker heap 每 50ms CDP 抽樣。這是實測 sampled high-water mark，是相應 Benchmark process／isolate 實際 peak 的下界，不是零插樁遊戲的精確 Peak Heap。現行工具的 setup/readback 不在觀察區間，profiler 本身的 retained heap 包含在內。本次早期矩陣採用的 v1 memory collector 包含事後 readback，其資料會明確標記該窗口，不將它冒充純重播 heap。
- 原生外部 CDP 的 CPU／heap 窗口從新測量 Worker ready 後到 timing-stop，也包含 Writer acquisition 與起停握手；這些不包含於 `totalMs`。fixture／seed Worker 與事後 fingerprint 不在該窗口。Node 現行 observer 則由計時 load 前後的 hook 啟停。
- `yield.totalMs` 包含 timer 等待、host 排程與可能 GC；它不是純 timer API CPU cost。8ms 只在完整事件後檢查，單次事件及最後驗證／原子提交可以超過 8ms。
- 工具量到真正的 persistence／reducer／work budget，沒有量 renderer、WorldStream 或 Runtime 載入後的 pending command 執行。原始 Inbox／Fence 會保留並驗證，但不會為分數而執行或丟棄玩家命令。既有 Runtime 排程／durable tests 另外檢驗其可靠性；Android 對實際訊息的回應延遲仍需真機測量。

AI scaling fixture 因正式 Schema 要求固定 100 勢力／99 AI registry，將 100 城市分配給玩家與指定數量 AI；其餘 AI 由正常滅國／retire 規則停止決策。它量的是 0/25/50/99 **持城 AI**，不能聲稱只改 AI 數量而其他世界拓樸完全相同。developed/combat 是明示的人工已完成狀態；combat 使用合法鄰接位置及正式命令／行軍／戰鬥開始。mature 預設推進 7 世界日，可用 `--mature-days 1..30` 指定，每世界小時透過正式 Persistence 保存一次；若自然滅國暫停，保留實際結果，不繼續捏造存活世界。本次 30 日 setup 曾遇 Node 約 2 GiB heap OOM，須單獨記為失敗，不能當成 Android 或完整重播的記憶體結果。`--cities 200` 使用 native `initialCity`／economy 初始化建立固定合法擴張 fixture，供城市規模比較。大型 Ledger 需同時看 `requestedLedger`、`inputDimensions` 與保存後 `initial`；60,000 候選不會變成合法的 60,000 retained outcomes，前景／自動各 1,024 的正式 retention 保持。
