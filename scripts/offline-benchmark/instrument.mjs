import ts from 'typescript';

// Validation build only. No src file or app Vite configuration is changed.
const targets = {
  'formal/offline.ts': ['offlinePlan', 'finishOffline', 'advanceOfflineCooperative'],
  'formal/reducer.ts': ['advanceFormalCooperative', 'finishFormalAdvance', 'replayClonePolicy', 'cloneReplayCommandDraft', 'cloneReplayCityDraft', 'submitOrderDraft', 'completeResearch'],
  'formal/autonomy.ts': ['handleAutonomy', 'economicChoices', 'chooseEconomic', 'submitAutonomous', 'retireAutonomy'],
  'formal/aiActions.ts': ['updatePublicMemory', 'politicalDecision', 'militaryDecision', 'expansionDecision', 'wonderDecision'],
  'formal/aiKnowledge.ts': ['publicSituation'],
  'formal/endgameAI.ts': ['computeThreats', 'publicWonderThreats', 'invalidateEndgameIntel'],
  'formal/militaryPower.ts': ['militaryRanking', 'invalidateMilitaryPower'],
  'formal/wildLifecycle.ts': ['respawnWild', 'populateWild'],
  'formal/economy.ts': ['settleCity', 'productionPerHour', 'administrationMultiplier', 'populationGrowth', 'promoteCityQueues', 'handleEconomyEvent'],
  'formal/autoLogistics.ts': ['runAutoLogistics', 'runWonderAutoSupply'],
  'formal/battles.ts': ['handleCombatEvent', 'resolveCombatRound'],
  'formal/combatResolver.ts': ['exchange'],
  'formal/armies.ts': ['applyArmyCommand', 'scheduleMarch'],
  'formal/routing.ts': ['route'],
  'formal/military.ts': ['handleMilitaryEvent', 'armyUpkeep'],
  'formal/research.ts': ['startResearch', 'completeAge'],
  'formal/settlement.ts': ['handleSettlementEvent'],
  'formal/governance.ts': ['handleGovernance', 'retireGovernors'],
  'formal/extinction.ts': ['resolveExtinctions', 'reconcileExileSites'],
  'formal/wonderCondition.ts': ['reconcileWonders', 'handleRepairEvent'],
  'formal/wonder.ts': ['handleWonderEvent'],
  'formal/breakthrough.ts': ['reconcileBreakthroughs', 'handleBreakthroughEvent'],
  'formal/modernCatchup.ts': ['reconcileCatchup', 'handleCatchupEvent'],
  'formal/victory.ts': ['reconcileVictory', 'hasVictoryCityShare', 'campStatistics', 'victoryConditions'],
  'formal/politics.ts': ['reconcilePolitics', 'reconcilePoliticalEvents'],
  'formal/diplomacyReports.ts': ['diplomacySnapshot', 'diplomacyChanges'],
  'formal/growthTasks.ts': ['syncGrowthTasks', 'captureGrowthEvent', 'recordGrowthEvent'],
  'formal/scheduler.ts': ['replace', 'push', 'pop', 'snapshot', 'discard'],
  'formal/spatial.ts': ['spatial', 'invalidateSpatial'],
  'formal/worldDraft.ts': ['cloneWorldDraft'],
  'formal/schema.ts': ['validateFormalWorld'],
  'formal/saveCodec.ts': ['encodeSave', 'decodeSave', 'validateReportHistory'],
  'formal/commandLedger.ts': ['prepareVerifiedLedger', 'verifyLedgerArchive', 'normalizeOutcomeRevisions', 'findReceipt', 'copyHistory', 'commandHistory', 'appendReceipt'],
  'formal/commandEvidence.ts': ['pruneCommandEvidence'],
  'formal/canonical.ts': ['digest'],
  'persistence.ts': ['loadAnchored', 'commit', 'sanitizeStoredReports'],
  'ledgerStore.ts': ['readLedger', 'readLedgerArchive', 'scanLedgerIdentity', 'writeLedger', 'publishLedgerHead'],
};

export function offlineInstrumentation(detailed = true, cloneSites = false) {
  const matched = new Set();
  return {name: 'b10-p0-offline-benchmark-only', enforce: 'pre',
    transform(source, id) {
      const path = id.split('?')[0].replaceAll('\\', '/').split('/src/game/')[1];
      if (!path || !(path in targets)) return;
      const file = ts.createSourceFile(id, source, ts.ScriptTarget.Latest, true), edits = [];
      const insert = (at, code) => edits.push({at, code, order: edits.length});
      const span = (body, label, before = '', async = false) => {
        insert(body.getStart(file) + 1, `${before}const __b10span=globalThis.__b10p0?.enter(${label});try{${async ? 'return await (async()=>{' : ''}`);
        insert(body.end - 1, `${async ? '})();' : ''}}finally{if(__b10span)globalThis.__b10p0.leave(__b10span);}`);
      };
      function visit(n) {
        if (detailed && ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && targets[path].includes(n.name.text)
            && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) && ts.isBlock(n.initializer.body)) {
          matched.add(path + ':' + n.name.text); span(n.initializer.body, JSON.stringify(path + ':' + n.name.text), '', n.initializer.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword));
        }
        if (detailed && path === 'formal/spatial.ts' && ts.isIfStatement(n) && ts.isBlock(n.thenStatement)) {
          const condition = n.expression.getText(file);
          if (condition === '!cached' || condition === 'cached.time!==w.time')
            span(n.thenStatement, JSON.stringify(condition === '!cached' ? 'spatial:fullRebuild' : 'spatial:armyRefresh'));
        }
        if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.body && n.name) {
          const name = n.name.getText(file);
          if (path === 'formal/reducer.ts' && name === 'advanceOneEvent') {
            matched.add('event');
            const before = 'globalThis.__b10p0?.event(scheduler.peek(),w,scheduler);';
            if (detailed) span(n.body, "'event:'+scheduler.peek().type", before);
            else insert(n.body.getStart(file) + 1, before);
          } else if (detailed && targets[path].includes(name)) {
            matched.add(path + ':' + name); span(n.body, JSON.stringify(path + ':' + name), '', n.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword));
          }
        }
        // Attribute only explicit native clones; no replacement of clone semantics.
        if (detailed && ts.isCallExpression(n) && n.expression.getText(file) === 'structuredClone') {
          const label = 'native:structuredClone' + (cloneSites ? ':' + path + ':L' + (file.getLineAndCharacterOfPosition(n.getStart(file)).line + 1)
            + ':' + (n.arguments[0]?.getText(file).replace(/\s+/g, ' ').slice(0, 80) ?? '') : '');
          insert(n.getStart(file), `(()=>{const __b10clone=globalThis.__b10p0?.enter(${JSON.stringify(label)});try{return `);
          insert(n.end, ';}finally{if(__b10clone)globalThis.__b10p0.leave(__b10clone);}})()');
        }
        ts.forEachChild(n, visit);
      }
      visit(file);
      let code = source;
      for (const e of edits.sort((a, b) => b.at - a.at || b.order - a.order)) code = code.slice(0, e.at) + e.code + code.slice(e.at);
      return {code, map: null};
    },
    buildEnd(error) { if (!error && !matched.has('event')) throw Error('Benchmark event probe did not match reducer'); },
  };
}
