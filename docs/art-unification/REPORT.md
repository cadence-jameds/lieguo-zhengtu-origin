> 玩家八張回饋修正：指定五張兵種與三文明前三時代城郊已更新，見[新舊對照、解剖硬閘門與實景回歸](player-feedback-20261029/REPORT.md)。下列五張舊兵種自評及其舊圖板已被取代；法蘭克舊精銳為多餘肢體硬性 FAIL，舊高分撤回作為放行依據。重甲騎兵原圖保留。

> 本輪新增：六文明帝王城郊貼牆、世界地圖110%候選與城內比例複驗，見 [實景與量測報告](city-fit/REPORT.md)。以下先前紀錄保留，城郊／城內顯示以本輪報告為準。

> 帝王城市比例複查：確認腳點／構圖與世界地圖用途混用，詳見[本輪量測、修正與 54 案 UI 對照](city-scale/REPORT.md)。

> 科技對照板修正：先前文明對照因混入現代科技而失效。請以[本輪修正報告](technology-repair/REPORT.md)、正確圖板與 39 案新截圖為準；舊的文明圖板驗收結論撤回。

# 全套美術整合施工紀錄

本分支已實作完整 catalog 的圖片整合與帝王顯示映射，交付為 **Draft 候選整合，尚未取得玩家最終美術核准**。藍金騎兵保留玩家喜歡的斗篷、盔纓與金甲，長槍改為腰側握持；投石機改為深色精修木料、鍛鐵包角、金屬輪轂及配重式構型。兩張玩家指出錯誤的候選、紅褐色改版及其他退件均保留，不進入正式映射。

## 基準與 HEAD

- main 基準與施工前／交付前重新確認：`844a904e7527b79fd2cd7e2837e78b412aadf1c0`。
- 功能分支：`feat/art-unification-20261028`。
- Runtime、美術、顯示測試實作 commit：`4059b4f798d5cdd2e4d5854e52f2c3e56123d325`，tree：`7a5ae366bdd70f40e48bc69658c6680de6396d0e`。後續證據 commit 只補驗收文件、對照圖與稽核腳本的重現性，最終 HEAD 見 Draft PR。
- v95 唯一玩法主規格及 v94 歷史文件完全保留；`src/game/formal/` 沒有變更，catalog、成本、效果、條件、ID、schema、384×384 世界與 99 AI 均未修改。
- 美術聖經來自未合併的 [Draft PR #43](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/43)，head `e8a21f8711f6bc349f3d8743385cf1a5a2617256`。本分支完整保留 [v1.0](../art/列國征途_美術聖經_v1.0.md)，Git blob `9b324744789b1d0cbc1938f8dda735fa7634ba25`；補充規則另列 [v1.1](../art/列國征途_美術聖經_v1.1.md)。

## 覆蓋與整合

| 範圍 | 實際盤點／映射 | 本輪產出 | 驗收狀態 |
| --- | --- | --- | --- |
| 正式單位 | 44／44，含 16 現代單位、12 個正式精銳對應 | 33 張新卡；11 張沿用已確認母圖 | PATH_PASS；美術玩家核准待驗 |
| 正式科技 | 82／82，含 15 現代科技 | 82 張獨立 TECH-CARD；12 條有數字的正式階級線，各階不同；六文明專屬 I／II 各不同 | PATH_PASS；美術玩家核准待驗 |
| 城建 | 20 建築 × 六文明 × 四時代 = 480 組完工／施工／詳情映射 | 33 張帝王完工圖，含四資源田及六文明中心／城堡；41 張施工圖，含八種普通時代新增建築 | PATH_PASS；通用功能建築由各文明共用 |
| 城市 | 六文明 × 四時代 = 24 組 | 六張帝王城市、帝王城市圖集、城牆環與完工／施工城內背景 | PATH_PASS；前三時代保留母圖 |
| 資源田 | 四資源 × 四時代 × 六個等級邊界 = 96 組，每組檢查完工及施工 | Lv0～5、6～10、11～15 的純顯示分段；高階按田地等級顯示 | PATH_PASS；沒有改資格或產量 |

480 組映射包含共享圖片，並非 480 張獨立建築圖。建築資訊中圖及詳情卡沿用同一高解析度 CITY-SPRITE，在既有 UI 內等比例呈現。完整 ID、路徑、SHA256、文明、時代、資源田及系列資料見 [覆蓋矩陣](coverage.md) 與 [逐筆 JSON](coverage.json)。

實際程式接線包括 `artRegistry`／`artAssets`／`artMap`、正式卡圖元件、城內建築、資源田、建築詳情、MiniatureCity 與世界地圖。帝王視覺 age=3 只在 presentation 使用，不進入存檔。既有已完成建築在尚未開工的升級佇列保留目前外觀；未建成的新建築及已開工升級顯示真正未完成結構。手機六格、建築槽位、腳點與原 UI 定位沒有更動。

## 原圖、提示詞與技術處理

[來源索引](../art-source/unification/batches.json) 保存 45 個可重現候選批次的完整提示詞、實際傳入的至少兩張同類參考、來源 SHA256、工具、尺寸、逐格退件與選用原因。[輸出索引](../art-source/unification/assets.json) 保存 198 個衍生輸出及逐圖 ART-GATE 自評，另有一張城市組合圖集，共 199 個新 Runtime 檔案。全部原始 PNG 留存，原母圖未覆寫。

生成後只做技術性的圖集提取、等比例留白與 WebP 壓縮。透明圖按實際 alpha 連通物件提取，移除鄰格殘片，統一 512px 畫布及地面腳點；卡圖保留深色背景。舊兵種／衛隊圖集按實測 y487／y505 分隔線裁切原點陣圖，避免相鄰長槍侵入卡面。兩張帝王城內背景只換遠方城牆帶，y235 以下道路及建築槽位像素與母圖逐像素一致。

兩次投石機細部生成被工具拒絕、沒有圖片，明列於 [BLOCKED 記錄](../art-source/unification/generation-blocked.json)。一張未選用的弩手中間圖缺少完整逐字提示詞，保存在 [隔離記錄](../art-source/unification/rejected/crossbow-clean-intermediate.json)，狀態 BLOCKED_PROVENANCE；正式映射採用另一次完整留存提示詞的重製版本。這些都未計入完成輸出。

## 視覺比對與 ART-GATE

- [優先兵種／投石機／藍金騎兵新舊與退件比較](boards/priority-before-after.webp)。
- 正式兵種與精銳、現代世代：[圖板一](boards/unit-lines-1.webp)、[圖板二](boards/unit-lines-2.webp)。沒有自行創造遊戲不存在的 III 階。
- 科技真實 I／II／III：[圖板一](boards/technology-tiers-1.webp)、[圖板二](boards/technology-tiers-2.webp)；[文明專屬 I／II](boards/civilization-technology-pairs.webp)。
- [六文明四時代](boards/six-civilizations-four-ages.webp)，包括舊帝王沿用城堡與新帝王的比較。
- 建築完工、施工、資訊及詳情：[圖板一](boards/building-states-1.webp)、[圖板二](boards/building-states-2.webp)。
- 透明度黑／灰／綠底比較見 `boards/alpha-1.webp` 至 `alpha-7.webp`；小尺寸可讀性見 [64px](boards/readability-64.webp)、[128px](boards/readability-128.webp)。

[逐圖 ART-GATE](art-gate.md) 為 Codex 視覺自評，採用圖 18～19／20，關鍵項目沒有 0；不是獨立美術簽核，也不是正式發布 Gate。**投石機支點承接細節部分被構件遮擋，第 08 項只給 1 分，機構細部仍待玩家審圖。**蒙古精銳馬尾接近來源邊緣，第 09 項只給 1 分。整體筆觸與細節密度仍有輕微差異，各圖第 07 項保守給 1 分。玩家指出的穿頭與舊機械結構候選，已改為硬性 FAIL，不以總分抵銷。

## 實測結果

| 項目 | 結果 | 證據／範圍 |
| --- | --- | --- |
| Typecheck | PASS | `npm run typecheck` |
| Production Build | PASS | Pages base `/lieguo-zhengtu-origin/`，僅本機產物，未部署 |
| Pages 路徑、PWA scope／fallback | PASS | `node scripts/check-pages-build.mjs` |
| 發行版本／worker 身分一致性 | PASS | `node scripts/check-release-build.mjs`，source commit 4059b4f，dirty=false |
| 完整隔離回歸 | PASS：2,098 成功、0 失敗、1 略過 | [摘要](validation/regression-summary.json)，原 maxWorkers=2／30 秒 timeout 未放寬 |
| 資產路徑與全 catalog 覆蓋 | PATH_PASS | 44 單位、82 科技、480 建築組合、24 城市、96 資源田邊界組合 |
| 解碼、尺寸、alpha、參考／輸出校驗碼 | PASS | [技術檢查](file-gate.json)，45 批、198 圖；場景前景完全相同，城牆可見紅色殘邊 0 像素 |
| Chromium 320／390／1440px | PASS：70／70，0 HTTP／page errors | [結果](browser/result.json)；實際 Shell、City、Army、Research、世界地圖及完整圖庫，合成且有效的 Formal world |
| 新舊 UI 對照 | PASS：舊版 6 畫面可載入 | [舊版結果](browser/before-result.json)，320／390／1440px 城市與圖庫 |
| GitHub PR CI | 建立 PR 後觀測；見 PR Checks | 不以本機結果冒稱遠端 CI；最終狀態於交付訊息列出 |
| 玩家美術簽核／獨立 Gate | 待驗／HOLD | Codex 自評不代替玩家與獨立驗收 |
| 實體手機／慢速網路 | 待驗 | 瀏覽器模擬尺寸不能代替實體裝置 |

瀏覽器截圖包括六文明四時代城市、帝王 320／1440px、一般／精銳／現代軍事、科技、建造／排隊／詳情、資源田施工及世界地圖。代表截圖：[320px 城內](browser/320-civ_zhongguo-imperial.png)、[390px 城內](browser/390-civ_zhongguo-age3.png)、[桌面城內](browser/1440-civ_zhongguo-imperial.png)、[320px 建築詳情](browser/320-construction-detail.png)、[390px 資源田詳情](browser/390-field-detail.png)、[桌面完整圖庫](browser/1440-gallery.png)。

最終成功回歸前，曾有一次現存 `formal/runtime.test.ts` 的 developer-speed 測試超過原 30 秒限制；當時同時執行瀏覽器與圖片處理。沒有更改該測試、timeout 或 Formal runtime；停止重工作業後完整重跑成功，留存於 [驗證歷程](validation/history.json)。這不覆寫 AGENTS.md 所記錄的歷史三個 legacy art failures、B5 E1 HOLD、Astra Gate 尚未 PASS 及實體手機待驗事實，也不代表 R3／R4 推進。

## 效能與未完成驗收

198 個衍生圖共 17,043,180 bytes，城市組合圖集另 584,050 bytes，合計新增 17,627,230 bytes；最大單圖 1,946,330 bytes。卡圖 lazy decoding／loading，沒有拉伸舊圖冒充新圖。本機 Chromium 的每案載入及完整 eager decode 時間逐項記錄在 browser/result.json，只表示本機流程，並非手機效能保證。

現有 PWA 規則會預快取全部正式美術；本機 Build 為 392 entries／72,178.72 KiB，新增素材會提高首次離線下載成本。沒有在本輪改動 Service Worker 快取政策。實體手機的儲存壓力、低記憶體與慢速網路體驗仍待驗；來源 PNG 與驗收截圖另增加 repository 容量，不會放入正式 public 資產。

尚待玩家對 198 個採用圖、投石機機構細節及整體風格作最終簽核，另待實體手機／慢速網路、獨立 Gate。這份 Draft PR 可直接審閱完整實作與證據，**不得標示全套正式美術已最終驗收完成**。沒有合併 main、部署 Pages 或關閉 Issue。

## 重現

Node 22.13+，先 `npm ci`。建置只需專案依賴；生圖後處理另需 Python 3、Pillow、NumPy、SciPy，圖板另需 Noto Sans CJK 字型。

```sh
npm run typecheck
node scripts/verify-in-isolation.mjs full
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin npm run build
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin node scripts/check-pages-build.mjs
node scripts/check-release-build.mjs
python3 scripts/check-art-files.py
node scripts/art-coverage.mjs
node scripts/write-art-report.mjs
python3 scripts/art-comparison-boards.py
```

瀏覽器驗收：啟動 Vite 開發伺服器後執行 `node scripts/verify-art-browser.mjs <playwright/index.mjs> <dev URL> <輸出目錄>`；需 Chromium，非 `/usr/bin/chromium` 時用 `CHROMIUM_PATH` 指定。驗收頁是 `scripts/art-preview.html`，沒有寫入正式入口或私人存檔。原始候選轉製可用 `python3 scripts/prepare-art-candidates.py`，讀取已提交的來源索引，不重新呼叫生成器。
