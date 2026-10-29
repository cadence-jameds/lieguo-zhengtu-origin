# 六文明精銳複審：中日三方案與法蘭克單手斧

本輪接續雲端本機 `8736bad811a7c372c59881b143e4c75bd659c5af`，沒有從遠端舊版重做。該 commit、先前八張原始候選 PNG、五張已修正 WebP、城郊前後對照、報告及 46MB Git bundle 均確認存在。工作開始時遠端 Draft PR #44 仍為 `5314e0c6c0b450d3a74f0bb7365b13a831bdbdf5`。交付的新 HEAD／推送結果另見 validation.json、交付下載清單及回報。

**正式變更只有法蘭克精銳一張卡。** 中國／日本六張候選只在本目錄，Art Registry 與兩張現行精銳卡維持 8736bad，等待玩家選定。重甲騎兵、輕騎兵、騎士、三文明城郊接地、帝王城郊、世界地圖 110%、共用建築策略、科技、玩法／ID／存檔／v95 都不變。870 個既有 public／src/game／v94／v95 檔案以 SHA 鎖定，比較前後逐檔驗證。

## 六文明實圖複審

實際讀取 `catalog-guards.webp` 及六張現行精銳，普通版按正式 `armyAtlasBounds` 的 y505 分隔線裁切；沒有重生母圖。保存 [實際參考圖及來源](references.json)，對照 [8736bad 六文明原版圖板](boards/six-civilizations-before.webp)、[目前 128px](boards/six-civilizations-native-128.png)、[目前 64px](boards/six-civilizations-native-64.png)。兩張 native 圖板的每張卡保持該像素尺寸，不放大後冒充小尺寸。

| 文明 | 普通／精銳共有特徵 | 8736bad 精銳實際增加的裝備／結構 | 128px／64px 觀察 |
| --- | --- | --- | --- |
| 中國 | 紅纓軍盔、暗紅內衣、連弩、札片裙甲 | 厚肩層、頸部與前臂防護，更完整的弩機與可見前弓 | 128 可辨；64 下仍是相近札甲輪廓，玩家所指差異不足成立。本輪另提三種結構候選。 |
| 拜占庭 | 騎乘、金屬鱗片／片甲、長槍、盾牌 | 覆面盔、軀幹與四肢完整重防護、較重馬甲；藍金披風與裝備工藝 | 128 可辨覆面與騎乘防護；64 主要靠面甲、肩身重甲及披風輪廓，細馬甲片不逐片可讀。保留已確認圖。 |
| 法蘭克 | 鎖甲、鐵盔、披風、皮具、藍金鳶尾花 | 肩部金屬護片、護臂與較佳武器工藝；舊版改成雙手大斧和背盾 | 128 可辨防護與斧型；64 肩甲與斧形較清楚，但持法不符玩家本輪單手要求，已正式修正。 |
| 不列顛 | 英式長弓、箭囊、紅十字外衣、鐵盔 | 鎖甲軀幹與護頸、加強腰部防護；跪姿拉弓 | 128 鎖甲／腰甲可辨；64 主要靠姿勢，裝備細節讀性較弱，不能只用姿勢宣稱精銳化完全通過。本輪僅複審、未改此圖。 |
| 日本 | 日本兜、曲刃、暗色甲片、紅穿繩、草摺 | 寬肩大袖、胸甲、面部防護與頸甲 | 128 可辨肩胸；64 與普通輪廓仍接近。另以大鎧／胴丸／具足候選比較，未正式替換。 |
| 蒙古 | 騎射、複合弓、蒙古騎裝及皮革毛料 | 由毛帽輕裝改為鐵盔／札甲，完整軀幹護甲及馬匹前部防護 | 128 盔甲與馬具清楚；64 毛帽輕裝到盔甲騎射輪廓仍可區分，細甲片有限。未修改。 |

不同文明不可共用一種泛用板甲。中國 A 的細札甲與日本早期甲片都屬分片防護，會有材質上的共同點；中國紅纓盔、鉚接護臂、弩機及下垂甲裙，必須與日本兜／穿繩大袖／草摺／雙手刀保持不同。拜占庭與蒙古的金屬片甲也不等於同一套鎧甲，須連同覆面、騎射、馬具與構件看。本輪中國 B 的連續魚鱗系統、日本 C 的寬板胴與面頰防護，能進一步拉開跨文明結構差異。

## A. 中國候選，等待玩家選定

[普通／A／B／C 四欄](boards/中國-ABCs.webp) · [128px](boards/zhongguo-native-128.png) · [64px](boards/zhongguo-native-64.png)

| 候選 | 真正的護甲結構差異 | 縮小後的優勢及限制 |
| --- | --- | --- |
| [A 重型札甲](candidates/china-A-lamellar.webp) | 密集黑鐵札片、加厚多層肩部、頸部護片、完整護臂／脛甲及重裙甲；保留紅纓軍盔、暗銅邊件與連弩 | 128 可辨完整防護與厚肩；64 仍接近普通札甲材質，細部不是強項。 |
| [B 高階魚鱗甲](candidates/china-B-scale.webp) | 胸腹、圓弧肩甲、腰甲與脛甲採一致向下重疊的圓鱗；木金複合連弩保留彈匣、前弓與手動機構 | 128 圓鱗與普通直條札片明確不同；64 個別鱗片無法逐片辨讀，主要看曲面防護整體與更完整覆蓋。 |
| [C 禁軍重甲](candidates/china-C-imperial.webp) | 受明式釘甲啟發的厚重覆布甲衣，鐵片由大面積有鉚釘的甲衣面板固定；另配層疊鐵肩甲、護頸與寬甲裙 | 128／64 的大分塊胸腹、剛性甲衣與長寬裙板較清楚；是構造改變，不是把札甲染紅。小紋飾不是主要辨識手段。 |

**推薦 B**：魚鱗由肩、胸腹到腰部形成一致防護系統，既保留中國軍盔和連弩，又從甲片形狀就能與普通版分開，也不會套用泛用西式重甲。若玩家把 64px 大分塊辨識放在第一位，C 是較強的替代選擇。這是推薦，沒有修改正式映射。

C 初稿仍像外露矩形札甲，判為 `REJECTED_TOO_SIMILAR_TO_A`；只針對胸腹和裙甲做一次圖像編修，原稿與提示詞保留，未刪除。所有弩圖自檢正常兩手支撐、前方橫弓／弦、木製上彈匣與手動部件，不是槍管或現代槍械；這仍是歷史風格遊戲插畫候選，不宣稱考古復原的機械工程圖。

## B. 日本候選，等待玩家選定

[普通／A／B／C 四欄](boards/日本-ABCs.webp) · [128px](boards/japan-native-128.png) · [64px](boards/japan-native-64.png)

| 候選 | 歷史系統及結構差異 | 縮小後的優勢及限制 |
| --- | --- | --- |
| [A 大鎧](candidates/japan-A-oyoroi.webp) | 較早期大鎧方向：方整胸腹、明顯加寬大袖、深分片草摺與穿繩；開放面部、保留日本兜和曲刃 | 128／64 肩寬、方整體積及裙甲輪廓最強；仍延續普通武士語言，沒有大型幻想盔角。 |
| [B 胴丸](candidates/japan-B-domaru.webp) | 較貼身包覆胸腹、較窄貼合大袖、分片腰甲、完整護臂／脛甲；較小前立與筋兜輪廓 | 128 可看出包覆和活動性；64 細甲片與普通相近，不能只用小前立就當作充分精銳化，讀性評分保守。 |
| [C 具足](candidates/japan-C-gusoku.webp) | 較晚期當世具足方向：寬幅橫板桶側胴、較緊湊肩部、護手、面頰與喉部防護 | 128 大板胸甲與面具能表現製甲技術進步；64 細面甲、胸甲接縫會融入陰影，仍需玩家審圖。 |

**推薦 C**：大板胸甲、面頰與喉部防護是真正的防護系統升級，比普通武士的小札胸甲更能表現技術演進，同時保留日本兜、穿繩、草摺與曲刃。若最重視 64px 肩部輪廓，A 更醒目。B 的靈活方向合理，但本輪不推薦作最容易辨識的精銳方案。

三張是互斥設計方向，不是遊戲新增三個等級。早期大鎧、胴丸與晚期具足各自構成候選，沒有把三套混成一套；歷史型制精度仍待專門審圖，沒有宣稱照片級考證通過。

## C. 法蘭克正式修正

[普通／8736bad 舊精銳／新單手版](boards/frankia-before-after.webp) · [右手、左腕／盾內側、肩盾連接特寫](boards/frankia-anatomy.webp)

- **右手單持**唯一一根短木柄，只有一個中心斧座和兩側相對斧刃；尺寸符合單手握持，沒有第二把斧或背後重複武器。
- **左手持盾**，藍底金鳶尾花盾位於左側防護位置，左肩到上臂／前臂連續。部分左手與盾柄被盾遮擋；可見腕部與部分手套，隱藏手指不能逐指核數。沒有用塗黑手法消除手臂，也沒有把盾改回背上。
- 整體檢視只見兩條手臂、一隻完整右手及部分左手，沒有第三手／第三臂、懸空斧柄、柄穿身體或頭盔。右手與斧柄接觸、斧座及雙刃連接也逐一放大看過。
- 保留原有鐵盔、鎖甲、局部肩片、披風、皮革及藍金軍隊語言；普通版沒動。這是 `PASS_SELF_REVIEW`，玩家／獨立肢體複審仍 **待驗**；任何新發現的多肢體或重複武器直接 FAIL，總分不能抵銷。

只原位替換 `public/art/unified/units/elite.guard.civ_frankia.webp`，512×512 RGB WebP，36,062 bytes，較 8736bad 的33,486增加2,576 bytes，解析度／解碼記憶體規模相同。Registry 檔案逐 byte 不變，卡面與詳情仍走原路徑、原載入與裁切流程。

canonical `assets.json` 仍為198個活躍輸出，批次從50增至51。舊法蘭克 cell 標記 `supersededBy`，原稿、來源、舊卡與歷史評分保留；新資產記錄 `supersedes` 及8736bad舊SHA。歷史生產腳本若會重裝已被取代的卡，會拒絕執行；全套生產器依既有supersession跳過舊cell，避免恢復雙手斧。先前兵種／城郊驗收資料不重生，以明確的後繼記錄綁定新卡，舊圖板仍是當時快照。

## D. 視覺與技術驗證

[七張輸出與完整來源](outputs.json) · [八張原始生成歷史](generation-history.json) · [ART-GATE 分項](art-gate.json) · [保護清單](protected.json) · [瀏覽器檔案及程式 SHA](browser-manifest.json)

依 [美術聖經 v1.0](../../art/列國征途_美術聖經_v1.0.md) 與 [v1.1](../../art/列國征途_美術聖經_v1.1.md) 的 ARMY-PORTRAIT 流程。每次只生成一張；七張交付使用八次呼叫（中國 C 追加一次必要局部編修）。每次實際載入至少普通／現行精銳兩張同類母圖，C修訂另載入其初稿。原始1254×1254 PNG完整保留，等比縮成512再以480px置入512深色背景；無角色裁切、拉伸或事後調色。無文字、卡框、水印、草地基座，完整頭盔／兵器／腳部皆檢視。實際對照暖左上光、人物佔位、材質與筆觸，未用檔案存在推論美術通過。

ART-GATE 自評：法蘭克19、中國A18／B18／C19、日本A19／B18／C18；用途、視角、畫布關鍵項無0。部分候選的64px細節評為1，限制如上。所有中日候選仍是 **PLAYER_CHOICE_PENDING**，沒有由分數自動定稿。

| 檢查 | 本輪結果 |
| --- | --- |
| 格式／尺寸／原稿與參考完整性 | 7張512×512 WebP及8張PNG原稿；提示詞、來源、輸出SHA與參考檔逐張驗證 |
| 正式映射／變更範圍 | 只改法蘭克精銳一張public檔；其餘870個既有資產／遊戲程式／歷史規格檔SHA一致 |
| Art Registry | 全檔SHA不變；六張候選未出現在正式mapping |
| Typecheck／Build | PASS／PASS |
| 相關兵種與顯示測試 | 4 files／26 tests PASS |
| 正式 ArmyView | 320／390／1440px、9個單位含普通／精銳中日法及已保留騎兵，共27案PASS；卡圖及詳情路徑一致，0頁面／HTTP錯誤，六格與排版保留 |
| 候選頁 | 正式Art元件、原圖集裁切、三視窗共48張128px／64px卡面PASS；無橫向溢出。此頁只供審稿，不是正式映射替換 |
| 完整回歸 | 法蘭克正式替換後執行一次實際完整回歸：**2,102 PASS、0 FAIL、1 SKIP**，見validation.json。首次隔離副本複製遇/tmp ENOSPC，尚未進入測試；清除先前拋棄式驗證目錄後以原命令再跑，沒有放寬測試／timeout。 |
| 全資產／舊圖板／城郊顯示gate | 結果見validation.json；保留舊驗收來源，明確驗證法蘭克後繼輸出 |
| GitHub push／新版CI | 交付前嘗試一次；以validation.json與回報為準。未成功就標BLOCKED，不引用舊CI |

實際畫面：[候選320px](browser/candidates/320-ABCs.jpg)／[390px](browser/candidates/390-ABCs.jpg)／[桌面](browser/candidates/1440-ABCs.jpg)；法蘭克正式詳情：[320px](browser/army/320-elite.guard.civ_frankia-detail.jpg)／[390px](browser/army/390-elite.guard.civ_frankia-detail.jpg)／[桌面](browser/army/1440-elite.guard.civ_frankia-detail.jpg)。[正式兵種逐案](browser/army/result.json)與[候選尺寸逐案](browser/candidates/result.json)區分記錄，不把候選畫廊當成正式卡片映射測試。

實體手機、玩家選圖與獨立美術／肢體複審均 **待驗**。歷史三項legacy art失敗、B5 E1 HOLD、Astra Gate非PASS維持原意，新的測試結果不覆蓋這些歷史事實。保持原Draft PR #44，不合併、不部署、不關Issue。

## 重現

```sh
python scripts/prepare-elite-review.py                # 僅文件候選
python scripts/prepare-elite-review.py --apply-frank  # 僅已檢視的法蘭克正式卡
python scripts/elite-review-boards.py
python scripts/check-elite-review.py
python scripts/check-art-files.py /tmp/elite-art-files.json
python scripts/check-art-boards.py
python scripts/check-city-visuals.py
npm run typecheck
node scripts/verify-in-isolation.mjs full
npm run build
```

瀏覽器使用既有`art-preview.html`正式ArmyView與獨立`elite-review.html`候選頁。候選頁是scripts驗收入口，未加入production build路由或遊戲操作。所有PNG、WebP、普通母圖裁切、提示詞及未採用C初稿都在本目錄可追溯；完整Git bundle另作雲端下載檔，不提交至Git。
