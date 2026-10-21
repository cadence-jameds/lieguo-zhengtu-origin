# 列國征途：始源

單機持續世界歷史策略網頁遊戲。從一座城邦出發，建設資源田與城市、研究科技、整備軍隊，並透過行軍、偵察與戰報探索河谷世界。支援桌面與手機版面，進度保存在自己的瀏覽器。

## 線上試玩

**[開啟 GitHub Pages 試玩版](https://cadence-jameds.github.io/lieguo-zhengtu-origin/)**

目前為公開試玩，正式驗收與自動部署分開。首頁、戰役設定及已部署的 `version.json` 顯示實際載入版本、日期與 Commit SHA。原始碼 `package.json` 的 0.30.50 是固定計數基準，不代表最新部署版本；詳見 [版本管理](docs/RELEASE_METADATA.md)。

## 目前線上版本與發布狀態

[![目前部署版本、日期、更新重點及 Commit；文字紀錄請點擊圖片](https://cadence-jameds.github.io/lieguo-zhengtu-origin/release/latest.svg)](https://cadence-jameds.github.io/lieguo-zhengtu-origin/release/)

[![main CI](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/workflows/ci.yml?query=branch%3Amain)
[![Pages 發布](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/workflows/deploy-pages.yml/badge.svg?branch=main)](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/workflows/deploy-pages.yml?query=branch%3Amain)

圖片與[可讀文字／過往版本紀錄](https://cadence-jameds.github.io/lieguo-zhengtu-origin/release/)直接使用遊戲 Release Metadata；只有 Pages 成功發布才會替換線上內容，無需逐版修改 README。無法顯示圖片時可查看[純文字版本資料](https://cadence-jameds.github.io/lieguo-zhengtu-origin/version.json)或[完整文字更新日誌](https://cadence-jameds.github.io/lieguo-zhengtu-origin/CHANGELOG.md)。GitHub 圖片代理可能延遲刷新，請以文字頁與部署 Commit 核對。

CI 與 Pages 為分開的最新工作流程狀態；若最新建置或部署失敗，版本圖片仍顯示上次成功部署的內容。CI 成功、Pages 成功與正式獨立 Gate 結論分開管理。

## 正式主規格（v94）

**[《河谷戰役 vNext》正式整合主規格 v94](docs/b6-v94/河谷戰役_vNext_平衡重構討論_v94.md)** 為目前現行設計基準，完整承接 v93／v92 的有效規則。**待施工規格**：第 17 章的每城最多 5 筆施工／5 筆訓練排程、第 16 章的 80 項任務，以及 [Issue #14](https://github.com/cadence-jameds/lieguo-zhengtu-origin/issues/14) 的 P0-C-5／7／8／9／10／11／12／13 均為獨立待辦；規格核准不代表 Runtime 已完成。

v93 第 16 章已核准的 **80 項一次性玩家任務**（黑暗 14、封建 29、城堡 20、帝王 17）與資源獎勵完整保留；**不新增 B9 終局任務**。歷史規格 [v93](docs/b6-v93/河谷戰役_vNext_平衡重構討論_v93.md) 與 [v92](docs/b6-v92/河谷戰役_vNext_平衡重構討論_v92.md) 均保留供版本追溯。**v94 是設計規格升版，並非遊戲程式更新；GitHub Pages 公開試玩以建置產物 `version.json` 公布的版本為準。**

## 新戰役與存檔

- 世界大小為 384×384，包含玩家與 99 位 AI 領主，以及 432 個野外據點。
- 可選六個文明；每位領主起始人口 200、住房 400、四種資源各 600，以及 18 塊零級資源田。
- 新戰役速度可選1、3、6、10、25倍，預設1倍；戰役中可從設定修改並持久保存。
- 本輪候選一般速度為1X／3X／6X／10X／25X；離線上限可選0、1、4、8、12現實小時，預設12小時。開發者50X／100X僅用於前景，離線按一般速度補算。此版強制建立新戰役，舊資料保留並可匯出歷史備份，詳見[操作說明](README_PRE_B9_UX.md)。
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

`main` 每次更新後，自動執行 Typecheck、完整隔離 Regression、建置與 Pages 路徑／版本一致性檢查；全部成功才由現有 Pages workflow 部署公開試玩。一般 PR 只驗證，不部署；正式驗收狀態仍獨立保留，不能以 CI 綠燈代替。

版本資訊於建置時由 Git 歷史及合併 PR 的受控 Release Notes 產生，不回寫 main、不新增版本 PR、不依賴 Actions push 觸發另一流程。`dist/`、`.release/`、依賴、私人存檔與測試暫存不提交。離線仍可查看已載入版本日誌，更新前維持保存進度及等待 Service Worker 安裝的流程。

## 驗證與驗收狀態

PR [#3](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/3)、[#17](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/17)、[#9](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/9) 已合併。對應更新依序包含工匠／失城安全修復、版本與日誌自動化、軍團與治理／外交／工匠介面整合。最新可玩版本與更新摘要以上方動態區塊為準；最新自動測試統計請查看對應 Commit 的 CI 與 PR 驗證報告，不以固定舊統計代表今日結果。

**B5 E1 Lv15 人工驗收：OWNER WAIVED**，原歷史 HOLD 紀錄保留。正式 Sol／Astra 獨立審查以各 PR 核准紀錄為準，README 自動資訊不授權宣告 Gate PASS。實機驗證與一般 Chromium 手機尺寸驗證須分開列示；Android 更新問題追蹤於 [Issue #18](https://github.com/cadence-jameds/lieguo-zhengtu-origin/issues/18)。

### 歷史驗證：2026-10-13

以下為當日紀錄，並非目前測試統計或目前 Gate 結論：

- 三項沿用 Lv4 規格的美術測試已更新為 Lv10 邊界，包含 Lv9／Lv10 外觀及排隊中的施工預覽。
- 隔離完整回歸測試：**1,115 項通過、0 項失敗、1 項略過**。
- 型別檢查、正式建置、Pages 資源路徑與 PWA 檢查通過。
- 本地 Pages 建置的桌面與手機尺寸瀏覽器試跑能開啟首頁並開始新戰役，未發現 JavaScript 錯誤或資源載入失敗。
- [GitHub Pages 部署成功](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/38335217984)，線上首頁、主程式、樣式、版本檔與 Service Worker 均回傳 HTTP 200。

當日紀錄為 **Astra Gate：NOT DECLARED PASS、B5 E1：HOLD、實體手機測試：MANUAL PENDING**。這些歷史狀態不覆蓋後續正式核准／OWNER WAIVED 紀錄。

## 歷史文件

[README_V0.30.11.md](README_V0.30.11.md)、[README_V0.30.10.md](README_V0.30.10.md)、[README_PLAYABLE.md](README_PLAYABLE.md) 與 [早期 README](docs/archive/README_pre_v03010.md) 保留各版操作、可玩包與驗證歷史，其中版本、玩法和發布狀態不一定適用目前版本。最新操作與 Pages 狀態請以本 README 及目前原始碼為準。
