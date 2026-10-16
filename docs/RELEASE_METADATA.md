# 遊戲版本與更新資訊

本機、CI 及 Pages 共用 `npm run release:prepare`；`npm run build` / `dev` 會自動先執行。準備工作只讀 Git、寫入忽略的 `.release/metadata.json`，不 Push、不改 main、不呼叫 GitHub API，也不使用 workflow 執行次數或現在時間。

## 唯一規則與歷史基準

`releases/config.json` 固定基準是 PR #3 合併前 main `7c52ab7…`、0.30.50。從基準沿目標 Commit 的 first-parent 歷史依序檢查；每個含可玩變更的整合提交增加末段 1。純規格、審查、證據、測試、測試 helper、CI workflow 及測試依賴不加版；遊戲 source、美術、正式依賴或建置來源變更才加版。日期取該功能整合提交的 Git 提交記錄日期（%cI，GitHub merge 通常為 UTC），順序由 Git first-parent 決定。同 SHA 重建結果相同。

使用現有 merge commit 或 squash merge 流程，一個功能 PR 對應一個整合發布單元。不要以 rebase 將無獨立 Release Notes 的多筆功能提交逐一寫進 main；正式產生器會拒絕缺失摘要，避免猜測或無聲發佈。一般 PR／未提交本機建置只作待審預覽，最終版號與日期以合併 main 的提交為準。此 PR 不變更 repository 合併設定。

PR #3 對應的已合併提交 `6405f7e…` 有固定回補摘要，所以在該提交重建為 **0.30.51**，只列已合併 source 的五項玩家變更，不把 P0-C spec 寫成已完成。這是補登合併紀錄，不宣稱曾單獨發布 0.30.51。本自動化也有玩家可見變更，下一整合單元為 0.30.52。

已搜尋現有規格，未找到 Issue #16 所提 V0.100／.10 的原始進位授權。本輪只使用明確允許的末段遞增，超過 0.30.99 時**明確停止**，等待玩家正式規則；不自行實施 0.31.0、0.30.100 或其他未核准進位。

## 功能 PR 作者

1. 新增且只新增一個 `releases/notes/<slug>.json`，欄位 `title`、`notes`（可選 `pr`）。使用繁中短標題及 1～10 項已完成、玩家可見的重點。不填準備施工、Gate HOLD、規格核准或原始 Commit 標題。
2. 把相同 JSON 貼到 PR template 的 `release-notes:start/end` 受控欄位。CI 讀取原生 pull_request event，edited 也重驗；不用新的 PR API 權限或 Secrets。
3. CI 比對 base..HEAD 可玩變更、記錄數與正文。不符合即失敗；main 產生器亦嚴格檢查。缺資料只在本機／未合併預覽使用明確「待審」保守文案，正式 Pages 不猜測。
4. 已合併摘要不可回寫；更正已發佈行為時新增下一功能 PR 的摘要。純文件／測試 PR 不需摘要或版本 PR。玩家不必每次編版或填資料，此工作由施工者完成。

摘要隨 PR 合入 Git，建置從該 Commit 的版本化記錄讀取，不受 PR 合併後修改正文影響。PR #3 的特例只處理固定歷史提交，避免重算更早 PR。原 release.ts 全部未分版文字與舊 CHANGELOG 原文保存在 releases/，離線仍可查看，不憑空為它們指派新版本。

## 原始碼、建置與部署

- `package.json` / lock 根版本 0.30.50 是歷史計數基準；不要求每次人工同步。刪除容易過時的 tracked `public/version.json`。
- `.release/metadata.json` 是同一建置的完整唯一 metadata，含版號、日期、部署 SHA、最後功能 SHA、dirty 預覽標記、近期與歷史摘要。
- Vite 將 metadata 編入主程式／Worker，並產生 `dist/version.json`、發行版 `dist/package.json`、`dist/CHANGELOG.md`。`check-release-build.mjs` 比對產物；CI 與 Pages 使用相同腳本及 HEAD，沒有自動回寫 Commit 或觸發循環。
- `version.json` 不在 SW precache；更新檢查採 no-store。`commitSha` 僅供部署追溯；`contentSha` 是最後可玩整合提交的識別。相同版號但有效 `contentSha` 不同才提示更新建置；純文件部署的 `commitSha` 改變、`contentSha` 不變，不提供更新操作。較新數字版號照常提示，缺少有效內容識別時不單靠部署 SHA 推定同版有新內容。離線保留內建日誌，無法檢查時明確說明。
- 成功核對相同內容後，即使文件部署 SW 已下載或稍後下載完成、網站又斷線，也不重新提供更新操作；下一次成功核對到真正新內容會恢復通知。已知新內容的 waiting SW 與尚未取得內容核對結果的離線 waiting SW 保留既有手動保存後啟用流程；後者明示無法核對，不宣稱有新遊戲功能。
- 保存並更新仍等待新版 SW 安裝，先 await 原本 durable save，再 SKIP_WAITING、等待 controllerchange 後導航。保存／下載／啟用失敗均保留原頁，不改資料契約。
- 版本產生與 build 成功不等於部署成功；只有現有 main Pages workflow 成功才代表該建置已部署。這個 PR 本身僅交付待審建置，不自行部署。

## 存檔與驗證

這是應用程式版號。Formal metadata 原本使用 RELEASE.version 記錄建立時 appVersion，本輪不修改其 schema、相容判斷、Content／Ruleset／Generator／Terrain 常數、CAS、IndexedDB、Recovery 或 Command Receipt。合法舊 appVersion 存檔仍依原規則讀取。

執行 `npm run typecheck`、`node scripts/verify-in-isolation.mjs full`、`npm run build`、`node scripts/check-release-build.mjs`；Pages 路徑使用 README 的 GITHUB_ACTIONS／GITHUB_REPOSITORY 設定。Node P0 profiling compiler 只增加同一 metadata 常數注入／產物 version 來源相容，不修改模擬或量測邏輯。
