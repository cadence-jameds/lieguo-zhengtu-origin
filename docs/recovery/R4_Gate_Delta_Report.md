# R4 Astra Gate HOLD — B1／M1 最小 Delta Report

本次處理 Astra 已確認的 B1 BLOCKER 與 M1 MAJOR，以及 N1 測試覆蓋描述缺口。工程驗證結果不構成 Astra Gate PASS；完成後 STOP，等待 GPT-6 中控安排再次獨立審查。B5 E1／原 M3 Lv15 玩家人工驗收仍為 HOLD／MANUAL PENDING。

## 基準、規格與 Git 隔離

- Repository：`cadence-jameds/lieguo-zhengtu-origin`；既有 Draft [PR #3](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/3)。
- 修復直接父基準：`608de8a77a8644b7a3a894685e27ced9d4507ca0`，`stage2-r4-integration`。原 R4 commit、原驗證報告與 `docs/validation/r4-2026-10-13/` 原始材料保留。
- 已完整讀取使用者附件，原文另存 [Astra 原始報告](R4_Astra_Independent_Gate_Review_2026-10-13.md)，不改寫原 HOLD、FAIL 或失敗紀錄。
- 正式最高 Authority 為最新 main 的 [V94 正式規格](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/7b0390a05e5eea4f9fe190d2e772ad7275745751/docs/b6-v94/河谷戰役_vNext_平衡重構討論_v94.md)，Git blob `9dacc5c162003eba442c91c32ac54b02e9f9e9a3`。受審 R4 checkout 尚沒有此新增規格檔，從最新 main 核對全文；不因此把其他 main runtime 變更併入 R4。
- 施工期間最新 main 為 `7b0390a05e5eea4f9fe190d2e772ad7275745751`，另有存檔／排程效能及版本更新；本次驗證來源仍是受審 R4 加此最小 Delta，不能外推已驗證這些其他 main 變更。
- 獨立 worktree 施工；另一個 UI 分支 `v94-ui-integration` 的 `c8cf3ef16e01a709b545e4fa0dbe579c15e008b4` 與工作樹保持不變。未 hard reset、改 main／release、修改部署 workflow／acceptance、merge／deploy 或啟動 B9。
- 檔案重疊核對：與該 UI 分支同名改動只有 `src/game/formal/schema.ts`；UI 改的是 `reportSchema` 的 diplomacy category，本次改的是工匠／特殊工程 invariants 與 helper import，沒有覆蓋該分支內容。沒有進行跨分支 merge，也沒有宣稱未來整合已驗證。與目前 main 的新增 application 檔案沒有這六個 production Delta 檔案重疊。

## B1：世界推進及征服資格

原狀：AI 最後一城失守後，正在交戰的舊軍仍可打完攻城，卻把目標城給已滅國 AI；`validateFormalWorld` 拋出 `Extinct faction ownership invalid`。有效 Save／Load 後仍會重現。

修復：城市受領資格與戰鬥能力分開。單軍及聯軍的候選勢力須仍有自有城市且不在 extinct 名單；`extinctionPending` 舊軍也排除，即使玩家已合法復國仍不能用舊軍接收城市。合法候選維持原發起者優先、有效生還兵最多、seeded 並列抽選。低層 `finishConquest` 在修改人口、訓練或 owner 前再次拒絕無資格受領者。

沒有合法受領者時，使用既有 `no-occupiers` 終戰原因，保留攻城損害、回合、傷亡與 final／玩家終戰報告，城市仍歸原 owner；沒有取消戰鬥、移除 extinct、放寬 Schema 或免費恢復 AI 城市。既有 extinction resolver 在終戰後將生還舊軍轉成流亡軍一次。新測試確認世界能越過原崩潰事件，持續推進至後續世界時間，存讀檔及 Recovery 重播保持單一 final、單一流亡軍及單次 owner transfer。

## M1：工匠及特殊外文明城堡授權

原狀：待命工匠在城失守後仍綁敵城；特殊城堡工程繼續替敵人完工並消耗原玩家工匠。

修復：正式 owner transfer 同一轉換內處理工匠與 active scheduler。失效特殊城堡 Lv1 授權及其依賴的同城堡後續升級排程取消，清除工匠 command binding、未完工城堡佔位及相關 completion event；不退款。原勢力尚有城時，工匠沿既有 route 撤往最近合法自有城，使用原每格 45 秒移動規則；無自有城時按滅國處置移除，不補償。途中目的地失守沿既有到達後重新尋路機制轉向，沒有瞬移。

城堡 materialize／消耗前，再核對特殊工程、唯一工匠、城市 owner、文明及原 applied command receipt；Schema 同樣拒絕敵城待命、重複 binding 或無有效授權的特殊工程。普通建築、城牆與資源田的征服、成本、取消退款、原排程未改動。專項測試實際以無關資源田工程的完整 job snapshot 與 event IDs 驗證特殊取消不重排其開工與工期；不聲稱逐種普通建築均新增人工驗收。

施工前規則核對：V94 §6.6 的自有城／工匠授權及正常城堡成本工期不變。V94 一般施工取消條款（1031–1041）定義玩家主動取消的 50%／100% 退款；本次是中控明確命令的失城特殊授權撤銷，按「不新增退款」處理，不呼叫會退款及重排普通佇列的一般取消命令。沒有改寫 V94 或增加無料補償。

同時事件：保留 construction.complete priority 5、army.arrive 40／combat 50 的原順序。若同一世界時間先合法完工再易主，工匠消耗一次，已完成城堡成為征服資產；若易主早於完工（含 1ms），特殊工程取消，stale completion 不再建造或消耗。這兩者均有 Save／Load 與重播驗證，未更改事件優先序。

## N1：舊覆蓋與本次新增 assertions

| 範圍 | 舊實際覆蓋 | 本次補強 |
|---|---|---|
| 滅國／流亡 | `extinctionB7.test.ts` 7 cases：非交戰舊軍轉流亡、仍有第二城不流亡、復國、25%／工匠、正常城堡完工、研究取消、切片等價 | 交戰中失去最後城後繼續攻城，AI→AI 及 AI→玩家，終戰／傷亡／生還流亡唯一性及持續推進 |
| 聯軍歸屬 | 基本發起者與合法聯軍鏈；不能支持 extinct 受領資格 | 已滅國且兵較多發起者排除、合格小盟友接收一次、全部無資格、deterministic tie、低層 guard、復國舊軍仍排除 |
| 工匠失城 | 舊基本領取／返回／消耗鏈；沒有待命失城及施工失城 assertions | 待命有第二城／滅國、移動目的地失守、特殊工程有第二城／滅國、相依城堡排程及無關田 job、無退款、敵城／複製 binding 拒絕 |
| Persistence | `extinctionPersistenceB7.test.ts` 1 case：人工 createExile 的 world-write 故障、full import／Recovery | B1 三種寫入故障原子 rollback、完整匯出重讀及 Recovery；M1 真失城前後 Save／Load／Recovery、到達、去重、舊命令 replay、同時事件 |
| Browser | 舊 R4 11 cases 是歷史工程證據，Astra 沒有重跑 | 本輪 production Chromium 真 worker／IndexedDB：B1 舊攻城結算、M1 待命與施工失城共 3 cases，均重新載入，9 PNG |

新檔 `gateDeltaR4.test.ts` 17 cases，`gateDeltaPersistenceR4.test.ts` 10 cases，共 27。後者含 1 個 browser fixture exporter；沒有 evidence 環境變數時會直接返回，計入 runner PASS，不能把此單一 exporter 本身當額外產品驗證。另 26 cases 有行為 assertions，三組實際 browser checks 另列。原所有測試與 acceptance 記錄未為 green 修改。

受控測試使用正式命令與 scheduler，但提供受控時代、建築、兵力、庫存及流亡軍種子；為觀察不相關田工程穿越失城邊界，該 fixture 的田工期延長為 4h；同時事件 fixture 把城堡 completion 對齊 arrival。browser 匯入 synthetic、事件前 4 秒存檔，99 AI 決策延後 30 日以隔離邊界。這不是公平自然長局、玩家人工操作或 99 AI 成熟戰爭平衡證據。

## 實際執行與失敗材料

結果與 raw JSON／log 在 [新版 evidence](../validation/r4-gate-delta-2026-10-13/summary.json)；SHA-256／bytes 與來源 Git blobs 見 [manifest](../validation/r4-gate-delta-2026-10-13/manifest.json)，六個 production source 差異見 [source diff](../validation/r4-gate-delta-2026-10-13/source-diff.patch)。

- 修復前原 Astra 三個 negative probes：3 PASS **代表成功重現缺陷**，不代表修復。`attempts/astra-probe-baseline.txt` 保留原世界驗證錯誤、敵城待命與敵城完工／耗工匠結果。
- 修復前新增 17 個合法結果 assertions：4 PASS／13 FAIL；B1 世界推進仍 throw，M1 owner／工程／事件 assertions 失敗，保留 `attempts/targeted-before.json`。
- 修復後第一組新測試加既有 B7／政治／帝國相關測試：52 PASS／0 FAIL。
- Persistence 測試設置的兩次中間失敗也保留：22 PASS／3 FAIL、23 PASS／2 FAIL。原因為 Recovery 兩點保留導致目標備份被後續第三次 save 剪除，以及刻意 raw owner 注入後未 invalidate spatial cache；調整隔離 import store 保存到達、刷新 forged-state cache，未改產品 retention 或驗收條件。
- 最終兩個新增測試檔：27 PASS／0 FAIL；Typecheck、production build PASS。
- 完整隔離 Regression 重新執行原 `node scripts/verify-in-isolation.mjs full`，無 exclude、maxWorkers=2／testTimeout=30000 不變。本次 137 files／1150 PASS／0 FAIL／1 SKIP，389.88 秒；精確結果以 summary／regression-full.json 為準，歷史 1123 PASS／0 FAIL／1 SKIP 不當成本次結果。
- 本輪 Chromium `154.0.8037.57`／1440×900：3 PASS／0 FAIL、errors=[]、9 screenshots；真 IndexedDB、worker 推進與 reload。Recovery 由 Node／fake-indexeddb 專項驗證；本輪 browser 不聲稱做過 Recovery 或原 M3 人工驗收。Typecheck／build／full 皆為本地工程檢查，不等同 GitHub Actions CI PASS。

## 邊界與交接

1. 合法失城前存檔可重播本次修復；歷史已壞的「工匠留敵城／敵城特殊工程」snapshot 會被更嚴格 Schema 拒絕，不提供自動修補 migration，Recovery 要有合法備份點。
2. 本次沿用既有 route 地形與到達轉向機制，未新增不可達地形的替代規則或免費搬移；並非所有地形／不可達 fallback 都已覆蓋。
3. [人工與獨立複核清單](R4_Gate_Delta_Manual_Pending.md) 保持 MANUAL PENDING。原 M3 Lv15 玩家手動驗收須獨立提供原指定情境、前後圖、玩家操作／報告，AI 或 synthetic browser 不能替代。
4. V93 的 80 任務、V94 五筆排程、新軍團／治理／戰報 UI，以及 main 的其他更新不在本次範圍。
5. 完成本次 source／tests／evidence commit 並更新 PR #3 後 STOP；不 merge、不 deploy、不宣告 Astra Gate PASS，等待 GPT-6 中控指派 Astra 再次獨立審查。
