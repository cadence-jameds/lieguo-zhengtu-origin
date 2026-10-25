# PR #36｜Service Worker 候選選取補修

沿用 Draft PR [#36](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/36) 與 `hotfix/android-update-finite-waits`。Main Base：`01247043bf79f51cb5fd5357c2f1c4eb88f027fc`；審查前 HEAD：`b437501f521fa1bc7b48b6f954e17221799fb91c`；修正應用程式來源：`e1a4b9ee2364fce9acfac57d91fee19427d2092c`。本報告更新候選選取的驗證；[前輪交付](../issue18-update-p0/README.md) 保留為歷史 checkpoint，不能代替本輪結果。

## 已證實的缺陷與修正

原 `waitForWaiting()` 在 waiting／installing 皆空、active 為 activated 時，立即返回 active。`registration.update()` 先返回、updatefound 稍後才出現時，該 active 仍是舊版，後續驗證會過早失敗。這是已重現的程式缺陷；不能據此斷言它就是玩家 Android 原始故障的唯一原因。

本輪只有一個應用程式檔案改動：`src/game/useAppUpdate.ts`。waiting／installed 既有路徑保留；activated 候選先用原有 `verifyWorkerRelease` 核對自己的 version／contentSha 與目標版本，並確認它仍是 registration.active。舊版、不符目標或無回應僅排除該候選，繼續等待 updatefound／statechange／前景恢復與既有 250ms 輪詢，不提早終止安裝等待。

每個 active 實例一次身分查詢，最多 3s，與安裝等待並行；整段安裝等待仍為 30s，不因查詢或事件重設期限。結束、逾時或取消時關閉 MessageChannel、取消查詢並移除監聽；舊回覆不能續作。35s 保存 ACK、15s 啟用、5s 導航、150s 整次期限、防重複保存／啟用、InvalidStateError、明確重試與實際控制器核對均未改動。沒有清除資料、改格式、改正式遊戲規則、修改版本號或增加第二份 release note。

## 修復前後測試

先僅加入測試，對審查前程式執行：83 項中 77 通過、6 失敗，見 [before.json](before.json)。原有 75 項均通過；新增 8 項中 6 項真的失敗。相同測試在修正後 83/83 通過；8 檔定向測試 144/144 通過，見 [targeted.json](targeted.json)。沒有移除或放寬既有斷言。

新增案例：舊 active 等待延遲安裝（有事件／全漏事件）、只有舊版時 30s 逾時並正常 waiting 重試、同版號異內容直接 activated、active 已換新版但控制器仍舊版及返回前景、activated 內容不符目標、舊 active 查詢無回應時 waiting 仍可優先處理、逾時／卸載後晚回覆不得續作。既有保存失敗、連點、ACK 逾時、漏 controllerchange、InvalidStateError、docs-only／同號異內容、Recovery 與舊存檔測試保持。

首次完整定向執行的 6 項 release metadata fixture 因 sandbox 的 `spawnSync git EPERM` 無法建立測試用 Git repository；開啟所需執行權限後，同樣 144 項全數通過，未修改測試。

## 驗證結果

| 檢查 | 結果 |
|---|---|
| `npm ci`、`npm run typecheck` | 通過 |
| 8 檔定向測試 | 144 通過、0 失敗 |
| `node scripts/verify-in-isolation.mjs full` | 197 檔；1,991 通過、0 失敗、1 skip；[紀錄](full-regression.json) |
| 根目錄及 Pages `npm run build` | 通過；既有 bundle size 提示仍在，未改分塊設定 |
| Pages base／PWA scope／SW fallback | `/lieguo-zhengtu-origin/` 通過 |
| version.json／release metadata／Worker Identity | 根目錄及 Pages 均通過；[紀錄](build.json) |
| 程式來源 GitHub CI | [40152068844](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/40152068844) 全部成功；1,991／0／1；[步驟與摘要](ci-runtime.json) |
| 原生 Chromium 154 完整矩陣 | **26/27**；包含原 main 預期卡住重現 1 案，修正後 25/26；[完整結果](browser.json) |
| 候選選取原生修復前 | 審查前 b437501 程式，同樣兩案均 FAIL：預期 downloading，實際 failed；[證據](browser-before-review.json) |
| 候選選取原生修復後 | 延遲安裝及延遲安裝＋漏 controllerchange 均通過；保存一次、ACK 後啟用、重載後核對 version／contentSha |
| 原生單項重查 | 候選兩案＋430px 正常更新 3/3；[紀錄](browser-repeat.json)。不是全矩陣重跑成功的宣稱 |

唯一 skip 是既有 `batch210` 玩家私人後期存檔六世界小時案例，未提供 `REALM_REGRESSION_SAVE`。本機完整副本來源檔案 hash 與 e1a4b9e 相符，但使用先前快取的 c23694c release metadata；此來源差異在 JSON 明列。CI 以新的 PR merge `39ed37de...` 重新 prepare metadata，再執行完整回歸、Build 與身分核對，亦全部通過。本機分支預覽自動版號 .70、CI PR merge 版號 .65 分開記錄，未手動改號碼。

原生矩陣使用 production build、真 SW／Cache／IndexedDB、合成戰役與既有 N01 領獎收據。覆蓋 320×568、360×640、390×844、430×932、568×320、640×360、844×390、932×430、1440×900，並驗證連點、ACK／IDB abort、Recovery、慢速／離線／返回前景、超時重試、docs-only／同號異內容、空局／歷史資料保全。`before-unbounded-update` 仍是原 main 的 P0 基線，與本輪 b437501 候選缺陷的原生 before 證據分開。

### 原生失敗與限制保留

- [首輪 23/27](browser-initial.json) 的 3 個前置競態（基線與候選兩案）源於瀏覽器自動 SW 檢查早於刻意延遲的 update()；另 1 案 bad-install 的 25s 觀察窗短於保留的 30s 安裝期限。驗收 server 增加僅本機的 3s 供檔時序，原 main 卡住基線使用既有慢速供檔；bad-install 先觀察原生 API 結束再檢查 30s 邊界。產品程式未加固定延遲，安全斷言未放寬。[4 案重查均通過](browser-recheck.json)，然後才重跑完整矩陣。
- 完整矩陣的 430px 正常更新仍有 **1 次原生啟用逾時**：新 waiting 身分已核對、durable ACK 已到、發送一次 SKIP_WAITING，但 worker 仍 installed；15s 後失敗、保留已保存資格與原頁面，按鈕可重試。單項重跑成功；先前 c23694c checkpoint 亦曾記錄類似現象。沒有足夠原生 SW 執行取證確認其根因，也沒有證明此現象已修復；本次不以額外重送啟用或刷新掩蓋它。
- 以上與候選選取不同：候選缺陷在保存前就誤選舊 active、過早驗證失敗；本輪已由單元及原生 before／after 證實修正。未宣稱所有 Chromium 情境全綠或 Issue #18 完全修復。

### 截圖

| 情境 | 修復前 | 修復後 |
|---|---|---|
| 新版延遲安裝 | [過早失敗](before-candidate.jpg) | [正確新版已載入](after-candidate.jpg) |
| 延遲安裝＋漏接管事件 | [過早失敗](before-candidate-lost-event.jpg) | [實際接管後重載](after-candidate-lost-event.jpg) |

[430px 啟用逾時：保存已確認、更新未完成、可安全重試](activation-timeout-430.jpg)。本輪 5 張截圖均為受控合成資料；前輪各尺寸截圖仍保留於歷史 checkpoint。

重現命令：先 `UPDATE_P0_SKIP_BASELINE=1 node scripts/prepare-update-p0-sites.mjs /tmp/update-p0-browser`（需前輪 baseline 存在；新目錄首次省略該變數），再啟動 `node scripts/serve-update-p0-sites.mjs /tmp/update-p0-browser`，以 `node scripts/verify-update-p0-browser.mjs <playwright-module> /tmp/update-p0-browser <output>` 執行。`UPDATE_P0_CASES` 可指定上述 case。原生 before 將 b437501 的 `src/public/scripts/releases` 等建置輸入以 git archive 放入獨立暫存目錄，用同一舊 release label 建置為 patched-old、after 仍指向 e1a4b9e；同一驗收腳本得到兩個預期失敗。這些舊 label 是受控測試，不冒稱歷史部署 bundle。

## 待實機驗收

**Android 實機待玩家驗收。** Chromium 的 Android UA／觸控／viewport 模擬不等於 Android OS 模擬器或真機通過。原玩家裝置的 API、SW 狀態及背景生命週期仍未直接取證。

核准發布後，由玩家先確認保存及備份，再檢查／明確執行更新；確認準備、下載驗證、保存確認、啟用及重載階段，返回後核對版號與 contentSha，重載進度及 Recovery，另測一次背景切換及離線失敗後重試。若失敗，記錄階段與文案；不要清網站資料、刪 IndexedDB 或解除安裝 PWA。

維持 Draft、Issue #18 OPEN；未合併 main、未部署，交付後等待中控複審與玩家驗收。
