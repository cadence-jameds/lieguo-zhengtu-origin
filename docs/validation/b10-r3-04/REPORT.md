# R3-04 UI Projection／WorldStream v2（Draft）

本檔記錄交付建立時已取得的證據；**最終安靜環境完整回歸與 GitHub CI 以 PR 最終驗證留言／Checks 為準**。不把未結束的工作或單項通過當完整 Gate PASS。未合併、未部署，未開始 R3-05。

Base PR #56 `1737d14a8f210fb2d33eb5dadbde18c3bb375586`／`feat/b10-r3-03-command-ledger`；本分支 `feat/b10-r3-04-ui-projection`。上游 #54／55／56 原 HEAD 與 Draft 保留。正式 source anchor 見 compatibility.json；最後玩家程式變更 `3af8ac9d9b9efa2b51fc10d63e6d093bb01b4791`，之後為測試／驗證工具。

## 正式資料流與邊界

見 [資料契約](CONTRACT.md)、[完整 UI／歷史引用矩陣](UI-DEPENDENCIES.md)。Runtime 唯一權威 → T2 committed source → Verified read-only WorldProjection → v2 Delta → PresentationStore → React selectors。獨立 PresentationWorld kind／version，沒有 Ledger、commandReceipts、completionReceipts、events、AI state；不以空收據假冒 FormalWorld。

T1／T2／T3、CAS、writer epoch、FIFO、不可變 Original Result／Branch Disposition、DB3、Save1、Recovery 與 Preview protocol1 保留。Model、Reducer、Scheduler、Persistence、LedgerStore、CommandLedger、SaveCodec、ConstructionRules **8檔原始碼完整不變**；23個共用 Formal 模組轉譯 JS 相同。Economy／城堡來源 formal 分支與原存檔 object schema／refinement 的 AST／JS 也相同。新增展示 structural validators 不改 Save Schema。

點擊保存 React 已提交的 campaign/branch/writer/revision 與原始語意指紋；Worker 不拿新世界重造原始意圖。治理最後寫入身份由 Verified Reader 增量衍生，保留 ABA 與順序；軍隊使用版本化靜態地圖 digest，舊 v1 Pending 仍按原指紋驗證。正式 Reducer 再驗全部規則；Preview 與命令生命週期分離。

協定有 session、單調 sequence（含同 Revision 結果）、entity/section base/nextVersion。新增／更新／刪除附 ID；缺包／重複／亂序／錯 campaign、branch、writer／不支援版本整包拒絕。重取展示 Snapshot 最多自動三次、一次一個請求、三秒期限，保留手動入口，不取消或重送命令。正式傳輸使用 Worker structured clone，明確 undefined 可移除區段；不是新增跨語言 JSON 存檔格式。

Store 保留未變城市／軍隊參照；城市詳情隔離訂閱，本地輸入不重建世界。不同 branch/writer 的城市表單、地圖／情報／Preview 重新建立。時鐘、共享依賴與真正改變的父層仍合理重繪，不宣稱全UI零額外render。

## 正確性矩陣

| 要求 | 證據 |
|---|---|
| 單／多城、100+連續更新、穩定參照 | worldStream、projectionReactR304，120+100次更新，順序／版本／schema原子拒絕 |
| 軍隊新增、移動、駐防、召回、返回刪除 | projectionArmyR304 同正式 Reducer 各階段對照 Add/Update/Remove；重複 Remove 不污染 view |
| 建築／科技／施工／訓練／物流 | worldStream施工完成逐欄對照；保留 runtimeB4／各Worker原領域斷言，同時驗真v2畫面 |
| 治理ABA／總督／城堡工匠 | projectionAdmissionR304，22類意圖；正式治理三次寫入；工匠建堡前後source／producer parity |
| 任務／領獎／政治／現代工程 | UI矩陣中的持久狀態與純讀公式；原完整來源證明／規則測試保留 |
| 60k歷史不展開 | 0/1k/10k/30k/60k spy：普通投影 commandHistory／JSON.stringify 零呼叫；暖提交只讀新增身份 |
| 遺失／重複／亂序／同Revision | WorldStream／React recovery／useGame；展示sequence與權威命令結果分開 |
| campaign／branch／Recovery／匯入／重置／handoff | branch Snapshot重建、舊session/epoch拒絕、表單／快取清空；Runtime／Ledger回歸 |
| Worker中斷、lost Ack／T3、等待逾時 | Durable Runtime／useGame原斷言；獨立計時、Pending保留入口、終局才解除；native失包實際觀察snapshot request |
| 點擊原意／舊Ack | React commit race、治理舊表單、跨campaign同ID Ack；T1保存exact context，偽writer/session拒絕 |
| Preview過期／中斷／卸載重開 | 原R3-02 controller／React／規則對照；獨立Worker無儲存或提交能力 |
| 99AI／25X、快速連發、背景前景、滅國復國終局 | 原可靠命令／clock／freeze Worker；native私有補算中T1完成，Preview死亡仍只有一次效果 |
| T2／CAS／Quick／Full／Recovery | R3-03 Ledger與故障注入測試未放寬；native匯入回復後舊ID不能重執行 |
| 真正UI／重載／60k DB | 實際GameApp空地清單→Preview→正式建造→重載查committed；原生DB60000身份載入可操作城市 |

軍隊測試初稿嘗試行軍中召回，被正式規則拒絕；改用合法援軍先駐防再召回，未改規則。Native harness 的 preamble／optimizer reload／測試writer初始化失敗不算PASS；修正後完整五組重跑。沒有刪測試、放寬斷言、減資料量或提高既有期限。

## 環境、樣本與原始摘要

Node22.23.4／Linux container／2 CPU quota（200000/100000）／8GiB RAM／預設Node heap 2,197,815,296 bytes。Chromium154.0.8037.57，真 Dedicated benchmark Worker／structured clone／Store／React19，開發模式，非Android。

每組100勢力、25X；暖操作各30樣本、3次預熱；Worker冷Snapshot／resync各10。Main統計包含66份Patch（含6次Worker預熱）及11份Snapshot（初次＋10次resync）。[Node摘要](node-perf.json)、[Native數字與Profiler](native-perf.json)、[Native正式流程](native-flow.json)保留完整樣本／指標，無私人存檔、HAR、原始trace或大量截圖。

Node與Native paired bench都使用RAM Verified合法合成世界；後者在真正Worker運算，**不是T2延遲**。另有真正原生DB／Runtime／GameApp的60k冷驗證。99AI並行補算與傳輸微基準分開，不冒稱繁忙戰役或手機SLA。v1 reference重現PR56 projectWorld／JSON section演算法，與v2使用相同目前世界；未以不同環境R1-C數字換算改善比例。

| 歷史 | Snapshot bytes | Tick bytes | 命令bytes | v1 Tick建構 | v2 Tick建構 | v1命令建構 | v2命令建構 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 467,325 | 305 | 1,796 | 3.60/28.10 | 3.00/4.60 | 3.10/33.30 | 3.30/9.00 |
| 1,000 | 467,634 | 308 | 1,799 | 8.50/39.00 | 2.70/22.60 | 3.10/7.20 | 2.70/6.70 |
| 10,000 | 467,737 | 309 | 1,800 | 71.10/117.70 | 3.00/36.20 | 12.00/39.60 | 3.00/34.80 |
| 30,000 | 467,737 | 309 | 1,800 | 418.50/548.40 | 4.10/12.60 | 90.50/149.20 | 5.30/16.10 |
| 60,000 | 467,737 | 309 | 1,800 | 527.10/991.30 | 3.40/6.90 | 114.40/177.30 | 3.70/9.40 |

時間為p50/p95 ms。Main為傳輸／排程等待、套用、到下一frame；Profiler為實際React render。

| 歷史 | Main等待 | Main套用 | 下一frame | Long Tasks | Profiler |
|---:|---:|---:|---:|---:|---:|
| 0 | 0.50/2.30 | 0.70/4.70 | 4.20/32.80 | 3 | 0.20/1.10 |
| 1,000 | 0.50/4.50 | 0.50/1.00 | 2.20/15.90 | 0 | 0.10/0.40 |
| 10,000 | 0.50/1.70 | 0.50/6.60 | 1.50/18.50 | 0 | 0.20/0.40 |
| 30,000 | 0.50/2.10 | 0.60/6.50 | 1.70/35.10 | 7 | 0.20/0.70 |
| 60,000 | 0.60/30.60 | 0.50/3.40 | 1.90/32.30 | 8 | 0.20/1.30 |

v1 Snapshot由454,109增到19,163,002 bytes，命令Patch由147,130增到18,856,156 bytes；v2約467KB／1.8KB。v1小Tick本來可以只傳time/revision，但為找差異仍展開／序列化歷史；v2增加版本安全Header，小Tick bytes略增。bytes是JSON logical encoding，非structured clone framing保證。

每組reader初始讀count，33次命令再讀33筆；66次普通更新與10次resync不重掃歷史。冷來源重建仍O(歷史)：60k Native Worker冷Snapshot p50/p95為85.4/103.0ms，不宣稱冷成本常數化。

混合v1/v2壓力窗口記錄到50～173ms Long Tasks，涵蓋setup／cold／壓力階段，尚未逐筆證明歸因，**不能宣稱所有普通操作皆無Long Task，或50ms目標全面達成**。真GameApp短程建造與60k載入的互動觀察為0，只是有限樣本；60k原生冷載入到可操作城市約7秒（單次，當次值見native-flow，非p95）。

React受控單城庫存100次更新：舊整段城市替換changed/other=101/101 renders，v2=101/1。Native paired bench兩個consumer各68次：time與全局城名（唯一建城名）皆真依賴，沒有包裝成只一城重繪。單城庫存隔離由前述100次對照證明。

保留量有界：emitter前一view、Store當前view／versions、每個掛載selector一份上下文、一份proof與每城facts；刪除實體即移除version，不積累tombstone或snapshot歷史。Native process heap約54～357MB含工具與cold/reference fixture，非純retained UI或Android需求。現況工程／政治／實體增大仍有現況成本；本批採全實體Update與部分區段Snapshot，未聲稱每個巢狀純量皆Delta。

## Gate與重現

- 定向涵蓋Projection／Admission／React／Runtime／Ledger／Preview／freeze，最終總數見PR驗證留言。早期核心47 PASS、擴展174 PASS、最後React5 PASS、正式軍隊1 PASS。
- successor／防竄改43項測試與全部正向Gate通過；Preview graph75模組、0 authority/storage、0 render完整Reducer。版本固定來源與反例測試不更新舊證據來自我放行。
- Typecheck、Build、project Pages paths、Release artifacts／Worker identity通過。最後安靜完整回歸及GitHub CI結果以PR Checks／最終留言為準。
- [第一輪完整隔離真實摘要](full-attempt1-summary.json)：2371 PASS／2 TIMEOUT／1 SKIP；同環境PR56為2355 PASS／相同2 TIMEOUT／1 SKIP。150k120秒與Runtime30秒期限保留；本輪第一輪曾與定向、Gate、Build共用CPU，不當安靜效能對照。

重現：Node22、npm ci、Typecheck／Build；全套只能 `node scripts/verify-in-isolation.mjs full`。微基準 `node scripts/benchmark-ui-projection.mjs`。先release:prepare，以唯一的 `node scripts/serve-ui-projection-validation.mjs` 啟動5184（停用HMR），再跑兩個 `verify-ui-projection[-performance]-browser.mjs`。需可用Chromium／Playwright，可設定PLAYWRIGHT_MODULE／B10_BROWSER_URL。Chrome產物在ignored artifacts，不需要玩家資料。

## 六個交付問題

1. UI一般更新已完全停止接收完整命令歷史；命令Query／有界Inbox結果獨立處理。
2. 30k／60k普通Patch不隨收據歷史線性成長；現況實體／區段本身大小仍影響傳輸。
3. 未變城市／軍隊保留參照，城市詳情隔離已測；時鐘／共享依賴／父層仍合理重繪，非全UI零額外render。
4. 點擊原始前提保留；治理ABA、身份、玩家順序fence與正式Reducer驗證未放寬。
5. R3-01／02／03正式格式與原子契約不變，依全部定向／full／native／CI證據審查，不宣稱未跑完Gate通過。
6. R3-05仍有完整載入驗證、匯出匯入、Recovery、持久編碼／寫入、部分權威順序查詢與冷Projection來源重建成本；本批未提前做分段編碼或AI排程重寫。

Android實機、長期真配額／記憶體、混合壓力長任務歸因、正式部署仍待驗。B5 E1 HOLD／Astra未PASS／實體手機待驗事實保留；此Draft不是正式發布驗收。
