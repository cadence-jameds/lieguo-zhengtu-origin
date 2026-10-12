# 列國征途：始源 v0.30.31 更新報告

日期：2026-10-09（Asia/Taipei）
唯一 implementation baseline：已發布 v0.30.30，commit cc09adde965ff791ce493867ac54ca759fc08150。沿用 v90 Formal authority；本輪只處理建造條件呈現及山脈通行／建城一致性，未開始 B6、B7、B8，未重做 B5 combat resolver。

## 玩家可見變更

- 建造選單移除重複的逐項「未達」清單及通用「符合建造條件」提示。保留一行前置，逐項已達為綠色、未達為紅色；例如封建時代紅色、城市中心 Lv5 綠色、民居 Lv5 紅色。資源不足與施工佇列等其他拒絕原因仍保留，合法建造 command 與按鈕條件不變。
- 山脈完整圖片輪廓覆蓋的格子正式標為 mountain：行軍不可穿越，建城命令拒絕。前一版只修正完整山形繪製，沒有將圖片覆蓋範圍同步為正式地形，本版修正該落差。

## 正式地形與相容性

參考 DEMO v0.30.2 完整 alpha 輪廓與避讓原則，實作在 Formal durable terrain；未使用 legacy geography、march 或 combat engine 作 authority。既有山脈素材不變。保守遮罩納入圖片透明邊緣的非零 alpha 區域，由同一 mountainFootprint 同步繪圖配置、Formal mountain 格與 schema 驗證。

新世界先建立固定山脈 profile，再生成城市／據點；保留世界 384×384 與固定 432 wild slot lifecycle。Formal passable、buildable、routing 與 settlement command 直接使用正式地形，不另建立 UI 通行規則。

native terrainVersion 2 在原 envelope、schema、checksum、report 檢查後一次遷移到 3。schemaVersion 仍為 3，IndexedDB 架構不變。遷移避讓既有城市、所有據點 slot、拓殖隊、行軍與物流路徑及一格周邊；會覆蓋這些位置的整張山脈圖片取消繪製。保留城市、據點、軍隊 ID、任務、完整路徑、抵達時間、事件及 command receipt，不搬移既有实体或重新計算在途任務。持久化山脈 profile 不隨世界時間、據點 generation 或刷新而重新生成。寫入失敗保留原存檔。

## 變更覆蓋矩陣

|項目|結果|證據|
|---|---|---|
|建造條件混合紅綠／全部達成|PASS|buildConditions31.test.tsx；mixed/met HTML|
|無重複前置清單與通用提示|PASS|UI DOM regression|
|實際建造按鈕與 command|PASS|未達禁用、已達合法 payload|
|四種 world seed 完整 mountain footprint|PASS|mountains31.test.ts；所有覆蓋格不可通行／不可建城|
|真實拓殖命令拒絕山脈覆蓋格|PASS|資源與 ready unit 不損失|
|固定 432 據點、城市合法位置|PASS|Formal generator regression|
|舊 terrain 2 在途軍隊 save/load|PASS|legacy-migration.json；路徑、時間、事件、receipt 保留|
|快照／時間／generation 不重抽山脈|PASS|durable profile roundtrip|
|checksum 與偽造 footprint 拒絕|PASS|save/schema negative tests|
|IndexedDB 原子遷移與 fault rollback|PASS|既有存檔保留，健康寫入地形 3|
|完整素材繪製、不按格裁切|PASS|mountainRendering / DemoMapCache tests|
|B5／save-load／BattleReports／UI|PASS|完整 536 項回歸|

## 驗證

- 完整正式系統與 UI：536 tests PASS、0 failed（regression-tests.json）。
- 本輪 targeted：16 tests PASS、0 failed（targeted-tests.json）；與完整測試重疊，不相加計數。
- TypeScript typecheck PASS。
- 發布流程執行 TypeScript 與 production build；成功結果隨發布交付記錄保存。
- 本輪未宣稱瀏覽器截圖或裝置 FPS 測試。測試 HTML 是 DOM 證據。

## 範圍限制

不改據點生成率、守軍、loot、generation、respawn、偵察規則、戰利品搬運或 combat resolver。山脈地形更新會改變新下達任務的可走路徑，這是本輪要求的正式阻擋效果；舊在途路徑與時間保留。
