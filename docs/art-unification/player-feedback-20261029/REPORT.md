# 玩家八張回饋：指定兵種與城郊接地修正

本輪在既有 Draft PR #44、`feat/art-unification-20261028` 接續施工。施工前核對遠端與本地 HEAD 均為 **5314e0c6c0b450d3a74f0bb7365b13a831bdbdf5**；本機交付 commit 見 Git log／回報；遠端仍為上述 HEAD，尚未推送。GitHub CI 為 BLOCKED，詳見本報告驗證段及 [PR #44](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/44) 最新更新。保持 Draft，等待玩家審圖。

本輪只替換五張指定卡面，以及不列顛、日本、蒙古前三時代有城牆時的城市顯示位置。重甲騎兵、帝王城市與圍牆、世界地圖 110%、城內建築比例、全部科技與其他美術保持原有檔案內容。正式 ID、玩法、數值、存檔及 v95 文件未變。

## 八張正式回饋與五組兵種對照

本輪依對話提供的法蘭克精銳、武士精銳、連弩精銳、輕騎兵、騎士／重甲騎兵，以及不列顛、日本、蒙古四時代截圖逐一處理。Windows 本機路徑不是容器可讀來源；沒有宣稱取得或封存那些本機 PNG。可回退的正式原檔取自上述 HEAD，保存在 [before](before/)。

| 對象 | 本輪修正 | 正式新舊對照 | ART-GATE 自評 /20 |
| --- | --- | --- | --- |
| 精銳連弩衛隊 | 加厚肩甲、胸甲、頸部與前臂防護；維持中國紅／鐵灰與連弩，前弓、彈匣及機構更明確 | [普通／舊精銳／新精銳](boards/unit-china.webp) | 19 |
| 精銳武士侍從隊 | 大型雙肩大袖、寬胸甲、面頰防護、進階兜與頸甲、配刀；保留原有深褐紅日本武士語言 | [普通／舊精銳／新精銳](boards/unit-japan.webp) | 18 |
| 精銳法蘭克擲斧衛隊 | 正常兩臂、兩手握一把雙面戰斧；盾牌固定於背帶，保留藍金鳶尾花 | [普通／硬性 FAIL 舊精銳／新精銳](boards/unit-frankia.webp)；[手部與盾帶特寫](boards/frankia-anatomy.webp) | 19，另列解剖硬閘門 |
| 輕騎兵 | 一根連續槍桿，左後方為鈍尾、唯一槍尖朝右前方；檢視手、韁繩、盾帶與馬腿；保持輕甲與無重馬甲 | [修正前／後](boards/unit-light.webp) | 19 |
| 騎士 | 新獨立構圖採低飽和暗紅／米白／鐵灰，簡單鎖甲、局部板甲、輕裝馬匹 | [正式舊騎士／新騎士／未修改重甲騎兵](boards/unit-knight.webp) | 19 |

[64px 原尺寸對照](boards/units-native-64.png)沒有放大角色或更換標籤冒充升階差異。實際 ArmyView 卡面在三種視窗都是 100px，手機詳情卡為 74px，桌面詳情卡為 100px。中國的肩胸甲與連弩、日本的雙肩大袖及胸甲在實際卡面可辨；日本細部甲片在 64px 較不明顯，第 08 項只給 1 分，未宣稱細節毫無限制。

法蘭克舊精銳依玩家回饋標示 **HARD_FAIL_EXTRA_LIMB_PLAYER_FEEDBACK**，舊高分不再構成本輪通過依據。新候選全圖及手部特寫自檢只見兩手兩臂，雙手連接同一斧柄，盾牌以背帶固定；任何後續發現的多餘肢體、錯誤握持都直接 FAIL，總分不能抵銷。全部新圖仍為 **SELF_REVIEW_CANDIDATE_PLAYER_PENDING**，玩家與獨立審查均 **待驗**。

美術依據是完整閱讀的 [v1.0](../../art/列國征途_美術聖經_v1.0.md) 與既有 [v1.1](../../art/列國征途_美術聖經_v1.1.md)，角色用途 ARMY-PORTRAIT；實際載入原普通版／舊精銳／舊騎兵母圖各至少兩張參考。深色完整背景、3/4 視角、暖側光、歷史材質與寫實手繪均經圖像並排檢視，沒有以檔案存在作為風格通過證據。分項、圖像 SHA 與硬閘門見 [art-gate.json](art-gate.json)。

## 城郊原因與最小修正

不是對照板拼接或圖集分格錯誤。舊三張城市圖集下排三文明的有效底部，在自身單格中明顯高於上排三文明；共用城市 art box 放在圍牆內時，地面薄片底邊露在前牆上方，形成花盆／懸空錯覺。黑暗時代最明顯；封建、城堡仍有較小偏差。

檢查項目包括原圖透明底、圖集分格、`background-size:300% 200%`、mask、art box、`transform`，以及前後牆圖層。沒有發現必須重生或修邊原圖的厚重底座；城牆圖集本身與前後牆裁切／層級可以保留。修正移動既有城市 art layer，使地面進入前牆後方；前牆自然遮擋底部。**未拉伸、未放大、未修改透明底或原始城市／圍牆圖。**

| 文明 | 黑暗原圖接地 y | 封建 y | 城堡 y | art box 向下位移 %：黑暗／封建／城堡 | 帝王 |
| --- | ---: | ---: | ---: | --- | --- |
| 中國 | 450 | 447 | 463 | 0／0／0 | 原樣 |
| 拜占庭 | 453 | 458 | 461 | 0／0／0 | 原樣 |
| 法蘭克 | 463 | 460 | 469 | 0／0／0 | 原樣 |
| 不列顛 | 370 | 417 | 403 | 14.77／5.59／8.33 | 原樣 |
| 日本 | 368 | 429 | 407 | 15.16／3.25／7.54 | 原樣 |
| 蒙古 | 373 | 433 | 407 | 14.19／2.47／7.54 | 原樣 |

[原圖量測 JSON](legacy-measurements.json)的 y 為 512px 單格內 alpha>96 有效外框的下緣，供診斷參考；最終位置以正式城郊前牆遮擋的瀏覽器實景檢視決定，不以腳點數字單獨判定。顯示比例始終不變，位移為響應式 art box 百分比，視窗變窄時一起縮放。新增 `legacyCityGroundOffset` 只對三文明、age 0–2、已有牆的城郊 class 生效。無牆與帝王不帶新 class／CSS variable；外層點擊格位、牆環位置、mask、圖層與其他顯示映射都不變。

### 三文明四時代前後實景

每板上排 before、下排 after，左至右黑暗／封建／城堡／帝王。來源是相同合法測試世界與相同按鈕截圖框；兩版在相同視窗、DPR、倍率截圖。圖板只對完整畫布等比縮圖並置中，未按城市輪廓各自放大。

| 文明 | 320px | 390px | 桌面 1440px |
| --- | --- | --- | --- |
| 不列顛 | [前後](boards/city-civ_britannia-320.webp) | [前後](boards/city-civ_britannia-390.webp) | [前後](boards/city-civ_britannia-1440.webp) |
| 日本 | [前後](boards/city-civ_japan-320.webp) | [前後](boards/city-civ_japan-390.webp) | [前後](boards/city-civ_japan-1440.webp) |
| 蒙古 | [前後](boards/city-civ_mongolia-320.webp) | [前後](boards/city-civ_mongolia-390.webp) | [前後](boards/city-civ_mongolia-1440.webp) |
| 其餘三文明回歸 | [前後一致](boards/city-other-three-320.webp) | [前後一致](boards/city-other-three-390.webp) | [前後一致](boards/city-other-three-1440.webp) |
| 無牆回歸代表畫面 | [前三文明前後一致](boards/city-unwalled-320.webp) | [前三文明前後一致](boards/city-unwalled-390.webp) | [前三文明前後一致](boards/city-unwalled-1440.webp) |

無牆圖板展示三個目標文明；自動回歸另外完整檢查六文明的所有無牆狀態。

完整 UI 截圖範例（更多見 [browser/cities](browser/cities/) 及 [browser/units](browser/units/)）：

- 城郊日本：[桌面](browser/cities/after-1440-civ_japan-2-wall5-ui.jpg)／[320px](browser/cities/after-320-civ_japan-2-wall5-ui.jpg)／[390px](browser/cities/after-390-civ_japan-2-wall5-ui.jpg)。
- 精銳日本實際卡面：[桌面](browser/units/1440-elite.guard.civ_japan-ui.jpg)／[320px](browser/units/320-elite.guard.civ_japan-ui.jpg)／[390px](browser/units/390-elite.guard.civ_japan-ui.jpg)；[320px 詳情](browser/units/320-elite.guard.civ_japan-detail.jpg)。
- 兵種詳情與卡面：[兵種截圖目錄](browser/units/)，依視窗及正式 ID 命名；每個測例均驗證正式 ArmyView 卡圖與詳情圖的真實載入路徑。

## 映射、來源與可回退性

五個既有路徑都在 `public/art/unified/units/` 下原位替換，`artAssets.json` **逐 byte 不變**。44 個正式單位、82 科技與其他建築／文明／四時代映射數量不變。本輪沒有增加不存在的等級或 fallback 圖。

[輸出清單](../../art-source/player-feedback-20261029/outputs.json)逐張記錄新原稿、正式輸出、參考圖、尺寸、SHA256、提示詞與評分；[生成歷史](../../art-source/player-feedback-20261029/generation-history.json)保留八張候選及一次無圖阻擋。中國 v1 的弩形辨識不良、日本 v1 的升階差異不足，都未進正式映射；中國 v2 因工具審核回傳 BLOCKED、未產生圖片，完整提示詞與錯誤紀錄保留，後續使用中性裝備展示提示完成候選。沒有將 BLOCKED 回報為生成成功。

原稿為 1254×1254 PNG。正式轉換使用既有完整畫布流程：等比縮成 512，再以 480px 置入 512px 深色背景，WebP quality 88；沒有拉伸、局部裁切人物或事後調色。五張正式檔合計 **171,124 bytes**，比五張舊檔少 **360 bytes**；解析度與解碼記憶體規模不變。重甲騎兵 SHA256 固定為 `5bf17f041076d421025a0853689a9584c962b5466dae0384664f12ab761ca389`。

[before](before/) 保留五張原正式卡與重甲騎兵副本、舊三城市圖集及原顯示程式。canonical `assets.json` 仍為 198 個活躍輸出；五個舊 cell 標記 `supersededBy`，原批次、原始素材與歷史評分保留，避免全套轉換器把退件卡重新覆蓋回去。新增五個單圖批次，來源合計 50 批。生產腳本可從選定原稿重現相同 SHA。

[protected.json](protected.json)鎖定所有非本輪 public 資產，以及正式 mapping、科技、單位 catalog、帝王城市、帝王牆、世界地圖顯示設定；[compatibility.json](compatibility.json)以來源 SHA 綁定新舊 MiniatureCity/CSS 差異。舊 city-fit 驗收資料未改寫，歷史雜湊差異必須通過本輪嚴格 scope 與瀏覽器證據檢查。

## 驗證與限制

- Typecheck：PASS。
- Build：PASS。
- 相關 Vitest：26 PASS（包含一個新的三文明／時代／牆狀態顯示隔離測試）。
- 完整隔離回歸：**2,102 PASS、0 FAIL、1 SKIP**，使用 `node scripts/verify-in-isolation.mjs full`；[機器驗證摘要](validation.json)。
- 檔案與路徑檢查：50 source batches／198 assets，0 FAIL；正式 art 總量 17,042,430 bytes，沒有新增無關 public 圖。
- 城郊瀏覽器：**288 cases PASS**，六文明 × 四時代 × 三視窗 × 有牆／無牆 × 前後版。144 pairs 中 **27 個預期改動、117 個 PNG byte-identical**；按鈕和前後牆幾何完全相同，0 頁面／HTTP 錯誤，手機六格導覽保留。
- 兵種瀏覽器：**27 cases PASS**，三組普通／精銳、輕騎兵、騎士、重甲騎兵 × 三視窗；正式訓練資格及卡片／詳情圖載入，0 頁面／HTTP 錯誤、0 水平溢位。
- 比較板：22 個輸出（21 WebP 與 1 原尺寸 PNG），來源 SHA 與欄位可追溯；截圖封存前後重新生成，所有圖板 SHA 相同。
- 截圖：387 張擷取記錄，72 張完整 UI／詳情 JPEG 直接提供；其餘原尺寸 PNG 的解碼 RGB 無損封存為 32 個 WebP frame collections，`capture-index.json` 對應原始 SHA、RGB SHA 與 frame。逐 frame 比對原像素，無重繪／縮放；無損封存後的圖板與封存前逐檔同 SHA。此格式只用於驗收證據，不加入遊戲載入。
- **GitHub 推送／CI：BLOCKED**。連接器上傳大型原始圖片時多次未回傳並遭中止／環境重啟；直接 GitHub 連線受到 enforced network policy 阻擋（proxy 403）。本機成果已完整保存，遠端仍為 `5314e0c6c0b450d3a74f0bb7365b13a831bdbdf5`，未移動分支 ref；本輪 CI 尚未啟動，不能引用舊 HEAD 的綠燈當作本輪結果。維持同一 Draft PR，不另開 PR。

瀏覽器使用 Chromium 與正式 Shell／CityScenes／ArmyView，合法合成場景只在測試 harness，沒有加入玩家存檔。實體手機 **待驗**，玩家最終美術審查 **待驗**。沒有以自動測試或自評取代玩家核准。AGENTS 所載三項 legacy art 歷史失敗、B5 E1 HOLD、Astra Gate 非 PASS 及歷史證據保持原意；本輪測試結果不宣告正式發布 Gate。未合併、未部署、未關閉 Issue。

## 重現入口

```sh
python scripts/apply-player-art-20261029.py
python scripts/player-feedback-boards.py
python scripts/check-art-files.py /tmp/player-art-files.json
python scripts/check-art-boards.py
python scripts/check-player-feedback.py
python scripts/check-city-visuals.py
npm run typecheck
node scripts/verify-in-isolation.mjs full
npm run build
```

瀏覽器擷取器 `verify-player-feedback-cities.mjs` 需要目前版及基準 HEAD 的獨立 Vite；兩版 `art-preview` 使用同一個測試用 `wall=0` 覆寫以比對無牆（只在 harness）。`verify-player-feedback-units.mjs` 使用現版正式 ArmyView。工具參數第一項為本機 Playwright 模組路徑；基準版使用 Git 原檔而非手工重建 CSS。新圖生產命令會寫入選定正式輸出，其他 gate 為唯讀檢查。
