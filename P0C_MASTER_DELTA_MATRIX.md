# P0-C Master Delta Matrix

基準 main `06c4cb93779f1f679bb77470515fd8aee1c42de9`；施工起點 PR21 `b4faa4e188a4b0a456a4af5b94ade2363bcee247`。Authority：玩家最新施工令 > v94 > 有效核准PR/Issue > 指定DEMO UI > source。

本表先記錄source缺口，後續在同表追加驗證。PASS只代表指定範圍；整體Gate未通過。C13-ORG-RANK-PENDING，Android真機未驗，C4 HOLD。已結案UI復原搜尋不重跑。

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
