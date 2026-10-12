# DEMO World Map → v0.30.9 Parity Matrix

日期：2026-10-04｜Formal地形、坐標、規則不因美術改變。

狀態描述 renderer接線；不是逐像素承諾，也不是實機效能PASS。TEMP_DIFFERENT的原因逐列明列，不以「B10再優化」代替原因。

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
| level labels | DEMO showMapCaption語義適配 | RESTORED | 正式site.level | 無 | 標示開啟且近景顯示Lv；城市名稱不畫在地圖 | 符合v0.30.2標示預設關閉 |
| grid | 40×20世界錨定diamond | RESTORED | Formal可見坐標 | 無 | land淺格線，可開關；water/river不畫grid | Grid不改terrain membership |
| labels | 文明單字／Lv；裝置記憶 | RESTORED | 正式文明／據點 | 無 | 預設關閉；不可因進城而偷偷開啟 | 與DEMO相同標示邏輯 |
| selection | selected tile＋浮動資訊窗 | ADAPTED | spatial.at／Formal terrain | 自有城導覽；拓殖坐標傳給整備頁 | 選格高亮；他城資訊／地形／田分布；不點外框冒選邊界格 | B5尚未開放，不提供偵查／出征 |
| hover | dashed tile／座標提示 | RESTORED | Formal terrainAt | 無 | 滑鼠虛線格框，拖曳和離開停止hover | 不沿用legacy Node picking |
| XY | MapFloatPanel＋0～383檢查 | ADAPTED | Formal dimensions | 無 | 原緊湊XY浮窗，居中、可拖、位置保存；整數／越界拒絕 | 唯一維度差異為正式384 |
| overview | 工具列 查看全景 | IMPROVED_FORMAL | Formal terrain／100城 | 無 | ground縮圖也是同一shader；野外據點遠景隱藏 | 無純色工程總覽；維持100與432資料 |
| toolbar | map-tools-v8 compact一列 | RESTORED | UI camera／flags | 無 | ＋／−／⋯／回城／全景／XY／標示／格線／世界工具／最愛 | 取消大按鈕排列 |
| desktop | world-map fills main-surface | RESTORED | FormalWorld | 各功能仍走Formal adapter | 左導航＋主地圖＋右上工具列；canvas方向鍵/Enter | 不建立新桌機Shell |
| mobile | same renderer + pointer pinch + Shell | RESTORED | 相同FormalWorld | 與桌機相同 | 原底部nav與右側一列；雙指以中心移動／縮放，pointercancel不選格 | 正式資料不分叉成mobile engine |
| caravan／settlement overlays | routes線／三角marker／reservation | IMPROVED_FORMAL | Formal logistics／settlements path／timestamps | 治理與拓殖頁發命令 | 原行軍圖層語言套用本批可用路線 | 不畫不存在的Combat resolver |
| 帝國版圖／戰鬥圖層 | worldtools與army disabled | TEMP_DIFFERENT | B4目前無完整B5/B6實體 | 無 | 明示尚未開放 | B5戰鬥與B6政治未完成；啟用舊influence或marches會恢復legacy authority |
| 最愛 | Formal坐標＋裝置preferences | ADAPTED | fieldDistribution＋當前campaign座標 | 無玩法命令 | 五個最愛，顯示糧木石金/坐標；不隨save export移轉 | Formal B4沒有tile_favorite command；呈現偏好不能寫入未知schema |
| LOD／DPR／動態pulse | pixel worker／96MiB ground cache／20k decoration cache | TEMP_DIFFERENT | readonly terrain pixel jobs | 無 | 近景漸進texture、DPR≤2；遠景不畫細景，選取靜態高亮 | B4持續世界快照與DEMO動畫loop不同；動畫pulse／最終LOD與極端手機調教留B10，基本投影／景物／工具已恢復 |
