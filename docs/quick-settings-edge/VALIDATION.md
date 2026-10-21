# 懸浮齒輪定向驗證

基準 main：`a7100066d0fefacb3d8252d8bd5ac8a6e16cc6a7`（已合併 PR #23）。

- 只調整 QuickSettings、相關 CSS 與測試；不變更 Formal Runtime 或戰役資料。
- 取消頂部／底部拖曳禁區。四邊 24px 內放開後收合；點擊先展開，再點擊開啟快速設定。
- 本機偏好沿用原 key，增加可選 edge；舊偏好仍可讀取，縮放視窗後重新限制座標。
- 控制項透過 Portal 浮於頁面上；原生對話框開啟時移入其內，維持原生焦點／最上層邊界。
- 圖示為單色 SVG，無陰影或漸層；不需要載入額外圖片。

驗證：Typecheck、Production Build、Pages 路徑、Release Metadata 一致性 PASS；快速設定單元測試 7 PASS。

原生 Chromium、正式 Worker／IndexedDB、合成 seed 90217、每局 99 AI：1440×900 滑鼠、390×844／320×568 觸控三組皆 PASS。涵蓋四邊收合、點擊展開、拖曳不誤開、上下自由拖曳、重新載入、尺寸變更、隱藏／顯示、原生對話框浮層與滑條暫存／取消。沒有 JavaScript pageerror。

[手機展開](mobile-expanded.png) · [手機收合](mobile-tucked.png)

完整隔離 Regression 由本 PR 現有 GitHub CI 執行，結果見 PR 留言。Android 真機與低階 GPU 待人工驗收；C4 仍為 HOLD，沒有宣告整體 Gate PASS。
