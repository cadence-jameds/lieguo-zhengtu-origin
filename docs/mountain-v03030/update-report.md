# v0.30.30 世界地圖山脈顯示修正

Implementation baseline：v0.30.29，commit b114c4fa328ba73ebd795b2f0e29902858495f34。規格 authority 沿用 v90；本輪只有地圖顯示 Delta，未開始 B6／B7／B8。

## 核對結果與修正

已閱讀 DEMO v0.30.2 ZIP 的 terrainRegions.ts、worldScenery.ts，確認 DEMO 使用完整透明山脈 atlas 圖片、深度排序與大型重疊山體；沒有逐格裁切山峰。參考 ZIP SHA256：39b945b23a74ac6aa75412d31459c3efc7954bde40eb99e766ac33029cc5539a。

目前顯示異常的原因是 SceneryCache 將整張山脈圖片裁進 Formal M 地塊聯集，造成山峰被斜線削平、山腳呈現鋸齒。

- 移除每張山體的地塊裁切，恢復完整山形與既有素材的原始長寬比。
- 每六列在連續山地中央放置一個大型山體，避免密集堆疊；沿用 seeded variant、翻轉、深度排序與世界座標快取。
- 由既有 atlas 的所有非透明像素建立保守輪廓，核對完整圖片與河流／水域；接近水域時縮放整張圖片，不削掉山峰。
- 森林、地表裝飾、城市／據點避讓、標記與行軍前景沿用現有機制。

## 正式規則與相容性

沒有修改 Formal terrain、世界生成版本、山地不可通行／不可建城、行軍路徑／距離、偵察、戰利品、432 個據點 lifecycle 或存檔 schema。山體的立體投影可以跨出錨點地塊，是展示層效果，不會將投影下的地面改為山地；通行仍讀正式 terrain。完整圖片與單格地面範圍並不相等，不能將圖像當成新的通行判定。

## 驗證

- Formal／presentation／saveLock：50 個測試檔、529 項 PASS，包含 B5、save/load、BattleReports、UI。
- 專項含四種種子（0、1、90217、uint32 max）、全山體錨點／輪廓、水域避讓、讀檔與時鐘一致性、無 per-sprite 裁切。
- typecheck 與 production build PASS（發布流程輸出另附）。
- before.png／after.png 為目前 painter 輸入的離線視覺合成，用於檢查完整山峰；不是瀏覽器截圖，不宣稱手機 FPS 或玩家 Smoke 通過。
- 本輪完成後 STOP，不開始新階段。
