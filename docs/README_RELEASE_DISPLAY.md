# README 發行資訊自動展示

README 只需本 PR 一次加入固定連結；之後無須逐版改寫 Git 內的 Markdown。建置沿用 PR #17 的 `.release/metadata.json`，由 `vite.config.ts` 產生 `dist/release/latest.svg` 與 `dist/release/index.html`。遊戲、`version.json`、部署 package、CHANGELOG 與 README 展示使用同一個 Release Metadata，原始 `package.json` 保留計數基準。

SVG 顯示最新版本、內容更新日期、部署 Commit 與受控繁體中文摘要。文字 HTML 顯示完整 SHA、歷史版本、舊更新重點，以及相對路徑的 JSON／CHANGELOG 退路。輸出會轉義資料，不載入腳本或 GitHub API。SVG 使用純文字元素、標題與說明，手機文字頁可自動換行。

## 發布語意與權限

- 維持既有 workflow 與 `contents: read`，沒有 main 寫回、Secrets、分支保護修改、額外人工核准或部署觸發循環。
- 一般 PR 只建置待審產物；只有既有 main Pages 工作流程成功部署後，正式網址才會換成新資料。本 PR 不執行部署。
- CI 與 Pages 分開使用官方 main badge；最新失敗時，動態版本圖片仍保留上次成功部署的內容。badge 是工作流程狀態，請從連結核對 SHA，不能取代正式獨立 Gate。
- GitHub 圖片代理可能快取舊 SVG，刷新時間沒有保證。文字頁與 JSON 可直接核對目前線上 Commit。Git 內 README 原始文字不會每版改變。
- docs-only 合併保留版號、內容 SHA、日期與更新歷史，只更新部署 SHA；同一 SHA 重跑得到相同產物。未合併功能與規格待辦不會被摘要宣告完成。

## 與遊戲更新隔離

`release/**` 不加入遊戲 precache，文字歷史頁排除於遊戲 navigation fallback，避免文件被攔截為遊戲首頁。遊戲原本的離線更新紀錄仍由嵌入 metadata 提供。README 呈現程式故障不會執行任何存檔或 Service Worker 操作；建置的一致性檢查會阻止發布不一致產物。

`scripts/check-release-build.mjs` 比較產物與同一 metadata 的 SVG／HTML；`releaseMetadata.test.ts` 以實際暫存 Git 歷史驗證功能升版、文件不升版、重跑確定性與文字安全。原生 Chromium 測試另外驗證 project Pages 路徑、手機換行及受遊戲 SW 控制時仍能開啟文字歷史頁。

## 尚待正式發布後核對

本輪只能驗證本地與 CI 產物；正式 GitHub README 圖片及 GitHub Camo 刷新須在玩家核准合併並成功部署後核對，不將 localhost 測試冒充正式線上驗收。
