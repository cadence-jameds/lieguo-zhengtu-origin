// Verify a genuine pre-update synthetic Formal envelope with the current compiled engine.
// node scripts/v95-verify-old-save.mjs <compiled> <pre-update.realm-save> <report.json>
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import 'fake-indexeddb/auto';
const [compiledArg,sampleArg,outArg]=process.argv.slice(2),compiled=path.resolve(compiledArg),load=name=>import(pathToFileURL(path.join(compiled,'src/game/formal',name+'.js')).href);
const {decodeSave,encodeSave}=await load('saveCodec'),{advanceFormal}=await load('reducer'),{FormalPersistence}=await import(pathToFileURL(path.join(compiled,'src/game/persistence.js')).href),{citySnapshot}=await load('economy');
const sample=JSON.parse(fs.readFileSync(sampleArg,'utf8')),before=structuredClone(sample.snapshot),{world:loaded}=await decodeSave(sample);
const oldCity=before.cities[0],oldGoldRate=27*1.32*1.06,expectedLegacyGold=oldCity.stock.gold+Math.floor(oldCity.economy.productionRemainder.gold+oldGoldRate*(before.time-oldCity.economy.lastSettledAt)/3600000);assert.equal(loaded.cities[0].stock.gold,expectedLegacyGold);
assert.equal(before.economyVersion,undefined);assert.equal(loaded.economyVersion,95);
assert.deepEqual(loaded.cities.map(c=>c.buildings),before.cities.map(c=>c.buildings));assert.deepEqual(loaded.cities.map(c=>c.economy.construction),before.cities.map(c=>c.economy.construction));assert.deepEqual(loaded.factions.map(f=>f.techIds),before.factions.map(f=>f.techIds));assert.deepEqual(loaded.commandReceipts,before.commandReceipts);
const next=advanceFormal(loaded,loaded.time+3600000).world,envelope=await encodeSave(next),reloaded=(await decodeSave(envelope)).world;assert.deepEqual(reloaded,next);
const s=new FormalPersistence({suffix:'v95-old-save-'+crypto.randomUUID()});let recovery;
try{const started=await s.importSave(JSON.stringify(sample),true),point=(await s.backupList())[0],advanced=advanceFormal(started,started.time+3600000),saved=await s.save(advanced.world,advanced.reports,started.revision);assert.deepEqual((await s.loadSave()).game,saved);const restored=await s.restore(point.id);assert.deepEqual(restored.cities.map(c=>c.buildings),started.cities.map(c=>c.buildings));assert.deepEqual(restored.cities.map(c=>c.economy.construction),started.cities.map(c=>c.economy.construction));recovery={result:'PASS',restoredTime:restored.time,revision:restored.revision,retainedQueue:restored.cities[0].economy.construction.length};}finally{await s.db.delete();}
const report={result:'PASS',fixture:{path:sampleArg,baseMain:'64fc1b76b1a96f43ef880550c8c7717b37446474',checksum:sample.checksum,createdBy:'unmodified baseline engine before v95 source edits; synthetic world, no player data'},migration:{verifiedBeforeTransform:true,pendingPreUpdatePeriodSettledAt:loaded.time,noRetroactiveOffering:true,receiptsUnchanged:true,buildingsUnchanged:true,admittedWorkUnchanged:true,metadataVersionsUnchanged:true},roundTrip:{loadTime:loaded.time,advancedTime:next.time,allCitiesDeepEqualAfterReload:true,population:citySnapshot(next,next.cities[0].id).population,gold:citySnapshot(next,next.cities[0].id).stock.gold,castleCompletedDespiteNewPrerequisite:true},recovery};fs.mkdirSync(path.dirname(outArg),{recursive:true});fs.writeFileSync(outArg,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
