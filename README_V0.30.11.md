# 列國征途：始源 v0.30.11

本版依兩張玩家截圖及 v0.30.2 原始碼修正呈現：首頁使用同一張 river-city.webp；六個文明卡只顯示徽章、名稱與定位；選中文明詳情放在卡片下方；地圖「⋯」只展開工具列。手機採底部導覽、桌機採左側欄，手機軍隊恢復雙欄，手機橫向 HUD 採 DEMO 雙欄。

沿用 DEMO 的 game.css、themes.css、MobileNavigation.tsx 及美術；正式資料仍由 Formal catalogs 提供，沒有回復舊 DEMO 人口加成、三十六領主、存檔格式或玩法。正式世界維持 384×384、100 勢力及432 野外據點，離線推進、11兵種線與建造／訓練佇列沿用 v0.30.10。

手機判定沿用 DEMO：寬度不超過760px，或寬度不超過1100px且主要指標為觸控。修正桌機樣式在觸控裝置上的套用範圍；城市手機頁不再額外插入世界資訊列，地圖仍顯示世界時間。

Node.js 22.13 以上：npm ci；npm run dev。驗證：npm run typecheck；npm test；npm run build。Playable 包見 README_PLAYABLE.md。本機包改用 localhost:8771；從舊端口匯出存檔後匯入新端口，Sites 同網址直接延續正式存檔。

本輪已執行自動回歸、型別檢查與正式建置。SSR 結構與相同素材比對不等於實際瀏覽器視覺驗收；手機手勢、畫面逐像素、Windows 實機啟動及 Player Smoke 尚待檢查。不宣稱 Astra Gate 或 Player Smoke PASS，不進入 B5。
