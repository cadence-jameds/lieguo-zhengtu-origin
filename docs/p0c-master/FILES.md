> 下表為原A002／cc4階段42檔的可追溯清單；最新C13／C4另修改其中3個正式檔、新增2個測試，現相對b4為44檔（29正式／15測試）、相對main為49檔（32正式／17測試）。[最新實際檔案與blob](../p0c-final-delta/evidence/source-manifest.json)，不以舊manifest冒稱新內容。

# 本輪正式程式檔案

相對原PR21 `b4faa4e188a4b0a456a4af5b94ade2363bcee247`，正式程式HEAD `a002ff21398e08a2410eee4077957c549d57b238`。新增與修改以Git blob、SHA256保存於 [source-manifest.json](evidence/source-manifest.json)。

|檔案|類別|
|---|---|
|[src/game/FormalCityPanel.tsx](../../src/game/FormalCityPanel.tsx)|production|
|[src/game/FormalWorldMap.tsx](../../src/game/FormalWorldMap.tsx)|production|
|[src/game/GameApp.tsx](../../src/game/GameApp.tsx)|production|
|[src/game/commandFeedback.ts](../../src/game/commandFeedback.ts)|production|
|[src/game/formal/aiKnowledge.ts](../../src/game/formal/aiKnowledge.ts)|production|
|[src/game/formal/battles.ts](../../src/game/formal/battles.ts)|production|
|[src/game/formal/demolition.ts](../../src/game/formal/demolition.ts)|production|
|[src/game/formal/economy.ts](../../src/game/formal/economy.ts)|production|
|[src/game/formal/extinction.ts](../../src/game/formal/extinction.ts)|production|
|[src/game/formal/extinctionB7.test.ts](../../src/game/formal/extinctionB7.test.ts)|test|
|[src/game/formal/integrationR4.test.ts](../../src/game/formal/integrationR4.test.ts)|test|
|[src/game/formal/military.ts](../../src/game/formal/military.ts)|production|
|[src/game/formal/p0cExileScout.test.ts](../../src/game/formal/p0cExileScout.test.ts)|test|
|[src/game/formal/p0cQueues.test.ts](../../src/game/formal/p0cQueues.test.ts)|test|
|[src/game/formal/playerFeedback.test.ts](../../src/game/formal/playerFeedback.test.ts)|test|
|[src/game/formal/playerOrderRuntimeP0.test.ts](../../src/game/formal/playerOrderRuntimeP0.test.ts)|test|
|[src/game/formal/queueCapacity.ts](../../src/game/formal/queueCapacity.ts)|production|
|[src/game/formal/reducer.ts](../../src/game/formal/reducer.ts)|production|
|[src/game/formal/reportScope.ts](../../src/game/formal/reportScope.ts)|production|
|[src/game/formal/saveCodec.ts](../../src/game/formal/saveCodec.ts)|production|
|[src/game/formal/schema.ts](../../src/game/formal/schema.ts)|production|
|[src/game/formal/wallDelta.test.ts](../../src/game/formal/wallDelta.test.ts)|test|
|[src/game/game.css](../../src/game/game.css)|production|
|[src/game/orderAdmission.test.ts](../../src/game/orderAdmission.test.ts)|test|
|[src/game/orderAdmission.ts](../../src/game/orderAdmission.ts)|production|
|[src/game/persistence.ts](../../src/game/persistence.ts)|production|
|[src/game/presentation/DevelopmentViews.tsx](../../src/game/presentation/DevelopmentViews.tsx)|production|
|[src/game/presentation/ExtinctionView.tsx](../../src/game/presentation/ExtinctionView.tsx)|production|
|[src/game/presentation/FormalReportsView.tsx](../../src/game/presentation/FormalReportsView.tsx)|production|
|[src/game/presentation/IncomingArmyAlert.tsx](../../src/game/presentation/IncomingArmyAlert.tsx)|production|
|[src/game/presentation/LegionView.tsx](../../src/game/presentation/LegionView.tsx)|production|
|[src/game/presentation/PoliticsView.tsx](../../src/game/presentation/PoliticsView.tsx)|production|
|[src/game/presentation/Shell.tsx](../../src/game/presentation/Shell.tsx)|production|
|[src/game/presentation/craftsmanCastleUI.test.tsx](../../src/game/presentation/craftsmanCastleUI.test.tsx)|test|
|[src/game/presentation/factionRankings.ts](../../src/game/presentation/factionRankings.ts)|production|
|[src/game/presentation/mapRelations.ts](../../src/game/presentation/mapRelations.ts)|production|
|[src/game/presentation/p0cDemoUi.test.tsx](../../src/game/presentation/p0cDemoUi.test.tsx)|test|
|[src/game/presentation/p0cFeedback.test.tsx](../../src/game/presentation/p0cFeedback.test.tsx)|test|
|[src/game/presentation/uiIntegrationV94.test.tsx](../../src/game/presentation/uiIntegrationV94.test.tsx)|test|
|[src/game/runtime.worker.ts](../../src/game/runtime.worker.ts)|production|
|[src/game/useGame.ts](../../src/game/useGame.ts)|production|
|[src/game/presentation/incomingNavigation.test.tsx](../../src/game/presentation/incomingNavigation.test.tsx)|test|

## 原PR21已保留的C9程式

相對main共32個正式程式檔：上述本輪29檔，加原五策略三檔。三檔相對b4faa4e逐位元不變；相對main的完整47個程式／測試檔見 [main-source-manifest.json](evidence/main-source-manifest.json)。

- [src/game/formal/aiAttackStrategies.ts](../../src/game/formal/aiAttackStrategies.ts)
- [src/game/formal/aiActions.ts](../../src/game/formal/aiActions.ts)
- [src/game/formal/autonomy.ts](../../src/game/formal/autonomy.ts)
