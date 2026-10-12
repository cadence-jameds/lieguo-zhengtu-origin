# 列國征途 Stage 2 B4 Art Integration Report

日期：2026-10-04（台灣）｜source：**v0.30.8**｜起點：v0.30.7｜交付：Playable #1

**整合與自動回歸完成；桌機／手機瀏覽器視覺、操作 Smoke 尚待玩家驗證。沒有執行 Astra Gate，沒有發布 Sites，沒有開始 B5。**

## 權限與完整性

- v84 是唯一玩法 authority，SHA-256：`9c0dd16d24a947043381968829fce2fc08069374943bf2943f614deb939afd9b`，原文未修改。
- v0.30.7 是 formal simulation／command／scheduler／save／persistence authority，ZIP SHA-256：`d75e89b198890d9e8849f63f7be162aee6f197b642487f11bfcb197b12eeec12`。
- `src/game/formal` 36 檔全部逐 byte 保持原樣；engine、world、persistence、runtime.worker、useGame 的 simulation path 沿用。沒有重跑／重寫 B2～B4 實作，只有必須的回歸驗證。
- v0.30.2 及 DEMO Reuse Art Pack 的 `public/art` 123 檔，與起點／本版逐 byte 相同。新增美術放 `public/art/formal`，沒有覆蓋 DEMO atlas。
- 仍是384×384、100勢力、432據點。DEMO Node、save、world generation、256×256 和玩法數值没有成為正式資料來源。renderer／adapter 不寫入 FormalWorld。
- 本批 appVersion 升0.30.8；B4 content、ruleset、schema、generator、terrain tags不變。v0.30.7 native B4 save 可由相同 codec讀取；不是 DEMO migration，也不擴張B2／B3批次相容契約。

## 沿用與新製作

直接沿用 terrain、water、riverbank、trees、mountains、ground details、world resources、scenery bounds、城內三視覺時代底景、城郊底景、四資源母圖、建築三時代 atlas、六文明中心／城堡、地洞、施工素材、cities-age-0～2、wall-ring-0～2、三種 catalog atlas、文明徽記和猩紅獅王品牌圖。123檔全部保留，實際接線項目見 Manifest；保留不等於本批每張都顯示。

新增獨立透明512×512 WebP母圖共10張：市政廳、修道院、磨坊、鋸木場、石匠工坊、鑄幣所、鐵匠鋪、大使館、戰矛兵、投石機。以DEMO building atlas為風格參考，用內建圖片生成；戰矛兵另修成投擲姿勢＋備用短矛，避免與槍兵混淆。PNG來源、題材、最後修正記錄在 `docs/art-source/formal`。WebP只做尺寸／格式交付，保留alpha；透明像素中的RGB不代表有不透明色塊。每棟使用同一底部anchor模型，不畫每級版本。

新增10個160×160原生SVG科技類別母圖：情報、軍事操典、馬術／育種、徵兵制度、物流、工程、攻城、行政、精銳化、科研協同。共用金色線條／深綠框，提供小型可縮放類別識別，沒有新增67張大插畫。另有64×64統一UI icon系列（人口、住房、資源、施工、槽、商隊、輜重、預約、科研、funding、queue、軍事、Elite、Age、里程碑、City、統治初定、拓殖、護衛、旅途、容量、Lv等）。部分預備icon保留而未在目前UI出現，Manifest實體附表明列。

## Formal → Art

`src/game/presentation/artMap.ts` 是明確的單向presentation mapping。機器表：`docs/playable/formal-art-map.json`。

| Formal civilization | DEMO alias／圖集index |
|---|---|
| civ_zhongguo | civ_zhongguo／0 |
| civ_byzantium | civ_byzantion／1 |
| civ_frankia | civ_frankia／2 |
| civ_britannia | civ_britannia／3 |
| civ_japan | civ_japan／4 |
| civ_mongolia | civ_mongol／5 |

未知文明會明確拒絕，不靜默落到中國。正式ID／存檔ID不變。

| Formal building | DEMO alias |
|---|---|
| center | hall |
| residence | house |
| warehouse.* | warehouse |
| bunker.* | cellar |
| market | market |
| barracks | barracks |
| archery | range |
| stable | stable |
| academy | academy |
| workshop | workshop |
| castle | castle |
| townhall／monastery／mill／lumbermill／masonry／mint／blacksmith／embassy | 本批獨立母圖 |

| Formal age | visualAge／presentation |
|---|---|
| Dark | 0 |
| Feudal | 1 |
| Castle | 2 |
| Imperial | 2＋帝王 badge／地圖「帝」標記 |

程式不要求 `cities-age-3.webp` 或 `wall-ring-3.webp`。

## 世界renderer沿用範圍

不是直接掛回DEMO WorldMap和legacy engine，而是保留其成熟投影、圖集、crop、圖層、操作思路，建立FormalWorldMap讀Formal terrain和SpatialIndex。

- 沿用20／10的45°投影與反投影；16×16圖塊暫存、terrain texture、正式水格材質、由正式相鄰地形決定河岸位置。
- 樹／山／地面細節使用sceneryAtlas的裁片；擺放變化只影响視覺。依深度排序並避開城市／據點格，renderer不產生地形。
- 近景城市沿用六文明city atlas，綠框＝自有、灰框＝其他正式勢力；沒有在B6之前發明友敵外交關係。
- 四資源／盜賊以world-resources固定crop0／1／2／3／6，加Lv文字；Formal Lv1～10均不需要新增圖。新局生成的實際等級分布仍沿用Formal B2。
- zoom、拖曳、雙指縮放、XY浮窗可拖動、選取、hover資訊、標示／格線切換、回城、全景、尋找五類據點。
- 由SpatialIndex可見範圍取城市與據點；近景scenery、chunk cache和遠景overview暫存均為ephemeral，不存進save。overview只縮小畫面，世界仍384×384。
- 商隊／拓殖路線與marker只讀正式shipment／settlement路徑與時戳；目的地reservation從正式資料顯示。未接戰鬥、攻擊、偵察或易主resolver。
- 最終LOD、帝國影響區、戰鬥圖層、高級動畫和極端手機效能仍留B5+／B10。

## TownScene integration

`FormalCity → citySnapshot → cityPresentation → CityScenes`。直接沿用DEMO TownScene的16個腳底anchor、三時代底景、BuildingSprite、ConstructionSprite與CSS composition。因原TownScene含legacy Node／buildDuration，未讓那段authority進入正式scene；新component讀正式queue的startsAt／durationMs。

center固定中央；formal自由slot0～14映射其餘15anchors。重複倉庫／地洞由完整formal identity映射；施工前配置的slot顯示Lv0與施工覆層。點場景開建設管理，真正升級由Worker command提交；新建築仍由正式引擎選第一空槽，UI不私下改slot。wallLevel0不畫完成城牆；>0用visualAge母圖。

## OutskirtsScene integration

沿用DEMO18anchors、城郊底景、ResourceSprite、施工素材與中央MiniatureCity。每田依formal slot定位，Lv0～15顯示正式數字。新局為6糧／5木／4石／3金；拓殖後城市若正式座標資料有不同專精，adapter忠實讀其fields，不覆寫為起始田型。點田可查看下一級成本／工期並提交正式upgrade。

## 科技／兵種／badge

- 28兵種：民兵／槍兵／弓兵／騎兵／衝撞車／斥候用DEMOunits；六文明衛隊用guards；輜重車用technologies的補給車crop，與市場caravan icon分開。
- 輕騎兵／騎士共騎兵母圖，以「輕騎」「騎士」badge分別識別。12精銳用基型／衛隊圖＋ELITE。沒有重畫28兵。
- 67項B4科研需求全部顯式mapping；科技系列用同母圖＋I／II／III，文明專屬用類別母圖＋文明徽記。共圖不合併formal科技ID。
- 科研協同有獨立的三城連結SVG母圖與正式名稱／條件。完整現代資格取得仍留B9，沒有因圖示存在提前啟用現代玩法。
- 人口／住房、資源、施工、City、統治初定、科研、徵兵、商隊、拓殖等接入共用icon；queue與剩餘時間都來自正式snapshot。

## Playable交付與限制

1. `Playable1_v0.30.8.html`：production JS／CSS、全部public圖檔、正式Worker內嵌；沒有外部CDN。以Chrome／Edge下載開啟。本機HTML的Web Locks／Worker支援仍須在實際瀏覽器確認。
2. `列國征途_Playable1_v0.30.8.zip`：production static build＋Windows `PLAY.cmd`／本機loopback伺服器，無須Node/npm/Python；固定localhost:8765，以確保secure-context API。此啟動器在本輪未有Windows實機可執行；提供可檢視原始碼，並同時保留標準static build。
3. 可選 `B4_manual_inspection.realm-save`：通過native schema與codec的測試世界，供後期B4介面快速人工驗證，明確不是正常新局。正常新局仍D7；没有cheat UI或fixture runtime入口。原子匯入會替換目前世界，使用前先匯出備份。
4. 所有操作走useGame→正式Worker→formal commands→原子persistence，持續世界仍每10秒結算保存。

**瀏覽器Smoke限制必須保留：** container未安裝可執行的Chromium；cloud browser封鎖localhost，並明確拒絕file協定。沒有繞過其政策，沒有偽造桌機／手機截圖或將build當UI實測。正式Playability的人工驗收仍是玩家下一步；HTML／ZIP已實際產出供其開啟。

本批沒有宣稱手機效能、720h、真正離線補算或全瀏覽器file API支援已驗收。Windows launcher也沒有實機PASS宣稱。

## 自動驗證

| 測項 | 結果 |
|---|---:|
| B1 formal regression（含R1） | 71 PASS |
| R1獨立重跑 | 12 PASS（已含於71，不重複加總） |
| B2 | 15 PASS |
| B3 | 23 PASS |
| B4 | 66 PASS |
| 新presentation／asset／native persistence／mapping export | 14 PASS |
| 最終合併回歸 | 189 PASS／0 FAIL／0 SKIP |
| typecheck | exit0 |
| production build | exit0 |

額外兩項native persistence測試使用真FormalPersistence＋fake-indexeddb，沒有mock storage：正常新局→田／中心command→scheduler完成→export→reload→故意checksum損壞→Recovery；另以明確fixture執行科研、軍事、拓殖整備、商隊和時代命令，存讀並推進17世界時確認完成。這是非瀏覽器整合測試，沒有冒充UI操作。開發兩次錯誤（測試未等排隊中心完成、fixture里程碑誤填2000）只修正fixture／等待目標，不改simulation；原失敗log留Evidence。

資產驗證包括所有19建築、28兵、67科技、6文明別名、帝王→visual2、所有視覺時代施工路徑、16／18anchor唯一、scene markup、五類據點crop、UI paths與無legacy authority。單檔包另做syntax、內嵌asset／Worker檢查和ZIP／tree byte驗證。

## 後續邊界

B5：Combat／Raid／Conquest／Scout／牆破壞／戰報玩法；B6政治／外交／帝國版圖；B7流亡；B8AI策略；B9現代／奇觀／終局。B10：每級建築田、帝王專atlas、精銳獨立插畫、動畫、DPR尺寸、極端mobile polish、最終LOD與色調精修。全部未開始。

**STOP：交付本批checkpoint，等待玩家實際試玩。**
