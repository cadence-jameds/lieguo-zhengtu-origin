# 動作候選 D：低姿架弩／過頂舉刀

回應玩家認為中日精銳與一般兵仍太相似、希望更大膽且可從動作著手的意見。本輪新生成兩個動作方向，接續 `2f7c34f14b1247ae887920ddc679a52024e492c1`；只增加文件候選與審圖資料，沒有接入 Runtime。現行正式圖、A／B／C、Registry、玩法與歷史驗收紀錄全部保留，不替玩家選圖。

| 文明 | 新候選原圖 | 一般／正式精銳／動作 D 大圖 | 128px | 64px | 手機直排 |
| --- | --- | --- | --- | --- | --- |
| 中國 | [低姿架弩 v1](raw/china-D-v1.png) | [完整比較](zhongguo-compare-512.png) | [128px](zhongguo-compare-128.png) | [64px](zhongguo-compare-64.png) | [開啟](zhongguo-mobile.png) |
| 日本 | [過頂舉刀 v2](raw/japan-D-v2.png) | [完整比較](japan-compare-512.png) | [128px](japan-compare-128.png) | [64px](japan-compare-64.png) | [開啟](japan-mobile.png) |

## 設計與自評

**中國 D：低姿、橫向張力。** 後膝降至地面，前腿跨出，兩手架弩向右；披風向左展開，形成低而寬的三角輪廓。保留紅纓、連弩、深色鐵甲與紅布，肩部重疊護片及披風增加裝備層次。這次胸腹仍是片甲，沒有完全達成提示詞中的大片釘甲；不可把未生成的甲型當成已完成效果。128px 可見後膝、前腳與架弩；64px 仍可辨低姿和披風，但細甲片及機構不可逐件讀取。

中國 v1 可見兩條手臂、兩手支撐單一木弩、兩腿及完整腳部，未見第三肢體；但右手下方的橢圓控制環太像槍械扳機護圈，手動連弩的槓桿關係仍須複審。針對控制區的生圖編修未產出圖片，工具回報 `moderation_blocked`、`violence`；完整錯誤與 request ID 見 [china-edit-blocked.json](china-edit-blocked.json)。因此 v1 **僅為動作概念，機構待修，不可直接當正式候選驗收通過**。沒有用手繪塗除或其他生成途徑繞過該次拒絕。

**日本 D：高位武器弧線與前跨。** 雙手過頂持刀，刀刃向右上展開，上身轉向並前跨；相較一般與現行精銳的低手持刀，新增清楚的上方輪廓。保留日式兜、大袖、草摺、深鐵與紅穿繩，胸部寬板較整塊。128px 可辨高舉雙臂與分開握持的手位；64px 舉刀和跨步仍可見，面甲、手指與胸板接縫消失。這是動作讀性自評，不宣稱真實 UI／玩家／獨立審圖或實體手機已通過。

日本初稿的兩手擠在短刀柄同一處，已由正式生圖工具編修為長刀柄兩段分握；[v1 原稿](raw/japan-D-v1.png) 保留為 `SUPERSEDED_SHORT_OVERLAPPING_GRIP`，比較板使用 v2。v2 自檢見單一出鞘刀刃、單一刀柄與刀鍔，兩手各連接其前臂，腰側另有收納用刀鞘；未見第三手、第三臂或刃穿頭。遮擋指節不能逐指保證，握持、肩肘負荷及劍術姿態仍待玩家與獨立複審，未宣稱 ART-GATE PASS。

## 公平比較與來源

一般兵仍由現有 `unitArt`／`armyAtlasBounds` 取得，中國使用 `guard.civ_zhongguo`，日本使用 `guard.civ_japan`；第二欄直接讀取現行正式精銳圖。新圖以各自的現行精銳與一般兵原圖為參考，透過正式 `image_gen.imagegen` 生成；完整逐字提示詞在 [prompts](prompts/)，原始生成 PNG 在 [raw](raw/)。沒有更改或覆寫之前的七張候選記錄。

每張輸入完整等比縮至最大邊 480px，置於共同 512×512 畫布，最低鞋底對齊 y450；不個別放大任何輸入。跪姿不能用「盔頂到鞋底等高」去強行放大成站姿高度，因此本輪改用完整來源畫布規則，保留姿勢造成的高度差。這與前輪五欄的站姿等高板是不同的比較條件；生成構圖、頭身比例和姿勢壓縮的差別仍可見，沒有宣稱精確人體骨架同尺度。鞋底人工標點約 ±4 個來源像素。128／64px 均由同一套比較卡直接等比縮小，未放大冒充小尺寸；手機直排美術區域為 288px 預覽。

[manifest.json](manifest.json) 記錄實際 selector、來源 SHA256、三張成功生成原圖、提示詞與參考 SHA、初稿／修正版狀態、全部比較板 SHA 與縮放／腳線。模型名稱未由工具公開，未自行捏造。

## 驗證與發布狀態

```sh
python3 docs/art-unification/elite-review-20261029/action-candidates-20261029/build.py
python3 scripts/check-art-boards.py
python3 scripts/check-city-visuals.py
python3 scripts/check-player-feedback.py
```

以上本機檢查通過；正式來源與映射未改。GitHub fetch／ls-remote 的命令級網路權限申請兩次未能執行：自動核准服務回報 `Selected model is at capacity`，不是安全判定，也不是 CONNECT 403。未繞過核准流程，未改用 GitHub API 寫入分支。這輪只完成本機資料，**未 Push、未更新遠端 PR 描述、未觸發或宣稱新版 GitHub CI 通過**。

PR #44 未修改；PR #45 最近讀取仍是 Draft、HEAD `2f7c34f14b1247ae887920ddc679a52024e492c1`。沒有合併或部署。歷史 legacy art failures、B5 E1 HOLD、Astra Gate 非 PASS、玩家／獨立審圖與實體手機待驗均維持原記錄。
