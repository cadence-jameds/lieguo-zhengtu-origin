# 日本精銳最終定案與 Runtime 接入

玩家正式採用：**日本候選 1「鬼面大鎧＋過頂舉刀」**。中國仍採用 `3798a7f` 的 **B 高階魚鱗甲＋低姿跪射**，本輪未更動中國圖片、映射或來源資料。

日本核准成果已存在於來源提交 `262d9efaa23670d82abcb2c7e99a0a39446bc9ab`。本輪直接逐位元組複製已核准的 512px lossless WebP，沒有生圖、轉檔、裁切、重縮或調色。

| 項目 | 位置／值 |
| --- | --- |
| Runtime ID | `elite.guard.civ_japan` |
| 正式圖片 | [elite.guard.civ_japan.approved-candidate-1.webp](../../../public/art/unified/units/elite.guard.civ_japan.approved-candidate-1.webp) |
| 核准 512px 成果 | [原候選 1](../elite-final-20261030/japan/candidates/japan-1-oni-oyoroi-overhead.webp) |
| 原始生圖 | [1254px 原圖](../elite-final-20261030/japan/raw/japan-1-oni-oyoroi-overhead.png) |
| Runtime／候選 SHA256 | `f9e55c7eb9babdfba36c98c63f7983b5b319d5c17b4cd5e60211eaf6dbebbda8` |
| 解碼 RGB SHA256 | `c0abd851bb20ffeaf1dc594bcbbc291164cf48e5331a8961365ec905410dd781` |
| 舊正式圖 | [原路徑完整保留](../../../public/art/unified/units/elite.guard.civ_japan.webp) |
| 定案與機器可讀紀錄 | [runtime.json](runtime.json) |

## 保留、不採用的候選

- **候選 2「鬼角前立＋斜前蓄力斬」不採用**；[成果](../elite-final-20261030/japan/candidates/japan-2-horn-crest-coiled.webp)、原圖及提示詞保留。
- **候選 3「高階武士＋半蹲居合」不採用**；[成果](../elite-final-20261030/japan/candidates/japan-3-elite-iai-low.webp)、原圖及提示詞保留。
- [既有 A／B／C](../elite-review-20261029/REPORT.md)、[D 動作候選](../elite-review-20261029/action-candidates-20261029/README.md)、原正式圖、全部來源與 SHA 紀錄均保留。未覆寫原圖、比較板或歷史生成 JSON。
- [原五欄 512px](../elite-final-20261030/japan/comparison-512.png)／[128px](../elite-final-20261030/japan/comparison-128.png)／[64px](../elite-final-20261030/japan/comparison-64.png) 仍維持審查當時「一般／舊正式精銳／候選1／2／3」的原始排列；第二欄代表更新前正式版本。
- 手機直排：[128px](../elite-final-20261030/japan/comparison-128-mobile.png)／[64px](../elite-final-20261030/japan/comparison-64-mobile.png)。

舊 `outputs.json`、`review.json`、自評與瀏覽器紀錄的 PENDING／UNCHANGED 是來源提交當時的歷史狀態。本文件及 `runtime.json` 記錄玩家後續的正式定案，優先說明目前採用狀態，不回寫歷史證據。

## 尺寸與實際遊戲卡面

- 日本原生圖片：[512px](sizes/japan-runtime-512.png)／[128px](sizes/japan-runtime-128.png)／[64px](sizes/japan-runtime-64.png)。縮圖僅供驗證，正式 Runtime 檔案與核准成果完全相同。
- 真實 ArmyView 卡面：[320px 手機](browser/army/320-elite.guard.civ_japan-card.png)／[390px 手機](browser/army/390-elite.guard.civ_japan-card.png)／[1440px 桌面](browser/army/1440-elite.guard.civ_japan-card.png)。
- 實際詳情：[手機](browser/army/320-elite.guard.civ_japan-detail.jpg)／[桌面](browser/army/1440-elite.guard.civ_japan-detail.jpg)。
- [原生尺寸元件頁](browser/gallery/320-native.jpg) 使用正式 Art／unitArt 與 Runtime 映射；窄螢幕的 512px 圖在容器內橫向捲動，128／64px 不個別放大。
- [ArmyView 驗證](browser/army/result.json)／[原生尺寸驗證](browser/gallery/result.json)／[來源與截圖 SHA](browser-manifest.json)／[本輪測試結果](validation.json)。

視覺自評：512px 可檢查雙手同握一把主刀、手臂連接、鬼面為人類佩戴甲具；腰間另有入鞘短刀柄，並非第二把出鞘刀。128px 仍見過頂舉刀、寬大肩甲與前跨步；64px 主要依高舉手位、刀弧與寬肩／雙腿輪廓辨識，鬼面五官、手指與甲片細節不逐件可讀。保持原候選18分自評，不因接入調高分數。玩家已核准；獨立美術審查及實體手機測試仍待驗。

本輪只新增日本核准 Runtime 檔案及改一個 Registry 值；其餘素材、兵種資格、規則、ID、正式規格與 UI 元件不變。來源 manifest 只更新日本條目與其 supersedes 鏈。歷史 legacy 三項美術失敗、B5 E1 HOLD、Astra Gate 非 PASS 保留。PR #45 維持 Draft；不修改 PR #44、不合併、不部署。

## 本機回歸結果與 CI 判定

本機完整隔離回歸第一輪為 **2091 PASS／1 FAIL／12 SKIP**：既有 Runtime 測試30秒逾時，另有 B9-2 beforeAll 240秒逾時造成11項跳過；兩個測試檔與全部遊戲邏輯均未改動。保留原始失敗報告與 SHA，不調整測試門檻、不排除測試。Typecheck、Build、Pages產物與美術檢查通過。詳見 [validation.json](validation.json)。完整回歸以最終 HEAD 的 GitHub CI 實際結果確認，不把本機逾時輪次宣稱通過。

同一隔離副本、相同30秒門檻的 Runtime 檔案重驗為 **61 PASS／3 FAIL／0 SKIP**，三項均為逾時，沒有斷言值不符。此結果同樣保留於驗證紀錄，不宣稱本機回歸通過。
