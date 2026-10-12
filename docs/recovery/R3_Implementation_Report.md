# R3｜Formal世界動態與Art整合

基準R2c v0.30.48 HEAD 28b8fdd0928bce59d3cfe0676765263ff65f9937、ZIP cc8ed8c8788e9e93533e11817fc7781793ed432488c89cf748f93c257b3a2765。987來源檔、CRC、bundle及clone Verified。

所有玩家及99AI在途Army均取正式ArmyId/path/segmentTimes/世界時間；補45°binary heading連續方向，維持三態外交色、路徑WeakMap/Path2D cache、route bbox cull、LOD。同一renderer RAF，不新增99AI高頻timer或尋路。修復可見路徑上的軍隊尚未進viewport時動畫提前停掉。renderer唯讀，不更動任何正式時程／兵力／所有權。

最高層動態雙劍沿既有B6：Formal BattleId與combat/siege，AI vs AI亦適用，同地一次、持續Siege不提前消失，formal final立即移除持續圓徽記。B5野外／城市Raid為instant resolver，因此只由新增可相容optional final receipt targetPoint/mission呈現短暂终战闪刀与火花（无持续圆徽记）；不伪造activeBattleState，不改BattleDuration或Resolver公式。hydrate、Recovery、時間回退、receipt清理及reduced-motion不重播終戰flash。

商隊、拓殖、工匠改為所有owner正式civilian route投影，保留原Ship/Project/Craftsman ID，不製造ArmyId。cache累計path距離及返程方向；拓殖actual depart由正式arrivalAt與distance45000反推，不再把ready時刻當dispatch。描繪真實路徑、owned glyph，不顯示敵人cargo、兵種、數量、HP、科技。流亡「流」不受普通文字標示開關隱藏；六文明外城堡CityScenes既有castleCivilizationId/job快照与ArtAsset接线保留。

本批targeted4檔49項PASS、0FAIL；typecheck/build PASS。100個真實Formal dispatch隊列／原始世界384／432验证，10次重复frame cache只有100次miss及1000hits；方向／连续位置、入口cull、真实AI vs AI Lv15 Siege、终战位置、SaveLoad重播、reduced-motion、civilian actual departure。这里的Canvas proxy只验证绘图契约，不能当成Chrome/GPU FPS。初次测试因controlled battlefield尚未放入所需兵力失败，已修正测试setup，原日志保留，未改Formal出兵资格。

真实Browser已尝试但Cloud Chrome无法访问本机origin（ERR_CONNECTION_REFUSED），错误页DOM又被URL policy阻挡；未绕过或更新Sites。Desktop/Phone/Touch/GPU FPS为MANUAL PENDING，见Browser_Evidence及UI Checklist。B5 E1仍HOLD，Lv15自动状态测试不冒充人工E1证据。

Art Delta、UI Smoke、WorldMap Parity随此批保存。R4必须完整正式回归、B6-B8链、100势力模拟、SaveLoad/Recovery/Offline、现代AI策略接口风险及E1证据整理，最终Astra Handoff；Sol不执行Astra Gate，不开B9，不更新Sites。
