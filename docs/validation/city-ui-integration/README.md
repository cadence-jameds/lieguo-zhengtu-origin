# 城市 UI 整合驗收

基準：最新 main `bfe242939a791350c4d4a2c0b262e4891266684e`（PR #45）。本輪僅交付 Draft PR，不合併或部署。

## 完成項目

- 名稱採彈性欄位與省略號，完整名稱保留 title／aria-label；總督、全景操作固定同列。座標與原有改名操作置於名稱下方。手機已啟用總督時顯示「總督方針」，title／aria-label 保留政策全名。
- 移除城市手機與桌面的兩個重複「帝王時代」Badge。
- 手機 HUD 使用目前玩家勢力的真實 age，兩列置中呈現「黑暗／時代」等文字，沿用 44px 點擊區與原操作。AGE_NAMES 與時代規則未變。
- 移除 FormalWorldMap 額外繪製的「帝」。清查 338 個 Runtime 程式、CSS、SVG 檔案，未見其他同類標記。保留正常時代／帝國／研究樹／征途名稱、圖像替代文字、科技等級與 ELITE，以及流亡軍「流」和其他地圖符號。
- 城內等級從名稱分離，使用 24px 半透明黑底白字正圓。徽章共用建築尺寸、圖片縮放與基腳定位，獨立圖層高於屋頂／施工效果，pointer-events:none。名稱隱藏時仍可見，空地與新建未完工建築不顯示；升級顯示當前完成等級。城郊、城牆、美術映射與圖片未變。

## 瀏覽器證據

`browser-result.json`：39 項 PASS，無頁面錯誤／HTTP 錯誤；另有最終四尺寸截圖複驗 PASS。

- `before/after-320x568-imperial.jpg`：長城名與帝王時代。
- `before/after-390x844-imperial.jpg`、`after-390-age-0/1/2.jpg`：同一 mounted HUD 動態切換四時代，城市標題與頂部高度。
- `before/after-844x390-imperial.jpg`：手機橫式。
- `before/after-1440x900-imperial.jpg`：桌面標題與 Lv1／9／10／15。
- `before/after-map-age-2/3.jpg`：城堡／帝王城市與 Canvas 舊標記對照；地圖點選仍可開啟原城市資訊。
- `after-construction.jpg`、`after-queued.jpg`：施工／排隊中的既有完成等級。

截圖來自實際 Shell、FormalCityPanel、CityScenes、FormalWorldMap。`preview.tsx` 只在驗收時建立並驗證合成 Formal world，不使用私人存檔，不修改正式玩法；圖片均為現有遊戲資產。24 組六文明×四時代皆驗證城內圖片成功載入、徽章與圖片中心一致；城郊 18 塊資源地仍使用原 parcel-label。

重現：以 Node >=22.13 執行 npm ci，啟動目前版本 Vite 於 4175、基準版本於 4181，將本資料夾的 preview.html／preview.tsx 複製到基準相同路徑，再執行 `node scripts/verify-city-ui-integration.mjs`。此腳本使用環境提供的 Playwright 與 /usr/bin/chromium，輸出本資料夾。

## 檢查與限制

檢查摘要見 `checks.json`。完整回歸使用 `node scripts/verify-in-isolation.mjs full`，避免歷史測試寫入正式工作樹。既有 B5 E1 HOLD、Astra Gate 未 PASS 與實體手機待驗狀態保留；瀏覽器模擬驗收不替代實體手機。

完整回歸原始結果 **FAIL：2104 PASS／1 FAIL／1 SKIP**。唯一失敗是未修改的 `src/game/formal/runtime.test.ts` 中 `developer speed changes bridge…` 超過 30000ms。本分支隔離定向重跑 PASS（16508ms），最新 main 同測試 PASS（15951ms）；未修改該測試、Runtime 或超時門檻，也未把整體結果改標 PASS。唯一 SKIP 是需要外部私人存檔環境變數 REALM_REGRESSION_SAVE 的歷史測試，本輪不提供或使用私人存檔。

AGENTS.md 記錄的歷史三項美術失敗未在此 main 基準的兩個 legacy art 測試檔重現（20 PASS）；本輪完整回歸也沒有美術失敗。此觀察不更動既有驗收／Gate 記錄。
