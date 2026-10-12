# R3 Art Delta Manifest

沿用B4與v0.30.2 DEMO視覺，不替換384正式世界資料、原UI或三主題。

| 分類 | 實際來源／接入 | 正式資料與畫面 |
|---|---|---|
| REUSE | public/art/world-terrain-023.webp、world-riverbanks-0301.webp、world-resources.webp、world-trees-0299.webp、world-mountains-0299.webp、world-details-0299.webp | FormalWorldMap terrain/city/wild場景、原cache/culling |
| REUSE | public/art/castle-civ_zhongguo.webp、castle-civ_byzantion.webp、castle-civ_frankia.webp、castle-civ_britannia.webp、castle-civ_japan.webp、castle-civ_mongol.webp | CityScenes直接取city.castleCivilizationId／建造job快照，既有六文明外城堡接線KEEP |
| REUSE | PoliticsView／FormalWorldMap帝國區域色、empireOf、正式關係色 | 帝國名與版圖對應，零帝國不留權限／版圖；友好綠／戰爭紅／中立灰 |
| ADAPT | armyOverlay Canvas triangle＋ArmyRouteCache | 所有100owner實際ArmyId/path/segmentTimes，45°方向、连续位置、援軍／聯軍／返程；無敵軍数量/HP/科技提示 |
| ADAPT | paintBattleMarker既有交叉雙劍與火花 | Formal BattleState/BattleId持续主战／Siege，最高繪製層、同地去重、正式結束移除 |
| ADAPT | final receipt targetPoint/mission＋BattleImpacts | 城市／野外Raid瞬时终战闪刀火花，沒有持续圆形战役徽记；hydrate/recovery/reduced-motion不重播，不创建BattleState |
| ADAPT | civilianOverlay独立Shipment/Project/Craftsman路线cache | 所有AI與玩家商隊、拓殖、工匠實際在途／返程；不伪造ArmyId，不每frame尋路；ready后等待不當作已出發 |
| ADAPT | 既有流亡「流」glyph | 活躍ExileSite明確「流」，不依一般標示開關隱藏；LOD沿正式地圖规则 |
| REUSE | ExtinctionView工匠⚒、CraftsmanPanel、RebirthView | owner合法工匠位置／轉移／付費城堡與玩家復國入口；无AI复国特权 |
| NEW | GovernanceView/GovernorControls＋原card/css | 五方針、支出／保留量、狀態、owned controls及分頁；沒有新增bitmap或另設計一套UI |
| DEFER | B9奇觀／完整現代兵種、B10大規模整體UI、B11長測 | 尚未授權本輪施工，未把基本Army動畫推遲到B10 |

影響：Art基於Formal系統；renderer不拥有命令、战果或所有权。所有新粒子/flash只用于呈現真实receipt，永不改变Scheduler时间。reduced-motion关闭双剑摆动／spark／终战flash；功能性实时位置仍更新。

人工Browser/Mobile/触控/GPU FPS：MANUAL PENDING；見Browser_Evidence，未冒稱DOM測試為實機PASS。
