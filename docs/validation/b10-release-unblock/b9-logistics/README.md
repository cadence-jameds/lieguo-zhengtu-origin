> **最終封版狀態更新（2026-11-10）：** [最新驗收與合併策略](../final-seal/RESULTS.md)。SW已有30/30後續證據，B9記憶體結案；使用者取消部署護欄要求，Android安排合併後且不阻擋單人技術合併。以下歷史量測與失敗保留，不作當前MERGE HOLD判定。

# B9 大型物流效能／本機 Gate 補修

基準：`7264472e7cfc30ec72d64e24198d3d8d5d23adeb`。本批是效能／240秒 Hook Gate 問題，**不是已確認的 B9 玩法功能 P0**。只更新 Draft PR61，不合併／部署，不開始 B11。

效能候選：`441a93ac383969dd02d3cf78c39afdd5172e8006`；唯一完整Gate版本：`81ea5b5f685b58f946ce121f017e48ea9e210df8`。之後的公開驗證入口修正：`8375d5d5f281162bd2f973e0bca0a0a89171be55`，有限保護版 `b88a996cf849538f0bd6bcde951b1488e559869a`，應用版本0.31.25。沒有修改 DB、Save Format、Model、Replay Fence、Scheduler、AI、RNG、物流公式或歷史主規格。

## 真正成本與修改

每趟實際命令與事件補算仍各自複製私有世界並驗證。累積運輸紀錄會反覆經過 Zod 結構解析：建立解析輸入、欄位 pair、中間狀態及輸出物件。基準 CPU sampling 的 ZodObject `_parse` self 約22.9秒；原生複製約40.9秒，另外有完整世界交叉驗證與 GC。整體仍有隨累積紀錄反覆掃描的成本，不能宣稱已把所有 O(N²) 工作消除。

本批只重用**內容完全相同的 Shipment 純結構解析**：

- `shipmentSyntax.ts`：私有草稿一次性 root permit。公開、重入、匯入與存檔驗證回到原 Zod 路徑；非支援／effectful syntax 不使用快取。
- 比對每個實際欄位、巢狀資源與授權值、鍵的存在性，使用 Object.is 保留 signed zero；改值或未知 undefined 欄位都重新解析。只保存獨立凍結快照，輸出重新複製，沒有把 caller 或世界物件當成可信不變資料。
- 指紋來自目前編譯的 Schema 欄位、約束、regex、union 與 parser；規則、Campaign、branch／writer epoch 改變時清除。固定目前 Shipment 語法的專用快取，不是任意 Schema／世界驗證快取。
- 上限4096筆，滿後保留穩定前綴，其餘紀錄照原解析，避免循環逐筆淘汰造成 thrashing。沒有裁切正式紀錄。
- `schema.ts`、`reducer.ts`：只在 native-cloned、尚未暴露的 Reducer 私有草稿使用此入口。世界 Schema 與所有 pool、付款、來源、所有權、資格、事件、唯一身份及時序交叉驗證仍每次執行。Persistence／codec 使用原公開完整驗證入口。

沒有更動測試 fixture、2,000趟、每趟上限30,000、60M扣款、前置800趟奇觀、64趟封存頻率、240秒期限、2 Workers或heap／GC設定。三個原始檔的SHA256及所有比較資料列於 `measurements.json`。

## 同環境 Profile（各 n=1）

Node22.23.4／CPU quota200000:100000／8GiB／預設heap2197815296／NODE_OPTIONS未設。相同原始B9測試與既有Profiler，maxWorkers2；單檔 Profile 實際只有一個測試檔工作程序，V8另有輔助執行緒。完整 Gate 才有兩個檔案 Worker 持續競爭。這是 Node／fake-indexeddb 診斷，非 Chromium／Android 或玩家點擊延遲。

| 項目 | 本輪基準 | 441a93a效能候選 |
|---|---:|---:|
| 初始化 wall | 148428.8ms | 137146.8ms |
| CPU user＋system | 174062.5ms | 163838.6ms |
| 完整世界Schema inclusive | 93051.0ms | 78830.7ms |
| 世界Schema呼叫 | 5611 | 5611 |
| cloneWorldDraft inclusive | 42131.8ms | 43954.3ms |
| cloneWorldDraft呼叫 | 5640 | 5640 |
| GC observer時間／次數 | 16484.4ms／10398 | 15877.1ms／7567 |
| 結尾RSS | 365719552 bytes | 886689792 bytes |
| 真實突破趟數／原B9測試 | 2000／11 PASS | 2000／11 PASS |

Schema inclusive與GC／CPU不是互斥項目，不能相加。Clone未改善，結尾RSS也較高；不能宣稱降低記憶體峰值。保留所有原始記憶體與CPU資料，不把端點差異直接歸因為永久快取大小或泄漏。沒有為取得PASS強制GC、增heap或減Worker。

舊213→174秒來自前輪環境，與本輪148.4秒分開；只用本輪前後描述局部收益，不宣稱跨環境精確百分比或全裝置p95。

四個未採用候選完整保留：物件解析器185.5／150.1秒、純量快取161.6秒、逐筆標記版155.3秒。都沒有放入最終程式，也沒有因此執行完整Gate。對照測試曾抓到規則指紋必須讀取Zod實際編譯Shape；已修正，沒有放寬斷言。

## 驗證與既有證據

定向30 PASS，包含逐欄變動、原錯誤與path、獨立輸出、scope例外／重入、規則／分支失效、4096容量與overflow；另以完整未快取驗證器對照正式命令、到貨、返還的世界／reports／Ack，並確認pool、重複身份、付款及cargo改值仍拒絕。原B9 Profile 11 PASS。Typecheck、Build、Pages、Release Metadata與直接受影響的有限successor／4反竄改測試PASS。

依使用者指示引用[原PR61證據](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/7264472e7cfc30ec72d64e24198d3d8d5d23adeb/docs/validation/b10-release-unblock/final-blockers/README.md)：SW30/30、31世界對照、1025防重播、14原子故障點、Quick／Full／Recovery、T2配對及原十分鐘99AI／25X Soak。沒有重跑這些原生測試。交易／SW／存檔檔案與正式玩法規則未改；本批對直接受影響的結構驗證與物流路徑另做上述等價檢查。

唯一一次原始完整隔離命令：`node scripts/verify-in-isolation.mjs full`，原2Workers／2CPU／8GiB、240秒Hook及其他全部期限不變。

**結果2487 PASS／1 FAIL／1 SKIP，整體FAIL，保持GATE HOLD／Draft。** B9 beforeAll已完成，11項B9測試全PASS，未再觸發240秒timeout。JSON的B9斷言執行區段約32秒不包含Hook，不能拿它冒充初始化時間。

唯一FAIL是原 `replayP0.test.ts` 的 `private AI admissions validate once at the complete replay boundary`：預期公開 `validateFormalWorld` 入口被呼叫1次，觀測到0次。實際完整Schema仍有執行，但包裝函式放在同一Schema模組內，繞過原跨模組可觀測入口，這是本批引入的呼叫邊界回歸，不是原B9玩法錯誤。

已把私有包裝移回Reducer，直接呼叫原公開驗證器一次；Schema不再新增公開的私有驗證入口。原 `replayP0.test.ts` 未修改，連同直接受影響測試 **68 PASS**，Typecheck及有限保護／4反竄改再次通過。此最小修正不改快取演算法；沒有再做Profile，故上表不是新HEAD的重新量測。

**依本批限制沒有啟動第二次本機完整Gate，不能把68定向PASS改寫成整體PASS。** 下一個最小步驟是審核後讓入口修正與B9 Hook在同一個原始完整Gate中同時驗證。仍有Clone／其他世界交叉驗證成本及較高Profile結尾RSS，尚未取得live heap或實機長時記憶體證據；不宣稱所有大量物流、瀏覽器或Android裝置均達標。

raw CPU profiles、完整runner JSON與診斷程式只留在忽略的artifacts；本目錄只提交摘要／雜湊。Android與正式部署未新增驗證。原整合／發布審核要求維持，B9效能Gate不等於整體發布放行。
