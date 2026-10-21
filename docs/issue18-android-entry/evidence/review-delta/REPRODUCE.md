# 最小 Delta 重現

程式來源本機 fce7c30 / 遠端 a44d10c，檔案 tree 相同。需要 Node >=22.13、npm ci、Playwright 與原生 Chromium。本任務使用 /usr/bin/chromium；不使用真實玩家 profile。

1. `npm run typecheck`；專項執行 campaignArchive、campaignArchivePolicy、campaignStorage、updateEntry、updatePreparation、useAppUpdate、useGameInteraction 七個測試檔，參數 `--maxWorkers=2 --reporter=json`，不加 timeout 放寬。
2. 完整測試只執行 `node scripts/verify-in-isolation.mjs full`。本機首輪 1506/8/1 失敗紀錄不可覆蓋為全綠；單獨 runtime/replay 重驗是另一結果，完整最終驗證見最新 HEAD CI。
3. `GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin npm run build`，並以相同環境值執行 scripts/check-pages-build.mjs；scripts/check-release-build.mjs 檢查 Release Metadata。
4. 原生：正式 main namespace 使用上一步 dist。另將完整追蹤原始碼複製至 `/workspace/research/issue18-delta/time2-copy/`（不可複製或修改 PR #23 分支），唯一原始碼差異是 formal/versions.ts 的 FORMAL_DB_NAME 從 schema1 替換為 time2；複製 .release/metadata.json、共用已安裝依賴，以相同 Pages 環境執行 `node node_modules/vite/bin/vite.js build`。source-isolation.json 證明只有此一差異；沒有引入 UX-1 其他變更。
5. `python3 prepare-native.py`：由兩份 dist 產生隔離版本標籤／identity／precache 與 native transaction abort 故障副本。路徑在檔案開頭，可調整到自己的隔離目錄。保留上一版 SW identity helper，避免混入刪除舊部署檔的故障。
6. `python3 serve-native.py /workspace/research/issue18-delta/native 5219`：僅 localhost。此 server 不以相同秒 mtime 回傳跨版本假304，也不刪除瀏覽器的 SW、Cache Storage 或 IndexedDB。
7. native-runner.mjs 需可匯入 playwright；使用 ISSUE18_NATIVE_ROOT / ISSUE18_FIXTURES 指向隔離目錄與合成 fixture JSON。fixture 格式需有 base（encodeSave 後的世界 JSON 字串），不要使用私人存檔；可用既有 scripts/p0c-master-browser.mjs 的 P0C_FIXTURE_ONLY=1、P0C_MAP_99=1 產生（來源 dev server 4310），不得因此重跑 AI 長測。只會匯入合成世界到測試 profile。
8. `node native-runner.mjs`，輸出各情境 JSON 與 JPEG。R18_CASES 可限定已失敗的情境；本次最終九情境全部執行。檢查 passed=9、failed=0、errors=[]，並逐筆比對歷史資料及匯出。不要上傳 fixture 或原始匯出下載檔。

native-first-result.json (8/1)、native-second-result.json (5/4)、fixture-http-failures.txt 和 fixture-server-diagnosis.json 保留測試服務失敗；final-native.json (9/0) 為最終結果。沒有放寬 timeout、刪除案例、偽造 Worker ACK 或跳過 SW 身分核對。Android 實機仍待人工驗收。
