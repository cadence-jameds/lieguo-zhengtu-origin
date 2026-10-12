# 列國征途：始源 v0.30.32 更新報告

日期：2026-10-09（Asia/Taipei）。唯一 implementation baseline：已發布 v0.30.31，commit a97b955a0d48c587245e90f1ee701958b1640bc8。Formal authority 沿用 v90；本輪只修正世界地圖資源據點背景顯示。

## 變更

已實際讀取 DEMO v0.30.2 source 中 worldScenery.ts 與 sceneryPlacement.ts：背景清除只適用 capital／village，scenery cache key 亦只包含城市。資源據點生成、冷卻或重生不改變背景地景。

目前 Formal SceneryCache 曾將 432 個 wild site slot 與城市一併列入 radial destination-out 背景清除及快取依賴，造成據點周圍樹木／地景被擦除。本版改為只使用 Formal cities。

- 資源據點保留背景樹木、地景，不再套用城市清場效果。
- 據點移動、冷卻、generation 變更沿用原有背景快取，不會製造新的空洞或重算背景。
- 城市仍保留 DEMO 的背景清場。
- 據點圖片、選取互動、底部標記、等級標示及繪製順序不改。

未改 Formal terrain、mountain profile、通行／建城、據點 432 slot lifecycle、生成率、守軍、loot、combat、scout、存檔或 IndexedDB schema。未使用 legacy engine 作規則 authority；未開始 B6、B7、B8。

## 驗證

本輪 targeted 17 tests PASS、0 failed：DemoMapCache 6、mountainRendering 4、playerFeedback 7。新增 canvas regression 透過實際 SceneryCache draw/pump 驗證 432 據點不產生背景清除、所有據點移動／冷卻／generation 變更後快取沿用、城市在相同座標仍產生清場。既有 cache budget、全區冷啟動、山脈完整繪製與正式阻擋回歸通過。

正式發布另執行 TypeScript typecheck 與 production build；結果隨交付記錄提供。本輪不宣稱瀏覽器截圖或 FPS 量測。DEMO 比對 excerpt 與 ZIP hash 見 demo-reference.json，測試詳情見 targeted-tests.json。
