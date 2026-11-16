import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {buildLab as buildOriginalLab} from './build.mjs';
const buildLab = detailed => buildOriginalLab(detailed, false, 'work/b10p0/test');

test('instrumented replay matches all authoritative synchronous fields and leaves input untouched', async () => {
  const lab = await import(pathToFileURL(await buildLab(true)).href);
  const result = await lab.parityProbe();
  assert.equal(result.same, true); assert.equal(result.inputUnchanged, true); assert.ok(result.events > 0);
});

test('malformed private envelope cannot touch an existing database', async () => {
  const lab = await import(pathToFileURL(await buildLab(false)).href);
  const databases = await indexedDB.databases();
  await assert.rejects(lab.prepare({}, JSON.stringify({format: 'DEMO', snapshot: {secret: 'PRIVATE'}})));
  assert.deepEqual(await indexedDB.databases(), databases);
});

test('all authoritative world fields, ledger archive and report history match count-only build', async () => {
  const detailed = await import(pathToFileURL(await buildLab(true)).href);
  const count = await import(pathToFileURL(await buildLab(false)).href);
  const a = await detailed.prepare({speed: 1}), b = await count.prepare({speed: 1});
  try {
    assert.equal(a.snapshotChecksum, b.snapshotChecksum);
    const x = await detailed.measure(a, {hours: 1}), y = await count.measure(b, {hours: 1});
    assert.equal(x.statistics.eventOrderChecksum, y.statistics.eventOrderChecksum);
    assert.equal(x.events, y.events);
    assert.deepEqual(x.equivalence.fingerprints, y.equivalence.fingerprints);
  } finally {await detailed.cleanup(a); await count.cleanup(b);}
});

async function rawArchive(suffix) {
  const request = indexedDB.open('lieguo-formal-bounded-v1-' + suffix);
  const db = await new Promise((ok, fail) => {request.onsuccess = () => ok(request.result); request.onerror = () => fail(request.error);});
  try {
    const names = [...db.objectStoreNames], tx = db.transaction(names, 'readonly'), rows = {};
    await Promise.all(names.map(name => new Promise((ok, fail) => {
      const r = tx.objectStore(name).getAll(); r.onsuccess = () => {rows[name] = r.result; ok();}; r.onerror = () => fail(r.error);
    })));
    return {format: 'lieguo-recovery-archive-v1', databases: {'lieguo-formal-bounded-v1': rows}};
  } finally {db.close();}
}

test('raw database adapter preserves source, rejects duplicate rows and verifies ledger checksums', async () => {
  const lab = await import(pathToFileURL(await buildLab(false)).href), source = await lab.prepare({speed: 1});
  let restored;
  try {
    const archive = await rawArchive(source.suffix), original = JSON.stringify(archive);
    restored = await lab.prepare({}, original);
    assert.equal(restored.sourceFormat, 'raw-current-database-archive'); assert.equal(restored.sourceRecovered, false);
    assert.equal(restored.auxiliaryArchiveVerified, true);
    assert.deepEqual(restored.initial, source.initial);
    assert.equal(JSON.stringify(await rawArchive(source.suffix)), original);
    const duplicate = structuredClone(archive); duplicate.databases['lieguo-formal-bounded-v1'].saves.push(duplicate.databases['lieguo-formal-bounded-v1'].saves[0]);
    await assert.rejects(lab.prepare({}, JSON.stringify(duplicate)));
    const corrupt = structuredClone(archive), manifests = corrupt.databases['lieguo-formal-bounded-v1'].LedgerManifests;
    for (const manifest of manifests) manifest.manifest.checksum = '0'.repeat(64);
    await assert.rejects(lab.prepare({}, JSON.stringify(corrupt)));
    const wrongFormat = structuredClone(archive); wrongFormat.databases['lieguo-formal-bounded-v1'].StorageMeta[0].format = 'unsupported';
    await assert.rejects(lab.prepare({}, JSON.stringify(wrongFormat)));
    assert.equal(JSON.stringify(await rawArchive(source.suffix)), original);
  } finally {if (restored) await lab.cleanup(restored); await lab.cleanup(source);}
});
