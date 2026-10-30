# 手機城內比例與米色標籤驗證

以最新 main `7f184d526019d40caf370d2b0fe3ed3ba7e8c66a`（已合併 PR #49）為修改前基準。UI 與瀏覽器證據固定在 `96fcadb5c47e6533066ede29ce4dd631488e3da8`；本輪僅修改 `CityScenes.tsx`、`game.css` 兩個 Runtime 來源。獨立功能分支，維持 Draft，未合併或部署。

## 比例量測

使用相同合法合成 Formal world、實際 Shell／FormalCityPanel／CityScenes，以瀏覽器實際繪製尺寸量測圖片或 SVG 裁切內容。套用 object-fit、CSS 內距、旋轉及縮放，排除 alpha ≤96 的透明留白；結果取 CSS 像素，邊界有約 1px 量化誤差。完整資料與每對建築不透明輪廓交集見 `browser-result.json`。

| 建築／場景 | 320px 修改前 → 後（W×H） | 390px 修改前 → 後（W×H） |
|---|---|---|
| 民居 | 45×39 → 66×56 | 47×41 → 68×58 |
| 倉庫 | 51×40 → 68×53 | 54×42 → 70×55 |
| 兵營 | 59×49 → 69×58 | 61×50 → 72×60 |
| 城市中心 | 81×69 → 81×69 | 83×71 → 83×71 |
| 城堡 | 83×66 → 83×66 | 85×68 → 85×68 |
| 城郊農田 Lv5／6／10／11／15 | 106×97／98×75／98×75／89×68／90×69，前後相同 | 106×97／98×75／98×75／89×68／90×69，前後相同 |

手機 `.town-close` 的圖片呈現層按類型增加 45%（小型）、32%（倉庫／市場／射箭場）、18%（學院／兵營／馬廄／攻城工坊）；城市中心與城堡保留原比例。既有帝王校準仍由原 `townBuildingScale()` 處理，未修改該函式。按鈕、地塊座標、場景大小、手機全景、桌面及兩種城郊模式均逐項比較，建築尺寸未回歸。

六文明×四時代×兩套建築配置涵蓋一般建築與學院／攻城工坊／使館；所有案例的最大片段交集占較小建築不透明像素 **0.84%**，無嚴重遮蔽。畫面另經人工檢視，實體手機仍待驗。

## 標籤與操作

已完成建築與城門使用米色底 `#fff4dfe8`、深棕字 `#4a4129` 及 `#8b795899` 邊框。收起名稱為圓形等級徽章；顯示名稱為同一中心的單列名稱＋粗體等級。已移除建築下方重複名稱。長名稱限制寬度，手機全景使用依場景寬度限制的緊湊膠囊，名稱可省略，完整等級不截斷。

Overlay 與圖片共用縮放及視覺中心校準，徽章反向補償手機圖片放大，保持可讀尺寸；不攔截點擊。等級維持實際完成值，新建 Lv0 不產生徽章。施工及排隊中的已完成等級均有驗證；城門 Lv0／1／9／10／15、兩種名稱模式及原城防回呼由單元測試驗證。城郊原樣式完全保留。

## 證據與重現

- 320px：`before-320-town.jpg`、`after-320-town.jpg`。
- 390px：`before-390-town.jpg`、`after-390-town.jpg`；名稱／城門共用 `after-390-names-gate.jpg`。
- 比例不變：`after-390-outskirts.jpg`、`after-390-panorama.jpg`、`before-1440-town.jpg`、`after-1440-town.jpg`。
- 瀏覽器：`browser-result.json`，53 PASS／0 FAIL／0 載入或 JS 錯誤；檢查 computed styles、圓形、視覺中心、模式切換、輪廓交集與名稱碰撞，並實際點擊建築、城門與空地開啟原對話框。

重現時先 `npm ci`、`npm run release:prepare`，將上述基準 commit 用 `git archive` 展開至獨立暫存目錄，連結 node_modules 並複製忽略的 `.release`。分別以 Vite 啟動目前來源 `127.0.0.1:4175` 與基準 `127.0.0.1:4181`，執行 `node scripts/verify-mobile-town-labels.mjs`。腳本使用 Chromium；可透過 `PLAYWRIGHT_MODULE`／`CHROMIUM_PATH` 指定本機安裝位置。完整回歸只執行 `node scripts/verify-in-isolation.mjs full`，避免歷史測試改寫工作目錄的證據。

## 相容性與驗收界線

`compatibility.json` 與 `scripts/mobile_town_successor.py` 固定兩個 UI 來源的前後 SHA、既有校準／圖片映射，以及完整 PR #49 證據與原歷史美術 manifest。新瀏覽器證據、截圖與測試腳本同時固定到不可變 UI commit；修改來源或圖片後只刷新 JSON 雜湊仍會被拒絕。原 Gate 保留執行，另加 3 項本輪防竄改測試；原 PR #49 的 10 項測試仍針對其不可變來源執行。

當次完整檢查結果另見 `checks.json`。AGENTS.md 記錄的 B5 E1 HOLD、Astra Gate 非 PASS、歷史 legacy 美術失敗，以及 PR #49 的完整回歸超時證據均保留。本輪 UI 檢查不代表正式美術或發布放行；實體手機操作、玩家比例與名稱可讀性仍待驗收。
