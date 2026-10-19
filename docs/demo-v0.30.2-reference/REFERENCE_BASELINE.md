# DEMO v0.30.2 唯讀參考基準與中控交接

本輪日期：2026-10-18（Asia/Taipei）。範圍為定位、讀取驗證、結構盤點與比較基準建立；Formal 施工暫停，完成後 STOP。

## 1. 固定來源與完整性

- Repository：`cadence-jameds/lieguo-zhengtu-origin`
- 遠端分支：`reference/demo-v0.30.2`
- Commit：`44728f749044c1a5f1ad4fe47f1eccc391c7d9b2`
- GitHub 相對目錄：`demo-v0.30.2-source/lieguo-v0.30.2/`
- 該目錄 Git tree：`7cc6bb2017ba63c0020cdfe86db5b81fa882de03`
- 雲端完整唯讀原始碼：`/workspace/reference-baselines/demo-v0.30.2/source/`
- 獨立建置／執行副本：`/workspace/reference-baselines/demo-v0.30.2/runtime/`
- 正式對照基準：main `06c4cb93779f1f679bb77470515fd8aee1c42de9`，tree `18ec4ade6d7a043c4be0882d1b11a63c5563e8f1`；本機對照副本 `/workspace/reference-baselines/formal-main-06c4cb9/`。

遠端 subtree listing `truncated=false`，共 379 個檔案、61,533,559 bytes。143 個 src 檔案、127 個 public 檔案（其中 art 123 個）、90 個 docs 檔案、4 個 scripts，另有根目錄及設定檔。379／379 的檔案大小與 Git blob SHA-1 逐一匹配；美術二進位也逐位元驗證。277 個 blob 可從既有本機 Git object 取得且與遠端 SHA 相同，其餘 102 個 UTF-8 blob 由 GitHub 連接器讀回並驗證。不是僅靠檔名推定版本，亦未假設能讀 Windows `G:\`。

`package.json` 確實標示 `0.30.2`。`index.html`、全部來源、CSS、package-lock、Vite/PWA 設定、icons 與美術均已取得。601 處相對 source import／Worker URL 引用未發現缺失。此確認針對遠端 commit 的完整可建置專案，不代表已比較 Windows 未提交內容或原始 ZIP 的額外檔案。

完整清單及證據：`remote-manifest.json`、`integrity.json`、`dependency-audit.json`。重驗指令：

```bash
python /workspace/reference-baselines/demo-v0.30.2/verify-integrity.py
```

## 2. 實際入口與主要模組

入口鏈：`index.html` → `/src/main.tsx` → `src/App.tsx` → `src/game/GameApp.tsx`。main 匯入 `src/game/game.css`；其他 CSS／主題及圖像由模組引用。這是 React／TypeScript／Vite 專案，建置後產生 JavaScript，不是單一靜態 HTML 加手寫 JS。

| 職責 | DEMO v0.30.2 | Formal main |
|---|---|---|
| 主介面 | `src/game/GameApp.tsx`，legacy Game／Node | 同名主介面接 FormalWorld、Formal commands |
| 世界地圖 | `WorldMap.tsx`、`influence.ts`、`empirePalette.ts`、`mapProjection.ts`、terrainRaster Worker | **實際入口為 `FormalWorldMap.tsx`**，搭配 `presentation/mapRelations.ts`、map geometry、Formal terrain／spatial；不能拿保留的 legacy WorldMap 當正式現況 |
| 天下勢力 | `Views.tsx::DiplomacyView`、`realmSystems.ts::updateLeaderboard` | `presentation/PoliticsView.tsx`；PR #9 帝國／軍團／領主瀏覽、搜尋、詳情與正式權限 |
| 城市 | `CityView.tsx`、`TownScene.tsx`、`OutskirtsScene.tsx` | `presentation/CityScenes.tsx`、`FormalCityPanel.tsx`、`BuildingDetail.tsx`、`CityQueues.tsx` |
| 軍隊 | `Views.tsx::ArmyView/MarchList`、`Mission.tsx` | `presentation` 軍隊視圖、`CombatPanel.tsx`，Formal military／armies／battles |
| 滅國 | `DefeatView.tsx` 與 GameApp restore-map 狀態 | `presentation/ExtinctionView.tsx::RebirthView`、Formal extinction |
| 引擎／持久化 | legacy `engine.ts`、`world.ts`、`runtime.worker.ts`、`persistence.ts` | `formal/` 的 schema／scheduler／reducer／saveCodec／CAS／receipts，加正式 Worker／IndexedDB |

## 3. 可立即開始的比較矩陣（本輪未施工）

| 項目 | DEMO 已讀證據 | Formal 現況 | v94／後續決議與待決策 |
|---|---|---|---|
| P0-C-11 帝國版圖 | `influence.ts:8` 起：城市周圍半徑 8；獨立領主周邊也參與最近區保留；同帝國近城可有有限陸地連接走廊；輸出邊界與帝國標籤。`WorldMap.tsx:96` 起：塗層 alpha .36、水面排除、邊界；版圖模式改變底色及地形呈現。開關預設 false。 | `presentation/mapRelations.ts:9` 起：正式帝國城市半徑 5 塗層、alpha .36；目前無相同走廊／邊界輸出。FormalWorldMap 低縮放時逐城畫帝國名稱，版圖按鈕也可展開帝國清單。 | 可比較塗層、邊界、地形、標籤與工具操作；不可直接替換政治權屬或以 DEMO 半徑改正式玩法。後續需同等帝國配置的並列畫面，目前新局尚無帝國，已拍的 territory 圖只證明模式與地形背景。 |
| 地形／座標／縮放 | DEMO `world.ts:14` 是 **256×256**；XY 0–255；縮放 .12–2；有滾輪、單指拖曳、雙指縮放、方向鍵、Enter、標示與收藏。 | 正式 **384×384**，Formal terrain／route／picking／viewport 管線。 | 可比較手勢與顯示；世界尺寸、地形、路由、水域耗時、在途 ETA 均維持正式規格。不能因相同 seed 就假定兩版地圖等同。 |
| P0-C-13 天下勢力 | `Views.tsx:36–64`：帝國／軍團／領主；組織按總戰力排序但只展示評級；領主按城數、人口、ID 排序，城數／人口同分者顯示同名次。玩家標「你」、本方組織標所屬。`realmSystems.ts:14–18` 定義每世界小時快照，部分政治操作清快照後重算。DEMO 卡片直接列資訊，沒有 Formal 相同的查看詳情按鈕。 | 三類瀏覽和詳情已存在，清單按正式陣列順序，未提供 DEMO 同款名次／排名快照。 | 名次呈現、同分處理與更新行為可開始比對。DEMO 組織評分會計算精確駐軍／在途軍力及舊兵種／科技，不能直接接入 Formal。組織排名所需權限／資料及正式公式需中控裁決；不得以「只顯示評級」掩蓋未授權精確資料的評分來源。 |
| P0-C-10 滅國畫面 | `DefeatView.tsx:6–10`：陷落插圖、國土盡失／本局已結束、閱讀敗北戰報、流亡復國、結束本局、匯出本局紀錄、載入其他存檔、開始新戰役；復國展開可進地圖或 XY。圖像 `public/art/report-defeat.webp` 已驗證。 | 精簡勢力已滅國卡片、三候選區域、返回主畫面／結束本局。 | 可以開始版型、背景、文案、按鈕與導頁比對。DEMO「停止世界、10 民兵、資源 600/600/400/300、6 小時保護、自由 XY」與正式「0 軍隊、四資源各600、48 世界小時、3 候選」衝突，不可照搬。滅國實際畫面與按鈕尚未在本輪建立受控情境重現。 |
| 城市／軍隊 UI、#4／5／6 | 已讀城市、城郊、招募、行軍、成本與佇列元件；DEMO 頁面和實際操作已拍照。DEMO 有舊三筆 UI、舊數值與文明介紹。 | PR #9 已有文明文案、成本全寬與城市佇列摘要；本輪只建立對照，不回退既有成果。 | 後續依五筆正式容量、資格／成本與各 Issue 回歸；DEMO 三筆容量和舊成本不是 authority。 |
| P0-C-12 軍團簡介 | DEMO 可提供整體 UI 參考，不是移除簡介的必要 authority。 | LegionView／PoliticsView 仍有 description 的呈現與舊資料相容需要。 | 玩家已明確決議移除設定入口；保留舊欄位與政治命令契約。本輪不改程式。 |

P0-C-1～9、五筆排程不依賴 DEMO，即使基準已取得，也須等待本輪 STOP 後中控重新指示才續作。先前提出的 AI 評分權重問題仍待決定；此回合沒有擅自定案。

## 4. 重現與驗證

所有安裝／建置只在 runtime 副本進行；source 379 個檔案設為唯讀。Node `24.19.0` 符合專案 Node >=22.13 要求；以原 package-lock 執行 `npm ci` 成功（386 packages）。原指令 `npm run typecheck`、`npm run build` 均 PASS；Vite 產出 main、runtime/export/terrain Worker、CSS 及 PWA。PWA precache 135 entries。

最初預設 sandbox 無網路使安裝失敗；重試時先前安裝的清理造成依賴短暫不完整，第一次 build 報 node:fs／node:url／vitest/config 找不到，保留於 `build-first-incomplete-dependencies.log`。待先前程序退出後，在環境允許的 registry.npmjs.org 網路權限下重新以同一 lockfile npm ci，最終 typecheck／build 成功；**沒有修改 source、設定、lockfile 或測試來通過**。最終記錄為 `npm-ci.log`、`typecheck-final.log`、`build-final.log`。

Chromium **154.0.8037.57**、production build、本機獨立 origin、原生 IndexedDB 與實際 DEMO Worker：桌面 **1440×900**、手機模擬 **390×844**，兩組流程 PASS。固定 seed 92049，從首頁→新局→地圖→版圖開關→縮放→天下領主排行→城市→軍隊；每版 7 張，共 **14 張 PNG**，36 位領主排名可見，同分顯示第 1 名；記錄的 document overflow=false，pageerror／HTTP >=400 為 0。見 `browser/result.json`、`verify-reference.mjs`、`browser/*.png`。手機是 Chromium 模擬，不是 Android 真機 PASS。

重現指令（先在 runtime 安裝及建置；新副本需從 source 複製，不在唯讀 source 產生輸出）：

```bash
cd /workspace/reference-baselines/demo-v0.30.2/runtime
npm ci
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1 --port 4302 --strictPort
# 另一終端執行；腳本的 Playwright 絕對路徑是本環境路徑，換環境需調整。
node /workspace/reference-baselines/demo-v0.30.2/verify-reference.mjs
```

後續對照固定使用 remote-manifest 中 commit，不使用會移動的分支 HEAD；以 `git diff --no-index -- <DEMO檔案> <Formal檔案>` 讀差異，exit 1 代表檔案不同。兩版程式分別在獨立 origin／瀏覽器 context 運作，禁止共用存檔或把 legacy 引擎當 Formal authority。圖像／文案／互動按矩陣逐項取證，不將整個 DEMO 分支合併。

## 5. 尚缺與邊界

- **目前沒有阻止 source 比對或啟動 DEMO 的缺檔。**無需再請玩家 Commit／Push 本目錄。
- 沒有 Windows 本機未提交檔案／原 ZIP 的比對；完整性以已取得 GitHub commit 為準。
- 帝國實際領土的同資料 DEMO／Formal 並列、多縮放／拖曳／點選細節、大地圖效能、受控滅國按鈕流程與正式排行榜權限決議留待後續施工／驗收。本輪不宣稱這些 parity 已完成。
- 本輪沒有重跑 Formal Regression、99 AI 長測、Android 真機、PR #19 完整更新邊界測試，也不宣告 Gate 或部署驗收。
- 正式 repository `/workspace/lieguo-zhengtu-origin` 的 work checkout 恢復原 HEAD `3d1760864f3b9d9a55108c80225764ef8e3099e1` 且 `git status --porcelain` 為空。先前同步 main 的 51 個檔案已留存於獨立正式參考副本後，僅撤回本次同步；沒有 Formal 施工變更。對照採最新遠端 main `06c4cb9`，不能把 work checkout 的較舊 HEAD 誤認為遠端最新 main。

**STOP，等待 GPT-6 中控下一步指令。** 沒有修改 DEMO 原始碼、提交／推送、建立 PR、合併分支、寫入 main／release、部署或關閉 Issue。
