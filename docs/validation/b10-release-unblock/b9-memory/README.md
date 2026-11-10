# B9 Shipment 快取記憶體診斷

基準為 Draft PR61 `dbcf7d59c55c322c272d4900cdf8a81e36ae8793`，前版對照為 `7264472e7cfc30ec72d64e24198d3d8d5d23adeb`。本批只檢查記憶體風險；正式物流、Schema、快取、安全驗證、T2、存檔、SW、Scheduler、RNG 與 AI 都沒有修改。

## 方法與限制

同環境 Node22.23.4、CPU quota `200000 100000`、8GiB、預設 heap `2197815296` bytes、`maxWorkers=2`。A 為修改前，B 為目前正式快取。依序 A1/B1、B2/A2、A3/B3，各三個全新程序；另外 A4cpu/B4cpu 各一次舊 CPU Profiler 工具控制，不混入三次正常統計。

每次執行原 `breakthroughB92.test.ts`，完整前置800趟奇觀＋2,000趟突破、60M資源、原11項斷言及240秒 beforeAll 不變。兩版測試及 helper 逐 byte 相同，SHA256 列於 `measurements.json`。沒有預製 funded fixture、減少物流量或更改扣款／到貨／返還。

這是獨立 Node/Vitest 診斷，不是原始完整 Gate、Chromium 或 Android 結果。maxWorkers 保持2，但單一檔案只有一個活動測試 Worker；不冒充兩個 full-suite Worker 同時競爭。程序逐一執行，沒有並行瀏覽器或其他 benchmark。

觀察器在 clone／schema／每128趟邊界採樣 RSS、Heap Used/Total、External、ArrayBuffers；`process.resourceUsage().maxRSS` 記錄程序高水位。數據是執行原測試的fork Worker程序，並非整個cgroup或Vitest parent合計。Heap 峰值為採樣下限，不宣稱每個瞬間都被捕獲。GC 使用 PerformanceObserver，統計保留原始測試結束時的次數及耗時；不把後續強制GC算入正式負載。

診斷 Worker 使用 `--expose-gc`，**原始所有測試結束，再靜置20秒後**才在診斷 hook 收集三次 GC。這沒有改正式遊戲或原始 Gate 的 GC 行為。保留實際 funded world，另外對相同真實2800筆紀錄做60次唯讀 Schema 解析，每次使用不同診斷 Campaign context，觀察舊快取是否累積。這不是新增命令，也不是額外遊戲／Gate PASS。最後以空的新 context 清除快取，GC後再靜置5秒。

CPU控制加入舊 Inspector 及量測 wrapper；在 hook 結束、Profiler.stop 回傳物件仍存活、產物寫完／斷線、suite結束及GC後分別採樣，避免把工具暫存物件視為正式 retained heap。沒有因RSS較高就對正式遊戲強制GC。沒有產生或提交私人存檔／原始 heap snapshot／CPU profile。

A1 啟動後才加入非啟用的舊CPU plugin import；正常組 Worker 使用的主動觀察器相同，差異僅在 parent config 載入，不用小幅時間差宣稱精確速度改善。兩次 harness bootstrap 失敗（一個cwd錯誤、一個Worker尚未轉交expose-gc）發生在正式負載之前，修正診斷設定後才開始A1；原始失敗仍留在臨時證據目錄，不算有效樣本或遊戲FAIL。

## 引用與清理檢查

`shipmentSyntax.ts` 的長期強引用是 `readers` Set → `ShipmentSyntax` → 原結構Schema及最多4096個Entry。正式 `schema.ts` 只有一個 factory 呼叫，因此每個正式模組／Worker只有一個讀取器；不是每個世界或每次驗證新增一個。

每個Entry擁有 Shipment 淺複本與各自 resources／authorizationSnapshot 複本、鍵名陣列；目前可重用Schema只有純量欄位及這兩個小物件。它不保留 FormalWorld、Zod ParseContext、回呼、世界版本鏈或完整Ledger。凍結的是自有快照，命中回傳另一份可變輸出，不把輸出物件重新掛回快取。

`pendingRoots` 為WeakSet且finally刪除，`active` 在finally還原；`parsers` 為函式WeakMap、value是數字；規則fingerprint只保留目前小型Schema描述。Campaign／branch／writer epoch／規則變更會clear。超過4096的新增紀錄走原解析器，不擴容、不裁切正式世界。版本及實際內容不相同時不重用驗證。

## 結果

**三組正常A/B均完成原11項測試，共66項測試執行PASS，2,000趟突破各完整完成。沒有確認記憶體洩漏，也沒有修改正式程式。** 以下為各n=3的中位數（範圍），十進位MB；不是n=3的p95估計。

| 階段／指標 | 修改前A | 目前B |
|---|---:|---:|
| 原測試OS RSS高水位 | 423.8（421.8–433.2） | 459.9（454.1–466.0） |
| 採樣Heap Used峰值 | 264.5（260.3–266.1） | 286.0（279.8–288.1） |
| 採樣Heap Total峰值 | 291.4（285.4–294.6） | 315.6（311.9–322.0） |
| 採樣External峰值 | 19.9（17.1–24.5） | 15.7（15.5–19.6） |
| Hook結尾RSS／Heap Used | 350.5／118.6 | 354.9／63.7 |
| 原11測試結尾RSS | 405.8（398.2–413.7） | 423.3（421.6–448.2） |
| 原11測試結尾Heap Used／Total／External | 260.3／285.4／15.3 | 241.7／280.8／15.3 |
| 診斷GC後Heap Used | 41.0（40.9–41.1） | 44.1（44.0–44.2） |
| 第60次context切換後Heap Used | 41.0（41.0–41.1） | 43.2（43.1–43.2） |
| 清除快取後Heap Used | 41.0（41.0–41.1） | 41.3（41.2–41.4） |
| 清除後Heap Total／External | 80.8／2.283 | 82.4／2.283 |
| 清除後再閒置5秒Heap Used | 41.0 | 41.3 |
| 原測試GC秒數／次數 | 20.77／12,685 | 17.94／8,851 |

原測試GC耗時A範圍20.36–22.51秒、次數12,654–12,766；B為17.88–19.41秒、8,464–8,854。這只是本次記憶體觀察器下的整個11測試，不與前輪只量初始化Hook的CPU Profile作直接比例比較。

B三輪都只有**1讀取器／1 Schema／2800個凍結快照**，每次context切換仍2800，最後清除後均0。第10→60次切換GC後Heap變化分別+49,856、+53,080、−199,096 bytes；A為+43,472、+40,216、+49,704 bytes，同量級小幅測試工具／引擎雜訊，沒有隨50份舊世界累積。B清除快取後各釋放約1.884MB Heap；這是整體heap差值，不冒稱heap snapshot逐物件精確歸因。再閒置5秒只有約4KB成長，External維持2.283MB。

**RSS不等於存活Heap。** A1自然閒置後RSS降到173.7MB，B3自然閒置後降到156.4MB；其餘相同工作程序則可保留約400MB RSS。B1診斷GC後Heap Total僅54.1MB、Used44.1MB，但RSS411.3MB；清除後Used41.4MB，RSS仍411.3MB。這表示大量RSS並非由快取持有的JS物件解釋，包含V8／原生配置器的保留空間及其他程序記憶體；不能單靠RSS端點推論heap leak，也不能在缺少native allocation trace時將全部差額精確歸因某一配置器。

本次正常組沒有重現先前單次Profile的886.7MB結尾RSS，但目前快取組的採樣峰值與RSS中位數仍稍高，這個代價保留，不宣稱零記憶體成本。4096上限／overflow行為另由原定向測試驗證；這個真實工作負載本身只有2800筆，不冒充4096筆實跑。

CPU工具控制各n=1，原11測試也各全部PASS，另22項測試執行，與正常組分開：

| 工具控制階段 RSS／Heap Used，MB | A4cpu | B4cpu |
|---|---:|---:|
| Hook結尾，尚未stop | 355.0／65.9 | 378.3／193.3 |
| Profiler.stop物件仍活著 | 359.1／71.5 | 385.7／200.2 |
| 寫出／drop／disconnect後 | 367.1／73.7 | 374.3／187.8 |
| 原11測試結尾 | 449.1／293.9 | 442.4／280.1 |
| 診斷GC後 | 433.9／42.2 | 142.8／45.2 |
| 清空快取後 | 433.9／42.2 | 215.9／42.3 |

stop物件確實新增約5.6／6.9MB暫時Heap，產物寫完後可釋放但不保證立即回收／歸還RSS。工具組GC後也沒有數百MB的存活Heap。**沒有重現舊單次886.7MB端點，也沒有證明Profiler就是舊差額的唯一原因**；工具、配置器及GC phase混合，原n=1不可做因果定論。原始Profile與失敗證據保留，不改寫舊結論。

在本次範圍內，已排除**每趟／每次分支context保留舊世界而線性成長**的證據疑慮，且實際清理有效。這不是任意時長、任意平台的無洩漏證明。獨立合成診斷中的GC不作正式解法；依使用者要求，到此停止效能施工。

## 重現與原始摘要

在乾淨開發樹使用同一 Node22 binary；輸出目錄必須是新的 `/tmp` 目錄。先 `node docs/validation/b10-release-unblock/b9-memory/prepare.mjs <out>`。為重現本次實際順序，先用 `B9_MEMORY_PLAN=A1 node .../run.mjs <out>`，成功後用預設 plan 再執行 `node .../run.mjs <out>`。最後 `node .../summarize.mjs <out>`。不要把這組暴露GC的診斷config用在正式Gate。

prepare從不可變Git SHA匯出正式程式，只有Vite觀察器加量測；原始測試及規則不改。生成的interface讓B使用正式快取scope，A後測probe使用原解析器。run遇到失敗即停且拒絕覆寫舊結果。`measurements.json` 收錄逐階段記憶體、GC、快取數量、環境、樣本與原始產物SHA256；大型原始物件僅留 `/tmp/b9-memory`。

## 驗證及審核邊界

| 驗證 | 本批結果 |
|---|---|
| 原B9正常A/B | 6次完整原負載，各11 PASS，共66次測試執行 |
| CPU工具控制A/B | 2次完整原負載，各11 PASS，共22次測試執行；獨立計算 |
| 原shipmentSyntax定向 | 7 PASS，包含4097筆overflow、獨立輸出、內容／規則／context失效、公開／重入及例外scope |
| Typecheck | PASS，Node22.23.4 |
| Build | PASS，0.31.25／content8375d5d；既有chunk size提示保留 |
| dbcf7d59最新有效GitHub CI | [42774994392](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/42774994392)，2488 PASS／0 FAIL／1 SKIP，job129691302968原始摘要已核對 |
| 本機原始完整Gate | **本批未重跑，不宣稱PASS**。前次81ea的2487 PASS／1 FAIL／1 SKIP仍保留；入口修正後只具備68定向及最終程式CI證據 |

本批新增的只有本目錄診斷工具及證據；沒有正式記憶體修正，故依本次任務第6項不啟動額外完整Gate。正式應用內容與dbcf7d59完全相同；報告提交後的新文件HEAD CI以PR Checks為準，不把dbcf的CI冒稱文件HEAD已執行。沒有新增玩家可見功能／Release Notes，既有PR Release Notes JSON維持不變。

**記憶體疑慮可在上述測試範圍內結案，可進入B10合併審查；這不是合併／發布放行。** 若審核要求修正入口後同HEAD的本機完整PASS，該證據仍待補齊；main部署護欄、發布與設備審核要求也不由本批解除。不為RSS端點追改已確認有界的快取，不修改其他效能路徑。

原SW30/30、31世界對照、1025防重播、14原子故障、Quick／Full／Recovery、T2配對與99AI/25X十分鐘Soak沿用既有有效證據。本批沒有改其依賴，不手動重跑。Android、其他Chromium版本／真背景未驗、B5 E1 HOLD與Astra非PASS仍在。main部署隔離未安裝是獨立合併前置；不能用本批記憶體診斷解除。

只更新PR61；保留Draft，完成後停止，不合併、不部署、不開始B11或其他效能最佳化。
