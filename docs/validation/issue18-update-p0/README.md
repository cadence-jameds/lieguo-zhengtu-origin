# Issue #18｜Android 更新有限等待 P0 修復交付

本輪為實作與 Draft PR，非純調查。Base：`01247043bf79f51cb5fd5357c2f1c4eb88f027fc`；已確認 PR #35 合併。分支 `hotfix/android-update-finite-waits`，Draft PR [#36](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/36)。最終程式來源為 `c23694c507e51ddfe68c64e503640676bfc6c57b`；之後只補驗收腳本及證據，應用程式來源不變。

**Android 實機待玩家驗收。Issue #18 保持 OPEN。** 不把 Chromium 行動模擬、CI 通過或本次修復，宣稱為原 Android 裝置故障已完全解決。

## 已證實、推測與未證實

| 類別 | 結論與證據 |
|---|---|
| 已證實的程式缺陷 | 原 `registration.update()`、`getRegistration()`、`register()` 可永不 settle，更新的 finally 不執行，updating 一直為 true。原 50 個測試通過，新增 7 個真正失敗，見 [before.json](before.json)。原 main production build 在真 Chromium／SW／IDB 下受控卡住 update Promise，頁面時鐘推進 60 秒後仍 disabled、未送保存請求，見 before 截圖與 browser-initial。 |
| 已證實的事件缺口 | 原程式對已 activated、waiting 不同步及漏失 controllerchange 缺乏一般性重查；新增失敗測試、原生漏事件及不同 controller wrapper 的自有內容核對均有證據。 |
| 已證實的資料探測副作用 | Dexie.exists 在不存在 namespace 的探測可能做 open／abort／deleteDatabase，並非既有玩家資料遭刪除的證據。本輪唯讀檢查／備份已移除這條內部探測路徑；[before-readonly.json](before-readonly.json) 在原 main 真的失敗，修正後無建立／刪除，包括無 databases API 的分支。 |
| 可合理解釋相同手機症狀 | 未 settle 的原生 Promise、背景計時器暫停／事件遺失都能造成類似表現；不能僅靠「正在保存並更新…」判斷實際卡在保存。 |
| 原玩家裝置根因未證實 | 沒有原裝置 DevTools、卡住當時 SW／controller 狀態、階段與耗時，不能斷言是哪一個 API 或生命週期差異。 |

詳見 [來源稽核、PR #19 對照與期限表](SOURCE_AUDIT.md)。原 Issue #18 的 InvalidStateError、disabled、最新按下後未導向為不同症狀，未混為同一已證實根因。

## 修復前／後

| 情境 | 原 main | 修復後 |
|---|---|---|
| update／lookup／register 永不返回 | 更新 Promise 不結束、loading 持續 | 各 12s 後終止本次觀察；失敗文案、解除 updating，可明確重試 |
| 保存 ACK 不返回 | hook 可一直等待 | 35s 邊界；原正式 sync 30s watchdog 保留；沒有 ACK 不啟用、不導航、不聲稱保存成功 |
| 原生 Worker 已接管但事件漏失 | 可能等待不會再發生的事件 | 250ms 有限輪詢、statechange、controllerchange 與前景重查；不同物件須證明同一 version／contentSha |
| 保存成功、啟用未完成 | 按鈕仍顯示泛稱「正在保存並更新」 | 明示保存成功、正在啟用；15s 後若未核實接管，顯示已保存但更新未完成，保留頁面 |
| location.replace 未離開頁面 | 無獨立終結判準 | 5s pagehide 邊界；重載未完成可重試；回來後比對實際版本／內容，未知或不符不宣稱成功 |
| 超時後原操作晚到 | 無整次取消機制 | 取消 token＋epoch 防舊續作；舊 ACK 不觸發啟用／重載，不拿舊 ACK 代替目前世界的保存證明 |
| 已有活動戰役但保存失敗 | 更新停止，原始備份入口可能不可見 | 保留原頁，提供唯讀原始備份；明示只含已寫入資料、不代表本次保存成功 |

原生 API 與已開始的 durable transaction 不能真正撤回。取消的是本次應用流程及其後續動作；重建註冊前仍先保存，原生註冊即使晚完成也不會由舊流程再保存、發 SKIP_WAITING 或重載。頁面完全凍結時 JavaScript 無法執行；恢復時以 wall clock 先檢查期限，不宣稱背景期間能準時顯示錯誤。

空局及唯讀歷史使用「正在確認本機資料保全」階段，不顯示正在保存遊戲；原生案例證明零保存請求／零 ACK 且歷史資料不變。

## 更新階段與安全恢復

| 階段 | 有限等待 | 成功／失敗／恢復 |
|---|---:|---|
| 發現版本：version.json 與 body | 8s | Abort fetch；保留已知已下載資格，可再次檢查；docs-only 不因 commitSha 變更誤報 |
| 準備／取得／更新 registration | 各 12s | 原 InvalidStateError 的有限重新查詢保留；不清站台、不 unregister、不無限重試 |
| 安裝與候選重查 | 30s | 事件及有限輪詢取得 waiting／installed／new active；失敗可安全重試 |
| 候選 Worker 自有內容驗證 | 3s | version／contentSha 必須符合目標，MessageChannel 關閉；未知／不符不啟用 |
| 本機資料枚舉／開啟／唯讀交易 | 各 8s | 不升級 schema，不建立／刪除 DB，晚開啟結果關閉連線 |
| 正式保存或等待舊保存結束 | 各 35s | 一次明確嘗試最多一個新 sync；在未結束的保存 Promise 前不重疊送另一個；重試要取得自己的正式 ACK |
| 保存已成功 | ACK 後才成立 | 畫面同時保留保存成功資格，後續啟用失敗不誤稱沒保存，也不誤稱已更新完成 |
| 啟用、核對實際控制器 | 15s | 未確認接管則不導航；可由實際狀態／內容證明恢復漏事件，而非單看 sw.js URL |
| 重新載入 | 5s | pagehide 或失敗終止；新頁比對 `_appUpdate`／`_appUpdateContent` 與自己的 RELEASE |
| 整次明確更新嘗試 | 150s | 中止舊觀察及續作，解除 updating；無無條件刷新、無無上限重試 |

手機與桌面使用同一 hook 的 phase／label／保存資格，UI 顯示準備、下載、驗證、保存、保存成功、啟用、重載、可安全重試。沒有把原生錯誤堆疊直接交給玩家。

正式保存權威仍是 `useGame.sync()` 對自己的 requestId 取得 `synced` durable acknowledgement；其原實作未修改。保存失敗不啟用、不重載。空戰役、唯讀歷史、loading／busy／error／locked 仍依原 updateEligibility 規則；引擎有錯時更新可能依安全 Gate 暫停，須先重新讀取，並非 updating 永遠鎖住。

## 實際修改位置

- [useAppUpdate.ts](../../../src/game/useAppUpdate.ts)：註冊有限等待、候選／控制器核對、每次嘗試隔離、保存序列、導航與重載身份確認。
- [updateDeadline.ts](../../../src/game/updateDeadline.ts)：期限、前景壁鐘重查、取消與共用階段文案。
- [campaignStorage.ts](../../../src/game/campaignStorage.ts)：只讀 namespace 探測／transaction；不再經由 Dexie.exists 的缺庫清理探測。
- [FormalHome.tsx](../../../src/game/FormalHome.tsx)、[GameApp.tsx](../../../src/game/GameApp.tsx)：相同權威階段標籤與錯誤備份出口。
- 更新／入口／資料讀取測試；四支隔離 production build／合成存檔／本機伺服器／瀏覽器驗收腳本。完整路徑見 [FILES.txt](FILES.txt)。

`useGame.ts`、`updateEligibility.ts`、Formal 寫入／CAS／Recovery／離線模組、80 任務、B9、AI、戰鬥、平衡、存檔格式、vite.config.ts、主 README、workflow 與歷史版號均未修改。測試對既有資料讀取的兩個 fault mock 改為實際 native open／databases 邊界，原斷言保留；導航 mock 以 pagehide 模擬真離頁，另有不離頁的負向測試。未移除或放寬既有安全測試。

## 驗證結果

| 驗證 | 結果／證據 |
|---|---|
| 定向（8 個測試檔案） | 136 通過、0 失敗；[targeted.json](targeted.json) |
| Typecheck／Production Build／Pages 路徑／PWA／release／Worker 身分 | 全部通過；[建置證據](build-checks.json) |
| 完整隔離 Regression | 最終 CI 執行同一 full 指令：1983 通過／0 失敗／1 既有跳過；[完整紀錄](full-regression.json)。本機較早 checkpoint 1976／0／1，下一本機 run 因最終拒絕分類修正而中止，未冒稱為同 SHA |
| [程式提交 GitHub CI](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/40150070138) | 完整 1983 通過／0 失敗／1 跳過；Typecheck／Pages Build／release 全通過 |
| 原生 Chromium 154.0.8037.57 | 最終完整重跑 25 個斷言案例通過、0 失敗、0 page errors；其中 1 個是原 main 問題重現，24 個為修復後驗收；[browser.json](browser.json) |

原生 25 案例包含 8 組手機尺寸、桌面、duplicate click、API 永不 settle／晚到、真 IDB 交易 abort、安裝／內容驗證失敗、保存後啟用失敗與明確重試、慢速網路、離線不可取得版本、背景凍結／返回、漏 controllerchange、不同 controller wrapper 的實際內容證明、docs-only、同版異內容離線更新，以及 390px 更新後原生 Recovery。

測試為真 Chromium、production bundle、native Service Worker、native IndexedDB；有控制原生 API 的回傳／事件以製造已驗證故障，沒有把故障注入入口加入產品。部分期限測試使用 Playwright 頁面時鐘加速／wall time 跳轉，原生 SW 與 DB 仍是真實執行；不是 Android 真機時間行為的等價證明。

期限包裝器的拒絕分類另新增 5 項負向：undefined／null／false／0／空字串的 Promise rejection 都不能變成 ACK。修正前 5 項全失敗、修正後全通過；[證據](deadline-rejection-before.json)。此為 Hotfix 開發中補出的缺陷，不冒稱原 Android 裝置原因。

## 必須保留的失敗與不確定性

- 修復前 7 個新回歸全失敗、唯讀探測新增測試原 main 失敗；保留 [before](before.json)／[before-readonly](before-readonly.json)。早期修正迭代也保留 after-initial／after-iteration，沒有改寫原失敗。
- 初版 native 保存注入在 handler 之後才設定故障，實際保存成功；原離線案例已有可用快取，也成功更新，與當時預期失敗不符。修正注入時序及離線／伺服器不可用前提，沒有放寬 ACK／保存安全斷言。見 [探針開發紀錄](browser-probe-development.json)。
- 原生 raw backup tripwire 曾捕捉到 absent namespace 的 Dexie 探測 delete；Recovery 按鈕探針一度以 exact label 忽略圖示，見 [追加邊界紀錄](browser-readonly-before.json)。資料讀取路徑已改為嚴格唯讀，選擇器修正，未隱藏原結果。
- **首輪最終矩陣有一次離線啟用逾時**，已保存狀態、原頁及資料保留，loading 在 15s 後解除。相同程式單項重跑與整份 23 案例再跑均通過，未修改產品程式或安全斷言。但該次 native 生命周期原因未證實，不能用最終全綠掩蓋。見 [首輪結果](browser-first-final.json)、[單項重跑](browser-offline-retry.json)、[23 案例 checkpoint](browser-checkpoint22.json) 與最終 25 案例 browser.json。這仍是 Android／離線實機驗收的重點。
- 合成存檔有 `appVersion:0.30.52`、正式指令收據及一次已領 N01，用以檢查更新／Recovery 後保持；不是玩家私人存檔或真正歷史 .52 bundle。patched-old／same-version 的 release labels 為受控情境，來源與 identity 見 [browser-builds](browser-builds.json)／[fixture](browser-fixture.json)。正式 before bundle 確為 Base 程式。
- 未提供 adb／Android 裝置。Chromium Android UA／觸控／viewport 模擬通過，不是 Android OS 模擬器或原 Android 真機通過。

## 手機截圖

| 尺寸 | 更新成功與實際版本 |
|---|---|
| 320×568 | [截圖](after-320x568.jpg) |
| 360×640 | [截圖](after-360x640.jpg) |
| 390×844 | [截圖](after-390x844.jpg) |
| 430×932 | [截圖](after-430x932.jpg) |
| 568×320 | [截圖](after-568x320.jpg) |
| 640×360 | [截圖](after-640x360.jpg) |
| 844×390 | [截圖](after-844x390.jpg) |
| 932×430 | [截圖](after-932x430.jpg) |
| 桌面 1440×900 | [截圖](after-1440x900.jpg) |

另附 [原 main 卡住](before-390-unbounded.jpg)、[準備](stage-preparing.jpg)、[下載](stage-downloading.jpg)、[保存成功後正在啟用](stage-saved-activating.jpg)、[保存失敗](failure-save-failure.jpg)、[保存成功但啟用未完成](failure-activation-hang.jpg)、[註冊逾時](failure-register-hang.jpg)、[慢速網路](failure-slow-network.jpg)、[離線失敗](failure-offline.jpg)、[同版異內容離線成功](same-version-offline.jpg)，[空局保全](preservation-empty.jpg)、[歷史保全](preservation-historical.jpg)，共 26 張。

## 重現指令

```sh
npm ci
npm run typecheck
npm exec vitest run src/game/campaignStorage.test.ts src/game/campaignArchive.test.ts src/game/updateEntry.test.tsx src/game/useAppUpdate.test.tsx src/game/updatePreparation.test.tsx src/game/useGameInteraction.test.tsx src/game/releaseMetadata.test.ts src/game/releaseSaveCompatibility.test.ts -- --maxWorkers=2 --testTimeout=30000
node scripts/prepare-update-p0-sites.mjs /tmp/update-p0-browser
node scripts/prepare-update-p0-fixture.mjs /tmp/update-p0-browser
node scripts/serve-update-p0-sites.mjs /tmp/update-p0-browser
node scripts/verify-update-p0-browser.mjs /absolute/path/to/playwright/index.mjs /tmp/update-p0-browser /tmp/update-p0-evidence
node scripts/verify-in-isolation.mjs full
npm run build
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin npm run build
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin node scripts/check-pages-build.mjs
node scripts/check-release-build.mjs
```

Playwright／Chromium 為外部驗收工具，不增加產品依賴。初次 sites 目錄需為空，若已生成 baseline，可用 UPDATE_P0_SKIP_BASELINE=1 重建修正版變體。站點、原生合成 `.realm-save`、下載的原始備份與完整 browser 資料僅留 /tmp，不提交私人存檔／raw browser traces／ZIP。

完整回歸唯一跳過為既有 batch210 玩家私人後期存檔再推進 6h 測試（REALM_REGRESSION_SAVE 未提供）。實際執行的合成 native 存檔、正式交易失敗、離線、收據、Recovery 均通過。最新完整回歸由最終程式的 GitHub CI 執行，並非把早期本機結果冒稱為最終 SHA。

## 玩家實機驗收與停止點

1. 經中控審查及玩家核准發布後，才在原 Android Chrome 裝置驗收；本 PR 未部署。目前舊頁面的 JS 不會因 PR 自動被修復。能操作時先確認正式保存並匯出完整備份，再正常重新載入取得修復；若舊頁已卡住且無法保存，保留原頁並交中控確認備份途徑，不要求清網站資料或解除安裝 PWA。
2. 記錄裝置／Chrome 版號、載入版本及 contentSha、更新入口、每個階段文案與耗時；勿提供私人存檔或完整瀏覽器資料。更新需看到保存成功後才啟用，重載後確認目標版本／內容，並核對同一戰役、已領任務、指令結果與回復點。
3. 測正常網路、已下載後離線、未下載時離線、慢速、切背景再回前景、快速連點；允許安全失敗但不能永久 loading、假稱保存、無條件重載或重複自動啟用。啟用失敗後保留「保存成功、更新未完成」並能依 Gate 明確重試。
4. 需要時在合成／備份環境檢查 Recovery；不要在玩家原進度上故意損壞 IndexedDB 或填滿磁碟以製造失敗。

歷史 Gate／驗收記錄不由本輪 CI 改成正式 PASS。**保持 Draft；不合併 main、不部署 Pages、不關閉 Issue #18、不開始 B10／B11。交付後 STOP，等待 GPT-6 中控與玩家核准。**
