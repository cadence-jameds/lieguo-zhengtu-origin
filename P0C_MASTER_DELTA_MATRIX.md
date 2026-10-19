# P0-C Master Delta Matrix

基準 main `06c4cb93779f1f679bb77470515fd8aee1c42de9`；施工起點 PR21 `b4faa4e188a4b0a456a4af5b94ade2363bcee247`。Authority：玩家最新施工令 > v94 > 有效核准PR/Issue > 指定DEMO UI > source。

下表保留施工前source缺口，後方「本輪交付」表為目前狀態。PASS只代表指定範圍；整體Gate未通過。C13已依最新玩家方案B核准完成，功能PASS；Android真機未驗，C4 HOLD。已結案UI復原搜尋不重跑。

|項目|Authority|main已有|PR21已有|剩餘缺口|候選檔案（相對src/game，另註除外）|必要測試|依賴|起始狀態|
|---|---|---|---|---|---|---|---|---|
|C1|施工令§3|6秒共用提示|同main|成功1.5秒、錯誤回看、ACK生命週期|GameApp.tsx; useGame.ts; commandFeedback.ts|success/reject/timeout/duplicate/CAS/mobile|C2,C3,C4|PARTIAL|
|C2|施工令§3; PR11|前景優先與原子邊界|保留|回歸所有命令類別|runtime.worker.ts（僅FAIL修正）|playerOrderRuntimeP0/orderAdmission|C3,C4|NOT VERIFIED|
|C3|施工令§3; PR11|安全Admission/CAS|保留|真衝突/無關revision回歸|orderAdmission.ts; governanceAdmission.ts（僅FAIL修正）|admission/persistence|C2,C4|NOT VERIFIED|
|C4|施工令§3|端到端延遲有超標|既有效能HOLD|AB/BA每組30筆；剖析與真實優化|runtime.worker.ts; persistence.ts; reducer.ts（依剖析）|native Worker/IDB + rendered timestamps|全部Runtime|HOLD|
|C5|v94§6.6; 施工令§4|任意正數兵可建流亡據點|同main|有效戰鬥兵資格、排除斥候收編、舊資料|formal/extinction.ts; battles.ts; saveCodec.ts; reducer.ts|exile negative/mixed/old-save/recovery|C6,C9|FAIL|
|C6|PR3; 施工令§4|工匠免費Lv1城堡|保留|與C5/五筆交互回歸|formal/extinction.ts; economy.ts（僅FAIL修正）|extinctionB7/castle/queues|C5,QUEUE5|NOT VERIFIED|
|C7|v94偵察; PR15; 施工令§4|報告可能跨攻守範圍|同main|交付攻方、守方視角、舊資料全鏈路|formal/battles.ts; reportScope.ts; saveCodec.ts; persistence.ts|attacker/defender/multi/replay/IDB|C9|FAIL|
|C8|施工令§4|單城與既有軍情投影|同main|全域多城ETA警報|formal/aiKnowledge.ts; presentation/Shell.tsx; GameApp.tsx|filters/ETA/navigation/mobile|C1,C9|PARTIAL|
|C9|施工令§5; 已核准五策略|未合併|五策略+35組原長測|只補受影響相容回歸|保持aiAttackStrategies/aiActions/autonomy權重|seeded/replay/queue/scout/exile compatibility|C5,C7,QUEUE5,C4|PARTIAL|
|C10|DEMO44728f7; 施工令§7|Formal復國規則/入口|同main|背景、版型、合法導頁、受控場景|presentation/ExtinctionView.tsx; GameApp.tsx; game.css|extinction desktop/mobile/reentry|C5|NOT VERIFIED|
|C11|DEMO44728f7; 施工令§7|半徑5塗層|同main|半徑8視覺/有限走廊/邊界/水域/標籤|presentation/mapRelations.ts; FormalWorldMap.tsx|controlled empires/water/disjoint/zoom/perf|C9|NOT VERIFIED|
|C12|施工令§7|建立管理簡介仍存在|同main|移除UI輸入/編輯/多餘展示；保留schema|presentation/LegionView.tsx; PoliticsView.tsx|create/edit legacy description compatibility|C13|FAIL|
|C13|施工令§7領主排序已核准|三分類搜尋/詳情|同main|領主排行；組織軍力子項待裁決|presentation/PoliticsView.tsx; factionRankings.ts|ties/stable ID/public fields/mobile|C12|PARTIAL|
|QUEUE5|v94§17; 施工令§6|QUEUE_CAPACITY=3；舊面板/3|同main|真容量5/拒絕第6/摘要；策略門檻不混淆|formal/economy.ts; military.ts; FormalCityPanel.tsx; CityScenes/CityQueues/BuildingDetail|single/double/cancel/complete/multicity/AI/save/offline/CAS|C6,C9,Issue5|FAIL|
|Issue14|施工令§8|總追蹤|C9證據|逐項commit/test/evidence狀態|本矩陣/Delta/PR21|完整追溯|C1-13|PARTIAL|
|Issue4|PR9; 施工令§8|六文明文案已修|同main|先回歸|文明介紹UI（僅FAIL修正）|六文明 desktop/mobile|—|NOT VERIFIED|
|Issue5|PR9; v94§17|摘要已有但容量3|同main|同步5並確保切城/Recovery|CityScenes.tsx; FormalCityPanel.tsx|desktop/mobile/current-city/cancel/finish|QUEUE5|PARTIAL|
|Issue6|PR9; 施工令§8|手機成本卡已有修正|同main|390與更窄回歸|BuildingDetail.tsx; game.css（僅FAIL修正）|large costs/shortages/time/actions/overflow|QUEUE5|NOT VERIFIED|

## 保全

現有AI三檔與35組長測、DEMO379檔來源與14張原圖保持。另一worktree不修改。main/reference不寫入，不merge/deploy。原4個歷史缺tree的fsck限制保留。

## 本輪交付

最新正式程式基準 `ba11a66694a9190074c035f87ce0501d7744dd77`。最新Runtime CI完整隔離 Regression **1458 PASS / 0 FAIL / 1 既有 SKIP**，見 [證據](docs/p0c-final-delta/evidence/ci-runtime.json)。[最終Delta](docs/p0c-final-delta/DELTA_REPORT.md)補齊C13方案B及C4新效能證據。舊AE39092延遲／35組矩陣保留原受測SHA；最新ba11另有C4比較與自動35組相容結果。AI三核心檔逐位元不變，Persistence本輪有明確delta。所有程式檔案、提交與可重現步驟見 [Delta Report](docs/p0c-master/DELTA_REPORT.md)。

|項目|本輪內容／保全|驗證與交付狀態|
|---|---|---|
|C1|成功提示1500ms；送出／受理／durable ACK分開；錯誤回看與手機位置|定向與完整回歸 PASS；原生瀏覽器實際命令驗證|
|C2|保留前景FIFO與不可中斷保存邊界|playerOrderRuntimeP0、原子保存／故障回歸 PASS|
|C3|保留CAS、receipt與前景／分支 fence；新增派兵公開意圖與自有兵力快照的一次性重驗|23項定向 PASS；不忽略 revision、不任意重試所有命令；真衝突拒絕|
|C4|保留既有追算／原子保存；新增普通save可變分支副本、逐欄收據比對，最終strict驗證／checksum／CAS保留|**HOLD**；新1100嘗試／1099有效／1提交前逾時，36組皆至少30；候選189／549超標、max8613.2ms，尾端改善不一致；見最終效能報告，不能以功能PASS代替1秒目標|
|C5|有效戰鬥兵資格、剔除收編斥候、舊非法據點cooldown tombstone，沒有補發獎勵|單元／codec／Replay／去重與原生IndexedDB遷移 PASS|
|C6|PR3免費工匠Lv1城堡、工期與完工消耗保留；有效五筆上限回歸|工匠／失城／排程完整回歸 PASS；未重新實作|
|C7|攻方個人偵察交付，守方本方視角；寫入／查詢／匯入匯出與舊資料修復；移除未授權共享精確情報|完整回歸及原生DB物理資料檢查 PASS；非僅UI隱藏|
|C8|全域多城支數／最近ETA、清單排序、導航；排除斥候／友軍／尚未出發|舊AE導航負向FAIL、最終定向27 PASS及1440／390／320px原生入口6 PASS；不顯示精確兵力|
|C9|五策略三個核心檔案逐位元保留；原35組長測保留|完整回歸、C902兩seed自然96h及ae39092與最新ba11自動35組長測各自成功；三檔不變、舊新證據分列|
|QUEUE5／Issue5|單一QUEUE_CAPACITY=5，Formal建造／訓練／拆除／schema與所有摘要一致；active與queued合計，平行資格不變|第6筆無副作用、AI／多城／取消完工／Save／Replay／Recovery／CAS、桌面手機 PASS；不升schema|
|C10|國土盡失畫面、敗北背景、流亡復國入口與合法戰報／首頁／存檔動線|桌面390／320px、三合法復國候選與操作 PASS；Formal復國規則保留|
|C11|DEMO半徑8呈現、有限陸地走廊、邊界、透明度、水面排除、首城標籤與圖例；快取不隨無關clock重算|幾何／政治權屬不變、桌面手機縮放拖曳 PASS；五城DEMO／Formal並列已保存；繪製成本另列限制|
|C12|建立／管理／編輯簡介輸入與展示移除|UI／舊description契約回歸 PASS；未刪schema|
|C13|玩家方案B正式核准；帝國／軍團／領主按公開城市數→人口排行、同分同名次、ID穩定排序；成員／城市防重計，搜尋／詳情／玩家所屬與權限保留|**功能PASS**；正式成立／加入退出／征服易主及滅國／Save和Recovery、私有欄位讀取防護、桌面390／320px三分類通過；9張新圖及定向證據見最終Delta|
|Issue4|沿用PR9六文明文案，未重做|六文明1440／320px PASS|
|Issue6|沿用PR9成本／缺額／工期／按鈕排版，未重做|1440／390／320px無卡片橫向溢出 PASS|
|Issue14|逐項來源、程式、驗證與限制串聯至本PR|本矩陣／Delta／證據；不自行關閉Issue|

PASS範圍均限列出的測試／模擬平台。Android真機、實機GPU FPS與私人長局存檔未驗；C4未達標不能宣稱完成；C13方案B已完成功能驗證，歷史HOLD／FAIL及B5 E1 OWNER WAIVED保留。

本輪新增C13與C4分項提交073d36d／ba11a66；舊1440筆ABBA與原DEMO379檔／14圖保持。[新1100次比較及完整限制](docs/p0c-final-delta/PERFORMANCE_REPORT.md)。未Approve／Merge／Deploy／關閉Issue，整體Gate未PASS。
