// Only the benchmark build imports this entry. No app/production imports it.
import {createFormalWorld, initialCity} from '../../src/game/formal/generator.ts';
import {initializeCityEconomy} from '../../src/game/formal/economy.ts';
import {initialMilitary} from '../../src/game/formal/military.ts';
import {EventScheduler} from '../../src/game/formal/scheduler.ts';
import {enableAutonomy} from '../../src/game/formal/autonomy.ts';
import {advanceFormalCooperative, submitFormalOrder} from '../../src/game/formal/reducer.ts';
import {advanceOffline} from '../../src/game/formal/offline.ts';
import {FormalPersistence} from '../../src/game/persistence.ts';
import {RuntimeWorkBudget} from '../../src/game/runtimeWorkBudget.ts';
import {validateFormalWorld} from '../../src/game/formal/schema.ts';
import {encodeSave, decodeSave} from '../../src/game/formal/saveCodec.ts';
import {sealProjectionScenario} from '../../src/game/formal/projectionBenchmarkSupport.ts';
import {commandHistory, worldLedger} from '../../src/game/formal/commandLedger.ts';
import {canonicalJSON, digest} from '../../src/game/formal/canonical.ts';
import {HOUSING, BUILDING_CATALOG} from '../../src/game/formal/catalogB3.ts';
import {spatial, invalidateSpatial} from '../../src/game/formal/spatial.ts';
import {buildable, terrainAt} from '../../src/game/formal/terrain.ts';
import {FORMAL_DB_NAME} from '../../src/game/formal/versions.ts';
import {Metrics} from './metrics.mjs';

export const SAVED_AT = 1_800_000_000_000;
const HOUR = 3_600_000;
const suffixOK = s => typeof s === 'string' && /^b10p0-[a-f0-9-]+$/.test(s);
function store(suffix) {
  if (!suffixOK(suffix)) throw Error('Only isolated benchmark database suffixes are permitted');
  return new FormalPersistence({suffix});
}
async function restoreRawArchive(p, raw) {
  // The game deliberately does not import raw archives. This lab-only adapter
  // copies a complete current-format database into a new suffixed database.
  // It never opens any database named by the file and never rewrites checksums.
  if (Object.keys(raw).sort().join(',') !== 'databases,format' || !raw.databases ||
      Object.keys(raw.databases).length !== 1 || !Object.hasOwn(raw.databases, FORMAL_DB_NAME)) throw Error('Unsupported raw archive');
  const data = raw.databases[FORMAL_DB_NAME];
  await p.db.open();
  const names = p.db.tables.map(t => t.name).sort();
  if (!data || Object.keys(data).sort().join(',') !== names.join(',') || names.some(n => !Array.isArray(data[n]))) throw Error('Incomplete raw archive');
  await p.db.transaction('rw', p.db.tables, async () => {
    for (const table of p.db.tables) {await table.clear(); await table.bulkAdd(data[table.name]);}
  });
}
function dimensions(w) {
  return {factions: w.factions.length, ai: w.autonomy?.agents.filter(a => a.eventId).length ?? 0,
    registeredAI: w.autonomy?.agents.length ?? 0, cities: w.cities.length, armies: w.armies.length,
    battles: w.combat?.battles.length ?? 0, ledgerReceipts: commandHistory(w).length,
    commandEvidence: Object.keys(w.commandFacts?.evidence ?? {}).length,
    aiDecisions: w.autonomy?.agents.reduce((n, a) => n + a.decisions, 0) ?? 0,
    aiAccepted: w.autonomy?.accepted ?? 0, aiRejected: w.autonomy?.rejected ?? 0,
    governors: w.governors?.length ?? 0,
    ledgerOutcomes: worldLedger(w).results.reduce((n, s) => n + s.records.length, 0), scheduled: w.events.length,
    completedBuildingLevels: w.cities.reduce((n, c) => n + Object.values(c.buildings).reduce((s, v) => s + v, 0), 0)};
}
export async function fingerprints(w, reports) {
  validateFormalWorld(w);
  const keys = Object.keys(w).sort(), fields = {};
  for (const key of keys) fields[key] = await digest(w[key]);
  fields.fullLedgerArchive = await digest(worldLedger(w).archive());
  fields.fullCommandReceipts = await digest(Array.from(commandHistory(w)));
  fields.commandOutcomes = await digest({retained: worldLedger(w).results, pending: w.ledger?.outcomes ?? []});
  fields.reportHistory = await digest(reports);
  return fields;
}
export async function synthetic({ai = 99, speed = 25, scenario = 'fresh', ledger = 0, seed = 90217, cities = 100, matureDays = 7} = {}) {
  let w = createFormalWorld({campaign: 'b10p0-fixed', seed, speed, offlineHours: 12});
  if (cities > 100) {
    const index = spatial(w), scheduler = new EventScheduler(w.events);
    for (let y = 1; y < 383 && w.cities.length < cities; y++) for (let x = 1; x < 383 && w.cities.length < cities; x++) {
      if (!buildable(terrainAt(w, x, y)) || index.at(x, y).city || index.at(x, y).site) continue;
      const i = w.cities.length, c = initialCity(w.factions[i % 100].id, 'city:b10p0-extra-' + i, x, y, '合成擴張城市', false);
      c.military = initialMilitary(); c.autoLogistics = []; w.cities.push(c); index.addCity(c); initializeCityEconomy(w, c, scheduler);
    }
    if (w.cities.length !== cities) throw Error('Insufficient fixture city tiles');
    w.events = scheduler.snapshot();
  }
  // AI scaling keeps the required 100 native factions and 100 cities. Only
  // 1 + AI factions own cities; the other agents retire under normal rules.
  // This is fixture preparation, never an alternate replay or game rule.
  if (ai !== 99) {
    w.cities.forEach((c, i) => {c.ownerFactionId = w.factions[i % (ai + 1)].id;});
    invalidateSpatial(w);
  }
  enableAutonomy(w);
  if (scenario === 'developed' || scenario === 'combat') {
    // Explicitly artificial completed-state fixture, based on the native generator.
    for (const c of w.cities) {
      c.buildings.center = 10;
      for (const key of ['residence', 'warehouse.0', 'barracks', 'academy', 'townhall', 'market', 'blacksmith', 'stable', 'archery', 'workshop', 'monastery', 'mill']) {
        c.economy.slots[key] = Object.keys(c.economy.slots).length;
        c.buildings[key] = Math.min(BUILDING_CATALOG[key.split('.')[0]].maxLevel, ['residence', 'warehouse.0'].includes(key) ? 15 : 10);
      }
      c.housing = 400 + HOUSING[15]; c.population = 10000;
      c.economy.milestones = [10000];
      for (const f of c.fields) f.level = 10;
      c.stock = {food: 40000, wood: 40000, stone: 40000, gold: 40000};
      if (scenario === 'combat') c.military.units = {militia: 1000, ram: 10};
    }
    for (const f of w.factions) {f.age = 3; if (scenario === 'combat') f.protectionUntil = 0;}
    w = validateFormalWorld(w);
  }
  let history = [];
  if (scenario === 'combat') {
    // Place each defending city on a free, adjacent legal tile. This artificial
    // geometry gives simultaneous real marches, rather than skipping arrivals.
    for (let i = 1; i < 61; i += 2) {
      const c = w.cities[i], target = w.cities[i + 1], index = spatial(w);
      const point = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({x: c.x + dx, y: c.y + dy}))
        .find(p => p.x >= 0 && p.x < 384 && p.y >= 0 && p.y < 384 && buildable(terrainAt(w, p.x, p.y)) && !index.at(p.x, p.y).city && !index.at(p.x, p.y).site);
      if (!point) throw Error('No legal adjacent synthetic battle tile');
      target.x = point.x; target.y = point.y; invalidateSpatial(w);
    }
    // Route/command validation and battle creation use production paths.
    for (let i = 1; i < Math.min(61, w.cities.length); i += 2) {
      const c = w.cities[i], target = w.cities[i + 1];
      const t = submitFormalOrder(w, {commandId: 'command:b10p0-setup-' + i, campaignId: w.campaignId, issuerId: c.ownerFactionId,
        issuedWorldTime: w.time, expectedRevision: w.revision,
        payload: {type: 'army.dispatch', cityId: c.id, mission: 'conquest', target: {kind: 'city', cityId: target.id}, units: {militia: 500, ram: 5}}});
      if (t.ack.status !== 'committed') throw Error('Synthetic battle command rejected');
      w = t.world; history.push(...t.reports);
    }
    const firstArrival = Math.min(...w.armies.map(a => a.arrivalAt));
    const t = await advanceFormalCooperative(w, firstArrival, undefined, new RuntimeWorkBudget().advance);
    w = t.world; history.push(...t.reports);
  }
  if (scenario === 'mature') {
    // Mature foreground fixture: hourly real FormalPersistence checkpoints,
    // rather than pretending a many-day uncommitted offline draft is normal play.
    const p = store('b10p0-' + crypto.randomUUID());
    try {
      await p.acquireWriter(); w = await p.start(w);
      for (let at = HOUR; at <= matureDays * 24 * HOUR; at += HOUR) {
        const t = await advanceFormalCooperative(w, at, undefined, new RuntimeWorkBudget().advance);
        if (t.world.revision === w.revision) break; // Natural extinction pause.
        w = await p.save(t.world, t.reports, w.revision, SAVED_AT + Math.floor(at / w.speed));
      }
      const decoded = await decodeSave(JSON.parse(await p.exportStoredSave('full')));
      w = decoded.world; history = decoded.reports ?? [];
    } finally {await p.db.delete();}
  }
  if (ledger) {
    if (w.ledger) throw Error('Large ledger fixture requires an unsealed world');
    w.revision = Math.max(w.revision, 2);
    w.commandReceipts.push(...Array.from({length: ledger}, (_, i) => {
      const c = w.cities[i % w.cities.length];
      return {commandId: 'command:' + (i % 2 ? '' : 'ai-') + 'b10p0-history-' + i, issuerId: c.ownerFactionId, committedRevision: 1, disposition: 'rolled-back',
        fingerprint: canonicalJSON({campaignId: w.campaignId, issuerId: c.ownerFactionId, payload: {type: 'city.rename', cityId: c.id, name: 'synthetic'}})};
    }));
  }
  w = await sealProjectionScenario(w);
  return {world: w, reports: history};
}

export async function prepare(options, text) {
  const suffix = 'b10p0-' + crypto.randomUUID(), start = performance.now();
  let p = store(suffix);
  try {
    let bytes, inputDimensions, sourceFormat = 'portable-envelope', sourceRecovered = false, auxiliaryArchiveVerified = false;
    if (text !== undefined) {
      // importSave applies the full current compatibility, checksum, bundle,
      // Inbox, Recovery and domain authority rules, only to this new database.
      bytes = new TextEncoder().encode(text).length;
      if (bytes > 100 * 1024 * 1024) throw Error('Backup too large');
      const parsed = JSON.parse(text);
      if (parsed?.format === 'lieguo-recovery-archive-v1') {
        sourceFormat = 'raw-current-database-archive';
        await restoreRawArchive(p, parsed);
        // Dexie's non-sticky ready handler runs once per instance. Use a fresh
        // instance to apply the real format check to the copied StorageMeta.
        p.db.close(); p = store(suffix);
        await p.acquireWriter();
      } else {await p.acquireWriter(); await p.importSave(text, false);}
    } else {
      await p.acquireWriter();
      const fixture = await synthetic(options);
      inputDimensions = dimensions(fixture.world);
      const e = await encodeSave(fixture.world, fixture.reports);
      const encoded = JSON.stringify(e); bytes = new TextEncoder().encode(encoded).length;
      await p.importSave(encoded, false);
    }
    const loaded = await p.loadSave(); let w = loaded.game; sourceRecovered = loaded.recovered;
    if (!w) throw Error('Missing isolated world');
    if (sourceFormat === 'raw-current-database-archive') {
      // Validate all portable Inbox/Recovery/domain roots through the existing
      // full-import boundary, in a second disposable database. Keep the primary
      // raw clone's branch/Fence/Inbox; never use the import's switched branch.
      const audit = store('b10p0-' + crypto.randomUUID());
      try {await audit.acquireWriter(); await audit.importSave(await p.exportStoredSave('full'), false); auxiliaryArchiveVerified = true;}
      finally {await audit.db.delete();}
    }
    // Only the synthetic fixture's speed is controlled. Private saves preserve it.
    const before = structuredClone(w); before.revision++;
    w = await p.save(before, [], w.revision, SAVED_AT);
    const initial = dimensions(w), snapshotChecksum = await digest(w);
    return {suffix, setupMs: performance.now() - start, source: text === undefined ? 'synthetic' : 'private-local-backup', sourceFormat, sourceRecovered, auxiliaryArchiveVerified, bytes,
      inputDimensions, initial, snapshotChecksum, worldStart: w.time, speed: w.speed, offlineCapHours: w.offlineHours,
      pendingInbox: (await p.pendingCommands()).length};
  } catch (error) {await p.db.delete(); throw error;}
  finally {p.db.close();}
}

export async function measure(prepared, options = {}, observe, cpu) {
  const p = store(prepared.suffix), budget = new RuntimeWorkBudget(), metrics = new Metrics({observe}), stages = {}, checkpoints = {}, progressSeries = [];
  let lastProgressBucket = -1;
  let stage, stageAt, processed = 0, yields = 0, yieldMs = 0, maxSliceMs = 0, sliceAt;
  const stageChange = next => {
    const now = performance.now();
    if (stage !== next) {if (stage) stages[stage] = now - stageAt; stage = next; stageAt = now;}
  };
  const advance = {...budget.advance, yieldControl: async boundary => {
    const at = performance.now();
    if (boundary === 'event') maxSliceMs = Math.max(maxSliceMs, at - sliceAt);
    const span = metrics.enter('yield:' + boundary);
    try {await budget.advance.yieldControl(boundary);} finally {metrics.leave(span);}
    yields++; yieldMs += performance.now() - at; sliceAt = performance.now(); observe?.();
  }};
  try {
    await p.acquireWriter(); // Startup lock acquisition is outside loadWithOffline.
    // All measurements begin after isolated import; new worker can cold-load it.
    globalThis.__b10p0 = metrics; observe?.();
    await cpu?.start();
    const at = performance.now(); sliceAt = at;
    const result = await p.loadWithOffline(SAVED_AT + (options.hours ?? 12) * HOUR, (s, fraction, events) => {
      if (s === 'offline' && stage === 'read') checkpoints.afterRead = metrics.result();
      if (s === 'save' && stage === 'offline') checkpoints.afterReplay = metrics.result();
      stageChange(s); if (events !== undefined) processed = Math.max(processed, events);
      if (s === 'offline' && typeof fraction === 'number' && typeof events === 'number' && Math.floor(fraction * 20) > lastProgressBucket) {
        lastProgressBucket = Math.floor(fraction * 20); progressSeries.push({fraction, events, elapsedMs: performance.now() - at});
      }
    }, advance);
    const totalMs = performance.now() - at;
    if (stage) stages[stage] = performance.now() - stageAt;
    const cpuProfile = await cpu?.stop();
    delete globalThis.__b10p0; observe?.();
    if (!result.game || metrics.events !== processed) throw Error('Incomplete benchmark event accounting');
    const stats = metrics.result(), final = dimensions(result.game);
    // Full-authority readback and comparison are outside the timed load/commit.
    const persisted = (await p.loadSave()).game;
    const reports = await p.db.BattleReports.toArray();
    const proofFields = await fingerprints(result.game, reports);
    const persistedFields = await fingerprints(persisted, reports);
    if (canonicalJSON(proofFields) !== canonicalJSON(persistedFields)) throw Error('Atomic readback mismatch');
    return {format: 'b10p0-offline-profile-v1', scenario: options.scenario ?? 'fresh', aiRequested: options.ai ?? 99,
      seed: prepared.source === 'synthetic' ? options.seed ?? 90217 : undefined,
      maturityDaysRequested: options.scenario === 'mature' ? options.matureDays ?? 7 : undefined,
      hours: options.hours ?? 12, requestedCities: options.cities ?? 100, requestedLedger: options.ledger ?? 0, ...prepared, suffix: undefined,
      totalMs, stages, replayEventsPerSecond: processed / (stages.offline / 1000), events: processed,
      yields: {count: yields, totalMs: yieldMs, maxObservedWorkSliceMs: maxSliceMs,
        requestedBudgetMs: 8, note: 'Whole events can exceed 8ms; timer wait includes host scheduling. Final validation/commit is outside replay yields.'},
      advancedWorldMs: result.summary.advancedWorldMs, final, statistics: stats, checkpoints, progressSeries, cpuProfile,
      equivalence: {atomicReadback: true, fields: Object.keys(proofFields), fingerprints: proofFields},
      limitations: ['Import/setup excluded from load total', 'No renderer or WorldStream cost', 'No pending Inbox command execution after load', 'Single run unless repetitions supplied']};
  } finally {delete globalThis.__b10p0; p.db.close();}
}
export async function cleanup(prepared) {const p = store(prepared.suffix); await p.db.delete();}

export async function parityProbe(ai = 99) {
  const fixture = await synthetic({ai, speed: 1});
  const original = await digest(fixture.world), expected = advanceOffline(fixture.world, SAVED_AT, SAVED_AT + HOUR);
  const {advanceOfflineCooperative} = await import('../../src/game/formal/offline.ts');
  const metrics = new Metrics(); globalThis.__b10p0 = metrics;
  let actual;
  try {actual = await advanceOfflineCooperative(fixture.world, SAVED_AT, SAVED_AT + HOUR, undefined,
    {yieldIntervalMs: 0, yieldBeforeStart: true, yieldControl: async () => {}});} finally {delete globalThis.__b10p0;}
  return {same: await digest(actual) === await digest(expected), inputUnchanged: original === await digest(fixture.world), events: metrics.events};
}
export {decodeSave, spatial};
