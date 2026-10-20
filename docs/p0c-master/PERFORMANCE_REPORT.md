> 本頁保留原1440次ABBA歷史；最新以PR21為before的1100次比較見[最終效能報告](../p0c-final-delta/PERFORMANCE_REPORT.md)。

# C4 效能驗證：HOLD

正式目標是玩家操作至合法處理、durable commit及畫面更新全部在1秒內。最終ABBA已重現超標，因此保持HOLD；功能／資料安全測試PASS不能代替延遲Gate。

## 已實作的瓶頸修正

原追算與命令分別保存，現在於私有draft完成事件追算、以原意圖重驗正式命令，最後共用一次原子保存／revision。事件及命令沒有省略，失敗保存不暴露draft，也不產生成功ACK。若命令拒絕但有合法追算，只保存追算結果。

Persistence移除重複前置完整validateFormalWorld；最終encodeSave仍完整驗證，之後才進入原子DB交易／CAS。receipt、authority、reports、backup故障及Replay／Recovery安全定向63案與完整1445案回歸通過。

[前置剖析](evidence/profile-diagnostic.json)10筆Node／fake-indexeddb改名診斷中，save共7168.6ms、encodeSave2794.0ms、30次validate2736.8ms、digest1939.0ms；這些含巢狀區段，不能相加當總耗時。這批SHA未記錄，sourceTreeHash有保存，只作定位重複驗證／保存，**不是main與candidate原生端到端比較**。

## 最終原生AB／BA量測方法

- main `06c4cb93779f1f679bb77470515fd8aee1c42de9`，candidate `ae39092bec61ebf3a52e497bc7f32a9a6c6cf519`；兩者都是Production Build、正式Worker與原生IndexedDB。
- 新局、96h、168h × 1440×900桌面／390×844手機模擬 × 1X／10X／50X。每組順序main→candidate→candidate→main，各pass20次嘗試；每版／組共40次，至少30次committed有效量測才符合樣本數要求。每組有改名、建造、訓練、研究、派兵五類。
- 自然世界起始99 AI；0h／96h仍99存續，168h為81存續但99份agent紀錄。自然滅國不補活、不降低活動、不改事件頻率；不要誤稱168h仍99存續AI。
- 為了讓同一世界合法測到五種操作，僅設定己方生產建築／倉儲、資源、人口、民兵與研究時代等公開前提。這是**natural-derived controlled player prerequisites**，不是完全未修改新局。每次操作前明確還原同一checkpoint，避免先做命令消耗資格導致後續比較不同；不在實際待測命令內跳過事件。
- 每pass記錄各speed輸入SHA256與bytes，確認ABBA同資料。存檔只留授權雲端本機，不公開.realm-save或私人資料。
- 起點為實際提交按鈕pointerdown；記錄Worker post、durable ACK與committed畫面斷言後兩次requestAnimationFrame。讀原生DB驗證Applied Receipt放在renderAt取樣之後。畫面完成值包括瀏覽器自動化斷言／兩幀觀察成本，是保守觀察值，不等於精確實機paint時間。
- 成功值取max(ACK,render)；拒絕保留原因與ACK，但不當作成功延遲。保留所有慢樣本／失敗，不丟冷啟動值；分別列成功樣本數、失敗率、p50／p95／max、>1s。main與candidate有效命令分布若因main派兵拒絕而不同，不能直接把總體差值當同分布因果改善；另按命令族列統計。
- 同一主機依序執行，量測時不並行Build、完整Regression或AI模擬；CPU／cgroup quota／記憶體環境與每pass load／freeMemory會保存。手機是Linux headless Chromium touch viewport模擬，不是Android真機／GPU或手機記憶體驗收。

## 最終ABBA結果

全部24個pass／1,440次嘗試已完成，36組各有31～40筆有效樣本（均達至少30筆），9組世界／速度輸入SHA256一致。[逐筆raw與日誌](evidence/latency/)、[統計與命令族分層](evidence/latency/statistics.json)、[原始執行順序與host負載](evidence/latency/runs.json)。全部1,374筆有效樣本均為預期命令類別、committed終態且原生DB有durable receipt，沒有不符紀錄。

|版本|嘗試|有效|正式拒絕|等待ACK逾時|提交前／未分類操作逾時|有效樣本>1秒|
|---|---|---|---|---|---|---|
|main|720|656|61|1|2|341|
|candidate|720|718|0|0|2|323|

以下p50／p95／max及>1s僅計有效成功；最後欄是所有未納入有效量測的嘗試，**不是全為正式拒絕**。main有一筆training在15秒觀察窗仍pending，最終延遲未知、下限至少15秒，所以不能將成功樣本max當全部操作的最大延遲。Candidate兩筆發生於168h手機50X第二pass：建造在命令送出前等待條件逾時、訓練按鈕disabled／detached逾時；last observed receipt仍是上一筆改名。未據此假稱命令已拒絕或已成功。

|世界／介面／速度|main n／p50／p95／max ms／>1s／未納入有效量測|candidate n／p50／p95／max ms／>1s／未納入有效量測|
|---|---|---|
|0h／1440px／1X|40／271.2／573.6／921.4／0／0|40／308.2／559.6／1158.9／2／0|
|0h／1440px／10X|40／293.8／530.1／676.8／0／0|40／291.5／867.1／1694.9／2／0|
|0h／1440px／50X|39／321.5／1261.5／1791.9／2／1|40／297.4／1002.9／1645.4／3／0|
|0h／390px／1X|40／265.4／474.6／543.6／0／0|40／255.5／427.0／746.1／0／0|
|0h／390px／10X|40／278.0／605.6／1086.4／1／0|40／244.1／784.7／1005.1／1／0|
|0h／390px／50X|40／274.5／405.7／1053.6／1／0|40／235.9／398.0／601.1／0／0|
|96h／1440px／1X|40／1027.9／2582.0／3470.1／21／0|40／724.6／1578.3／2775.7／6／0|
|96h／1440px／10X|35／1080.2／2388.8／2872.9／18／5|40／739.5／1385.6／1750.2／9／0|
|96h／1440px／50X|31／2081.5／3108.5／3528.8／31／9|40／1011.5／1877.7／10118.0／22／0|
|96h／390px／1X|40／933.9／2330.8／5168.1／16／0|40／759.6／1265.7／3165.5／7／0|
|96h／390px／10X|36／1048.6／4156.7／4810.5／20／4|40／808.3／1421.3／1980.5／8／0|
|96h／390px／50X|32／1702.7／2728.3／2971.0／31／8|40／1206.4／2704.5／3567.1／28／0|
|168h／1440px／1X|34／2093.7／4203.5／7422.5／34／6|40／1631.5／2454.6／3612.1／40／0|
|168h／1440px／10X|38／1686.8／4636.6／4904.0／38／2|40／1612.7／3270.6／3592.6／39／0|
|168h／1440px／50X|31／2446.2／8018.1／12556.2／31／9|40／1901.2／3569.7／5603.2／40／0|
|168h／390px／1X|32／1767.7／4404.9／4547.0／31／8|40／1950.4／3664.1／9103.6／40／0|
|168h／390px／10X|36／1573.2／3864.6／4044.9／35／4|40／1339.3／2061.9／4832.8／38／0|
|168h／390px／50X|32／1759.0／5095.2／5362.1／31／8|38／1656.3／3292.1／3415.8／38／2|


主機為Linux x64、Intel Xeon Platinum8573C，3個可見logical CPU，cgroup CPU quota `200000 100000`（2 CPU），記憶體限制8GiB，Node24.19.0。每pass保存load與freeMemory；桌面／手機同主機交錯依序，沒有並行AI長測或Build干擾這批時序。

Candidate成功最大值10,118ms發生96h桌面50X研究，Worker durable ACK為9,048.1ms，提交前post delay10.7ms、ACK後畫面觀察1,069.9ms。這表示主要等待在Worker／保存路徑，沒有內部分段trace足以進一步斷言唯一原因；encode、digest、世界追算與DB成本仍需後續剖析。168h候選每組p95仍超過2秒，且少數新局也超標，**C4 HOLD**。不能由總體有效比例或p95降低就宣告1秒目標達成。

精確受測production為AE39092。其後A002僅修正C8導航，Formal／Worker／Persistence／Admission／useGame逐位元相同（見source manifest）；本輪沿用該Runtime量測，再對A002補Typecheck／Build、定向測試、原生UI及地圖繪製。沒有把這批舊SHA延遲宣稱為A002重跑結果，也沒有為UI導頁重做昂貴矩陣。


## 已完成的定向證據

[派兵修正pilot](evidence/mixed-dispatch-fixed-pilot.json)15次全部committed，三種speed各五類命令；仍有>1s，樣本不足最終Gate。main與修正前candidate的實際revision拒絕保留在本目錄的mixed-pilot紀錄。

[ae39092原生相容](evidence/c9-native-ae39092.json)五案PASS，包含三速改名／同ID重送／真衝突、桌面與手機雙軍並發及Recovery去重。這批不是最終30筆ABBA資料。

## C11 地圖繪製成本

[歷史240筆](evidence/map-perf.json)：99份agent紀錄、98個存續AI的受控UI世界（切城測試將一座AI城市移交玩家），詳見[限制說明](evidence/CONTROLLED_FIXTURE_LIMITS.json)。這批不是99個存續AI驗收；另有下方獨立99存續fixture補驗。原測量，各view／開關狀態30次鍵盤平移。等待初始assets後，觀察renderer既有data-render-ms；不在每幀重算政治geometry。

|寬度／視野|版圖關閉 p50／p95／max ms|版圖開啟 p50／p95／max ms|
|---|---|---|
|1440 全區|1.0／3.5／14.6|2.4／6.1／6.5|
|1440 近城|0.5／1.2／1.7|1.2／4.4／5.3|
|390 全區|1.0／2.0／3.8|2.8／3.9／4.9|
|390 近城|0.4／4.6／4.8|0.8／1.7／2.0|

這是Canvas CPU指令提交成本，排除初始載入等待，不是手機GPU FPS或完整互動延遲。快取失效／水面／遠離島狀領土／不改權屬另有純呈現測試與並列圖。前兩次測量腳本因selector匹配close按鈕、浮動圖例遮住工具列而失敗，已保存first／second-failure.log；改為精確按鈕並正常關閉圖例，不強制點穿遮擋、不修改遊戲迎合測試。


## 99個存續AI的獨立地圖補測

[原始240筆](evidence/map99-perf.json)使用未移交城市的獨立fixture：99個agent、99個有城市的AI、99個保留排程的agent、100城、384×384、world0。Production0.30.64／A002；沒有重跑原DEMO基準。

|寬度／視野|版圖關閉 p50／p95／max ms|版圖開啟 p50／p95／max ms|
|---|---|---|
|1440 overview|0.9／1.4／1.5|2.0／3.2／4.3|
|1440 close|0.4／5.2／5.7|1.1／2.6／3.1|
|390 overview|1.0／3.2／5.6|1.9／4.7／5.2|
|390 close|0.3／2.6／8.1|0.6／1.1／1.6|

每組30次warm平移，CPU Canvas提交成本；不等於GPU FPS、冷啟動、最壞帝國幾何或99AI同時決策下的互動驗收。獨立fixture保留自然AI排程，沒有降低AI頻率，但此繪圖微量測在初始暫停世界進行。

## 剩餘限制

**C4 HOLD**。最終36組樣本已完整交付，仍不達1秒；沒有降低99 AI活動、跳事件、放寬timeout、假ACK或宣告Gate PASS。實體Android、GPU FPS與私人長局存檔均未驗。
