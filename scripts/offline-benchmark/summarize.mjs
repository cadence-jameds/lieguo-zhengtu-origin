import fs from 'node:fs/promises';

export function replayRows(result) {
  const before = result.checkpoints.afterRead?.operations ?? {}, after = result.checkpoints.afterReplay?.operations ?? {};
  return Object.fromEntries(Object.entries(after).map(([key, row]) => [key, {
    calls: row.calls - (before[key]?.calls ?? 0), inclusiveMs: row.inclusiveMs - (before[key]?.inclusiveMs ?? 0),
    selfMs: row.selfMs - (before[key]?.selfMs ?? 0),
  }]).filter(([, r]) => r.calls));
}
export function category(key) {
  if (key.startsWith('yield:')) return 'I';
  if (key.startsWith('native:') || /cloneWorldDraft|cloneReplay|replayClonePolicy|copyHistory/.test(key)) return 'B';
  if (/commandLedger.ts:(findReceipt|commandHistory|appendReceipt)/.test(key)) return 'D';
  if (/spatial/.test(key)) return 'H';
  if (/finishFormalAdvance|finishOffline|validateFormalWorld|normalizeOutcome|pruneCommandEvidence|canonical.ts|commandLedger.ts|saveCodec.ts/.test(key)) return 'J';
  if (/economy.ts|autoLogistics.ts/.test(key)) return 'E';
  if (/battles.ts|combatResolver.ts|armies.ts|routing.ts|military.ts|militaryPower.ts|wildLifecycle.ts|research.ts|settlement.ts/.test(key)) return 'F';
  if (/governance.ts:handleGovernance|autonomy.ts:(handleAutonomy|economicChoices|chooseEconomic|submitAutonomous)|aiActions|aiKnowledge|endgameAI.ts:(?!invalidate)|submitOrderDraft/.test(key)) return 'D';
  if (/retireAutonomy|retireGovernors|extinction|wonder|breakthrough|modernCatchup|victory|politics|diplomacy|growthTasks|endgameAI/.test(key)) return 'G';
  return 'C';
}
export function partition(result) {
  const rows = replayRows(result), totals = Object.fromEntries('ABCDEFGHIJ'.split('').map(k => [k, 0]));
  totals.A = result.stages.read; totals.J = result.stages.save;
  for (const [key, row] of Object.entries(rows)) totals[category(key)] += row.selfMs;
  const recorded = Object.values(rows).reduce((n, r) => n + r.selfMs, 0);
  // Progress/probe bookkeeping and code outside measured wrappers remain in C.
  totals.C += result.totalMs - result.stages.read - result.stages.save - recorded;
  if (!Object.keys(rows).some(key => !key.startsWith('yield:'))) {
    return Object.fromEntries(Object.entries(totals).map(([key, ms]) =>
      ['B', 'D', 'E', 'F', 'G', 'H'].includes(key) ? [key, {ms: null, percent: null, status: 'not instrumented in count mode'}]
      : [key, {ms, percent: ms / result.totalMs * 100,
        note: key === 'C' ? 'Coarse replay work including unsplit B-H and in-replay validation' : key === 'J' ? 'Atomic save only; in-replay validation is unsplit under C' : undefined}]));
  }
  return Object.fromEntries(Object.entries(totals).map(([key, ms]) => [key, {ms, percent: ms / result.totalMs * 100}]));
}
if (process.argv[1]?.endsWith('/summarize.mjs')) {
  const matrix = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
  const cases = matrix.cases ?? [matrix];
  for (const r of cases) {
    console.log(JSON.stringify({scenario: r.scenario, speed: r.speed, hours: r.hours, ai: r.aiRequested,
      ledger: r.requestedLedger, seconds: r.totalMs / 1000, events: r.events, phases: partition(r),
      topSelf: Object.entries(replayRows(r)).sort((a, b) => b[1].selfMs - a[1].selfMs).slice(0, 10)}));
  }
}
