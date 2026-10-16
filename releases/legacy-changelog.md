# v0.30.27 — 2026-10-08

- 本輪九項更新：Lv10進階資源美術、DEMO手機導覽、v87盜賊戰利品、城市中心時代晉升、建築等級與均分按鈕、學院與城市中心縮時資訊、野外名稱座標合併、現實情報時間。
- B5盜賊delta先以v0.30.23獨立驗證，再整合v0.30.26主線；守軍與432槽生命周期不變。
- 不開始B6。

# v0.30.9 · 2026-10-04

- DEMO首頁、九項主導航、桌機HUD與手機底部導航恢復；Formal科技／軍隊／治理功能回填。
- 45°世界地圖恢復連續地表、河岸、樹群與山脈；pixel worker獨立於正式simulation。
- 保留v0.30.8 Formal authority、384／100／432、新增美術與save相容。
- 203項自動測試PASS；Playable #1 Candidate，人工Smoke待執行。

# v0.27.20 — 2026-09-27

- 地圖可收藏五組可建城地塊，依糧木石金組成及座標命名；收藏隨存檔和備份匯出。
- 地圖提示恢復固定樣式，切換城市只置中；只替換水域紋理，城郊資源地各等級恢復選取框。
- 六文明三時代有城牆城郊的城市更貼合城牆；拜占庭封建屋頂與學院、市場圖集裁切修正。
- 單批徵兵上限 500；戰報依實際出戰、傷亡與城牆描述戰場，可展開原始紀錄。
- 完整十項修改與驗證紀錄見 [更新清單](docs/UPDATE_BATCH_v0.27.20.md)。

# v0.27.19 — 2026-09-27

- 世界地圖選中的城市與野外資源持續閃動底部菱形框；直接點選不移動畫面，從城市選單切換或重新選同一座時置中。
- 城牆施工進度條及排隊沙漏移除黑色框；校正六文明、三時代的部分施工圖尺寸及有牆城郊城市和圍牆的比例。
- 戰報攻守姓名使用不同顏色，戰鬥詳情加入清楚的展開／收合入口。
- 完整十項修改與驗證紀錄見 [更新清單](docs/UPDATE_BATCH_v0.27.19.md)。

# v0.26.9 — 2026-09-23

- 首頁載入進度獨立整列，下方並排開始新遊戲與匯出存檔，縮短標籤並避免手機按鈕文字拆行。三種主題共用。

# v0.26.8 — 2026-09-23

- 每次離線最多補算現實 24 小時，既有不設上限存檔也套用上限，保留 0／1／6 小時選項。
- 首頁直接匯出最後已保存且檢查碼正確的進度，追算未完成時也能使用；損毀時嘗試有效回復點。
- 本機僅保留最近兩份回復點。新遊戲速度改列遊戲 1 小時需要的現實秒數，移除 48 小時估算。

# v0.26.4 — 2026-09-23

- 修正部分手機瀏覽器在取得 Web Lock 時可能無限停在首頁讀取狀態；鎖定取得新增 8 秒逾時與明確提示。
- 讀取期間不再誤顯示「尚無本機進度」，並避免尚未確認存檔前進入新遊戲流程。
- 不變更 IndexedDB schema、世界資料、平衡或 v0.26.3 地圖美術設定。

# v0.26.3 — 2026-09-23

1. 恢復野外資源、盜賊文字描邊及陰影，不改城市文字。
2. 縮放 ≤0.22（含全區0.13）隱藏野外據點、文字、等級、底框及點選。中距離資源圖示依可見範圍校正為稍微小於首都；素材繪製倍率約70～72%，實際可見比例另計。已核對六文明三時代都市及七種野外素材的可見範圍，避免透明留白使資源圖示比首都大。滑鼠、觸控與鍵盤共用可見性規則。

幾何地圖、地形分布、據點數量、存檔規則保持不變。待更新0/10。

## v0.26.2 — 2026-09-21
- 地圖恢復離散幾何色塊、三角樹木與低矮稜線符號，保留地域生態及種子水系。
- 野外資源／據點文字移除描邊與陰影；城市文字、字級及等級標示不變。
- 提供含程式、美術、依賴鎖定檔及本機啟動說明的原始碼備份。

## v0.26.1 — 2026-09-21
- 恢復平面等角地圖投影與點選，保留地形生態、森林與丘陵符號、256個野外據點。
- 淺白UI選取按鈕的次要說明文字跟隨按鈕前景色，涵蓋文明卡片與分類按鈕；手機與桌面共用。

## v0.26.0 — 2026-09-21

- 連續坡面呈現低地、平地、丘陵、高地；城市、格線、選取框、道路與行軍路徑共用高程投影，滑鼠／觸控／鍵盤使用相同反算。
- 河谷保持低勢、水面沿主流下降、湖泊維持水平；森林依水距、濕度、坡度及海拔疏密分布，可與丘陵共存。保留既有河道，無新增高度戰力加成。
- 丘陵用圆緩坡脊與陰影，森林用成簇樹冠及樹幹；維持簡潔地圖風格及三種UI。
- 資源文字比城市標示小15%，仍保留描邊與陰影，等級文字維持原有大小。
- 據點總槽位由384降至256，64區平均4個，按陸地約3～5個；糧77、木64、石51、金26、盜賊38，獎勵／等級／冷卻不變。
- 舊存檔優先保留既有部隊目標；不得保留的多餘目標待部隊離開後移除，不重置城市和行軍。已滿區域不再補點。

## v0.25.0 — 2026-09-21

- 不再產生或展示水域城址自動修正通知，保留城市修復。
- 偵察戰報記錄四種資源（包含 0）、守軍與援軍、城防類型／等級、觀測時間。庫存僅展示偵察快照，據點重生使舊情報失效。
- 固定 384 個野外槽位，64 區按陸地面積分配約 4～8 個；冷卻 30＋(等級−1)×5 世界分鐘，在缺額區域換位置重生。無私人資源環。
- 新世界糧／木／石／金／盜賊分配為 115／96／77／38／58；普通據點 Lv1 基礎 450 單資源，使用已確認等級倍率，盜賊混合資源約多 17.5%，守軍約多 25%。
- 撤除世界地表貼圖，恢復地域色塊、簡潔地形符號與清晰格線；裝飾地形延伸至可玩區外，但不能選取或建城。
- 新戰役種子決定主河方向、曲線、2～4 條支流與 2～4 個不規則湖泊。舊存檔保留既有水系、城市及行軍進度。

## v0.24.0 — 2026-09-20

- 世界地圖恢復文明文字；其他介面的徽記保留。
- 地形由 7×7 格隨機方塊改為連續地域，跨格紋理與地表混合，保留原河道、水域判定、格線、帝國版圖與分區快取。
- 新開局種子自動隨機，可輸入或重抽，嚴格驗證 0～4294967295；同版本同種子可重現初始地圖。
- 舊存檔城市、資源地配置及已出發行軍路線／抵達時間不重置。陸地地形更新後，新下達的行軍依新地形計算。

# v0.23.0 · 2026-09-20

1. 三種主題統一城市選單、時代與駐軍、分頁、改名、全景按鈕及未讀提示樣式。
2. 時代晉升與科技獨立佇列，可同時進行；舊存檔正在晉升的剩餘時間保留。
3. 新開局速度 1X／3X／6X／10X／50X，預設 1X；舊倍率存檔仍可接續。
4. 所有新開局玩家及 AI 首都固定 6 農田／5 林地／4 石場／3 金礦；其他地塊仍隨機。
5. 世界地圖加入草地、森林、丘陵、平原、水域美術；保留格線、分區快取與帝國版圖淡地形。
6. 六文明專屬徽記用於文明選擇、側欄及地圖城市標記，敵我色框獨立保留。
7. 地圖右侧工具列改為獨立小型方正按鈕，移除整組底框；手機保留易點擊尺寸。

# v0.22.0 · 2026-09-19

1. 中央都市加大，前後城牆分層；移除下方城名。
2. 城防詳細頁改用各時代的局部城牆與城門。
3. 晉升時代同時顯示前置條件與各資源缺口。
4. 手機城內、城郊預設放大操作；名稱切換與底部導覽配色統一。
5. 讀檔逾時或損毀會顯示錯誤，可在確認後刪除本機戰役及回復點重新開始。
6. 復國選址與 XY 指定位置先顯示四類資源地數量。
7. 地圖野外據點只顯示等級，詳細資訊保留名稱。
8. 軍團入團消息只通知自己所屬軍團。
9. 新開局 200 居民；徵兵保留 200，既有存檔人口不回溯修改。
10. 拓殖至少 600 人，移出 400；成本穀 350、木 300、石 650、金 350。
11. 首頁顯示文明、戰役時間、速度及離線設定；新局預設 1X，可選 1X／10X／50X／100X。
12. 城郊與詳細頁共用資源外觀：0～3 級自然地，4 級起完整作業設施。

# CHANGELOG

## 0.21.0 — 2026-09-13

Fourteen authorized updates. See [verification checklist](docs/UPDATE_BATCH_v0.21.0.md).

- Whole-city civilization/era art, optional era walls and connected outskirts landscape; compact device-specific controls in all themes.
- Initial/settled population 400, settlement departure 800, immediate one-person-per-unit recruitment with 400 civilian reserve.
- Repeatable civilian buildings sum completed plot effects; military and academy remain unique.
- Governor garrison targets, population/food limits, mixed recruits and resource-aware construction. Materials policy includes gold.
- City ownership details, larger relation frames, final-pass outlined civilization glyphs, unbuildable-tile information cleanup.
- Political view hides wild nodes; terrain raster work is queued and bounded during zoom, grid and cities retain display resolution.
- Preserve schema 6 and v0.20 save database/content ID. Existing recruits are not charged again.
- New population/governor parameters in `src/config/realm.ts`.

## 0.20.0 — 2026-09-13

City/outskirts overhaul and the six-item authorized batch. See [verification and balance](docs/UPDATE_BATCH_v0.20.0.md).

- New schema 6, separate browser database; old saves are rejected without mutation.
- Eighteen seeded natural parcels per city, level-zero production and independent upgrades; civic construction inside the city.
- New outskirts art, era-specific central settlement, responsive tabs and rename action.
- Mobile vertical map tools, readable city coordinates, faint terrain and overlay grid.
- Permanent Tasks page, conditional onboarding launcher, city-specific logistics.
- City-hour report aggregation with category retention and permanent milestones.
- New economic constants live in `src/config/economy.ts`; existing civic, population, combat and caravan parameters retain their existing modules.

Earlier releases are documented in `docs/UPDATE_BATCH_v0.12.0.md` and previous batch files.

## v0.26.5 — 2026-09-23
- 將尚未發布的 v0.26.4 讀取修正整合至正式版本。
- 取得存檔控制權超過 8 秒直接顯示提示；不依賴瀏覽器回覆取消請求，且禁止逾時後啟動第二個寫入者。
- 讀取失敗可重新讀取，原存檔保留；讀取中不再誤報沒有進度或讓新遊戲進入無法送出的狀態。

## v0.26.6 — 2026-09-23
- 顯示讀取階段與離線追算百分比，新增停止讀取及保留存檔重試。
- 工作引擎逾時改為各階段 10 秒；只有有效前進的追算進度才能延長等待。
- 離線追算以 5 遊戲分鐘分段，定期讓出執行權；讀取期間不排定時更新，且同時最多一個更新待處理。
- 尚未讀取成功時開始新戰役需確認取代主要進度，不自動清除存檔。
- 尚未取得使用者手機上的實際存檔，不能宣稱已驗證其恢復結果。

## v0.26.7 — 2026-09-23
- 以實際 169 城／13,655 戰報存檔重現離線追算瓶頸；維持全量逐事件推進，優化每分鐘產量計算、野外據點上限與戰報索引。
- 相同桌機環境重播存檔 3 遊戲小時，約從 2.16 秒降為 1.43 秒；比對前後完整世界狀態檢查碼完全相同。手機實測時間依裝置而異。
- 開局設定的持續離線或 1／6 小時上限維持供玩家選擇，沒有強制改為限制離線。
