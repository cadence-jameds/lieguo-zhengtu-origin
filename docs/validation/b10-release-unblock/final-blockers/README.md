# PR #61 最後阻擋補修（2026-11-04～05）

本輪基準 `ad712d952b097c33f694d82bd51131ce7b2b6e61`；只補修 SW、B9 初始化與 T2 固定成本。**整體 P0／MERGE／PRODUCTION HOLD 仍有效：本機 B9 原 240 秒 Hook Gate 尚未解除。** SW 已針對舊 controller 退休／重啟競態補修，固定正式產物六輪原生 Chromium 完整測試為 30 PASS／0 FAIL；詳細根因及限制見末節。先前所有 SW 失敗完整保留，不以單次 5/5 宣稱解除。PR #54～#61 保持 Draft，沒有 main 合併或部署。

正式有界 DB、Save Format、窗口容量、ReplayFence、T1/T2/T3、Scheduler 及玩法不變。舊報告及原始失敗完整保留，這份補充不改寫前輪結果。原 `ad712d9` 成功 CI 41835957906（2473 PASS／0 FAIL／1 SKIP）仍是歷史成功證據，不冒充新 HEAD 的驗證。

以下按實驗階段保留當時判定；末節為最終程式版的驗證與剩餘阻擋。所有 native 測試為桌面 Chromium，不能替代 Android。Node22 用於本機 Build／profile／完整 runner；最終原生持久化安全測試的 Node harness 為24.19.0，實際交易在 Chromium154 的 Dedicated Worker／IndexedDB 中執行，兩者分開記錄。

## 實際修改與依據

1. `commandEvidence.ts`、`wonderSchema.ts`、`breakthroughSchema.ts`：僅快取物流付款預期 fingerprint 的 Canonical 編碼。固定最多 128 筆；key 包含戰役、issuer、命令類型、城市、專案與四項實際資源值。未知／非有限／缺少欄位／accessor 等資料仍走原編碼。不是可信身份或世界驗證快取；每次仍檢查實際收據、付款、身份、成本、物流、事件及完整 Schema。新增等價、逐欄位變化、caller mutation、eviction 與不合法資料測試。
2. `persistence.ts`：T2 retention 的 `LedgerIdentity.toArray()` 改為複合 `primaryKeys()`。原判斷只讀 row 的 campaignId／commandId，而它們正是不可變複合主鍵；不再為此再次傳回每筆原始 Payload／Ack。保留同一 proof lookup／刪除條件及同一 T2 交易，沒有省略載入驗證或 writeLedger 衝突檢查。新增 dbcore 觀測，明確斷言該 query 為 `values===false`，並驗證清理過期身份、保留原始 Ack 與 Pending。
3. 最終 `serviceWorkerRelease.ts` 在原 SKIP_WAITING 的 ExtendableEvent 內加入一次有界、唯讀的舊 active 往返，詳見末節。版本驗證、15／30 秒期限及原五情境保留。先前移除 skipWaiting waitUntil 的失敗實驗及 revert 仍在原紀錄，不重試為正式修復。

程式提交 `8f15e0972dae62fee246b1ccf68a12ab42c64af0`。隨後修正新增測試的 optional query flag 型別並收緊斷言；`f463d59` CI 的 TS2345 真實失敗保留，不能寫成 PASS。詳見最終驗證摘要。最終程式及有限證明版 `03eb7254deaad17bb200df1cfbcf211970508697`，內容 `ee62650063d4cb1db59c2d2ae11537a55575b0d5`、版本0.31.21；補入陣列／非 enumerable異常資源的原編碼fallback，並避免每次重新建立固定資源key陣列。上面的B9剖析屬原編碼改善候選，最終版仍須以完整原始runner判定240秒Gate。

## B9-2：CPU／GC 與原始工作量

Node 22.23.4、預設 heap 2,197,815,296 bytes、NODE_OPTIONS 未設定、CPU quota 200000/100000、8 GiB、maxWorkers=2。Vite validation-only transform／Inspector 1ms CPU sampling／GC observer；原 beforeAll 240000ms、2,000 趟各 30,000 真實物流、64 趟封存頻率、全部資源扣除斷言、事件及 11 個測試均未變。前置仍完成 800 趟奇觀物流；不是預製快照或降低工作量。

| 診斷（各一輪，不是完整 Gate） | ad712d9 | 編碼改善 |
|---|---:|---:|
| fundedBreakthroughSnapshot 初始化 wall | 212,681ms | 189,863ms |
| validateFormalWorld inclusive（5,611 次） | 137,286ms | 113,619ms |
| GC observer 次數／inclusive 時間 | 14,623／22,679ms | 11,827／20,878ms |
| 結束 RSS | 365,060,096 bytes | 373,891,072 bytes |
| 原始 B9 測試 | 11 PASS | 11 PASS |

改善前 self CPU 最大項為 structuredClone 49.5s、GC 26.0s、Zod object parse 25.9s、Canonical 遞迴及 map 26.6s。前置 completedWonder 約16.0s；後續物流隨有效付款／shipment 增加而變貴，沒有偷偷把它們視為可丟棄命令歷史。改善後 structuredClone 約50.2s，仍是主要成本；不因此放寬驗證、玩法或 timeout。GC observer 與 CPU sampler 的數字定義不同，不相加；inclusive phase 也不能加總為互斥耗時。此改善沒有宣稱降低 RSS 峰值。

最初追蹤誤開所有瀏覽器 trace 類別，原始 903MB trace 造成下一次診斷 setup ENOSPC。已無損 gzip 保留112MB，改為精確 ServiceWorker 類別。該 setup 失敗保留，未計為遊戲 FAIL／PASS；不是刪除失敗或重設資料。

## T2：實際原生 IndexedDB 分解

Chromium 154.0.8037.57、真實 Dedicated Worker、正式 Persistence／Reducer、100 勢力／99 個已排程 AI／25X、60k 合法合成累積歷史，保留有界近期結果。每組20次 T1、T2、查詢、無世界效果 rejected T2；不含冷／heavy 操作。validation-only instrumentation；inclusive phase 重疊，dbcore 時間包含排程與傳輸，不能當純磁碟 I/O。

| 原生診斷 | T2 p50／p95 ms | rejected T2 p50／p95 ms |
|---|---:|---:|
| 基準第1組 | 236.3／292.3 | 212.6／251.9 |
| 候選第1組 | **353.8／517.0** | **281.9／372.7** |
| 基準第2組 | 241.1／275.6 | 215.2／245.1 |
| 候選第2組 | 149.5／199.8 | 127.2／172.7 |

第一組候選其他階段（hash、validation、segment reads）也約加倍，全部真實保留，不能以第二組掩蓋長尾。第二組前後相同環境依序執行，仍有 OS／GC 雜訊，不代表所有裝置 p95 上界。基準第1組 T2 平均 retention136.8ms，其中 Identity value query84.1ms，整體 hash29.6ms／prepareVerifiedLedger21.9ms／writeLedger21.2ms；候選第1組即使整體較慢，Identity key query仍降為16.3ms。這證明原生資料回傳成本可消除，但沒有宣稱把原先71.4ms p95完全恢復。

正式無 profiling 的量測與最終原子驗證另列最終摘要；保留 R3-03 舊71.4ms及前輪 bounded304.0ms 的版本／環境差異，不用它們計算精確改善百分比。沒有建立永久命令歷史、調整窗口、拆 T2 或更改 DB／Save Format。

## SW 原生事件追蹤：修正前的阻擋證據

`sw-native.mjs` 保留原五情境的全部主要斷言：正常保存更新及冷離線重開、HTTP503後安全重試、Install Reject後安全重試、保存失敗不啟用、T1通知關頁後同ID只生效一次。原15秒 activation／30秒 Playwright 等待不變；先取得真正保存 Ack，再 SKIP_WAITING、controllerchange、導航與版本確認。沒有清除舊資料、unregister、強制刷新、略過內容身份或以備援導航假裝更新完成。

先在原正式產物上跑5個完整輪次，均5/5，但不構成修復。加入僅供 validation 的 lifetime observer 後，第1輪 HTTP503重試再次失敗（4/5）：舊 active仍是 v0.31.8／29ade31，候選v0.31.19／bf63仍 installed；收到SKIP_WAITING及呼叫start，超過期限無resolved／activate／claim／controllerchange。

Observer將原 Promise 原封不動交回 waitUntil／respondWith／skipWaiting／claim，旁路記錄 settlement；沒有多加正式生命週期 Promise。診斷訊息只在原情境結束後查詢。它會影響時序，故與無 prefix 的正式產物輪次分開。失敗時：候選 Workbox install 的 Promise 全部 fulfilled；候選只剩 skipWaiting 與等待它的 message waitUntil；舊 active 沒有未完成的 waitUntil／respondWith，仍可答覆身份。因此不是已證明的「安裝尚未完成」或 claim rejection；不能把 claim 當作已執行。

與實際版本相同的 [Chromium 154.0.8037.57 ServiceWorkerVersion](https://github.com/chromium/chromium/blob/154.0.8037.57/content/browser/service_worker/service_worker_version.cc) 顯示 installed狀態的 skipWaiting callback 會留待狀態切換，並依 browser inflight／renderer idle 握手決定舊 Worker 是否可終止。Playwright會自動連接SW的DevTools session；原生trace亦觀察到 idle/RequestTermination 路徑。這解釋 Promise 可以在 installed 不完成，以及單純移除 waitUntil 無法證明修復；**尚未證明造成該次 idle／keepalive 阻塞的最低層原因，也沒有證明可由正式 Web API 安全解除**。DevTools影響目前只是待驗假說，不能直接歸因瀏覽器而解除P0。

曾預留失敗後的CDP舊Worker stop診斷，但該輪全通過，沒有執行stop，不能聲稱因果。最終重現工具已移除此未使用分支；`sw-lifetime-stop-round2`檔名及原始5/5紀錄仍保留。正式流程沒有強制終止舊Service Worker或強制導航。

## 重現及證據範圍

- `b9-profile.config.ts` 只加diagnostic transform/setup，原測試檔與deadline保持；以 Node22執行原 `breakthroughB92.test.ts --maxWorkers=2 --testTimeout=30000`，`B10_B9_PROFILE_OUT`指定分開輸出。
- `prepare-diagnostic.mjs <pair>` 預設建 immutable ad712d9；`B10_SW_AFTER_REF`可指定後續SHA。before重用原29ade31產物，manifest記錄真實版本。另以 `diagnostic-server.mjs` 才附加lifetime prefix，原server及原產物不改。
- `bundle-profile.mjs <pair>` 以原source編production-domain validation Worker；`B10_FINE_PROFILE=1`加細項。`B10_CANDIDATE_PROFILE=1`另建candidate-profile-source，只替換本輪persistence.ts；不得冒充不可變baseline。`B10_PROFILE_WORKER`選擇兩個獨立bundle。原始無profiling驗證仍使用原 persistence-native helper。
- 全部本機full只用原 `node scripts/verify-in-isolation.mjs full`，原2workers、30秒、150k120秒、B9hook240秒；不得把此處11項PASS當full Gate。
- `measurements.json` 記錄摘要、版本、失敗、原始artifact SHA256；raw trace／CPU profile／存檔／完整runner輸出只存忽略的artifacts，不提交。沒有私人玩家資料。
- Android真機、真正背景process kill及正式部署仍未驗；B5 E1 HOLD／Astra未PASS不變。

## 固定正式產物的SW重跑

`03eb725`／v0.31.21／content `ee62650`，無lifetime prefix，三個完整輪次依序 **5/5、5/5、4/5**（合計14 PASS／1 FAIL）。第三輪「正常保存更新＋冷離線重開」在導航前即FAIL，故該輪沒有完成冷離線重開，不分拆冒充PASS。失敗時舊active仍v0.31.8／29ade31，候選installed且僅記錄install、skipWaiting received/start，沒有resolved、activate或claim。HTTP503、Install Reject、保存失敗及T1關頁四情境該輪仍全通過。這是正式產物再現，不能僅歸因lifetime observer。當時有既有successor Gate的背景驗證負載，完整原始trace與每輪結果均保留；CPU quota未改。

## 最終原生持久化與配對量測

實際ad712d9與03eb725的未instrumented正式Persistence各跑60k／20 warm／5 heavy／5 fresh Worker load，所有功能及roundtrip通過。但**順序整批量測的長尾沒有全面改善**：

| 未加profiler、整批先前後（ms） | before p50／p95 | after p50／p95 |
|---|---:|---:|
| T1（n20） | 6.9／10.8 | 7.3／11.8 |
| T2（n20） | 223.3／268.0 | 163.6／526.9 |
| rejected T2（n20） | 214.5／270.1 | 129.7／770.7 |
| Recovery（n5） | 513.9／596.2 | 458.7／960.1 |
| Quick Export（n5） | 139.4／179.5 | 175.5／268.5 |
| Full Export（n5） | 161.0／183.7 | 158.6／304.5 |
| Quick Import（n5） | 564.8／679.9 | 828.9／1632.1 |
| Full Import（n5） | 603.8／610.7 | 573.1／1138.3 |
| fresh Worker coldLoad（n5） | 233.0／308.3 | 276.4／279.5 |

這些尖峰全部保留；不能僅標為OS雜訊而排除程式因素，也不宣稱本輪改善Recovery或全部長尾。維持同瀏覽器的先後整批測試會混入GC、先前DB清理及儲存排程的時序，因此另外增加**不加profiler、同一瀏覽器、兩個獨立正式Worker／DB、逐對交錯順序**的n20比較。每一對依序執行，不同時寫入；雙方完成全部樣本後才清理DB；交替A-B與B-A，不刪樣本、不更動業務路徑。每對比對正式遊戲內容hash與每筆原始Ack，沒有改成mock交易。

| 原生交錯配對（ms，各n20） | before p50／p95 | after p50／p95 |
|---|---:|---:|
| T1 | 8.5／9.9 | 8.3／14.8 |
| T2 | 259.2／330.5 | 192.0／236.8 |
| rejected T2 | 241.3／278.7 | 154.0／181.7 |

20/20對T2較快且遊戲內容一致。這與Identity資料回傳量消除的剖析一致，足以保留這一小幅改善，但**不是所有持續連發／裝置的p95保證**。既有71.4→304.0ms歷史數字、候選517.0ms、整批526.9／770.7ms仍是風險證據，不能只摘選交錯結果宣稱全數效能Gate通過。T1只量Worker內持久接收，不能當玩家DOM點擊p95或Android指標。

同一固定正式source的原生安全驗證全部PASS：14個QuotaExceeded原子故障點（整庫前後digest一致、同ID恢復後原Ack）；50筆快速受理FIFO與舊writer fencing；1,025次實際T1/T2後只保留1,024近期結果、舊ID拒絕重播，重啟／Recovery／Quick匯入仍有效；T1通知後terminate真正Worker並恢復一次；成功T2遺失Ack可查原結果。Quick／Full／Recovery全部往返，原DB／Schema／Save Format及100MiB限制未改。

## 固定程式版驗證

`03eb725`：54項定向測試PASS，Typecheck、Build、Pages路徑及Release Metadata PASS（v0.31.21／content ee62650／dirty=false）；27項既有successor／反竄改／部署隔離／31世界對照／Preview及Projection邊界命令全PASS，另兩項美術與玩家回饋保護Gate PASS。31世界比較仍用完整PR60不可變Reference，正式事件、命令、RNG cursor、reports、Ack與玩法世界hash一致，沒有刪除或放寬歷史斷言。

[固定source CI 41848506221](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41848506221)：**2476 PASS／0 FAIL／1 SKIP**，全部Gate及Build成功。原始回歸artifact `regression-41848506221`／ID13335595981，GitHub提供digest `7efb5e95d1aad28c8c4fa0273a161ae6b9735d44d4638dde3dd032ae6a9e83af`。這是GitHub環境，不替代本機2CPU／8GiB／2workers的完整原始runner。最終本機結果待runner完成後記錄；兩次先前source被替代的未完成輪次明確保留INCOMPLETE，不當成timeout或PASS。舊ad712d9的B9hook240秒FAIL與成功CI仍完整保留。

可在乾淨環境重建原生配對資料，而不依賴本機既有scratch路徑：

```sh
B10_SW_BEFORE_REF=ad712d952b097c33f694d82bd51131ce7b2b6e61 \
B10_SW_AFTER_REF=03eb7254deaad17bb200df1cfbcf211970508697 \
node docs/validation/b10-release-unblock/prepare-production-refs.mjs /tmp/b10-final-perf
node docs/validation/b10-release-unblock/final-blockers/bundle-paired.mjs /tmp/b10-final-perf
B10_PRODUCTION_PORT=4234 node docs/validation/b10-final/production-server.mjs /tmp/b10-final-perf
# 另一終端：
B10_PRODUCTION_URL=http://127.0.0.1:4234/lieguo-zhengtu-origin/ \
node docs/validation/b10-release-unblock/final-blockers/paired-t2.mjs /tmp/b10-final-perf
```

完整n20／5的前後及14故障／1,025實際提交用原`persistence-native.mjs`，設定`B10_NATIVE_VARIANTS=before,after B10_COUNTS=60000`及相同URL。SW則另建before=29ade31、after=03eb725的同格式pair，使用原production-server與`sw-native.mjs`完整五情境，多輪各自指定`B10_SW_OUT`，不能只挑選成功的一輪。

## B9第二輪：保留失敗，進一步減少無用工作

03eb725在原2CPU／8GiB／2workers的完整runner仍 **2465 PASS／0 assertion FAIL／12 SKIP／1 suite hook timeout，整體FAIL**。唯一suite失敗仍為breakthroughB92 beforeAll240000ms；150k原120秒測試8811.1ms通過，Runtime developer catch-up原30秒測試15523.0ms通過。這輪FAIL完整保留，不能以GitHub2476 PASS或11項定向PASS取代。

通用JS複製候選只作診斷，沒有接入正式程式：實際800趟奇觀資料的n20 clone微基準，native p50/p95 2.444/3.539ms，候選1.529/5.083ms；候選還不能保持原structuredClone對Proxy的拒絕，因此拒絕採用。這不是把B9原2,000趟改成800趟。首次診斷include合併過廣而中止，確認tracked歷史檔未修改，INCOMPLETE記錄保留；重跑以明確單檔filter及獨立include，不能當完整Gate。

第二輪只改兩處：

- replaySubmit直到真正第一筆內部命令才在當前私有草稿上計算原有ownership policy。沒有命令的物流／時鐘補算不做無用全圖掃描；原structuredClone、receipt索引從零開始、事件順序及全部規則不變。
- Schema已解析的四項付款資源以純量傳給同一Canonical編碼快取，上一組完全相同的純量輸入可直接重用字串，不再為每筆歷史付款建立描述物件及JSON key。未知物件的原入口及所有原fallback斷言保留；新增正式Schema的未知／缺少／非有限資源及已改付款金額拒絕測試，不能藉快取遮住損毀。

程式fc4e313、有限hash證明ce30854（v0.31.22）：27定向、Typecheck、Build、Pages及Release Metadata、31世界確定性對照與4反竄改測試均PASS。完整原2,000趟／240秒的Node剖析11項PASS，初始化174258ms，5611次Schema inclusive104559ms；此無AI命令的段落ownership policy呼叫0次。仍保留前兩輪212681/189863ms及各自環境／GC數據；剖析不是完整Gate。本輪完整隔離runner結果待完成後另記，SW已知P0仍未解除。

三輪profile的CPU user＋system依序247230／225335／206906ms；GC observer依序14623／11827／10426次、22679／20878／19122ms。event-loop delay p99為9781／8242／8028ms、max16081／12516／12625ms；這是大量同步複製／驗證造成的診斷阻塞證據，不能把它直接當作本機full裡某一次timeout的完整因果或玩家畫面延遲。full另以無instrumentation、原2workers獨立重跑；沒有用GC flags、增加heap、降低同時workers或預先生成fixture取得PASS。

## ce30854最終本機完整Gate：仍FAIL

原2CPU／8GiB／2workers、原runner、原工作量及期限，完整結果 **2466 PASS／0 assertion FAIL／12 SKIP／1 B9 suite hook timeout，整體FAIL**。beforeAll仍超過240000ms，不能把0 assertion FAIL寫成完整Gate通過。150k原120秒測試7611.3ms PASS；Runtime developer catch-up原30秒8687.6ms PASS。原03eb725與ad712d9的FAIL繼續保留。

ce30854的[GitHub CI 41929705518](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41929705518) **2477 PASS／0 FAIL／1 SKIP、整體PASS**；所有前置Gate及Build成功。這只代表GitHub環境，不替代本機FAIL。

ce30854階段判定：付款編碼、無用policy掃描及T2 key-only清理的局部改善有證據，但當時沒有解除本機B9期限或SW間歇啟用P0。後續SW補修另列下節，不能回寫此階段為PASS。不提高期限、不改工作量、不用通用JS clone改變原複製契約，也不再擴大到新的世界／持久化架構。

## SW後續根因補修：舊controller探查與退休／重啟競態

進一步核對原始CDP version紀錄，03eb725及ce30854兩個正式失敗均有同型序列：舊頁在發出SKIP_WAITING的0～1ms立刻探查舊controller；舊Worker在14～15ms stopping、31～54ms stopped，32～55ms又starting，41～68ms running；250及500ms仍有舊頁探查，而候選一直installed、skipWaiting Promise未完成。不是只有UI selector逾時。

Chromium 154.0.8037.57的[ServiceWorkerVersion實作](https://github.com/chromium/chromium/blob/154.0.8037.57/content/browser/service_worker/service_worker_version.cc)中，OnStoppedInternal會為退休期間到達的新請求重啟舊Worker；StartWorkerInternal會清除立即終止旗標及renderer-idle狀態。這與原生停止／重啟序列及未完成的候選activation一致。原先只看JS waitUntil／Workbox install不足以發現這個browser交接競態。

補修b039e8e／有限證明750ea85／v0.31.23：候選收到既有SKIP_WAITING後，在同一ExtendableEvent中先對舊active Worker做一次有界的GET_APP_RELEASE唯讀往返，再呼叫原skipWaiting。舊頁已立即發出的探查得以在退休前處理，避免在停止途中為這批探查重新啟動。已active的自身不需往返；舊協定不回覆時最多3秒fallback，不輪詢、不無限重試，且仍包含在原15秒啟用期限內。舊回覆**只用於liveness，不是候選版本、存檔或命令Ack**；原頁的實際候選版本核對、真保存Ack、claim及導航保護全部不變。沒有提高15／30秒或任何完整Gate期限。

94項更新相關測試PASS，新增「先收到舊回覆才skipWaiting」及「靜默舊協定3秒有界fallback且無殘留timer」；Typecheck、Build、Pages及Release Metadata PASS。真正Chromium154／Linux／2CPU quota／8GiB，同一舊29ade31產物及原五情境，**6個完整輪次各5/5，合計30 PASS／0 FAIL**。正常更新／冷離線重開、HTTP503重試、Install Reject重試、保存失敗不啟用、T1通知關頁恢復各6次，所有原主要斷言及15／30秒期限保留，沒有清資料、unregister或強刷。原生記錄已出現activeProbe reply→skipWaiting→activate→clients.claim，健康路徑約1秒，沒有用一次5/5宣稱全裝置成功。

這是對具體競態的補修與桌面多輪證據；舊正常／503／Install Reject FAIL、無效移除waitUntil實驗與revert、ce30854的14/15仍完整保留。Android、其他Chrome版本及所有環境保證未驗。**本機B9原240秒Gate仍FAIL，整體P0 BLOCKED／Draft不變**；最後版本原生原子／1,025提交及完整隔離runner另外記錄，不以此30/30替代它們。

## 最終程式版750ea85：正式安全流程與CI

固定source `b039e8e206ff57bc5aebf493221fd1aa9ad29528`，有限證明HEAD `750ea852fe8173c0e951072047b0ee83858d023f`，版本0.31.23。最終原生Dedicated Worker／IndexedDB重跑 **PASS**：14個正式T2故障點、50筆FIFO及舊writer fencing、1,025次真實T1/T2與退休身份重送拒絕、重啟／Recovery／Quick匯入、T1後真正terminate Worker並恢復一次、T2成功遺失Ack後查回原始結果。原始結果為 `native-handshake-reliability.json`，並非沿用03eb725的測試當作本版PASS。

[CI 41933873760](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41933873760)為此確切HEAD：**2479 PASS／0 FAIL／1 SKIP、全部successor／反竄改／31世界對照與Build成功**。regression artifact ID13374471027，GitHub digest `6295810d08c21c1546d08ed68b6fee54b43fd00a4b678288c2098b601d0a8499`。Release artifact所記26b20ac4是PR合成merge SHA，不是已合併main或測試HEAD；本輪沒有merge。

main部署隔離尚未安裝，仍是獨立的整合前置條件；本任務只更新PR61，不建立其他PR或修改main。B5 E1 HOLD／Astra非PASS及Android未驗維持。B9完整runner最後一輪另列下節，不能以此CI或30/30 SW替代。

## 最終本機完整Gate：2468 PASS，但整體FAIL

750ea85原程式版，Node22.23.4、2CPU quota／8GiB／maxWorkers2、預設heap2197815296 bytes、NODE_OPTIONS未設定；沒有同時跑Chromium或其他benchmark。原始`node scripts/verify-in-isolation.mjs full`完整執行，結果為 **2468 PASS／0 assertion FAIL／12 SKIP，加1個suite Hook timeout，整體FAIL**。唯一失敗是`breakthroughB92.test.ts`的beforeAll240000ms。12 SKIP包含此Hook失敗未執行的11項B9測試，不能當成已驗證。先前ad712d9、03eb725及ce30854的完整FAIL與所有成功CI均保留。

150000 cumulative原120秒測試 **7039.0ms PASS**；Runtime developer catch-up原30秒測試 **8589.7ms PASS**。原runner、B9測試及初始化helper與ad712d9的SHA256逐一相同，記於measurements。完整JSON為`local-full-handshake.json`；環境、累計cgroup計數與背景負載另存`local-full-handshake-environment.json`。計數為整個session累計，不冒充本輪GC或OOM因果；執行中觀察至結束的OOM／OOM-kill計數維持4，沒有在此輪新增。

因此**不能解除整體P0 BLOCKED／MERGE HOLD／PRODUCTION HOLD**。B9完整Gate仍未達標；剩餘主要成本是原始逐趟複製及完整Schema處理，沒有安全證據可以直接拿掉。拒絕採用通用JS clone候選，未擴大重做有界存檔或調整玩法／期限／worker數量。SW的具體競態補修與桌面六輪證據、T2 key-only改善可供審核，並非本機全Gate通過。

六輪SW每輪均保留五項完整結果，無prefix observer或事後重送成功替代原結果：

| 原生輪次 | 正常更新＋冷離線 | HTTP503＋重試 | Install Reject＋重試 | 保存失敗 | T1關頁恢復 |
|---|---|---|---|---|---|
| 1 | PASS | PASS | PASS | PASS | PASS |
| 2 | PASS | PASS | PASS | PASS | PASS |
| 3 | PASS | PASS | PASS | PASS | PASS |
| 4 | PASS | PASS | PASS | PASS | PASS |
| 5 | PASS | PASS | PASS | PASS | PASS |
| 6 | PASS | PASS | PASS | PASS | PASS |

表中Install Reject維持原已記錄successor的原生candidate installing→redundant且未activated證明；不是改成HTTP503或要求失敗的installer仍能回覆版本。原測試FAIL及先前拒絕情境均獨立保留。T2表的p50／p95採nearest-rank、n20；冷／heavy操作n5，只適用所記版本與環境。最終交付HEAD在PR說明記錄；750ea85之後僅新增本目錄報告及診斷重現工具，正式程式內容仍為b039e8e／v0.31.23。
