# 中國精銳正式接入／日本精銳三款新候選

本輪接續 PR #45 的 `34be1b5c2dba64b2d84c4a8bfbc8656ad5d726c6`，維持 stacked Draft／Base `feat/art-unification-20261028`。**中國已按玩家核准的 `3798a7f` 接入正式 Runtime；日本三款只供審圖，正式圖片與映射不變。** 沒有修改遊戲規則、兵種 ID、存檔、正式規格、PR #44、main 或部署。

## 直接開啟日本五欄比較

固定順序：**一般武士｜現行精銳｜新候選 1｜新候選 2｜新候選 3**。

| 比較板 | 橫排 | 手機直排（寬 320px） |
| --- | --- | --- |
| 完整 512px | [開啟五欄大圖](japan/comparison-512.png) | [288px 等比預覽](japan/comparison-512-mobile.png) |
| 原生 128px | [開啟 128px](japan/comparison-128.png) | [原生 128px 直排](japan/comparison-128-mobile.png) |
| 原生 64px | [開啟 64px](japan/comparison-64.png) | [原生 64px 直排](japan/comparison-64-mobile.png) |

| 新候選 | 原始 PNG | 512px 展示 WebP |
| --- | --- | --- |
| 1：鬼面大鎧＋過頂舉刀 | [原圖](japan/raw/japan-1-oni-oyoroi-overhead.png) | [候選 1](japan/candidates/japan-1-oni-oyoroi-overhead.webp) |
| 2：鬼角前立＋斜前蓄力斬 | [修正版原圖](japan/raw/japan-2-horn-crest-coiled.png) | [候選 2](japan/candidates/japan-2-horn-crest-coiled.webp) |
| 3：高階武士＋半蹲居合 | [原圖](japan/raw/japan-3-elite-iai-low.png) | [候選 3](japan/candidates/japan-3-elite-iai-low.webp) |

圖板以 100% 原圖檢視才是標示的原生尺寸；把整張寬圖縮到手機寬度，不等於原生 64px。手機直排讓標籤與每張卡維持可讀。沒有在正式遊戲加入候選選擇入口；瀏覽器證據使用 scripts 下的獨立審圖頁及真實 `Art` 元件。

## 中國：3798a7f 核准圖正式接入

玩家最終採用 **B 高階魚鱗甲＋低姿跪射**，核准來源 commit：`3798a7f70fd76bfb5143a320a1e3703339a743a0`。

本輪沒有重新生成或改動中國造型。直接把該提交的既有 [512px 核准 PNG](../elite-review-20261029/china-B-kneeling-20261029/china-B-kneeling-512.png) 無損編碼成 [正式 WebP](../../../public/art/unified/units/elite.guard.civ_zhongguo.approved-3798a7f.webp)，只將 Registry 的 `elite.guard.civ_zhongguo` 值改指向此新路徑。兵種 ID、元件與資格／玩法不變。舊正式圖仍留在原 public 路徑，並保存 [前版輸出](before/elite.guard.civ_zhongguo.webp) 與 [前版 Registry](before/artAssets.json) 供追溯。

| 核對項目 | SHA256 |
| --- | --- |
| 核准原始 1254px PNG | `b7ff3b671ac852511b3a61fd1f118bbfb2ba0b7aac979250c2675d3906993790` |
| 核准 512px PNG | `80709f92bade96fe285617b56a138ec8604c07d80ad6653b6ac499251b70a30b` |
| 新正式無損 WebP | `e12b39f6ba3ca10f10028611a892b890c46ac1c173b96a8cb5a0ea39abaf50db` |
| PNG／WebP／瀏覽器解碼共通 RGB | `0bcf915c808f02297f3fceb8bdc908236e7f31231a378890a1e73ae6280626e6` |

無損轉檔後逐像素相同，沒有再裁切、縮放、換色或重畫。原 B 站姿、A／B／C／D、原始提示詞、來源與歷史比較板完整保留；**原 B 站姿只作比較，不作最終採用**。正式來源、舊／新 SHA、核准提交與轉檔方法見 [china-runtime.json](china-runtime.json)。

中國 [原生 512px](../elite-review-20261029/china-B-kneeling-20261029/china-B-kneeling-512.png)／[128px](../elite-review-20261029/china-B-kneeling-20261029/china-B-kneeling-128.png)／[64px](../elite-review-20261029/china-B-kneeling-20261029/china-B-kneeling-64.png) 保持核准版內容；真實 `Art` 元件也在三種寬度驗證了 512／128／64px 尺寸。

| 實際遊戲 ArmyView | 卡面截圖 | 詳情視窗 |
| --- | --- | --- |
| 320px 手機 | [正式卡面](browser/army/320-elite.guard.civ_zhongguo-card.png) | [詳情](browser/army/320-elite.guard.civ_zhongguo-detail.jpg) |
| 390px 手機 | [正式卡面](browser/army/390-elite.guard.civ_zhongguo-card.png) | [詳情](browser/army/390-elite.guard.civ_zhongguo-detail.jpg) |
| 1440px 桌面 | [正式卡面](browser/army/1440-elite.guard.civ_zhongguo-card.png) | [詳情](browser/army/1440-elite.guard.civ_zhongguo-detail.jpg) |

三種寬度均確認正式卡面及詳情使用新路徑，瀏覽器解碼的 512px RGB 與核准圖相同。現有遊戲名錄卡面為 100px，手機詳情為 74px，桌面詳情為 100px；這些實際尺寸沒有為本輪美術改動。

## 日本：造型、肢體與 64px 讀性

參照既有美術聖經 v1.0／v1.1 的 ARMY-PORTRAIT：人類全身、近眼平 3/4、深炭背景、左上暖光、深鐵／暗紅穿繩、受控舊銅高光。每張新圖都將專案目前正式精銳與真實一般武士送入正式生圖工具作參考；第一款另帶既有 D 握柄修正版。鬼面是人戴的鍛鐵面甲，鬼角是有金屬座固定的前立，沒有妖怪身體或皮膚長角。

| 候選 | 甲冑／輪廓 | 持握與肢體自檢 | 128／64px 觀察 |
| --- | --- | --- | --- |
| 1 | 鬼面式面甲、醒目前立、寬大分層大袖與重型胸腹；雙臂過頂，前跨步，刀刃向右展開高弧。 | 兩手在同一長柄的前後位置，手腕連接各自前臂；單一出鞘主刀，刃未穿頭。面具下保留人眼。 | 128 可見肩袖和面甲；64 仍可辨高舉雙臂與刀弧，面甲的五官與穿繩細節不清楚。 |
| 2 | 有金屬座的黑鐵彎角前立，重甲／大袖、轉身蓄力；手位偏肩側，刀線斜向，與第一款過頂高弧不同。 | 雙手握同一柄，肘腕連接；面甲是穿戴物。前立初稿仍像舊金色月牙，已局部修正，初稿保留。 | 128 可辨彎角與肩側刀位；64 角座、面甲細節變弱，主要靠側舉斜刀、厚肩和轉身輪廓。仍有與一般斜刀輪廓接近的風險，不宣稱鬼角細節本身已解決讀性。 |
| 3 | 較精緻的大分塊胸甲、緊湊護肩與紅穿繩；雙膝半蹲壓低重心，橫向拔刀。 | 右手握主刀柄、左手控制鞘口；一條連續刀身通向同軸鞘口，未見漂浮第二刀刃或第三手。 | 128 可見手與鞘口關係；64 水平刀線與低重心仍有辨識，手指、胸甲接縫不能逐件辨讀。 |

三款均在全尺寸、手部近看、512／128／64px 與瀏覽器審圖頁自檢。1／2 腰側另可見收鞘短兵器柄，並非第二支出鞘刀刃；不宣稱整張圖只有一件兵器。遮擋手指不能逐指保證，刀術姿態與歷史甲型是風格化遊戲方向，未宣稱嚴格斷代考證。沒有用小尺寸掩蓋全圖結構；沒有塗黑或裁切手部。

三款自評 ART-GATE 分別為 **18／17／18**，角色／視角／技術畫布無 0 分；細節筆觸及正式整合效果保守評分。日本候選使用真實 `Art` 元件的審圖頁，未接入 ArmyView 正式映射，因此正式 UI 項僅 1 分。這是自評，不是玩家／獨立 Gate；**日本仍未定案，沒有推薦或自動採用任何一款**。

## 五欄來源與比例

一般武士以正式 `unitArt('guard.civ_japan')`／`armyAtlasBounds` 從 `catalog-guards.webp` 裁出 `[514,507,508,515]`，不是舊精銳冒充。第二欄直接使用現行 `elite.guard.civ_japan` 正式 WebP，SHA 與施工前相同。

五欄同為 512×512 畫布，使用相同的「金屬盔體頂部（不含前立）至最低鞋底 360px、腳線 y460」規則，只對完整來源等比縮小和平移，不按武器或肩寬個別填滿、不放大候選、不非等比拉伸。所有來源邊界都保留在畫布內，人工標點約 ±8 來源像素。這是統一顯示身高的審圖規則，不代表骨架或真人身高精確相等；武器、盔飾與姿勢寬度仍保留差異。

候選 512px 無損 WebP 與比較板的對應 512px 圖塊解碼像素完全相同，128／64px 從同一卡面直接縮小；手機大圖為 288px 預覽，小尺寸直排維持原生 128／64px。細節與變換見 [review.json](japan/review.json)，逐字提示詞、母圖及原始結果見 [outputs.json](japan/outputs.json)／[generation-history.json](japan/generation-history.json)／[prompts](japan/prompts/)；工具未公開模型名稱，沒有捏造。

## 驗證與不變邊界

- 本機 Typecheck、Build、Pages 路徑／產物與美術完整性／來源／尺寸檢查通過；完整隔離回歸 **2103 PASS／0 FAIL／1 SKIP**，各項結果見 [validation.json](validation.json)。完整回歸只在隔離副本執行，不在驗證工作樹直接跑會寫 docs 的舊測試。
- [ArmyView 結果](browser/army/result.json)：27 案，0 失敗、0 page／HTTP errors；包含中日一般／正式精銳及其他兵種，320／390／1440px。
- [真實 Art 審圖頁結果](browser/gallery/result.json)：30 張日本原生 128／64px 卡、9 張中國 512／128／64px 卡；3 種寬度無文件橫向溢出。[截圖與來源 SHA](browser-manifest.json) 鎖定本輪證據。
- 正式 public 只增加一張核准中國 WebP，Registry 只改中國精銳一個值；其餘 key、所有日本 Runtime、其他正式美術、規格與玩法鎖定。原 A／B／C／D 及來源檔不改不刪。
- 舊完整性檢查保留歷史圖片與證據驗證，新增精確核准 SHA／單一 Registry 差異／日本不變的後繼檢查，不放寬其他素材的鎖定。
- 本 PR 沿用唯一尚未合併的玩家回饋 release note，補入中國正式定案這一項，PR 受控 JSON 同步；沒有改已合併摘要、package 基準版號或正式規格。
- 新中國 Runtime WebP 為 297,710 bytes，舊圖仍保留；Pages 格式 Build 預快取增加一項至 393 entries，沒有改快取策略或部署。低記憶體／慢網與實體手機仍待驗。

GitHub CI 以本輪最終遠端 HEAD 的實際 Checks 為準，交付回報提供 commit 與 CI 連結，不引用舊綠燈。PR #45 保持 Draft，不修改 PR #44、不合併、不部署。歷史 legacy art failures、B5 E1 HOLD、Astra Gate 非 PASS 與獨立審圖／實體手機待驗維持原事實。

## 重現檢查

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-player-feedback.py
python3 scripts/check-art-boards.py
python3 scripts/check-city-visuals.py
python3 scripts/check-art-files.py /workspace/work/elite-final-art-files.json
npm run typecheck
node scripts/verify-in-isolation.mjs full
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin npm run build
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin node scripts/check-pages-build.mjs
node scripts/check-release-build.mjs
```

瀏覽器使用本機 Vite 的 `scripts/art-preview.html`（實際 ArmyView）與 `scripts/elite-final.html`（審圖頁），執行 `verify-elite-final-army.mjs`、`verify-elite-final-gallery.mjs`；需要可用的 Playwright 模組與 Chromium，不是 production 路由或外部部署。
