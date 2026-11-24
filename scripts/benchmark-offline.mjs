// Local-only CLI. Reads a backup without ever opening the game's real database.
import 'fake-indexeddb/auto';
import fs from 'node:fs/promises';
import os from 'node:os';
import {resolve, dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync, spawn} from 'node:child_process';
import {Session} from 'node:inspector/promises';
import {PerformanceObserver} from 'node:perf_hooks';
import {getHeapStatistics} from 'node:v8';
import {buildLab} from './offline-benchmark/build.mjs';
import {summarizeCPU} from './offline-benchmark/cpu.mjs';
import {protectPrivateInput} from './offline-benchmark/private-paths.mjs';

const args = process.argv.slice(2), value = (key, fallback) => {
  const i = args.indexOf('--' + key); return i < 0 ? fallback : args[i + 1];
};
const out = resolve(value('out', 'artifacts/b10-p0/result.json'));
await protectPrivateInput(value('private'), [out, value('private-proof')]);
if (args.includes('--matrix') && value('private')) throw Error('The fixed-speed matrix uses synthetic fixtures; run private input cases separately');
await fs.mkdir(dirname(out), {recursive: true});
if (args.includes('--matrix')) {
  const cases = [];
  for (const speed of [1, 10, 25]) for (const hours of [1, 4, 12]) cases.push({speed, hours});
  for (const ai of [0, 25, 50]) cases.push({speed: 25, hours: 12, ai});
  for (const scenario of ['developed', 'combat', 'mature']) cases.push({speed: 25, hours: 1, scenario});
  cases.push({speed: 25, hours: 1, ledger: 60000});
  const from = Number(value('from', 0));
  const results = from ? JSON.parse(await fs.readFile(out, 'utf8')).cases.slice(0, from) : [];
  for (const [i, options] of cases.entries()) {
    if (i < from) continue;
    const file = resolve(dirname(out), `case-${i}.json`);
    const flags = Object.entries(options).flatMap(([k, v]) => ['--' + k, String(v)]);
    const code = await new Promise((done, reject) => {
      const child = spawn(process.execPath, ['--expose-gc', 'scripts/benchmark-offline.mjs', ...flags,
        '--mode', value('mode', 'detailed'), '--out', file], {stdio: 'inherit'});
      child.once('error', reject); child.once('exit', done);
    });
    if (code !== 0) throw Error('Benchmark matrix case failed: ' + i);
    results.push(JSON.parse(await fs.readFile(file, 'utf8')));
    await fs.writeFile(out, JSON.stringify({format: 'b10p0-matrix-v1', cases: results}, null, 2));
  }
} else {
  const options = {
    syntheticSettingsSmoke:args.includes('--synthetic-settings-smoke'),
    configureReplayCopy:args.includes('--configure-25x-copy'),
    requireReplayExtent:args.includes('--require-25x-horizon'),
    speed: Number(value('speed', 25)), hours: Number(value('hours', 12)), ai: Number(value('ai', 99)),
    scenario: value('scenario', 'fresh'), ledger: Number(value('ledger', 0)), seed: Number(value('seed', 90217)), cities: Number(value('cities', 100)), matureDays: Number(value('mature-days', 7))};
  if (![1, 10, 25].includes(options.speed) || ![0, 25, 50, 99].includes(options.ai) || ![1, 4, 12].includes(options.hours)
    || !['fresh', 'developed', 'combat', 'mature'].includes(options.scenario) || ![100, 200].includes(options.cities)
    || !Number.isInteger(options.matureDays) || options.matureDays < 1 || options.matureDays > 30 || !Number.isSafeInteger(options.ledger) || options.ledger < 0)
    throw Error('Invalid benchmark options');
  const mode = value('mode', 'detailed');
  if (!['count', 'detailed', 'sites'].includes(mode)) throw Error('Invalid profiler mode');
  const detailed = mode !== 'count';
  const modulePath = await buildLab(detailed, mode === 'sites');
  const lab = await import(pathToFileURL(resolve(modulePath)).href);
  let prepared;
  try {
    const privateFile = value('private', undefined);
    if(options.syntheticSettingsSmoke&&(privateFile||options.hours!==1))throw Error('SMOKE_SYNTHETIC_ONE_HOUR_ONLY');
    if (privateFile) {
      // Do not echo paths, data, IDs, parser diagnostics or game text to logs.
      try {
        const info = await fs.stat(privateFile);
        if (info.size > 100 * 1024 * 1024) throw Error('size');
        prepared = await lab.prepare(options, await fs.readFile(privateFile, 'utf8'));
      } catch {throw Error('PRIVATE_BACKUP_REJECTED: unchanged source; run the supported game version and inspect locally. No backup content was logged.');}
    } else prepared = await lab.prepare(options);
    console.log('Prepared isolated', prepared.source, prepared.source === 'synthetic' ? options.scenario : 'validated backup', prepared.speed + 'X', options.hours + 'h');
    if (args.includes('--validate-only')) {
      const {suffix: _suffix, snapshotChecksum: _checksum, ...summary} = prepared;
      if (summary.source === 'private-local-backup') {summary.worldAgeDaysAtStart = Math.round(summary.worldStart / 864000) / 100; delete summary.worldStart;}
      await fs.writeFile(out, JSON.stringify({validated: true, ...summary}, null, 2));
      console.log('Compatibility/integrity validation passed in isolated database.');
    } else {
    globalThis.gc?.();
    let peak = 0, samples = 0, gcMs = 0, gcCount = 0, lastEvents = 0, collecting = false, windowStart = Infinity;
    const observe = events => {
      if (!collecting) return;
      peak = Math.max(peak, process.memoryUsage().heapUsed); samples++;
      if (Number.isInteger(events) && events - lastEvents >= 10000) {lastEvents = events; console.log(JSON.stringify({processedEvents: events}));}
    };
    const collectGC = entries => {for (const e of entries) if (e.startTime >= windowStart) {gcMs += e.duration; gcCount++;}};
    const observer = new PerformanceObserver(list => {if (collecting) collectGC(list.getEntries());});
    observer.observe({entryTypes: ['gc']});
    const timer = setInterval(observe, 20), inspector = args.includes('--cpu') ? new Session() : undefined;
    inspector?.connect();
    const cpu = {start: async () => {
      if (inspector) {await inspector.post('Profiler.enable'); await inspector.post('Profiler.setSamplingInterval', {interval: 1000}); await inspector.post('Profiler.start');}
      windowStart = performance.now(); collecting = true; observe();
    }, stop: async () => {
      observe(); collectGC(observer.takeRecords()); collecting = false; observer.disconnect();
      if (inspector) return summarizeCPU((await inspector.post('Profiler.stop')).profile);
    }};
    let result;
    try {result = await lab.measure(prepared, options, observe, cpu);}
    catch (error) {if (privateFile) throw Error('PRIVATE_BENCHMARK_FAILED: source unchanged; no game content logged.'); throw error;}
    finally {clearInterval(timer); observer.disconnect(); inspector?.disconnect();}
    result.environment = {engine: 'Node / fake-indexeddb (not native IndexedDB)', node: process.version, v8: process.versions.v8,
      os: os.type() + ' ' + os.release(), architecture: os.arch(), cpu: os.cpus()[0].model, logicalCPUs: os.cpus().length,
      availableParallelism: os.availableParallelism(), head: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
      instrumentation: detailed ? 'detailed bounded spans' : 'event counter/checksum only', profilerMode: mode, explicitGCBeforeMeasurement: !!globalThis.gc};
    result.environment.v8HeapLimitBytes = getHeapStatistics().heap_size_limit;
    result.environment.cgroupCPU = (await fs.readFile('/sys/fs/cgroup/cpu.max', 'utf8').catch(() => 'unavailable')).trim();
    result.environment.cgroupMemoryLimitBytes = (await fs.readFile('/sys/fs/cgroup/memory.max', 'utf8').catch(() => 'unavailable')).trim();
    result.memory = {sampledPeakHeapBytes: peak, samples, intervalMs: 20, additionalSamples: 'every 256 events and yield', gcMs, gcCount, window: 'timed load only; setup and readback excluded',
      note: 'Sampled high-water mark, lower bound on true peak. Includes benchmark/bundle/profiler retained heap; excludes setup peak.'};
    if (prepared.source === 'private-local-backup') {
      if (value('private-proof')) {
        const proofPath = resolve(value('private-proof')); await fs.mkdir(dirname(proofPath), {recursive: true});
        await fs.writeFile(proofPath, JSON.stringify({eventOrderChecksum: result.statistics.eventOrderChecksum, fingerprints: result.equivalence.fingerprints}), {mode: 0o600});
      }
      delete result.snapshotChecksum; delete result.equivalence.fingerprints;
      result.worldAgeDaysAtStart = Math.round(result.worldStart / 864000) / 100; delete result.worldStart;
      delete result.statistics.eventOrderChecksum;
      for (const checkpoint of Object.values(result.checkpoints)) delete checkpoint.eventOrderChecksum;
      result.scenario = 'private-local-backup'; delete result.aiRequested;
      delete result.requestedCities; delete result.requestedLedger;
    }
    await fs.writeFile(out, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({totalMs: result.totalMs, events: result.events, stages: result.stages, peakHeapMiB: peak / 1048576}));
    }
  } finally {if (prepared) await lab.cleanup(prepared);}
}
