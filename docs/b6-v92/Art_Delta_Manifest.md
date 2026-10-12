# B6 Art Delta

| 類別 | 實際接線 | 狀態 |
|---|---|---|
| REUSE | artMap 六文明 emblem、既有世界 terrain worker、三主題 Shell | 原資產沿用 |
| ADAPT | FormalWorldMap→paintArmies，所有 AI/玩家 path 插值、relations 色彩、返程 | 已接線 |
| ADAPT | paintBattleMarker：DEMO 雙劍擺動／火花，Formal BattleId combat/siege，單城市去重，最後圖層 | 已接線 |
| NEW | PoliticsView 建團／帝國／外交／預備隊／會師命令；帝國名稱與版圖色 | 已接線 |
| DEFER | B7 流／工匠；B9 奇觀及完整現代美術；B10 精修 | 維持原安排 |

軍隊圖形不包含敵方精確兵力、科技、隱藏 HP 或牆耐久；renderer 不持有 commands。路徑 cache／culling／LOD／單一按需 RAF／reduced-motion 沿用。新增路徑內容 cache 識別。沿用圖片路徑见 src/game/presentation/artMap.ts，非僅存在未接線。
