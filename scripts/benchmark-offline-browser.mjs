import fs from 'node:fs/promises';
import http from 'node:http';
import {resolve, dirname} from 'node:path';
import {buildLab} from './offline-benchmark/build.mjs';
import {summarizeCPU} from './offline-benchmark/cpu.mjs';
import {protectPrivateInput} from './offline-benchmark/private-paths.mjs';

const args = process.argv.slice(2), value = (key, fallback) => {const i = args.indexOf('--' + key); return i < 0 ? fallback : args[i + 1];};
const mode = value('mode', 'detailed');
if (!['count', 'detailed', 'sites'].includes(mode)) throw Error('Invalid profiler mode');
const detailed = mode !== 'count';
await protectPrivateInput(value('private'), [value('out', 'artifacts/b10-p0/browser.json'), value('private-proof')]);
const labPath = await buildLab(detailed, mode === 'sites');
const assets = new Map([
  ['/', {type: 'text/html', body: (await fs.readFile('scripts/offline-benchmark/page.html', 'utf8')).replace("'BENCHMARK_MODE'", JSON.stringify(mode))}],
  ['/worker.mjs', {type: 'text/javascript', body: await fs.readFile('scripts/offline-benchmark/worker.mjs')}],
  ['/lab.mjs', {type: 'text/javascript', body: await fs.readFile(labPath)}],
]);
const server = http.createServer((req, res) => {
  const asset = req.method === 'GET' && assets.get(req.url);
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline'; worker-src 'self'; connect-src 'self'; style-src 'none'");
  if (!asset) {res.writeHead(404); res.end(); return;}
  res.setHeader('Content-Type', asset.type); res.end(asset.body);
});
await new Promise(resolve => server.listen(Number(value('port', 5197)), '127.0.0.1', resolve));
if (args.includes('--serve')) console.log('Private local benchmark: http://127.0.0.1:' + server.address().port);
else {
  let browser, prepared, page, worker;
  try {
    const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
    browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true, args: ['--no-sandbox']});
    page = await browser.newPage(); await page.goto('http://127.0.0.1:' + server.address().port);
    const options = {speed: Number(value('speed', 25)), hours: Number(value('hours', 12)), ai: Number(value('ai', 99)),
      scenario: value('scenario', 'fresh'), ledger: Number(value('ledger', 0)), seed: 90217};
    let text;
    if (value('private')) {
      try {
        const info = await fs.stat(value('private')); if (info.size > 100 * 1024 * 1024) throw Error('size');
        text = await fs.readFile(value('private'), 'utf8');
      } catch {throw Error('PRIVATE_BACKUP_UNAVAILABLE_OR_TOO_LARGE');}
    }
    prepared = await page.evaluate(async data => {const w = await window.openLabWorker(); try {return await window.requestLab(w, data);} finally {w.terminate();}}, {action: 'prepare', options, text});
    await page.evaluate(async () => {window.measuredWorker = await window.openLabWorker();});
    const cdp = await browser.newBrowserCDPSession(), targets = (await cdp.send('Target.getTargets')).targetInfos;
    const target = targets.find(t => t.type === 'worker' && t.url.endsWith('/worker.mjs'));
    if (!target) throw Error('Dedicated Worker target unavailable');
    const {sessionId} = await cdp.send('Target.attachToTarget', {targetId: target.targetId, flatten: false});
    let sequence = 0; const pending = new Map();
    cdp.on('Target.receivedMessageFromTarget', e => {
      if (e.sessionId !== sessionId) return;
      const m = JSON.parse(e.message), p = pending.get(m.id); if (!p) return;
      pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence; pending.set(id, {resolve, reject});
      cdp.send('Target.sendMessageToTarget', {sessionId, message: JSON.stringify({id, method, params})}).catch(reject);
    });
    let peak = 0, samples = 0, sampling = false;
    const sample = async () => {
      if (sampling) return; sampling = true;
      try {const m = await send('Runtime.getHeapUsage'); peak = Math.max(peak, m.usedSize); samples++;} finally {sampling = false;}
    };
    await sample();
    const timer = setInterval(() => {sample().catch(() => {});}, 50);
    if (args.includes('--cpu')) {await send('Profiler.enable'); await send('Profiler.setSamplingInterval', {interval: 1000}); await send('Profiler.start');}
    let profile;
    // Stop heap/CPU sampling before readback and full-world fingerprint work.
    await page.exposeFunction('timingStopped', async () => {
      clearInterval(timer); await sample();
      if (args.includes('--cpu')) profile = summarizeCPU((await send('Profiler.stop')).profile);
    });
    await page.exposeFunction('reportProgress', events => console.log(JSON.stringify({processedEvents: events})));
    const result = await page.evaluate(async data => {
      const w = window.measuredWorker;
      return await new Promise((resolve, reject) => {
        const pings = {calls: 0, totalMs: 0, maxMs: 0, over50Ms: 0, over100Ms: 0, over250Ms: 0};
        const timer = data.pings ? setInterval(() => w.postMessage({action: 'ping', sentAt: performance.now()}), 50) : undefined;
        w.onmessage = async e => {
          if (e.data.type === 'timing-stop') {clearInterval(timer); await window.timingStopped(); w.postMessage({action: 'timingAck'});}
          else if (e.data.type === 'progress') window.reportProgress(e.data.events);
          else if (e.data.type === 'pong') {const ms = performance.now() - e.data.sentAt; pings.calls++; pings.totalMs += ms; pings.maxMs = Math.max(pings.maxMs, ms); if (ms > 50) pings.over50Ms++; if (ms > 100) pings.over100Ms++; if (ms > 250) pings.over250Ms++;}
          else if (e.data.type === 'result') {clearInterval(timer); if (data.pings) e.data.value.workerPings = {...pings, meanMs: pings.totalMs / pings.calls, requestedIntervalMs: 50, note: 'Synthetic round-trip message service, not T1/T2 command latency; includes page/Worker scheduling'}; resolve(e.data.value);}
          else if (e.data.type === 'error') {clearInterval(timer); reject(Error(e.data.code));}
        }; w.postMessage(data);
      });
    }, {action: 'measure', prepared, options, waitForTimingAck: true, pings: args.includes('--pings'), requestPrivateProof: !!value('private-proof')});
    clearInterval(timer);
    result.environment = {engine: 'Native Chromium DedicatedWorker / IndexedDB; fresh worker after seed', chromium: browser.version(),
      nodeDriver: process.version, os: process.platform, architecture: process.arch, cpuThrottle: 1,
      instrumentation: detailed ? 'detailed bounded spans' : 'event counter/checksum only', profilerMode: mode};
    result.memory = {sampledPeakHeapBytes: peak, samples, intervalMs: 50,
      note: 'Dedicated Worker Runtime.getHeapUsage; sampled lower bound, includes profiler; excludes setup/readback. External CDP sampling perturbs timings.'};
    result.cpuProfile = profile;
    if (result.privateProof && value('private-proof')) {
      const proofPath = resolve(value('private-proof')); await fs.mkdir(dirname(proofPath), {recursive: true});
      await fs.writeFile(proofPath, JSON.stringify(result.privateProof), {mode: 0o600}); delete result.privateProof;
    }
    const out = resolve(value('out', 'artifacts/b10-p0/browser.json')); await fs.mkdir(dirname(out), {recursive: true});
    await fs.writeFile(out, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({totalMs: result.totalMs, events: result.events, stages: result.stages, peakHeapMiB: peak / 1048576}));
  } finally {
    if (prepared && page) await page.evaluate(async prepared => {window.measuredWorker?.terminate(); const w = await window.openLabWorker(); try {await window.requestLab(w, {action: 'cleanup', prepared});} finally {w.terminate();}}, prepared).catch(() => {});
    await browser?.close(); server.close();
  }
}
