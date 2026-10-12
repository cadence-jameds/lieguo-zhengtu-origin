# B6–B8 DEMO／Formal 世界地圖 Parity Matrix

基準：DEMO v0.30.2；Formal v0.30.40。DEMO source 前綴 `demo/lieguo-v0.30.2/src/game/`；Formal source 前綴 `src/game/`。本文於施工前完成，MISSING 是基準缺口，實作結果另行追蹤。

|項目|判定|DEMO定位|Formal定位|正式資料來源|預期效果|驗收|
|---|---|---|---|---|---|---|
|路線快取|ADAPT|WorldMap.tsx:86-87|FormalWorldMap.tsx:70|Army.path／Shipment.path|Path2D 與 bounds 依路線快照快取|縮放不重建 path；不可見路線略過|
|全勢力行軍|FORMAL_ALREADY_DONE|WorldMap.tsx:134-143|FormalWorldMap.tsx:70|FormalWorld.armies|保留全勢力；移除重複 marker|玩家、多 AI 同時顯示|
|位置插值|FORMAL_ALREADY_DONE|WorldMap.tsx:139|formal/armyPosition.ts:4|path／segmentTimes／departedAt|依正式世界時間插值|不同 speed、存讀檔位置一致|
|配色與任務|ADAPT|WorldMap.tsx:141|presentation/mapRelations.ts|正式政治關係／mission|自己米色，友好綠、敵對紅、中立灰；運輸金色|友好解除後顏色同步|
|交戰圓環|FORMAL_ALREADY_DONE|WorldMap.tsx:143|FormalWorldMap.tsx:70|Army.status engaged|保留橘色脈動；可見物件才重繪|reduced-motion 靜態識別|
|動態雙劍|MISSING|WorldMap.tsx:157-173|FormalWorldMap.tsx:71-74（待新增）|Combat.battles／BattleId／CityId|一目標一雙劍，最後 overlay|AI vs AI、主戰→攻城→結束|
|圖層順序|ADAPT|WorldMap.tsx:145-173|FormalWorldMap.tsx:69-74|正式戰鬥投影|雙劍在城市／名稱／hover 後繪製|記錄 Canvas paint order|
|viewport 裁切|ADAPT|WorldMap.tsx:136-138|FormalWorldMap.tsx:70|army path bounds／position|快取 bounds 裁切路線，裁切 marker|遠方軍隊不觸發連續動畫|
|zoom／LOD|ADAPT|WorldMap.tsx:163|presentation/mapViewRules.ts|camera zoom（純呈現）|marker 尺寸限制；密集畫面格聚合|近中遠景及窄視窗|
|reduced-motion|REUSE|WorldMap.tsx:42,163-170|FormalWorldMap.tsx:66|matchMedia|減少擺動／火花，維持戰鬥圖案|同一戰鬥不因偏好消失|
|地形／快取／Worker|FORMAL_ALREADY_DONE|WorldMap.tsx:terrainCache|presentation/DemoMapCache.ts|正式384世界地形|保留 B4 快取及 Worker|不遍歷147456格重建|
|聯軍／聯防標記|MISSING|WorldMap.tsx:軍事marker參考|formal/armies.ts／FormalWorldMap.tsx|B6 joint／reserve／formal army|同引擎多所有權部隊，集結等待不假行軍|同城聯軍不疊双劍|
|流亡／工匠團|MISSING|既有野外圖示語言|B7新增正式據點／UI|B7 exile／craftsman|流圖示及文明來源|滅國無幽靈marker|
|極端裝置與高階動畫|DEFER_B10|DEMO LOD 參考|B4保留renderer|純呈現|本輪可用動態完成後精修|不得以此延後本輪動態|

## 基準及流程

v91 SHA256 `c6428b647baf5ae7a5439c8534b4dc3212b261606ad20c15f4248d42510ee6c0`；v0.30.40 ZIP SHA256 `1a31aca48f39f77bfb70d8a4f7586684cb45ea6b3a2ae65208f42a687f8ac600`；source-tree 全部相符；Sites version35／commit `c8af4ceece88bebecb9c3c0cf93ca6a337186182`。

附件 v91 在建築章後接 B5 Delta，完整繼承條款參照原始碼隨附 `docs/b5-v91/authority-v84.md` §6.4–6.6、§9–10；v91 Delta 及玩家本輪指示優先。B5 Gate HOLD 不變；本輪依玩家明確流程例外允許 B6–B8 Implementation，正式整合放行仍須關閉 E1。

禁止回接 Legacy gameplay／政治／世界尺寸／存檔。保留 v0.30.40 精簡終戰戰報及 v91 即時戰況。
