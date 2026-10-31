import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {createFormalWorld} from './generator';
import {battlefield,dispatch,arrive,issue} from './combatTestSupport';
import {order,build} from './developmentTestSupport';
import {advanceFormal,advanceFormalCooperative,submitFormalOrder} from './reducer';
import {PROTECTION_DURATION} from './protection';
import {protectedFaction,SHIELD_DURATION} from './playtest';
import {rebirthCandidates,rebirthLocationReason,resolveExtinctions,worldPaused} from './extinction';
import {EventScheduler} from './scheduler';
import {spatial,invalidateSpatial} from './spatial';
import {terrainAt} from './terrain';
import {HOUR,changeCityOwner} from './economy';
import {eventId,projectId} from './ids';
import {encodeSave,decodeSave} from './saveCodec';
import {advanceOffline,advanceOfflineCooperative} from './offline';
import {FormalPersistence} from '../persistence';
import {enableAutonomy} from './autonomy';
import type {FormalWorld,FormalCommand} from './model';

function shield(w:FormalWorld,id=w.playerFactionId,kind:'newbie'|'rebirth'='newbie'){
 const f=w.factions.find(f=>f.id===id)!;f.protectionUntil=w.time+PROTECTION_DURATION;f.protectionKind=kind;delete f.protectionEnded;
}
export function invadingWorld(speed=1){
 let w=battlefield();w.speed=speed;w.cities[0].military!.units={};w.cities[0].wallLevel=0;w.cities[1].military!.units={militia:1000};
 w=dispatch(w,'conquest',{militia:1000},1,0).world;return w;
}
function defeated(){const w=invadingWorld();return arrive(w).world;}
function rebirth(w:FormalWorld){const p=rebirthCandidates(w)[0];return issue(w,{type:'player.rebirth',cityId:w.cities[0].id,...p,name:'復國測試'}).world;}
function rejectedUnchanged(w:FormalWorld,p:FormalCommand){const before=structuredClone(w),r=submitFormalOrder(w,order(w,p));expect(r.ack?.status).toBe('rejected');expect(r.world).toBe(w);expect(w).toEqual(before);return r;}

describe('P0-C-10 unified faction protection',()=>{
 it('new native world grants all 100 factions exactly 48 world hours, all owned cities, with no new polling events',()=>{
  const w=createFormalWorld({campaign:'p0-new',seed:90217});expect(w.factions).toHaveLength(100);
  for(const f of w.factions){expect(f.protectionUntil).toBe(48*HOUR);expect(f.protectionKind).toBe('newbie');expect(protectedFaction(w,f.id,48*HOUR-1)).toBe(true);expect(protectedFaction(w,f.id,48*HOUR)).toBe(false);}
  expect(w.events.some(e=>/protect/.test(e.type))).toBe(false);
  const t=advanceFormal(w,48*HOUR);expect(t.world.factions.every(f=>!protectedFaction(t.world,f.id))).toBe(true);
  expect(advanceFormal(t.world,49*HOUR).world.factions[0].protectionUntil).toBe(48*HOUR);
 });
 it.each(['newbie','rebirth'] as const)('%s protection ends on accepted city scout, survives rejected commands and has one durable notification',async kind=>{
  let w=battlefield();shield(w,w.playerFactionId,kind);w.cities[0].military!.units={scout:4};
  rejectedUnchanged(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'scout',target:{kind:'city',cityId:w.cities[1].id},units:{scout:5}});
  const o=order(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'scout',target:{kind:'city',cityId:w.cities[1].id},units:{scout:4}}),t=submitFormalOrder(w,o);w=t.world;
  expect(t.ack?.status).toBe('committed');expect(protectedFaction(w,w.playerFactionId)).toBe(false);expect(w.factions[0].protectionEnded?.reason).toBe('偵察其他領主城市');expect(t.reports.filter(r=>r.category==='system')).toHaveLength(1);
  expect(submitFormalOrder(w,o).reports).toEqual([]);
  const loaded=(await decodeSave(await encodeSave(w,t.reports))).world;expect(loaded.factions[0].protectionEnded).toEqual(w.factions[0].protectionEnded);
  const done=advanceFormal(loaded,w.armies[0].arrivalAt!+HOUR);expect(protectedFaction(done.world,w.playerFactionId)).toBe(false);
 });
 it.each(['scout','raid'] as const)('wild %s is legal during protection and never ends it',mission=>{
  let w=battlefield();shield(w);w.cities[0].military!.units=mission==='scout'?{scout:4}:{militia:50};const site=w.worldLayer!.wildSites.find(s=>s.level===1)!;
  w=issue(w,{type:'army.dispatch',cityId:w.cities[0].id,mission,target:{kind:'wild',siteId:site.id,generation:site.generation},units:{...w.cities[0].military!.units},...(mission==='scout'?{scoutMode:'resources-army' as const}:{})}).world;
  expect(protectedFaction(w,w.playerFactionId)).toBe(true);const at=arrive(w);expect(at.world.combat!.receipts.some(r=>r.kind==='final')).toBe(true);expect(protectedFaction(at.world,w.playerFactionId)).toBe(true);
  if(mission==='scout'){expect(at.world.armies[0].pendingIntel?.observedAt).toBe(at.world.time);const returned=advanceFormal(at.world,at.world.armies[0].arrivalAt!);expect(returned.reports.some(r=>r.battle?.intel)).toBe(true);}
 });
 it('AI city scouts follow the same break rule; a protected player rejects AI attacks atomically',()=>{
  let w=battlefield();const ai=w.cities[1].ownerFactionId;shield(w,ai);w.cities[1].military!.units={scout:3,militia:20};
  const t=dispatch(w,'scout',{scout:3},1,0);expect(protectedFaction(t.world,ai)).toBe(false);expect(t.reports[0].ownerFactionId).toBe(ai);
  w=battlefield();shield(w);w.cities[1].military!.units={militia:20};const before=structuredClone(w),r=submitFormalOrder(w,order(w,{type:'army.dispatch',cityId:w.cities[1].id,mission:'raid',target:{kind:'city',cityId:w.cities[0].id},units:{militia:20}},undefined,w.cities[1].ownerFactionId));expect(r.ack?.status).toBe('rejected');expect(w).toEqual(before);
 });
 it.each(['scout','raid','conquest'] as const)('protected city rejects %s at admission and arrival without damage or intel',mission=>{
  let w=battlefield();w.cities[0].military!.units={militia:50,scout:5};const p:FormalCommand={type:'army.dispatch',cityId:w.cities[0].id,mission,target:{kind:'city',cityId:w.cities[1].id},units:mission==='scout'?{scout:5}:{militia:50}};
  shield(w,w.cities[1].ownerFactionId);rejectedUnchanged(w,p);w.factions[1].protectionUntil=0;w=issue(w,p).world;shield(w,w.cities[1].ownerFactionId);const before={...w.cities[1].military!.units},at=arrive(w);
  expect(at.world.cities[1].military!.units).toEqual(before);expect(at.world.armies[0].pendingIntel).toBeUndefined();expect(at.world.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(1);expect(at.reports[0].battle?.outcome).toBe('no-target');expect(advanceFormal(at.world,at.world.time).reports).toEqual([]);
 });
 it('protection acquired during a live siege stops damage and keeps exactly one final receipt',()=>{
  let w=battlefield();w.cities[0].military!.units={militia:100};w.cities[1].military!.units={militia:100,baggage:10};w.cities[1].wallLevel=10;w=arrive(dispatch(w,'conquest',{militia:100}).world).world;expect(w.combat!.battles).toHaveLength(1);
  shield(w,w.cities[1].ownerFactionId);const before=structuredClone(w.cities[1]),rounds=w.combat!.receipts.filter(r=>r.kind==='round').length,t=advanceFormal(w,w.combat!.battles[0].nextRoundAt);
  expect(t.world.cities[1].military!.units).toEqual(before.military!.units);expect(t.world.cities[1].wallLevel).toBe(before.wallLevel);expect(t.world.cities[1].population).toBeGreaterThanOrEqual(before.population);expect(t.world.combat!.receipts.filter(r=>r.kind==='round')).toHaveLength(rounds);expect(t.world.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(1);expect(t.reports[0].battle?.conquestReason).toBe('protected-target');
 });
 it('war ends protection only after legal diplomacy; developer shield cannot restart or disable faction protection',()=>{
  let w=battlefield();shield(w);w=issue(w,{type:'politics',cityId:w.cities[0].id,action:'war',target:w.factions[1].id}).world;expect(w.factions[0].protectionEnded?.reason).toBe('主動宣戰');
  const until=w.factions[0].protectionUntil;w=issue(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed:50,shield:true}).world;expect(w.developer!.shieldUntil).toBe(w.time+SHIELD_DURATION);expect(w.factions[0].protectionUntil).toBe(until);
  w=issue(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed:50,shield:false}).world;expect(w.factions[0].protectionUntil).toBe(until);
  shield(w);w=issue(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed:50,shield:false}).world;expect(protectedFaction(w,w.playerFactionId)).toBe(true);
 });
});

describe('P0-C-10 exact extinction barrier and rebirth',()=>{
 it.each([1,3,6,10,25])('%sX completes the terminal receipt then freezes before same-time AI, marker and later events; resumes them once',async speed=>{
  let w=invadingWorld(speed);enableAutonomy(w);const arrival=w.armies[0].arrivalAt!,agent=w.autonomy!.agents[0];
  for(const a of w.autonomy!.agents){a.nextAt=arrival+HOUR;w.events.find(e=>e.id===a.eventId)!.at=a.nextAt;}agent.nextAt=arrival;w.events.find(e=>e.id===agent.eventId)!.at=arrival;
  const same=eventId('freeze-same'),later=eventId('freeze-later');w.events.push({id:same,at:arrival,type:'fixture.marker',marker:'same'},{id:later,at:arrival+1,type:'fixture.marker',marker:'later'});w.events=new EventScheduler(w.events).snapshot();
  const t=advanceFormal(w,arrival+HOUR),co=await advanceFormalCooperative(w,arrival+HOUR,undefined,{yieldIntervalMs:0});expect(co).toEqual(t);w=t.world;
  expect(w.time).toBe(arrival);expect(w.extinction!.defeat).toMatchObject({at:arrival,ended:false});expect(w.combat!.receipts.filter(r=>r.kind==='final'&&r.outcome==='conquered')).toHaveLength(1);expect(t.reports.some(r=>r.battle?.outcome==='conquered')).toBe(true);
  expect(w.events.some(e=>e.id===same)).toBe(true);expect(w.events.some(e=>e.id===later)).toBe(true);expect(w.events.some(e=>e.id===agent.eventId)).toBe(true);expect(advanceFormal(w,arrival+20*HOUR)).toEqual({world:w,reports:[]});
  const loaded=(await decodeSave(await encodeSave(w,t.reports))).world;expect(loaded).toEqual(w);const offline=await advanceOfflineCooperative(loaded,0,100*HOUR);expect(offline.summary.advancedWorldMs).toBe(0);expect(offline.summary.advancedRealMs).toBe(0);expect(offline.world.events).toEqual(w.events);
  const resumed=rebirth(w);expect(resumed.time).toBe(arrival);expect(worldPaused(resumed)).toBe(false);const done=advanceFormal(resumed,arrival+1);expect(done.world.events.some(e=>e.id===same||e.id===later)).toBe(false);expect(done.world.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(1);expect(done.world.autonomy!.agents.find(a=>a.factionId===agent.factionId)!.decisions).toBeGreaterThan(resumed.autonomy!.agents.find(a=>a.factionId===agent.factionId)!.decisions);expect(advanceFormal(done.world,done.world.time).reports).toEqual([]);
 });
 it('two simultaneous city arrivals keep the unprocessed army and receipt boundary across save, rebirth and same-time replay',async()=>{
  let w=battlefield(),point:{x:number;y:number}|undefined;for(let y=0;y<384&&!point;y++)for(let x=0;x<382&&!point;x++)if([0,1,2].every(i=>['land','forest'].includes(terrainAt(w,x+i,y)??'')&&!spatial(w).at(x+i,y).city&&!spatial(w).at(x+i,y).site))point={x,y};expect(point).toBeDefined();for(let i=0;i<3;i++){w.cities[i].x=point!.x+i;w.cities[i].y=point!.y;w.cities[i].military!.units={};}invalidateSpatial(w);w.cities[1].military!.units={militia:2000};w=dispatch(w,'conquest',{militia:1000},1,0).world;w=dispatch(w,'conquest',{militia:1000},1,2).world;const at=w.armies[0].arrivalAt!;expect(w.armies[1].arrivalAt).toBe(at);
  w=advanceFormal(w,at+HOUR).world;expect(w.time).toBe(at);expect(w.armies.some(a=>a.status==='outbound'&&a.arrivalAt===at)).toBe(true);expect(w.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(1);w=(await decodeSave(await encodeSave(w))).world;w=rebirth(w);expect(w.extinction!.resumedAt).toBe(at);w=(await decodeSave(await encodeSave(w))).world;w=advanceFormal(w,at).world;expect(w.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(2);expect(w.cities[2].ownerFactionId).toBe(w.factions[1].id);expect(advanceFormal(w,at).reports).toEqual([]);expect(advanceFormal(w,at+1).world.extinction!.resumedAt).toBeUndefined();
 });
 it('a pending combat round at the freeze time remains checksummed and resumes once after rebirth',async()=>{
  let w=battlefield();w.cities[0].military!.units={};w.cities[1].military!.units={militia:2000};w.cities[2].military!.units={militia:1000};w.cities[2].wallLevel=10;w=arrive(dispatch(w,'conquest',{militia:1000},1,2).world).world;expect(w.combat!.battles).toHaveLength(1);w=dispatch(w,'conquest',{militia:1000},1,0).world;const at=w.armies.find(a=>a.status==='outbound')!.arrivalAt!,b=w.combat!.battles[0],id=b.roundEventId,round=b.round;
  // Controlled valid snapshot: unrelated combat and the terminal arrival share a deadline.
  b.nextRoundAt=at;w.events.find(e=>e.id===id)!.at=at;w.events=new EventScheduler(w.events).snapshot();w=advanceFormal(w,at+HOUR).world;expect(w.time).toBe(at);expect(w.events.some(e=>e.id===id&&e.at===at)).toBe(true);expect(w.combat!.battles[0].round).toBe(round);w=(await decodeSave(await encodeSave(w))).world;w=rebirth(w);w=(await decodeSave(await encodeSave(w))).world;w=advanceFormal(w,at).world;expect(w.combat!.battles[0].round).toBe(round+1);expect(w.combat!.receipts.filter(r=>r.eventId===id)).toHaveLength(1);expect(advanceFormal(w,at).reports).toEqual([]);
 });
 it('offline replay stops at the loss, reports only the actual elapsed world duration, and repeated loads stay frozen',async()=>{
  const w=invadingWorld(25),arrival=w.armies[0].arrivalAt!,r=advanceOffline(w,0,12*HOUR);expect(r.world.time).toBe(arrival);expect(r.summary.advancedWorldMs).toBe(arrival);expect(r.summary.advancedRealMs).toBe(Math.ceil(arrival/25));
  for(const now of [13,24,100]){const next=advanceOffline(r.world,0,now*HOUR);expect(next.summary.advancedWorldMs).toBe(0);expect(next.world).toEqual(r.world);}
 });
 it('losing a non-final city never pauses; AI extinction stays permanent',()=>{
  let w=battlefield();changeCityOwner(w,w.cities[2],w.playerFactionId,'receive');changeCityOwner(w,w.cities[0],w.factions[1].id,'conquest');const s=new EventScheduler(w.events);resolveExtinctions(w,s);w.events=s.snapshot();expect(worldPaused(w)).toBe(false);expect(w.extinction?.extinct).not.toContain(w.playerFactionId);
  w=arrive(dispatch(battlefieldWithTroops(),'conquest',{militia:1000}).world).world;expect(w.extinction?.extinct).toContain(w.factions[1].id);expect(worldPaused(w)).toBe(false);expect(advanceFormal(w,w.time+HOUR).world.extinction?.extinct).toContain(w.factions[1].id);
 });
 it('a persisted, travelling AI settlement reservation rejects a stale rebirth preview inside the reducer without fallback',()=>{
  let w=battlefield();const c=w.cities[2];w.factions[2].age=2;build(c,'castle',1);c.population=2000;c.military!.units={militia:40};w=issue(w,{type:'settlement.prepare',cityId:c.id},c.ownerFactionId).world;const ready=w.settlements![0];w=advanceFormal(w,ready.startedAt+ready.prepDurationMs).world;const p=rebirthCandidates(w)[0];w=issue(w,{type:'settlement.dispatch',cityId:c.id,...p,name:'預約',escort:{militia:20}},c.ownerFactionId).world;
  w.cities[0].military!.units={};w.cities[1].military!.units={militia:1000};w=arrive(dispatch(w,'conquest',{militia:1000},1,0).world).world;expect(worldPaused(w)).toBe(true);expect(spatial(w).at(p.x,p.y).reservation).toBeDefined();rejectedUnchanged(w,{type:'player.rebirth',cityId:w.cities[0].id,...p,name:'衝突'});
 });
 it('free coordinates use Formal terrain, city, wild/cooldown and reservations; invalid submissions are atomic',()=>{
  const w=defeated(),valid=rebirthCandidates(w)[0];expect(rebirthLocationReason(w,valid)).toBe('');
  const points=[{x:-1,y:0},{x:384,y:0},{x:.5,y:1},w.cities[0],w.worldLayer!.wildSites[0]];
  for(const kind of ['water','mountain','river']){let found;for(let y=0;y<384&&!found;y++)for(let x=0;x<384&&!found;x++)if(terrainAt(w,x,y)===kind)found={x,y};expect(found).toBeDefined();points.push(found!);}
  for(const p of points){expect(rebirthLocationReason(w,p)).not.toBe('');const before=structuredClone(w);try{const t=submitFormalOrder(w,order(w,{type:'player.rebirth',cityId:w.cities[0].id,x:p.x,y:p.y,name:'非法'}));expect(t.ack?.status).toBe('rejected');expect(t.world).toBe(w);}catch(e){expect(String(e)).toContain('命令格式無效');}expect(w).toEqual(before);}
  spatial(w).reserve(valid.x,valid.y,projectId('occupied'));expect(rebirthLocationReason(w,valid)).toContain('預約');invalidateSpatial(w);
  const p=rebirthCandidates(w)[0],before=structuredClone(w);spatial(w).reserve(p.x,p.y,projectId('preview-stale'));expect(rebirthLocationReason(w,p)).toContain('預約');expect(w).toEqual(before);
  // Actual persisted reservation conflict is covered by settlement fixtures and Worker validation below.
  const site=w.worldLayer!.wildSites[0];site.phase='cooldown';invalidateSpatial(w);expect(rebirthLocationReason(w,site)).toContain('據點');
 });
 it('repeated rebirth retains civilization, age and tech, creates 400 people/zero troops/600 each, resets only protection and cannot undo end',async()=>{
  let w=defeated();w.factions[0].age=2;w.factions[0].techIds=['military.drill'];const civ=w.factions[0].civilizationId;
  for(let i=1;i<=3;i++){
   const frozen=w.time,others=structuredClone(w.cities);w=rebirth(w);const city=spatial(w).owned(w.playerFactionId)[0];expect(city.population).toBe(400);expect(city.military!.units).toEqual({});expect(city.stock).toEqual({food:600,wood:600,stone:600,gold:600});expect(w.time).toBe(frozen);expect(w.factions[0]).toMatchObject({civilizationId:civ,age:2,techIds:['military.drill'],protectionKind:'rebirth',protectionUntil:frozen+48*HOUR});expect(w.cities.filter(c=>c.id!==city.id)).toEqual(others);expect(w.extinction!.rebirths).toBe(i);
   city.military!.units={scout:2};w=issue(w,{type:'army.dispatch',cityId:city.id,mission:'scout',target:{kind:'city',cityId:w.cities[0].id},units:{scout:2}}).world;expect(protectedFaction(w,w.playerFactionId)).toBe(false);
   changeCityOwner(w,spatial(w).owned(w.playerFactionId)[0],w.factions[1].id,'conquest');const s=new EventScheduler(w.events);resolveExtinctions(w,s);w.events=s.snapshot();expect(worldPaused(w)).toBe(true);
  }
  const o=order(w,{type:'player.end',cityId:w.cities[0].id}),ended=submitFormalOrder(w,o);expect(ended.ack?.status).toBe('committed');expect(ended.world.extinction!.defeat!.ended).toBe(true);expect(submitFormalOrder(ended.world,o).ack?.status).toBe('duplicate');rejectedUnchanged(ended.world,{type:'player.rebirth',cityId:w.cities[0].id,...rebirthCandidates(w)[0],name:'不得再起'});expect((await decodeSave(await encodeSave(ended.world))).world.extinction!.defeat!.ended).toBe(true);
 });
 it('paused checksum, backups, restore, full report history and corruption recovery preserve the barrier',async()=>{
  const db=new FormalPersistence({suffix:'p0c10-'+crypto.randomUUID()});try{
   const t=arrive(invadingWorld()),w=t.world;await db.start(w);await db.save({...w,revision:w.revision+1},t.reports,w.revision);const loaded=(await db.loadWithOffline(Date.now()+100*HOUR)).game!;expect(worldPaused(loaded)).toBe(true);expect(loaded.time).toBe(w.time);
   const full=JSON.parse(await db.exportStoredSave('full'));expect((await decodeSave(full)).reports).toHaveLength(t.reports.length);full.snapshot.extinction.defeat.at++;await expect(decodeSave(full)).rejects.toThrow();
   const before=await db.backupList();const ended=issue(loaded,{type:'player.end',cityId:loaded.cities[0].id}).world;await db.save(ended,[],loaded.revision);expect((await db.backupList()).length).toBeGreaterThanOrEqual(before.length);await db.importSave(await db.exportStoredSave('full'));const points=await db.backupList();expect(points.length).toBeGreaterThan(0);const restored=await db.restore(points[0].id);expect(worldPaused(restored)).toBe(true);expect(restored.time).toBe(w.time);
  }finally{await db.db.delete();}
 });
});
function battlefieldWithTroops(){const w=battlefield();w.cities[0].military!.units={militia:1000};w.cities[1].military!.units={};return w;}
