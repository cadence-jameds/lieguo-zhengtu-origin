# PR #9｜最新 main 整合與工匠 UI Delta Report

本輪依 GPT-6 中控 [R9-B1～B4 審查](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/9#issuecomment-6218798152) 施工。受審原 HEAD `c8cf3ef16e01a709b545e4fa0dbe579c15e008b4`、最新 main `7e52d06c3ca83b1ba99d6f28346e0735b0d29aa2`，開始及提交前均重新核對。原 PR #9、舊報告與 1,137 PASS 歷史完整保留；後者不作最新整合驗收。

實作 source checkpoint：`81f686a3867310417c44c564479ac0cc1db8d0a2`，tree `23602d36471f2618667b08888df826e54bcc6ca3`。本報告隨後續驗證／測試工具提交交付；最終 HEAD 與 CI 以 [PR #9 Checks](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/9/checks) 及 PR 本文為準。source checkpoint 之後所有 `src/`、正式規則與發行摘要皆未改動。會再以最終 HEAD 建置並執行瀏覽器／定向／GitHub CI 核對，最後結果在 PR 本文交付，不把舊 HEAD 的結果冒充新 HEAD。

## 分支與衝突處理

已保存本機 `checkpoint/pr9-before-main-20261016`（原 HEAD）、`checkpoint/pr9-main-20261016`（main）及 `checkpoint/pr9-source-integration-20261016`。整合提交第一 parent 為 main、第二 parent 為原 PR HEAD，兩者都是新 HEAD 的祖先；原施工分支以 fast-forward 更新。這使 first-parent 發行規則沿正式 main 計數，也保留所有受審歷史。沒有 hard reset、rebase、force push、改 main／release 或使用 Merge PR／部署 API。

實際三方整合有五個文字衝突，均逐段處理：

| 檔案 | 解法 |
| --- | --- |
| `GameApp.tsx` | 同時保留 `LegionView` 與 main `ReleaseLog`，接回軍團／治理／外交頁，保留載入、同步保存與更新介面。 |
| `formal/reducer.ts` | 保留 main 的 Replay draft／Receipt 索引、`advanceOneEvent`、cooperative replay 與 Scheduler 順序；在原 PR #9 的合法政治變化邊界接回外交記事。沒有回用舊逐事件完整 clone。 |
| `runtime.worker.ts` | 保留 main 的離線進度、玩家命令協調、branch／foreground revision、CAS、durable ack 與序列排空；差異只是在報告空計數增加 diplomacy。 |
| `useGame.ts` | 保留 main patch 直接採用、載入 watchdog、Command Receipt／保存協調，只延伸外交計數。 |
| `presentation/ExtinctionView.tsx` | 保留既有 RebirthView；工匠操作使用 PR #9 已拆出的特殊單位卡，移除舊位置的重複 inline panel。沒有擴充滅國畫面或按鈕。 |

其餘正式模型／schema 只增加 diplomacy 分類，戰報 payload 驗證、checksum 與所有權限制維持。Persistence 只延伸合法分類與計數，並保留 count 先於 Dexie reverse／offset／limit 的 50 則分頁修正；存檔、Recovery、CAS 與 Command Receipt 主體不變。26 個關鍵檔與 main 逐位元相同，Worker／useGame 除外交空計數外與 main 完全相同，見 `core-preservation.json`。

本機僅未 materialize 107 張歷史封存 PNG，其 Git Blob 參照及遠端歷史保留。隔離輸入只略過這些封存圖檔，沒有排除任何 src／tests／設定；完整 GitHub checkout 的全套 CI 亦通過。未使用缺少封存二進位物件作為跳過測試的理由。

## 工匠 UI 修復

v94 最新總綱第 70 行明定：同文明、外文明合法工匠在自有無堡城市興建對應文明城堡 Lv1，穀／木／石／金成本均為 0，正常時代、建築前置、工期及 Lv2～15 成本不變。本輪對齊此條與 main 已合併 PR #3，未改 Formal D5 數值。

`cityActions.ts:craftsmanCastleAction()` 用真正 `craftsman.castle` 命令在私有 draft 預覽，返回同一資格拒絕原因、已支付成本及正常工期；不以普通造堡資源不足禁用工匠命令。預覽不提交、不寫 IDB、不消耗原世界工匠，六文明均有完整 canonical 不變斷言。按世界快取預覽，且只在工匠 dialog 開啟時執行。

`CraftsmanPanel` 保留卡片美術、選擇、轉移、在途與施工顯示；移除同文明禁止條件與舊收費文字，四資源顯示 0。缺時代、缺建築、已有城堡／工程、佇列滿、非自有城市或工匠無效時仍受正式拒絕。工期、單城一堡、完工一次消耗、取消規則、普通 Lv1 建堡及 Lv2～15 路徑全部沿 main；專項測普通 Lv1／Lv2 實際正常成本，沒有宣稱另做全部 Lv15 人工驗收。

## 新版證據與失敗紀錄

| 驗證 | 結果 |
| --- | --- |
| 工匠修復前 UI 負例 | 0 PASS／2 FAIL：同／異文明零庫存均被錯誤禁用；原始結果保留。 |
| 最新定向 | 107 PASS／0 FAIL；含工匠、外交、PR #3 C1／C3／D1／D5／水域及 PR #17 更新流程。屬完整回歸子集，不重複計數。 |
| 完整隔離 Regression | 1338 PASS／0 FAIL／1 既有 conditional SKIP，150 files；原 runner，maxWorkers=2、testTimeout=30000。 |
| Typecheck、Production Build、Pages 路徑、Release Metadata | PASS；沒有放寬 runner timeout 或排除測試。 |
| Chromium 主流程 | 24 PASS：1440×900、390×844，各含六文明零庫存、真前置負例、完工／重讀、全部治理政策與 1／10／50X stale／duplicate／合法 retry、軍團權限、外交 0／50／51／62、讀取清除／Recovery、#4～#6。 |
| Chromium 補充 | 10 PASS：真命令建造／訓練 3/3 與城市切換、盟友精確兵力不洩漏、正式拒絕回覆、Rebirth 路由及六文明開局文案。 |
| Chromium PR #3 核心 | 8 PASS：桌面／手機 C1 可達改道與全不可達、C3 仍有城及已滅國；99 agents、原生 Worker／IDB、SaveLoad／Recovery 與單次清算。另 21 項核心 fixture 測試為 full 子集。 |
| Chromium PR #17 PWA | 4 PASS：桌面／手機離線日誌、docs-only waiting SW 線上／離線不通知、同版不同內容訊號更新；durable-sync-ack 在 controllerchange 前，0.30.50 appVersion 舊存檔保留且可 SW 離線重載。 |

總計為 **46 組瀏覽器情境**，各組含多個實際操作；不是 46 項 unit tests，也不與 1338 相加。AI 決策僅在明示的合成原生瀏覽器 fixture 延後 30 天以隔離操作；未改任何產品 AI 行為／活躍度，不宣稱這等於 99 AI 長局效能實測。

失敗歷史另存新目錄，沒有改寫為 PASS：

1. 首次修復後定向 13 PASS／3 FAIL，包含無效同文明 fixture 的來源文明參照、測試對資源縮寫的錯誤假設與單一測試落在 Vitest 預設 5s；修正合法 fixture 與精確資源文字，正式定向沿用原 full 的 30s 基準，未調整 runner。
2. 初次整合定向 104 PASS／3 FAIL，舊 C3 斷言把「所有分類僅 1 則」當作單一終戰報告。改為仍強制 battle 恰好 1 則，另明確要求僅滅國情境有 1 則外交記事，總數分別 1／2，並保留重播無重複的斷言；未改戰鬥或 Receipt。
3. 新瀏覽器 fixture 曾把未來外交報告帶回較早世界，遭 checksum／報告游標驗證拒絕；改成各世界當時的報告陣列，未放寬驗證。
4. 首次主流程 22 PASS／2 FAIL 是 async `waitForFunction` 沒有重新輪詢 false Promise，過早檢查尚在施工的原生 IDB。保留失敗與獨立前後診斷；改在原 15s 內明確輪詢，真工期結束才檢查工匠消耗。PWA waiting probe 同步改以實際 registration handle 輪詢，原 20s 不變；正式 SW 機制逐位元不變。

瀏覽器非預期錯誤為 0；PWA 主動斷線錯誤逐筆標記並保留。封存圖片、私有存檔、原始 Playwright／CDP traces 未新增到 Git；公開的是合成場景結構化結果、原始測試輸出與 SHA256 manifest。

## 發行與最新 HEAD 對應

新增且只新增 `releases/notes/v94-ui-integration.json`，PR body 受控繁中 JSON 相同。六條摘要僅列軍團、天下勢力、治理、外交記事、工匠及 #4～#6 已完成 UI，沒有將 P0-C 或五筆 Scheduler／80 任務列為完成。

source checkpoint clean 建置為 **0.30.53**，歷史為 **0.30.53／0.30.52／0.30.51／0.30.50**；root package 0.30.50 仍為正式基準。version.json／發行 package／UI／Worker／CHANGELOG 使用同一 metadata，PR #3 的 0.30.51 與 PR #17 的 0.30.52 未重寫。source checkpoint 的 Push／PR CI 均成功：

- [Push CI](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/38927426649/job/117062438660)
- [PR CI](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/38927438359/job/117062477288)

後續交付 commit 只有文件、證據與測試工具修正，既有發行器判定不再升版，contentSha 維持 source checkpoint；部署 commitSha 仍追溯最終 HEAD。最後會重建該 HEAD、核對最新 Push／PR CI 及重跑真瀏覽器，PR 本文將列其 SHA、結果與連結。所有 `src/` 的 Git Blob 一致性一併核對，不能以原 PR #9 的 1,137 PASS 取代。

## 範圍符合矩陣與停止點

| 中控要求 | 交付／邊界 |
| --- | --- |
| R9-B1 main 安全整合 | 五衝突逐段解決；main 與原 PR 都保留為祖先；26 關鍵檔相同，正式 Reporter 延伸有限。 |
| R9-B2 D5 UI | 真命令純預覽、六文明同／異均免費、零庫存、真前置、正常建堡成本、完工／存讀檔。 |
| R9-B3 發行 Gate | 一份新摘要、本文同 JSON、既有產生器與 SW 保存安全流程保留；沒有手動版號。 |
| R9-B4 最新驗證 | 1338 full、107 定向、46 browser groups；最新 HEAD 的 CI／瀏覽器最後再核對。 |
| PR #3 C1／C3、失城清算與水域 | main 核心檔相同；107 專項與 8 原生場景，含 Recovery 去重。 |
| 報告權限／CAS | owner／campaign／時間／游標過濾及嚴格 report schema 不變；原生精確兵力隱私、分頁與治理 CAS 正反例。 |
| P0-C-5／7／8／9／10、Issue #14 | 未施工、未列完工；既有 RebirthView 可運作，未擴充滅國按鈕。 |
| 五筆佇列／80 任務 | 獨立 PENDING；UI 如實使用現行 3，Scheduler 與任務系統未改。 |
| B5 E1 | OWNER WAIVED，保留歷史 HOLD，未重新要求人工驗收。 |

無實體手機／GPU FPS、公開部署或本輪新增長期 AI CPU benchmark。PWA 新內容正例的 contentSha／commitSha 為明示合成值，文件負例使用真產生器與 Workbox 產物；沒有把估計或合成資料稱作正式部署。

完成限定 Delta 後 **STOP**，交 GPT-6 中控複審。沒有 Merge PR、部署 Pages、關閉 Issue 或開始 P0-C；原中控 HOLD 與獨立 Gate 決定仍由中控處理。
