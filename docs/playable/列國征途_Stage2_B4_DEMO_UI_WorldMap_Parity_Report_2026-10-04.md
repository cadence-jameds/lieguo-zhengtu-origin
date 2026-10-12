# 列國征途 Stage 2 B4 DEMO UI / World Map Parity Report

日期：2026-10-04（台灣）｜起點 **v0.30.8**｜交付 **v0.30.9 Playable #1 Candidate**

**介面／renderer恢復與自動驗證完成，玩家人工Playable Smoke仍待執行。沒有Astra Gate結論，沒有發布Sites，沒有開始B5。**

## 結果

恢復DEMO「重返河谷」品牌首頁、開始／載入／設定、六文明卡片新局流程、原九項左側導航與可滑動手機底部導航。Formal建設、科技、軍隊、拓殖、治理／商隊、城務紀事與存檔功能接回相應頁面。原城內16anchors、城郊18anchors、FormalArtMap與v0.30.8新增美術保留。

FormalWorldMap改為DEMO的40×20 45°投影、0.75初始zoom、原滾輪／pan／pinch節奏、compact一列工具與居中可拖XY。移植連續地表palette／texture／波紋和次格shoreline算法，河岸使用原bank crop，樹群有0～3組與不同尺寸，山體110～325寬沿Formal山地成帶。景物可跨tile，地形像素不產生玩法規則。

新地圖pixel Worker只接收seed、dimensions、worldLayer及texture，回傳generation-tagged像素。Formal runtime Worker逐byte不變；沒有把renderer worker當simulation。近景pixel工作移離主執行緒，96MiB地表cache與20,000格decoration cache設限；這是基礎防卡頓接線，不是手機FPS／最終LOD驗收。

## Authority與來源完整性

- v84唯一玩法基準，SHA-256 `9c0dd16d24a947043381968829fce2fc08069374943bf2943f614deb939afd9b`；未修改。
- v0.30.8 ZIP SHA-256 `22d446ec5a79bde485de9a9dba34e30a72b934ffde0f79e2272d8cc602a8b45d`；原checkpoint保留。
- `src/game/formal`全部36檔逐byte保持，`runtime.worker.ts`、`engine.ts`、`world.ts`、`persistence.ts`、`saveLock.ts`保持。
- `useGame`只增加switch／save通知與紀事分頁總數供UI顯示，command→Worker→CAS／Recovery的authority沒有改動。
- 全部既有public/art與icons維持原檔；沒有用新圖替換DEMO圖集或v0.30.8新增圖。Home.tsx／legacyGameApp保留為歷史檔，active app只使用FormalHome與新adapter。
- source AST transitive import檢查確認active Home／GameApp／WorldMap不引入legacyEngine／legacyUseGame／legacyWorld／legacyPersistence、DEMO地形生成或舊GameApp。BuildingSprite等使用的舊靜態美術ID只作presentation alias；不作成本／simulation來源。
- schema/content/ruleset/generator/terrain tags不變，只有appVersion為0.30.9。v0.30.8原生B4正式save可讀，不做DEMO migration。測試生成inspection save的appVersion跟隨0.30.9，並非正常開局。
- 正式新局384×384、100勢力／100城市／432據點；每城人口200／住房400／中心Lv1／600×4／全Lv0的6/5/4/3田；六文明與Dark Age保持。

## DEMO UI → v0.30.9 Formal UI Parity Matrix

| DEMO component / feature | v0.30.9 component / feature | 狀態 | Formal data source | Formal command path | 差異 | 原因 |
|---|---|---|---|---|---|---|
| Home 品牌／獅王圖／重返河谷 | FormalHome + BrandMark | RESTORED | FormalWorld.playerFactionId／factions／time／speed | load → FormalPersistence | 保留 DEMO 排版與文字層級；摘要換正式資料 | 恢復同款產品辨識 |
| 開始新遊戲／載入進度 | FormalHome → presentation/Start → GameApp | ADAPTED | FormalWorld summary；Formalcivilization IDs | start → runtime.worker → createFormalWorld → startCampaign；load → loadSave | 六文明卡片、名字、seed、五種速度；不沿用36領主 | v84 D7為100勢力／384世界 |
| 新局文明徽記 | FormalEmblem／CIV_ART | ADAPTED | Formal civilizationId | start.civilizationId | 明確處理拜占庭／蒙古別名 | Formal與DEMO ID不同，不能索引猜測 |
| 新局離線上限選單 | 未提供可變離線上限選單 | INTENTIONALLY_CHANGED | v0.30.8 runtime request／save契約 | 無 | v0.30.8 沒有 per-campaign offlineLimit 欄位與指令；不宣稱完整離線補算已支援 | 本批不能修改Formal save／runtime authority來引入舊DEMO離線設定；需後續正式補算驗證 |
| Home設定／三配色 | ThemeSettings + Dialog | REUSED | 裝置主題偏好 | 無，僅localStorage呈現偏好 | 三主題元件沿用 | 主題不改玩法 |
| Home快速存檔／完整備份／匯入 | FormalHome設定視窗＋GameApp匯入確認 | ADAPTED | Formal save；BattleReports | export mode quick/full；import → importSave | 實際驗證由Worker完成；先確認再替換 | 保留B1原子切換與DEMO拒絕規則 |
| 版本／更新資訊 | releaseNotes／version.json／檢查更新 | ADAPTED | 目前build版本／同origin version.json | 唯讀fetch；離線單檔直接顯示包版本 | 下載包沒有網站遠端部署通道；可查版本，沒有假造可用更新 | 本輪只交付下載包，禁止發布Sites |
| 桌機Top HUD與資源列 | presentation/Shell | RESTORED | citySnapshot → stock／netProduction | 資源按鈕開Modal；轉物流頁 | 人口／住房與駐軍摘要適配Formal資料 | Formal military與DEMO troops shape不同 |
| 人口／住房／產量／倉儲明細 | Shell + resource Dialog | ADAPTED | citySnapshot；productionPerHour；armyUpkeep；storageCapacity；protection | 唯讀；物流命令由治理頁發出 | 糧食已扣軍糧；統治初定反映於淨產量 | 不可拿legacy production計算 |
| 城市名稱／座標／城市切換 | Shell context-city／city-picker／Heading | RESTORED | spatial.owned → CityId | city.rename；切城只是本機呈現 | 桌機顯示名稱（座標）；手機用原下拉列 | 保留玩家熟悉選城邏輯 |
| 世界時間／速度 | Shell world-clock／mobile status | RESTORED | FormalWorld.time／speed | 無 | 開局後不切換速度 | 沿用Formal命令契約 |
| 雙頂部進度條 | Shell Progress | ADAPTED | ageQueue／researchProjects snapshot | age.start／research.start | 時代與科技可同時呈現；完成自動消失 | Formal durationSnapshot為唯一時間來源 |
| Desktop主導航九項 | Shell NAV + left-rail | RESTORED | FormalWorld／目前選城 | 依各正式頁面 | 原項目與順序保留；不每批改GameApp路由 | 後續B5～B9插回此架構 |
| Mobile HUD | Shell mobile-hud-main／mobile-resources | ADAPTED | 正式選城、資源、淨產量、軍隊 | 與桌機相同Formal命令 | 保留城市／時代／駐軍＋四資源；補小型人口時間列 | Formal所需住房與人口不能消失 |
| Mobile底部導航／更多 | MobileNavigation + Dialog | REUSED | 同NAV／view狀態 | 同各頁面 | 元件逐byte沿用；更多放任務、設定、首頁 | 純UI元件沒有舊引擎依賴 |
| Modal／背景點擊／Escape | presentation/UI Dialog | ADAPTED | Formal snapshots／本機視窗狀態 | 確認後才issue正式命令 | 搬移DEMO dialog行為到不含legacy content的模組 | 原ui.tsx含DEMO content／Start，需斷開authority |
| XY／最愛／地圖浮窗 | MapFloatPanel | ADAPTED | 正式座標／地形；裝置位置偏好 | 無；定位僅camera | 居中、標題拖曳、方向鍵移動、記住關閉位置；擴充視窗類型 | 元件純UI沿用，不保存成Formal玩法資料 |
| 城內／城郊視圖 | CityScenes + artMap | ADAPTED | citySnapshot → cityPresentation | building.upgrade／field.upgrade | 保留16／18 anchors與新增母圖；默認隱藏名稱 | 完整保留v0.30.8美術整合 |
| 手機城市放大／滑動／全景 | CityScenes mobile | RESTORED | 相同正式場景 | 無，切view／縮放僅呈現 | 手機默認放大可滑動；一鍵查看全景 | 沿用既有手機操作方向 |
| 建築／資源田資訊窗 | FormalCityPanel + Dialog + Cost | ADAPTED | B3 catalog／construction／fields | building.upgrade／field.upgrade（含lane） | 卡片成本、工期、缺資源、D2門檻及兩佇列；排隊後下一級正確 | 不能用DEMO成本或queue |
| City晉升／D2資格 | 城市建設頁badge／晉升按鈕 | ADAPTED | economy.milestones／cityPromotionCompleted／housing | city.promote | 新增必要正式功能，沒有另換Shell | v84永久資格與當下住房規則 |
| 科技頁／分類／科技資訊窗 | presentation/DevelopmentViews ResearchView | ADAPTED | TECH_CATALOG；本勢力techIds；researchProjects | research.start／research.contribute／age.start | 67項B4映射維持；現代後續能力明示前置 | D1不擴張到一般科技多城付款 |
| 軍隊／徵兵／訓練取消／解散 | ArmyView + unit modal | ADAPTED | UNIT_CATALOG；city.military；milestones | military.recruit／cancel／disband | 28兵種mapping不變；cost與時間讀正式函式；精銳實際轉換可見 | B4機制直接接回DEMO軍隊骨架 |
| 拓殖 | ArmyView 拓殖tab＋FormalDevelopmentPanel | ADAPTED | settlements／military護衛／正式坐標 | settlement.prepare／cancel／dispatch | 保留v0.30.8全部拓殖功能；地圖可將坐標帶回整備表 | 不可用DEMO建城成本、合法性 |
| 治理／多城總覽／城市運輸 | 治理頁 + logistics mode | ADAPTED | citySnapshot；logistics；autoLogistics | logistics.dispatch／logistics.auto.set | 商隊／自動物流嵌回治理頁 | B3/B4功能保留 |
| 天下勢力 | diplomacy-view／faction-grid | TEMP_DISABLED_B5_PLUS | Formal factions／owned城市數 | 無政治命令 | 可查看正式領主列表；外交／軍團停用 | B6尚未完成，不讀legacy政治 |
| 戰報紀事 | reports-view／details／每頁50則 | ADAPTED | Formal BattleReports | reportPage → FormalPersistence.readReportPage | 城務／科研可讀；戰鬥內容尚未開放 | 保持戰報與存檔分離 |
| 攻擊／偵察／戰鬥編組 | 軍隊與地圖頁disabled入口 | TEMP_DISABLED_B5_PLUS | 目前B4資料 | 無 | 只保留入口，不發無效戰鬥命令 | B5 resolver尚未實作 |
| 委任總督／政治帝國／帝國版圖 | 治理與世界工具disabled入口 | TEMP_DISABLED_B5_PLUS | 目前Formal沒有這些完整政策 | 無 | 明列尚未開放 | B6／B8權限邊界，不恢復DEMO gameplay |
| 任務／新手指引 | tasks-view + objectives | ADAPTED | 自有田／軍隊／城市數 | 導覽至正式頁面 | 唯讀完成狀態；沒有獎勵命令 | 任務玩法尚未實作，不能帶回舊reward |
| 戰役設定／存檔／回復點 | settings cards + restore Dialog | ADAPTED | Formal backupList／save summary | sync／load／backups／restore／export／import | 保持回復前確認與原子更新；原存檔失敗保留 | B1與R1 authority不變 |
| 領主改名設定 | 新局領主名稱；遊戲內不提供領主改名 | INTENTIONALLY_CHANGED | v0.30.8只有city.rename命令 | 無領主改名命令 | 城市可改名；領主中途改名暫缺 | Formal command契約不含faction.rename，禁止借用legacy玩家命令 |
| 流亡／現代化／奇觀／勝利頁 | 保留後續擴充路由 | TEMP_DISABLED_B5_PLUS | B4共用資格與ledger資料 | 無B7/B9新命令 | 不宣稱已完成後續玩法 | 本輪STOP於B4 |

## DEMO World Map → v0.30.9 Parity Matrix

| DEMO World Map feature | v0.30.9 component / feature | 狀態 | Formal data source | Formal command path | 差異 | 原因 |
|---|---|---|---|---|---|---|
| projection | mapGeometry.project／inverse | REUSED | Formal坐標 | 無 | (x-y)×20、(x+y)×10，45°與40×20tile不變 | 維度與投影解耦 |
| zoom | FormalWorldMap camera | RESTORED | 呈現camera | 無 | 初始0.75、最高2，wheel係數0.001、按鈕×1.3 | 沿用DEMO手感；全景最小0.045支援384 |
| drag | Pointer capture／pan threshold | RESTORED | 呈現camera | 無 | 6px點擊/拖曳分界；50格camera邊界；cancel不選格 | 修復pinch後誤點，保持原操作 |
| initial camera | home／session camera | ADAPTED | 當前Formal CityId | 無 | 以當前自有城為中心；切頁記住camera，換城重新定位 | 正式版取消首都，不使用legacy capital |
| overview framing | overviewZoom／paintSurface | IMPROVED_FORMAL | Formal dimensions與terrain | 無 | 視窗寬高計算全圖fit，不硬寫256中心 | 384×384仍147,456格 |
| terrain | mapPaint.paintSurface | ADAPTED | Formal worldLayer.terrain唯一membership | 無 | 搬移DEMO連續palette／grain／texture shader，沒有逐格貼色塊 | 不能沿用DEMO generator／terrainEnvironmentAt |
| forest | decorations＋深度排序 | ADAPTED | Formal F格與seedHash | 無 | 0～3個樹組、細樹／高樹／叢林變體，補少量land樹 | 恢復DEMO景物語言；不變可建城規則 |
| trees | world-trees-0299／sceneryAtlas | REUSED | 正式坐標與視覺hash | 無 | 原圖集、bounds，14～61寬變化、flips、跨tile；無tile裁切 | 保留原美術 |
| mountain | decorations ridge＋mountain atlas | ADAPTED | Formal M格連通與間距 | 無 | 稀疏大型110～325寬山體沿正式山地成帶；不靠舊ridge generator | 正式山脈仍不可建城／不可通行 |
| river | wetSurface＋shoreSegments | ADAPTED | Formal R格 | 無 | 世界座標bilinear／subcell contour／波紋，與land區分 | R中心membership保持1；合法性仍由Formal查詢 |
| water | paintSurface水紋 | ADAPTED | Formal W格 | 無 | DEMO terrain atlas水區與shader波紋，深度色調 | world-water-029保留；規則不由像素決定 |
| riverbank | world-riverbanks-0301＋subcell shoreline | ADAPTED | Formal相鄰R/W membership | 無 | 原210×12草／土／石bank pixels沿等高輪廓描繪 | 替換v0.30.8整張riverbank被縮成單線的做法 |
| ground details | world-details-0299／sceneryAtlas.ground | REUSED | Formal dry cells與seedHash | 無 | 48～91寬、透明度0.38、世界座標擺放 | 沿用DEMOtexture與layer思路 |
| scenery layering | decorationCache／sort／city clearings | ADAPTED | 正式城市坐標；readonlydecorations | 無 | 地面細節先、樹山與城市按x+y；城市clearings；sprites不tile clip | 不增加任何Gameplay terrain |
| cities | cities-age-0～2＋CIV_ART／wall-ring | ADAPTED | Formal city owner／civ／age／wall | 點自有城回城市頁 | 六文明atlas、柔和關係overlay、城牆；Imperial用visualAge2＋帝badge | 正式沒有首都／外交友敵；不假造 |
| wild sites | world-resources固定五crop | REUSED | Formal 432 sites／resource／level | 無戰鬥命令 | 糧0／木1／石2／金3／盜賊6，母圖共用 | Lv1～10不變identity |
| level labels | DEMO showMapCaption語義適配 | RESTORED | 正式site.level | 無 | 標示開啟且近景顯示Lv；城市名稱不画在地图 | 符合v0.30.2標示預設關閉 |
| grid | 40×20世界錨定diamond | RESTORED | Formal可见坐標 | 無 | land淺格線，可開關；water/river不畫grid | Grid不改terrain membership |
| labels | 文明單字／Lv；裝置記憶 | RESTORED | 正式文明／據點 | 無 | 預設關閉；不可因進城而偷偷開啟 | 與DEMO相同標示邏輯 |
| selection | selected tile＋浮動資訊窗 | ADAPTED | spatial.at／Formal terrain | 自有城導覽；拓殖坐標傳給整備頁 | 選格高亮；他城資訊／地形／田分布；不點外框冒選邊界格 | B5尚未開放，不提供偵查／出征 |
| hover | dashed tile／座標提示 | RESTORED | Formal terrainAt | 無 | 滑鼠虛線格框，拖曳和離開停止hover | 不沿用legacy Node picking |
| XY | MapFloatPanel＋0～383檢查 | ADAPTED | Formal dimensions | 無 | 原紧湊XY浮窗，居中、可拖、位置保存；整數／越界拒絕 | 唯一維度差異為正式384 |
| overview | 工具列 查看全景 | IMPROVED_FORMAL | Formal terrain／100城 | 無 | ground縮圖也是同一shader；野外據點遠景隱藏 | 無純色工程總覽；維持100與432資料 |
| toolbar | map-tools-v8 compact一列 | RESTORED | UI camera／flags | 無 | ＋／−／⋯／回城／全景／XY／標示／格線／世界工具／最愛 | 取消大按鈕排列 |
| desktop | world-map fills main-surface | RESTORED | FormalWorld | 各功能仍走Formal adapter | 左導航＋主地圖＋右上工具列；canvas方向鍵/Enter | 不建立新桌機Shell |
| mobile | same renderer + pointer pinch + Shell | RESTORED | 相同FormalWorld | 與桌機相同 | 原底部nav與右側一列；雙指以中心移動／縮放，pointercancel不選格 | 正式資料不分叉成mobile engine |
| caravan／settlement overlays | routes線／三角marker／reservation | IMPROVED_FORMAL | Formal logistics／settlements path／timestamps | 治理與拓殖頁發命令 | 原行軍圖層語言套用本批可用路線 | 不畫不存在的Combat resolver |
| 帝國版圖／戰鬥圖層 | worldtools與army disabled | TEMP_DIFFERENT | B4目前無完整B5/B6實體 | 無 | 明示尚未開放 | B5戰鬥與B6政治未完成；啟用舊influence或marches會恢復legacy authority |
| 最愛 | Formal坐標＋裝置preferences | ADAPTED | fieldDistribution＋當前campaign座標 | 無玩法命令 | 五個最愛，顯示糧木石金/坐標；不隨save export移轉 | Formal B4沒有tile_favorite command；呈現偏好不能寫入未知schema |
| LOD／DPR／動態pulse | pixel worker／96MiB ground cache／20k decoration cache | TEMP_DIFFERENT | readonly terrain pixel jobs | 無 | 近景漸進texture、DPR≤2；遠景不畫細景，選取靜態高亮 | B4持續世界快照與DEMO動畫loop不同；動畫pulse／最終LOD與極端手機調教留B10，基本投影／景物／工具已恢復 |


## 驗證結果與證據

| 驗證 | 結果 |
|---|---:|
| B1（含R1） | 71 PASS |
| R1獨立 | 12 PASS（包含在B1，不重複加總） |
| B2 | 15 PASS |
| B3 | 23 PASS |
| B4 | 66 PASS |
| 既有presentation／assets／Formal persistence | 14 PASS |
| 新UI／map parity | 12 PASS |
| 新地圖pixel Worker | 1 PASS |
| offscreen地圖輸出 | 1 PASS（只驗證可重現輸出） |
| 最終合併回歸 | **203 PASS／0 FAIL／0 SKIP** |
| TypeScript typecheck | exit0 |
| production build | exit0 |

Evidence含每批log／JSON、最終合併、transitive UI authority graph、source delta與逐檔hash、Home／desktop／mobile SSR HTML、terrain pixel輸出與offscreen合成、資產路徑與單檔Worker內嵌檢查。SSR結構檢查確認九navigation、四資源、城市座標、16anchors、手機放大與底部導航；**不檢查瀏覽器CSS box或真實pointer操作**。

Offscreen near／river／ridge PNG由Formal terrain、目前mapPaint與原atlas合成，用於核對地表／森林／山脈視覺；沒有加上瀏覽器CSS／grid／河岸canvas後處理，**不是瀏覽器截圖**。算法pixel benchmark一張1200×700約0.7～0.9秒（Node軟體渲染），不能當成手機FPS；實際地圖近景以worker分chunk與cache輸出。

本輪嘗試安裝Chromium未成功（下載內容無法解壓成有效ZIP），環境沒有可執行的瀏覽器。本輪不繞過cloud對localhost／file的限制，不偽造畫面或人工測試結果。

## 具體差異與未驗收

- Formal缺少可變offlineLimit欄位／request與中途領主改名command；這兩個DEMO選項沒有恢復。實作它們需擴張runtime／save，本輪禁止恢復legacy authority。城市改名已可用。
- DEMO的軍團／政治版圖／Combat／偵察／AI總督／流亡／奇觀等入口保留或明示停用；相應正式批次尚未完成。不能用舊engine補空缺。
- 最愛為裝置呈現偏好，按Formalcampaign記5坐標；不寫入未知schema，也不宣稱隨save移轉。
- 遠景隱藏wild sprites、選取為靜態高亮。最終LOD、DPR多尺寸、動畫、Imperial獨立atlas、每級圖仍留B10；基本地圖投影、texture、岸線、樹山與工具沒有推遲。
- 桌機／手機真瀏覽器layout與操作、Windows launcher、手機quota／FPS、真正離線補算、168／360／720h仍未實測。當前Candidate不能宣稱Playable Smoke PASS。

## 重現與試玩

原始碼解壓後：`npm ci --ignore-scripts`、`npm run typecheck`、`npm run test:b1`、`npm run test:b2`、`npm run test:b3`、`npm run test:b4`、`npm run test:presentation`、`npm run build`。需匯出offscreen evidence時先把world-terrain-023解碼為RGBA，再設定PARITY_EVIDENCE並跑mapVisualEvidence，執行scripts/render-parity-evidence.py；詳見Evidence README。

單檔包的Worker Blob以Uint8Array保留原UTF-8 bytes，避免atob字串重新編碼造成中文紀事亂碼；兩個Worker皆與production原檔逐byte驗證相同。素材179項內嵌且路徑0缺失，兩段JS syntax PASS。

Playable ZIP使用localhost:8769與v0.30.8的8765分開，避免舊PWA快取覆蓋新入口；既有戰役以匯出／匯入搬移，原8765進度不受影響。Playable ZIP含production static game、Windows PLAY.cmd／PowerShell localhost啟動器與inspection save。單檔HTML內嵌全部母圖／CSS／production JS、Formal Worker與map pixel Worker，不依賴CDN。file來源的Web Locks／Worker支援仍須實機確認，ZIP使用localhost secure context。

更新的Smoke Checklist附Website／Desktop／Mobile／World Map Visual Parity四大檢查區，保留正式功能與save／Recovery項目。

**STOP：v0.30.9只作Playable #1 Candidate；由玩家試玩後決定Player Feedback Fix。沒有B5、Astra Gate、Sites發布或人工Smoke PASS。**
