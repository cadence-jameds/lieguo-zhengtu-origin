# PR #44 城郊貼牆、世界地圖與城內建築比例複驗

本輪接續 `846e98ca1abc6eddda009cd6d08ce4600e2fbeaf`，在同一個 `feat/art-unification-20261028` 分支施工，原 Draft PR #44 保持開啟。**六文明全部檢查與處理；只改顯示，沒有重新生成圖片。** 先前的原圖腳點校準仍保留，本輪把「單格圖集量測」與「實際使用情境」分開校準。

## A：城郊與圍牆

確認是原圖校準後與既有城郊構圖不再完全貼合，並非新圖板縮放錯位。原城郊 `.outskirts-center` 寬30%、top45%；有牆城市 art inset -4%，牆環 inset -9%、寬高118%，另向下移自身高度6%。前／後牆分層、舊 radial mask、這些位置與互動按鈕均保留。上一輪把不列顛／日本／蒙古圖內腳點上移約70px，城郊仍套用同一牆環，因而在前牆內側留出較明顯空帶。

這次在 **帝王＋有牆＋城郊** 的城市圖像層增加文明參數，transform origin 為50%／90%；先等比縮放，再向下平移。沒有更改 mask／牆環素材／圖集裁切，也沒有改按鈕寬高、格位或資源田。無牆與前三時代維持原顯示。

|文明|觀察|等比倍率|向下位移（相對 art 自身高度）|複核|
|---|---|---|---|---|
|中國|原本已接近內牆，前側略可收緊|102.5%|1%|主殿保留高度，前側房群更貼合|
|拜占庭|輕微前側空帶|102.5%|1%|圓頂不裁切，前側屋群接近內牆|
|法蘭克|輪廓較窄，塔樓已夠高|103%|0%|微增橫向佔位，不再向下壓尖塔|
|不列顛|前側空帶明顯；上次腳點上移75px|103.5%|12%|主要以位置收緊，保留廣場|
|日本|前側空帶明顯；上次腳點上移70px|103%|12%|天守群落回內牆範圍，未改建築形狀|
|蒙古|較窄且前側空帶明顯|108%|11%|小幅等比增大帳殿群，前側帳群接近內牆|

判斷依據是實際城郊畫面中的內牆、房群與地面，不再把「圖內腳點相同」當作唯一通過條件。高屋頂在透視上可高於後牆；檢查的是地面房群是否自然留在牆內。機械參數與可見空間不能等同語義分割的土地邊界，最後仍保留玩家審圖。

- 六文明前後：[桌面](outskirts-before-after-1440.webp)、[320px](outskirts-before-after-320.webp)、[390px](outskirts-before-after-390.webp)。
- [六文明四時代實際城郊](six-civilizations-four-ages-in-walls.webp)：黑暗／封建／城堡／帝王同樣的截圖框與拼接倍率。
- 舊的 [原圖四時代比較](../boards/six-civilizations-four-ages.webp)仍是原圖用途的檢查；本輪圖集像素未變，不能用它取代這張實景牆內對照。

## B：世界地圖帝王文明中心

**採用候選 B：110%。** 100%較含蓄，108%已有增加份量但在手機上較接近原版；110%在六文明皆能保留形制並增加辨識度；112%也完成比較，但相對110%的收益小，邊緣與鄰近物件的餘裕更少。城堡與其他時代維持原始 source crop、尺寸及定位。

六文明 ×三種螢幕 ×三個地圖縮放 ×四種候選，共216案。地圖縮放為75%、97.5%（UI顯示98%）、164.775%（UI顯示165%）。現有地圖在約90%後會限制城市圖示本身的最大尺寸，因此98%與165%下城市中心圖片尺寸相同，地格與鄰近物件距離仍隨地圖縮放；這是原有邏輯，沒有更改。

以圖像 alpha 外框底部477～478／512的中點作接地補償，放大同時補回透明底邊，維持原接地位置。記錄真實 canvas drawImage 參數及 transform；162組與100%的對照，腳點差小於0.1px。選取框／選取與點擊計算、文字開關、鏡頭及地圖世界座標不變。帝王小字隨增幅上移，避免壓住屋頂。所有候選都在同一真實渲染器中比較，候選只替換瀏覽器收到的美術常數，沒有增加正式遊戲的候選操作開關。

|畫面|75%|98%|165%|
|---|---|---|---|
|桌面|[四候選×六文明](world-candidates-1440-z0.webp)|[四候選×六文明](world-candidates-1440-z1.webp)|[四候選×六文明](world-candidates-1440-z3.webp)|
|320px|[四候選×六文明](world-candidates-320-z0.webp)|[四候選×六文明](world-candidates-320-z1.webp)|[四候選×六文明](world-candidates-320-z3.webp)|
|390px|[四候選×六文明](world-candidates-390-z0.webp)|[四候選×六文明](world-candidates-390-z1.webp)|[四候選×六文明](world-candidates-390-z3.webp)|

## C：城內建築

此前已有依類型分級的 CSS：城市中心／城堡18%×21%；學院／兵營／馬廄／攻城工坊13.5%×15.5%；市場／靶場／倉庫12.5%×14%；其餘通常11.5%×13%。因此不是「完全未調過」，但新帝王圖的方形畫布與透明留白不同，原有槽位分級不足以代表可見建築大小。

盤點正式20類建築：19類城內 Sprite，加城牆場景。六文明四時代的19類都有前後量測（912列；456對），城牆另由城郊與城內場景檢查。共通功能建築依既有正式映射跨文明共享；城市中心／城堡保留六文明造型，沒有擅自製造新的文明專屬版本。學院、攻城工坊、使館在第二組有效合成城內樣本補足，沒有更改正式 catalog 或存檔。

本輪只在帝王城內的 `town-building-art` 圖像層等比縮放；transform origin 50%／94%，接近圖內接地線。按鈕、城內座標、道路背景、標籤錨點及施工進度錨點均維持原值；靶場標籤例外只作必要的水平避讓，原因見下表。前三時代圖像倍率仍為100%。詳情卡、建築選單不沿用城內放大，避免把場景尺度誤用成資訊卡尺寸。

|建築|帝王倍率（相對本輪前）|理由|
|---|---|---|
|城市中心／Hall|110%（六文明）|主建築增加份量，仍保留各文明形制|
|城堡|中國／拜占庭／不列顛／日本112%；蒙古／法蘭克100%|法蘭克原尖塔已高；蒙古112%候選與靶場的實際輪廓重疊86像素，106%仍有24像素接觸，最終保留100%重測|
|學院／攻城工坊／兵營／馬廄|108%|補足中大型建築的可見體積|
|市場／靶場／倉庫|106%|小幅增加中型建築辨識度|
|市政廳|104%|與中型功能建築銜接，不搶主建築|
|修道院／鑄幣所／鐵匠鋪|100%|原本已有高塔或較完整設備，避免小型建築搶戲|
|民居／地庫／磨坊／鋸木場／石工坊／使館|100%|既有比例可保留；地庫仍維持低矮構圖|
|城牆|100%|牆環與城內背景圖像均不變|

矩形外框相交不等於建築碰撞：塔樓外框的透明角落會與後方屋頂外框相交。本輪再依 alpha >96 的實際輪廓檢查，沒有把矩形碰撞誤報為穿模。另檢查前景城堡是否覆蓋後方靶場標籤；保留格位，將帝王靶場標籤水平避開高塔。原候選不通過時保留診斷、收斂後重拍，不以檔案存在判定通過。

- 完整尺寸：[可讀表格](measurements.md)、[原始量測／來源外框／DOM槽位／接地差](measurements.json)。可見W/H以場景百分比表示，不是遊戲占地數值。
- 六文明城內第一組：[桌面](town-before-after-1440-complete.webp)、[320px](town-before-after-320-complete.webp)、[390px](town-before-after-390-complete.webp)。
- 補足學院／工坊／使館的第二組：[桌面](town-before-after-1440-building-audit.webp)、[320px](town-before-after-320-building-audit.webp)、[390px](town-before-after-390-building-audit.webp)。
- 手機截圖保留正式預設的可橫向捲動近景；畫面邊緣可能看到半棟建築，屬於捲動視窗，完整建築仍在原場景內，可捲動點選。沒有為了截圖縮小整座城市或改成非正式排版。

## 驗證與重現

執行 `scripts/verify-city-visuals-browser.mjs` 取得真實 Chromium 畫面，再以 `scripts/city-visual-report.py` 量測與拼接；`scripts/check-city-visuals.py` 使用純標準庫驗證來源 SHA、同欄位尺寸、倍率、腳點與來源未過期，並加入PR CI。

|檢查|結果|
|---|---|
|Typecheck／Build|PASS／PASS；[記錄](validation/)|
|相關回歸|27 PASS；包含六文明四時代按鈕錨點與世界資料不變、帝王接地補償|
|城郊／城內實際瀏覽器|144 PASS、0 FAIL、0 page／HTTP errors；六文明×四時代×三螢幕×前後，城內每案兩組建築配置|
|世界地圖點擊／文字與施工|72 PASS、0 FAIL、0 page／HTTP errors；54組地圖中心實際點選＋18組雙工程施工顯示|
|世界地圖實際瀏覽器|216 PASS、0 FAIL、0 page／HTTP errors；所有候選都由正式渲染器繪製|
|比例／圖板量測|見 [測試記錄](validation/geometry.txt) 與 [CI gate](validation/city-gate.txt)|
|舊圖板、資產路徑與解碼|PASS；82科技映射、既有城市圖集檢查保留|
|完整隔離回歸|最終完整隔離重跑：2,101 PASS／0 FAIL／1 SKIP；[記錄](validation/full-regression.txt)|
|GitHub PR CI|提交後以原PR #44同一HEAD的Checks為準；實際結果回報於PR本輪摘要|

首輪本機完整隔離在視覺工作並行時，既有100支 ArmyIds繪製測試超過30秒（2,100 PASS／1 FAIL／1 SKIP），保留於 [首輪記錄](validation/full-first-run.txt)。沒有調整測試、放寬timeout或改模擬器；停止重型視覺工作後，完整隔離重跑2,101 PASS／0 FAIL／1 SKIP。

[瀏覽器逐案城郊／城內](browser/result-city.json)、[世界地圖](browser/result-map.json)、[每一格來源與拼接尺寸](board-manifest.json)。所有比較板使用同大小截圖框、同倍率，不依可見外框把某一新圖額外填滿。

本輪沒有改任何 public 美術圖、科技圖、v95、正式玩法、建築效果、正式ID、schema、世界模擬或手機六格功能。Runtime沒有新增圖片下載，只增加小型顯示參數及容器。Build仍為392個預快取項目；頁面新程式增加約2.5KiB，沒有新圖像下載。原稿與先前證據保留。

**待驗：** 玩家最終審圖、獨立 ART-GATE、實體手機與慢網。瀏覽器是桌面Chromium的320／390px模擬，沒有冒充實體手機。自評只針對本輪顯示：視角／材質沿用原圖；接地、牆內構圖、比例層級與點擊保留已以實景及量測複核，不能代替玩家簽核。AGENTS.md 的歷史三個 legacy art failures、B5 E1 HOLD、Astra Gate非PASS仍保留；本輪CI通過不表示推翻那些歷史／正式Gate事實。不合併、不部署。

## 六文明實際 UI 截圖索引

|文明|桌面城郊|320px城內|390px地圖（文字開啟）|390px施工|
|---|---|---|---|---|
|中國|[實景](browser/after-1440-civ_zhongguo-3-outskirts-ui.jpg)|[實景](browser/after-320-civ_zhongguo-3-town-ui.jpg)|[實景](browser/interaction-390-civ_zhongguo-labels-map.jpg)|[實景](browser/interaction-390-civ_zhongguo-construction.jpg)|
|拜占庭|[實景](browser/after-1440-civ_byzantium-3-outskirts-ui.jpg)|[實景](browser/after-320-civ_byzantium-3-town-ui.jpg)|[實景](browser/interaction-390-civ_byzantium-labels-map.jpg)|[實景](browser/interaction-390-civ_byzantium-construction.jpg)|
|法蘭克|[實景](browser/after-1440-civ_frankia-3-outskirts-ui.jpg)|[實景](browser/after-320-civ_frankia-3-town-ui.jpg)|[實景](browser/interaction-390-civ_frankia-labels-map.jpg)|[實景](browser/interaction-390-civ_frankia-construction.jpg)|
|不列顛|[實景](browser/after-1440-civ_britannia-3-outskirts-ui.jpg)|[實景](browser/after-320-civ_britannia-3-town-ui.jpg)|[實景](browser/interaction-390-civ_britannia-labels-map.jpg)|[實景](browser/interaction-390-civ_britannia-construction.jpg)|
|日本|[實景](browser/after-1440-civ_japan-3-outskirts-ui.jpg)|[實景](browser/after-320-civ_japan-3-town-ui.jpg)|[實景](browser/interaction-390-civ_japan-labels-map.jpg)|[實景](browser/interaction-390-civ_japan-construction.jpg)|
|蒙古|[實景](browser/after-1440-civ_mongolia-3-outskirts-ui.jpg)|[實景](browser/after-320-civ_mongolia-3-town-ui.jpg)|[實景](browser/interaction-390-civ_mongolia-labels-map.jpg)|[實景](browser/interaction-390-civ_mongolia-construction.jpg)|

桌面完整建築量測中，主中心可見寬約12.60～12.63%場景寬，高15.16～18.03%；城堡寬11.46～12.89%，高14.31～17.34%。兵營寬約9.14%、市場約8.07%，主建築層級明確；修道院保留原高塔但可見寬約6.75%，沒有把塔高誤當成整座占地。六文明共通建築的來源與可見尺寸相同。放大後接地變化最多0.84px；72組前後的按鈕座標／寬高完全保留。桌面兩組配置中，實際建築輪廓相交與城堡覆蓋靶場標籤均為0像素；外框透明角落的候選相交另有記錄。

648張原始截圖解碼後的RGB像素以38個無損WebP影格集合另存於 [無損來源影格圖集](capture-sheets/)，全數透過每個區塊的RGB SHA256與原截圖逐像素驗證；[來源索引](capture-index.json)保留原JPEG SHA、像素SHA、尺寸、WebP影格序號、矩形與來源名稱。沒有縮放或重繪來源截圖。由封存影格重建後，19張比較板的檔案SHA256全部與封存前相同。原JPEG位元檔保留在工作目錄 `work/city-fit/original-jpeg`，PR另保留72張可直接檢視的最終完整UI JPEG；其餘來源可從無損圖集按索引的frame序號還原像素（Pillow Image.seek(frame)）。`city-visual-report.py`可直接讀取圖集重建比較板，無須原JPEG。來源圖集與比較板均不在public或PWA預快取內。

[648張來源像素校驗記錄](validation/capture-pixels.txt)。來源封存採WebP原生無損影格，同尺寸、相近情境分組以共用重複背景；靜態比較板和72張完整UI例圖仍可直接開啟。這是驗收證據的儲存方式，不是遊戲素材或玩法變更。
