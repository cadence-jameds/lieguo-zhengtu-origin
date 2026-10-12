# v0.30.31 交接

本輪已完成建造選單單行逐項條件顏色與 mountain 圖片／Formal 阻擋格同步。STOP：未開始 B6、B7、B8 或其他新階段。後續以本版完整 source 為唯一 implementation baseline，規格維持最新 v90 加本輪明確修正。

- Formal mountainProfile revision 1 已持久化於 worldLayer，terrainVersion 3；schemaVersion 3 與既有 DB 保持相容。
- 舊 terrainVersion 2 必須經 decodeSave 原檢查後遷移；不可跳過 checksum／schema 或重新生成既有 profile。
- mountainFootprint 是繪圖與正式阻擋共用來源；不得恢复只繪圖不阻擋的山脈。
- 不得重新計算或刪除舊在途軍隊、拓殖隊、物流任務；migration 以整張圖片避讓保護格。
- 建造選單逐項顏色直接讀 Formal Requirement.met。建築共用資訊頁仍保留既有詳細前置區；本輪只精簡建造選單重複内容。
- 回歸 536 PASS；targeted 16 PASS；typecheck PASS。完整 report、JSON、HTML 隨 evidence zip 交付。發布 build 結果見 delivery 記錄。
