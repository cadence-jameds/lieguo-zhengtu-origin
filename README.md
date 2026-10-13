# 列國征途：始源 v0.30.49

單機持續世界歷史策略網頁遊戲。從一座城邦出發，建設資源田與城市、研究科技、整備軍隊，並透過行軍、偵察與戰報探索河谷世界。支援桌面與手機版面，進度保存在自己的瀏覽器。

## 線上試玩

**[開啟 GitHub Pages 試玩版](https://cadence-jameds.github.io/lieguo-zhengtu-origin/)**

v0.30.49 已於 2026-10-13 發布到 GitHub Pages。目前為公開試玩，正式驗收仍有待完成項目，詳見下方「驗證與驗收狀態」。目前版本以 [public/version.json](public/version.json) 為準。

## 正式主規格（v93）

**[《河谷戰役 vNext》正式整合主規格 v93](docs/b6-v93/河谷戰役_vNext_平衡重構討論_v93.md)** 是目前唯一現行設計基準，完整承接 v92 全部有效內容，並於第 16 章直接納入玩家核准的 **80 項一次性任務**（黑暗 14、封建 29、城堡 20、帝王 17）；沒有 B9 終局任務。原 v92 主規格保留供版本追溯，不作最新施工依據。**此為規格文件升版，並非遊戲程式或 Pages 發布版本更新。**

## 新戰役與存檔

- 世界大小為 384×384，包含玩家與 99 位 AI 領主，以及 432 個野外據點。
- 可選六個文明；每位領主起始人口 200、住房 400、四種資源各 600，以及 18 塊零級資源田。
- 新戰役速度可選 1、3、6、10、50 倍，預設為 1 倍；一般戰役開始後不再切換速度。
- 離線世界推進上限可選 0、1、6、24 小時，預設為 24 小時；選 0 小時時離線停止推進。
- 資源田在 Lv10 換成進階美術，升到 Lv10 的施工預覽也使用對應圖片。

存檔使用瀏覽器 IndexedDB，沒有伺服器帳號同步。本地端、GitHub Pages、不同瀏覽器與不同裝置的進度各自獨立；要轉移進度，請先從原環境匯出正式戰役存檔，再到新環境匯入。首頁設定與遊戲內「戰役設定」提供匯出／匯入操作；匯入前會驗證存檔並建立回復點。清除網站資料前，請先匯出備份。

## 本地啟動

需要 **Node.js 22.13 以上**及 npm。在終端機執行：

```bash
git clone https://github.com/cadence-jameds/lieguo-zhengtu-origin.git
cd lieguo-zhengtu-origin
npm ci
npm run dev
```

開啟終端機顯示的網址，預設為 `http://localhost:5173/`。預覽正式建置：

```bash
npm run build
npm run preview
```

建置輸出在 `dist/`；預覽網址預設為 `http://localhost:4173/`，實際以終端機輸出為準。

## 開發驗證

```bash
npm run typecheck
node scripts/verify-in-isolation.mjs full
npm run build
```

完整回歸測試請使用隔離腳本：部分舊測試會產生 `docs/` 下的檔案，腳本會在暫存副本中執行，避免覆寫歷史驗證資料。報告輸出到 `artifacts/integration/regression-full.json`。`smoke` 是有限檢查，`r3` 會排除兩個舊美術測試檔，兩者都不能替代完整測試或正式驗收。

要驗證 GitHub Pages 子路徑、PWA 範圍與 Service Worker，可使用與 CI 相同的設定（以下為 Bash 指令）：

```bash
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin npm run build
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin node scripts/check-pages-build.mjs
```

若要在本地預覽這個 Pages 建置，`preview` 也要使用相同設定：

```bash
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin npm run preview
```

網址會包含 `/lieguo-zhengtu-origin/`；一般本地開發使用 `/`。

## GitHub Pages 發布流程

`main` 為開發整合分支，`release` 為受保護的 Pages 發布分支。更新 `main` 不會直接發布網站；`dist/`、`node_modules/`、測試輸出及私人存檔不提交到 GitHub。

發布流程需確認核准紀錄所涵蓋的原始碼、通過完整回歸測試與建置、檢查 Pages 路徑，並在 `github-pages` 環境完成部署核准。部署工作流程只允許 `release` 分支執行。

目前公開試玩的授權與來源版本記錄在 [.github/PAGES_PREVIEW_APPROVAL.json](.github/PAGES_PREVIEW_APPROVAL.json)。後續遊戲原始碼、美術資源或建置設定變更，需有涵蓋該來源版本的核准；正式發布則仍須符合 [.github/RELEASE_APPROVAL.json](.github/RELEASE_APPROVAL.json) 的正式驗收條件。詳見 [Pages 試玩發布說明](docs/PAGES_PREVIEW.md)。

## 驗證與驗收狀態

2026-10-13 這次試玩發布已完成：

- 三項沿用 Lv4 規格的美術測試已更新為 Lv10 邊界，包含 Lv9／Lv10 外觀及排隊中的施工預覽。
- 隔離完整回歸測試：**1,115 項通過、0 項失敗、1 項略過**。
- 型別檢查、正式建置、Pages 資源路徑與 PWA 檢查通過。
- 本地 Pages 建置的桌面與手機尺寸瀏覽器試跑能開啟首頁並開始新戰役，未發現 JavaScript 錯誤或資源載入失敗。
- [GitHub Pages 部署成功](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/38335217984)，線上首頁、主程式、樣式、版本檔與 Service Worker 均回傳 HTTP 200。

自動測試與上述瀏覽器試跑不代表正式驗收完成。正式紀錄仍為 **Astra Gate：NOT DECLARED PASS、B5 E1：HOLD、實體手機測試：MANUAL PENDING**；本次試玩發布保留這些狀態。

## 歷史文件

[README_V0.30.11.md](README_V0.30.11.md)、[README_V0.30.10.md](README_V0.30.10.md)、[README_PLAYABLE.md](README_PLAYABLE.md) 與 [早期 README](docs/archive/README_pre_v03010.md) 保留各版操作、可玩包與驗證歷史，其中版本、玩法和發布狀態不一定適用目前版本。最新操作與 Pages 狀態請以本 README 及目前原始碼為準。
