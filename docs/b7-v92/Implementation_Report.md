# B7 v0.30.42 Implementation

延續 B6 9a7ee6b。零城市在 Formal event resolution 同步觸發滅國，清除政治與未完成研究／時代／拓殖／大型工程，取消完成事件，不退款、不誤完成，已付款科研 ledger 保留於 cancelledResearch。每支獨立殘軍按原 route 種子抽樣、非法點最近合法回退，獨立生成世界中立 exile sites；不占 432 slots、無 respawn。

交戰中殘軍保留至既有戰役完成，extinctionPending 持久化，玩家先復國亦不重新控制該軍。單一母城失守而仍有自有城市的原契約保留。最後擊破前的實際剩餘編成逐兵種 floor25%、每據點一個固定文明工匠，玩家／AI 同一 resolver，不解鎖科技資格。工匠隨軍真實返回，轉移走正式 route/event；目標失守會實際重新行軍而非瞬移。城堡正常建築付款、施工佇列與工期，文明來源快照寫入 Construction，完成才消耗工匠；每城一堡、正常升級。城堡及徵兵 UI 使用該堡文明，科技仍限目前領主。

玩家復國命令去重、不限次數、三個低擁擠遠帝國候選、6/7糧排除9/15，人口400／住房400／center1／田0／stock600各／軍隊0／48h保護。保留文明、時代、已完成科技及Meta。AI無復國。偵察不解除本方保護，掠奪／征服提前解除。

B5舊測試更新只涉及明確被B7取代的「滅國殘軍stranded／外文明生產readonly」；發起城失守研究／時代繼續測試增加第二自有城市以明確區分母城失守與滅國。未改B5傷害／持續攻城／精簡戰報。

驗證：61 files／757 tests PASS；B7直接8項測試（含IndexedDB）與B5測試盾14項Delta PASS。typecheck PASS，production build PASS（同階段 logs 可查）。Formal核心與presentation回歸、typecheck、production build、B7 IndexedDB失敗注入／完整匯出匯入／Recovery、save/load／離線切片等價均須成功後封存。Astra Gate未執行；B5 E1仍HOLD；實機人工PENDING。

下一階段：B8 自主99AI與城市治理，沿用此所有權／殘軍／獎勵入口。B9未開始，Sites未更新。
