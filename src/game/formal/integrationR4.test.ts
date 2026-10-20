import 'fake-indexeddb/auto';
import {afterEach, expect, it} from 'vitest';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createFormalWorld} from './generator';
import {battlefield, issue, dispatch} from './combatTestSupport';
import {build, order} from './developmentTestSupport';
import {isolatedAutonomyFixture} from './autonomyTestSupport';
import {enableAutonomy} from './autonomy';
import {advanceFormal, submitFormalOrder} from './reducer';
import {advanceOffline} from './offline';
import {HOUR} from './economy';
import {validateFormalWorld} from './schema';
import {encodeSave, decodeSave} from './saveCodec';
import {canonicalJSON} from './canonical';
import {isMissionArmy} from './combatModel';
import {empireOf} from './politics';
import {projectId} from './ids';
import {rebirthCandidates} from './extinction';
import {FormalPersistence} from '../persistence';
import {battleMarkers} from '../presentation/armyOverlay';
import type {FormalCommand, FormalWorld} from './model';

const stores: FormalPersistence[] = [];
afterEach(async () => { for (const s of stores.splice(0)) await s.db.delete(); });
function gameplay(w: FormalWorld) {
  const c = structuredClone(w); c.revision = 0;
  for (const r of c.commandReceipts) r.committedRevision = 0;
  return canonicalJSON(c);
}
function evidence(name: string, value: unknown) {
  if (!process.env.R4_EVIDENCE_DIR) return;
  mkdirSync(process.env.R4_EVIDENCE_DIR, {recursive: true});
  writeFileSync(join(process.env.R4_EVIDENCE_DIR, name), JSON.stringify(value, null, 2));
}
const act = (w: FormalWorld, i: number, payload: FormalCommand) => issue(w, payload, w.factions[i].id).world;
function politics(w: FormalWorld, i: number, action: Extract<FormalCommand, {type:'politics'}>['action'], extra: object = {}) {
  return act(w, i, {type:'politics', cityId:w.cities[i].id, action, ...extra});
}
/** Controlled integration fixture: grants are explicit, AI decisions deferred, never described as fair play. */
function chain() {
  let w = isolatedAutonomyFixture(battlefield());
  w.campaignId = 'campaign:r4-controlled' as FormalWorld['campaignId'];
  w.offlineHours = 0;
  for (const i of [0,1,2,3]) {
    w.factions[i].age = 2;
    for (const key of ['center','townhall','academy']) build(w.cities[i], key, 5);
    build(w.cities[i], 'embassy', 15);
  }
  w.cities[0].military!.units = {militia:7, scout:11, ram:5};
  w.cities[0].wallLevel = 15;
  w.cities[1].military!.units = {militia:2000, ram:100};
  w.cities[2].military!.units = {militia:2000, ram:100};
  // Existing empire 2 -> 1 -> 0 and bound project/invitation cleanup, without executing B9.
  w = politics(w,0,'legion-create',{name:'舊軍團'});
  w = politics(w,3,'legion-create',{name:'離去軍團'});
  w = politics(w,0,'empire-propose',{target:w.factions[3].id,name:'舊帝國'});
  w = politics(w,3,'request-accept',{requestId:w.politics!.requests.at(-1)!.id});
  const id = empireOf(w,w.playerFactionId)!.id;
  w.largeProjects.push({projectId:projectId('r4-orphan-check'),kind:'emergency-modernization',
    owner:{kind:'empire',empireId:id},legalContributors:{kind:'current-empire-members',empireId:id},
    paymentMode:'physical-shipment',initiatingCityId:w.cities[0].id,
    requiredResources:{food:1,wood:1,stone:1,gold:1},poolResources:{food:0,wood:0,stone:0,gold:0},
    shipments:[],createdAt:w.time,durationMs:HOUR});
  w = politics(w,3,'empire-leave');
  expect(empireOf(w,w.playerFactionId)!.legions).toHaveLength(1);
  w = politics(w,0,'empire-propose',{target:w.factions[3].id,name:'再邀請'});
  w = issue(w,{type:'governance.set',cityId:w.cities[0].id,enabled:true,policy:'reserve',budget:0,reserve:180}).world;
  w = dispatch(w,'raid',{militia:7,scout:11,ram:5},0,99).world;
  w = politics(w,1,'legion-create',{name:'聯軍'});
  w = politics(w,1,'legion-invite',{target:w.factions[2].id});
  w = politics(w,2,'request-accept',{requestId:w.politics!.requests.at(-1)!.id});
  w = act(w,1,{type:'joint.create',cityId:w.cities[1].id,targetCityId:w.cities[0].id,
    units:{militia:1000,ram:100},arrivalAt:w.time+HOUR});
  w = act(w,2,{type:'joint.join',cityId:w.cities[2].id,jointId:w.politics!.joints.at(-1)!.id,
    units:{militia:1000,ram:100}});
  expect(w.armies.filter(a=>a.status==='waiting')).toHaveLength(2);
  expect(w.cities[1].military!.units.militia).toBe(1000);
  expect(w.cities[2].military!.units.militia).toBe(1000);
  return validateFormalWorld(w);
}

it('R4 B6 -> joint Lv15 conquest -> zero empire -> B7 exile/floor25 -> AI foreign castle -> player rebirth', async () => {
  let w = chain();
  evidence('controlled-before.realm-save', await encodeSave(w));
  const arrival = w.politics!.joints.at(-1)!.arrivalAt;
  w = advanceFormal(w,arrival).world;
  evidence('controlled-arrival.realm-save',await encodeSave(w));
  for (let i=0;w.combat!.battles.length && i<13;i++) w=advanceFormal(w,w.combat!.battles[0].nextRoundAt).world;
  expect(w.combat!.battles).toHaveLength(0);
  expect(w.cities[0].ownerFactionId).toBe(w.factions[1].id);
  expect(w.combat!.receipts.filter(r=>r.kind==='final'&&r.mission==='conquest')).toHaveLength(1);
  expect(w.politics!.empires).toHaveLength(0);
  expect(w.largeProjects).toHaveLength(0);
  expect(w.politics!.requests).toHaveLength(0);
  expect(w.governors![0]).toMatchObject({enabled:false,eventId:null});
  expect(w.autonomy!.agents).toHaveLength(99);
  expect(w.extinction!.extinct).toContain(w.playerFactionId);
  expect(w.extinction!.sites).toHaveLength(1);
  expect(w.extinction!.sites[0].defenders).toEqual({militia:7,ram:5});
  expect(w.worldLayer!.wildSites).toHaveLength(432);
  const site=w.extinction!.sites[0], winner=w.factions[1].id;
  evidence('controlled-extinct.realm-save',await encodeSave(w));
  w=act(w,1,{type:'army.dispatch',cityId:w.cities[1].id,mission:'raid',
    target:{kind:'wild',siteId:site.id,generation:0},units:{militia:1000}});
  const raid=w.armies.filter(isMissionArmy).find(a=>a.target.kind==='wild'&&a.target.siteId===site.id)!;
  w=advanceFormal(w,raid.arrivalAt).world;
  const returning=w.armies.filter(isMissionArmy).find(a=>a.id===raid.id)!;
  expect(returning.units.militia).toBeGreaterThanOrEqual(1);
  expect(returning.units.scout??0).toBe(0);
  expect(returning.units.ram).toBe(1);
  expect(w.extinction!.craftsmen).toHaveLength(1);
  expect(w.extinction!.sites[0].phase).toBe('cooldown');
  const reward=w.autonomy!.agents.find(a=>a.factionId===winner)!.intel;
  w=advanceFormal(w,returning.arrivalAt).world;
  const craft=w.extinction!.craftsmen[0];
  expect(craft.ownerFactionId).toBe(winner);
  expect(craft.cityId).toBe(w.cities[1].id);
  expect(craft.civilizationId).toBe(w.factions[0].civilizationId);
  const stock=w.cities[1].stock.stone,tech=[...w.factions[1].techIds];
  w=act(w,1,{type:'craftsman.castle',cityId:w.cities[1].id,craftsmanId:craft.id});
  const job=w.cities[1].economy!.construction.find(j=>j.castleCivilizationId===craft.civilizationId)!;
  expect(w.cities[1].stock.stone).toBe(stock);
  expect(job.paidResources).toEqual({food:0,wood:0,stone:0,gold:0});
  expect(w.extinction!.craftsmen).toHaveLength(1);
  w=advanceFormal(w,job.startsAt+job.durationMs).world;
  expect(w.extinction!.craftsmen).toHaveLength(0);
  expect(w.cities[1].castleCivilizationId).toBe(w.factions[0].civilizationId);
  w=act(w,1,{type:'military.recruit',cityId:w.cities[1].id,unitId:'guard.'+w.factions[0].civilizationId,count:1});
  expect(w.factions[1].techIds).toEqual(tech);
  expect(w.factions.every(f=>f.modernQualification==='none')).toBe(true);
  const aiRebirth=submitFormalOrder(w,order(w,{type:'player.rebirth',cityId:w.cities[1].id,candidate:0,name:'非法'},'r4-ai-rebirth',winner));
  expect(aiRebirth.ack?.status).toBe('rejected');
  expect(rebirthCandidates(w)).toHaveLength(3);
  const rebirth=order(w,{type:'player.rebirth',cityId:w.cities[0].id,candidate:0,name:'R4復國'},'r4-rebirth');
  w=submitFormalOrder(w,rebirth).world;
  expect(submitFormalOrder(w,rebirth).ack?.status).toBe('duplicate');
  const home=w.cities.find(c=>c.ownerFactionId===w.playerFactionId)!;
  expect(home.population).toBe(400);
  expect(home.stock).toEqual({food:600,wood:600,stone:600,gold:600});
  expect(home.military!.units).toEqual({});
  expect(w.factions[0].age).toBe(2);
  expect(w.factions[0].protectionUntil).toBe(w.time+48*HOUR);
  expect(w.extinction!.sites).toHaveLength(1);
  expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
  evidence('controlled-chain.json',{time:w.time,finalReceipts:w.combat!.receipts.filter(r=>r.kind==='final'),
    exiles:w.extinction!.sites,foreignCastle:w.cities[1].castleCivilizationId,rebirth:home,
    winnerIntel:reward,qualifications:w.factions.map(f=>f.modernQualification)});
  evidence('controlled-reborn.realm-save',await encodeSave(w));
});

it('R4 cross-domain IDB rollback/import/Recovery keeps joint, empire, governor and exile lifecycle atomic',async()=>{
  let fail=false;
  const db=new FormalPersistence({suffix:'r4-'+crypto.randomUUID(),fault:p=>{if(fail&&p==='authority-write')throw Error('R4 injected fault');}});
  stores.push(db);
  const initial=await db.start(chain()),backup=(await db.backupList())[0].id;
  const t=advanceFormal(initial,3*HOUR);
  expect(t.world.extinction!.extinct).toContain(initial.playerFactionId);
  fail=true;
  await expect(db.save(t.world,t.reports,initial.revision)).rejects.toThrow('R4 injected fault');
  expect((await db.loadSave()).game).toEqual(initial);
  expect(await db.db.BattleReports.count()).toBe(0);
  fail=false;
  const committed=await db.save(t.world,t.reports,initial.revision);
  expect((await db.loadSave()).game).toEqual(committed);
  const copy=new FormalPersistence({suffix:'r4-copy-'+crypto.randomUUID()});stores.push(copy);
  const imported=await copy.importSave(await db.exportStoredSave('full'));
  expect(imported.extinction).toEqual(committed.extinction);
  expect(await copy.db.BattleReports.count()).toBe(await db.db.BattleReports.count());
  const restored=await db.restore(backup);
  expect(restored.largeProjects).toHaveLength(1);
  expect(restored.extinction?.sites??[]).toHaveLength(0);
  expect(restored.armies.filter(a=>a.status==='waiting')).toHaveLength(2);
  expect(restored.governors![0].enabled).toBe(true);
  expect(restored.commandReceipts.some(r=>r.disposition==='rolled-back')).toBe(false);
  const replay=advanceFormal(restored,3*HOUR).world;
  // Recovery keeps durable sequences monotonic. Newly allocated IDs (and the
  // exile location seeded from the project sequence) legitimately differ.
  expect(replay.extinction!.extinct).toEqual(committed.extinction!.extinct);
  expect(replay.extinction!.sites).toHaveLength(1);
  expect(replay.extinction!.sites[0].defenders).toEqual(committed.extinction!.sites[0].defenders);
  expect(replay.extinction!.sites[0].sourceFactionId).toBe(initial.playerFactionId);
  expect(replay.extinction!.sites[0].id).not.toBe(committed.extinction!.sites[0].id);
  expect(replay.cities[0].ownerFactionId).toBe(committed.cities[0].ownerFactionId);
  const semantics=(v:FormalWorld)=>v.combat!.receipts.map(({eventId:_event,...r})=>r);
  expect(semantics(replay)).toEqual(semantics(committed));
  expect(await db.db.BattleReports.count()).toBe(0);
  validateFormalWorld(replay);
  evidence('controlled-persistence.json',{fault:'authority-write',atomicRollback:true,
    reportCount:await copy.db.BattleReports.count(),restoredRevision:restored.revision,replayFinals:replay.combat!.receipts.filter(r=>r.kind==='final')});
});

it.each([12012,92049,90217])('R4 fair 100 factions/99 autonomous AI seed %s: 8h, SaveLoad and sliced equivalence',async seed=>{
  const w=createFormalWorld({campaign:'r4-fair-'+seed,seed});
  const pristine=canonicalJSON({cities:w.cities,factions:w.factions});
  enableAutonomy(w);
  expect(canonicalJSON({cities:w.cities,factions:w.factions})).toBe(pristine);
  expect(w.cities.every(c=>Object.values(c.stock).every(n=>n===600))).toBe(true);
  const start=performance.now(),direct=advanceFormal(w,8*HOUR),elapsedMs=performance.now()-start;
  let sliced=(await decodeSave(await encodeSave(w))).world;
  const reports=[];
  for(let at=HOUR;at<=8*HOUR;at+=HOUR){const t=advanceFormal(sliced,at);sliced=t.world;reports.push(...t.reports);}
  expect(gameplay(sliced)).toBe(gameplay(direct.world));
  expect(reports).toEqual(direct.reports);
  expect(gameplay(advanceOffline(w,1000,1000+8*HOUR).world)).toBe(gameplay(direct.world));
  expect(direct.world.factions).toHaveLength(100);
  expect(direct.world.autonomy!.agents).toHaveLength(99);
  expect(direct.world.autonomy!.accepted).toBeGreaterThan(0);
  expect(direct.world.factions.every(f=>f.modernQualification==='none')).toBe(true);
  expect(direct.world.worldLayer!.wildSites).toHaveLength(432);
  expect(direct.world.dimensions).toEqual({width:384,height:384});
  expect(direct.world.commandReceipts.filter(r=>r.commandId.includes('ai-'))).toHaveLength(direct.world.autonomy!.accepted);
  expect(new Set(direct.world.events.map(e=>e.id)).size).toBe(direct.world.events.length);
  expect(advanceFormal(direct.world,direct.world.time).world).toBe(direct.world);
  validateFormalWorld(direct.world);
  evidence('fair-'+seed+'.json',{seed,worldHours:8,elapsedNodeMs:elapsedMs,factions:100,agents:99,
    accepted:direct.world.autonomy!.accepted,rejected:direct.world.autonomy!.rejected,
    agentDecisions:direct.world.autonomy!.agents.map(a=>a.decisions),cities:direct.world.cities.length,
    legions:direct.world.politics?.legions.length??0,empires:direct.world.politics?.empires.length??0,
    combat:direct.world.combat!.statistics,events:direct.world.events.length,slicedEquivalent:true,offlineEquivalent:true,
    scope:'8 world hours only; no Day30/168h/360h/720h or GPU FPS claim'});
},120000);

it('R4 AI vs AI Lv15 siege: marker survives save/load and Recovery, one final, no player report leak',async()=>{
  let w=isolatedAutonomyFixture(battlefield());
  w.cities[1].military!.units={militia:40,ram:1};w.cities[2].military!.units={};w.cities[2].wallLevel=15;
  w=dispatch(w,'conquest',{militia:30,ram:1},1,2).world;
  w=advanceFormal(w,w.armies.filter(isMissionArmy)[0].arrivalAt).world;
  expect(w.combat!.battles[0].phase).toBe('siege');
  const id=w.combat!.battles[0].id;
  expect(battleMarkers(w)).toHaveLength(1);
  evidence('ai-siege-active.realm-save',await encodeSave({...w,offlineHours:0}));
  let near=w;
  while(near.combat!.battles[0].siegeRound!<11) near=advanceFormal(near,near.combat!.battles[0].nextRoundAt).world;
  evidence('ai-siege-near-final.realm-save',await encodeSave({...near,speed:50,offlineHours:0}));
  const db=new FormalPersistence({suffix:'r4-siege-'+crypto.randomUUID()});stores.push(db);
  const persisted=await db.start(w),backup=(await db.backupList())[0].id;
  const final=advanceFormal(persisted,persisted.time+HOUR);
  expect(final.reports.filter(r=>r.battle)).toHaveLength(0);
  expect(final.world.combat!.receipts.filter(r=>r.kind==='final'&&r.battleId===id)).toHaveLength(1);
  expect(battleMarkers(final.world)).toHaveLength(0);
  await db.save(final.world,final.reports,persisted.revision);
  const restored=await db.restore(backup);
  expect(restored.combat!.battles[0].id).toBe(id);
  expect(battleMarkers(restored)).toHaveLength(1);
  const end=advanceFormal(restored,final.world.time);
  expect(end.world.combat!.receipts.map(({eventId:_event,...r})=>r)).toEqual(final.world.combat!.receipts.map(({eventId:_event,...r})=>r));
  expect(new Set(end.world.combat!.receipts.map(r=>r.resolutionId)).size).toBe(end.world.combat!.receipts.length);
  expect(end.reports.filter(r=>r.battle)).toHaveLength(0);
  evidence('ai-siege-final.realm-save',await encodeSave({...end.world,offlineHours:0}));
});
