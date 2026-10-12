# Formal WorldMap Parity Matrix

| 視覺 | 資料Authority | 契約 |
|---|---|---|
| 軍隊、援軍、聯軍、返程 | FormalArmy.id/path/segmentTimes/departedAt/arrivalAt | ArmyPosition與binary heading；cache/cull/LOD；renderer不能發令或改時程 |
| 持續雙劍 | combat.battles[].BattleId＋phase | siege存在即保留，formal final即移除，最後層繪製；同地不重複 |
| Raid終戰閃刀 | final ResolutionId/BattleId/targetPoint/mission | 短暂冲击且无持续圆徽记；不假冒instant野外战役有多回合activeState |
| 商隊 | ShipmentId/path/dispatchedAt/arrivalAt/returnAt | 全owner、原route返程、无cargo免费显示 |
| 拓殖 | ProjectId/path/distance/arrivalAt | actual departure=arrival-ceil(distance45000)，不是ready完成時刻 |
| 工匠 | Craftsman.id/path/departedAt/arrivalAt/eventId | 自有圖示、外部基礎marker；carrierArmy由正式軍隊承載 |
| 城市／地形／據點 | Formal 384×384 /432 slots /spatial index | 禁止套回DEMO256模型；資產層只讀 |
| 帝國／外交 | R1正式政治scope | 三关系色、真实EmpireId/版图；解散后无孤儿引用 |

保留DEMO視覺技術，不執行DEMO AI六模板。Browser/Mobile MANUAL PENDING；Source只提供Node/DOM渲染断言，不提供假FPS。
