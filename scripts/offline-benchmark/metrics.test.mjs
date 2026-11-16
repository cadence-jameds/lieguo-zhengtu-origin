import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Metrics} from './metrics.mjs';
import {offlineInstrumentation} from './instrument.mjs';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {protectPrivateInput} from './private-paths.mjs';

test('exclusive spans sum without double counting; reservoirs stay bounded', () => {
  let time = 0; const m = new Metrics({capacity: 128, clock: () => time});
  const parent = m.enter('parent'); time = 2; const child = m.enter('child'); time = 5; m.leave(child); time = 10; m.leave(parent);
  assert.equal(m.result().operations.parent.inclusiveMs, 10);
  assert.equal(m.result().operations.parent.selfMs, 7);
  for (let i = 0; i < 100000; i++) m.record('many', i);
  const r = m.result().operations.many;
  assert.equal(r.calls, 100000); assert.equal(r.sampleCount, 128);
  assert.ok(r.p50Ms > 35000 && r.p50Ms < 65000); assert.ok(r.p99Ms > 80000);
  assert.equal(m.result().operations.child.p50Ms, null);
});

test('event probe is count-only when detailed mode is disabled', () => {
  const source = 'function advanceOneEvent(w,scheduler,reports,submit){return scheduler.pop();}';
  const result = offlineInstrumentation(false).transform(source, '/repo/src/game/formal/reducer.ts');
  assert.match(result.code, /\.event\(scheduler.peek\(\),w,scheduler\)/);
  assert.doesNotMatch(result.code, /\.enter\(/);
});

test('native clone wrappers preserve return and finally, with nested spans', async () => {
  const source = 'export async function digest(value){const x=structuredClone(value);await Promise.resolve();return x;}';
  const code = offlineInstrumentation(true).transform(source, '/repo/src/game/formal/canonical.ts').code;
  const module = await import('data:text/javascript,' + encodeURIComponent(code));
  const m = new Metrics(); globalThis.__b10p0 = m;
  try {
    const input = {a: [1, 2]}, copy = await module.digest(input);
    assert.deepEqual(copy, input); assert.notEqual(copy, input);
    assert.equal(m.result().operations['native:structuredClone'].calls, 1);
    assert.equal(m.stack.length, 0);
  } finally {delete globalThis.__b10p0;}
});

test('private source cannot be overwritten via equal, symlink or hardlink output paths', async () => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'b10p0-readonly-')), source = join(dir, 'private.json');
  try {
    await fs.writeFile(source, 'private synthetic test input');
    await fs.symlink(source, join(dir, 'symlink')); await fs.link(source, join(dir, 'hardlink'));
    for (const output of [source, join(dir, 'symlink'), join(dir, 'hardlink')]) await assert.rejects(protectPrivateInput(source, [output]));
    await protectPrivateInput(source, [join(dir, 'stats.json')]);
    assert.equal(await fs.readFile(source, 'utf8'), 'private synthetic test input');
  } finally {await fs.rm(dir, {recursive: true, force: true});}
});

test('named arrow invalidation retains behavior and is measured', async () => {
  const source = 'const cache=new WeakMap(); export const invalidateEndgameIntel=(w)=>{cache.delete(w);};';
  const code = offlineInstrumentation(true).transform(source, '/repo/src/game/formal/endgameAI.ts').code;
  const module = await import('data:text/javascript,' + encodeURIComponent(code)), m = new Metrics(); globalThis.__b10p0 = m;
  try {assert.equal(module.invalidateEndgameIntel({}), undefined); assert.equal(m.result().operations['formal/endgameAI.ts:invalidateEndgameIntel'].calls, 1);}
  finally {delete globalThis.__b10p0;}
});

test('async tail promises settle before span closes without changing inner rejection catch semantics', async () => {
  const source = `export async function prepareVerifiedLedger(value){try{return verifyLedgerArchive(value);}catch{return 'incorrectly caught';}}
    async function verifyLedgerArchive(value){await Promise.resolve();if(value==='reject')throw Error('expected');return value;}`;
  const code = offlineInstrumentation(true).transform(source, '/repo/src/game/formal/commandLedger.ts').code;
  const module = await import('data:text/javascript,' + encodeURIComponent(code)), m = new Metrics(); globalThis.__b10p0 = m;
  try {
    assert.equal(await module.prepareVerifiedLedger('ok'), 'ok');
    await assert.rejects(module.prepareVerifiedLedger('reject'), /expected/);
    assert.equal(m.stack.length, 0); assert.equal(m.result().operations['formal/commandLedger.ts:prepareVerifiedLedger'].calls, 2);
  } finally {delete globalThis.__b10p0;}
});
