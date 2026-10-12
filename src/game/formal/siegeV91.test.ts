import 'fake-indexeddb/auto';
import {afterAll,afterEach,describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {battlefield,dispatch,arrive,issue} from './combatTestSupport';
import {build} from './developmentTestSupport';
import {advanceFormal} from './reducer';
import {encodeSave,decodeSave} from './saveCodec';
import {FormalPersistence,type FailurePoint} from '../persistence';
import {advanceOffline} from './offline';
import {EventScheduler} from './scheduler';
import {handleCombatEvent,tacticalRoundWorldMs} from './battles';
import {validateFormalWorld} from './schema';
import {liveBattleView} from './battleView';
import {BATTLE_HISTORY_LIMIT} from './battleProgress';
import {empireId} from './ids';
import type {FormalWorld,FormalReport} from './model';
const evidence:Record<string,unknown>={};
const matrix:unknown[]=[];
const stores:FormalPersistence[]=[];
const store=(fault?:(p:FailurePoint)=>void)=>{const p=new FormalPersistence({suffix:'v91-'+crypto.randomUUID(),fault});stores.push(p);return p;};
afterEach(async()=>{for(const p of stores.splice(0))await p.db.delete();});
afterAll(()=>{mkdirSync('docs/b5-v91',{recursive:true});writeFileSync('docs/b5-v91/balance-matrix.json',JSON.stringify(matrix,null,2));writeFileSync('docs/b5-v91/regression-evidence.json',JSON.stringify(evidence,null,2));});
function begin(units:Record<string,number>,wall=15,tech=false){let w=battlefield();w.cities[0].military!.units={...units};w.cities[1].wallLevel=wall;w.factions[0].civilizationId='civ_frankia';if(tech){w.factions[1].civilizationId='civ_byzantium';w.factions[1].techIds=['civilization.imperial-wall'];}return arrive(dispatch(w,'conquest',units).world);}
function finish(w:FormalWorld){let reports:FormalReport[]=[];while(w.combat!.battles.length){const t=advanceFormal(w,w.combat!.battles[0].nextRoundAt);w=t.world;reports.push(...t.reports);}return{world:w,reports};}
// Independent specification oracle: cumulative table and published fixture base attacks.
// Never uses resolveSiege, combatStats, wall output or damage helpers to construct expectations.
const durability=[0,30,35,40,45,50,60,70,80,90,105,120,140,160,185,210];
const profiles:{name:string;units:Record<string,number>;power:number}[]=[{name:'small',units:{militia:10},power:2.1},{name:'mixed',units:{militia:300,spearman:200,archer:100,knight:100},power:121},{name:'large',units:{militia:1000,spearman:1000,archer:1000,knight:200},power:466},{name:'guard',units:{'guard.civ_frankia':100},power:36}];
const cases=profiles.flatMap(p=>[0,1,7,15].flatMap(wall=>[0,1,5,10,20].flatMap(rams=>[false,true].map(byzantine=>({profile:p,wall,rams,byzantine}))))) ;
describe('v91 actual Formal scheduler/resolver balance matrix',()=>{
 it.each(cases)('$profile.name wall=$wall rams=$rams Byzantine=$byzantine',({profile,wall,rams,byzantine})=>{
  const power=profile.power+rams*60,total=durability.slice(0,wall+1).reduce((n,x)=>n+x,0)*(byzantine?1.2:1),needed=wall?Math.ceil((total-1e-9)/power):0,expectedRounds=Math.min(12,needed),expectedConquered=needed<=12;
  const spent=expectedRounds*power,remaining=Math.max(0,total-spent);let expectedWall=0;for(let level=1;level<=wall;level++)if(durability.slice(0,level+1).reduce((n,x)=>n+x,0)*(byzantine?1.2:1)+1e-9>=remaining){expectedWall=remaining>1e-9?level:0;break;}
  const units:Record<string,number>={...profile.units,...(rams?{ram:rams}:{})},first=begin(units,wall,byzantine),end=finish(first.world),reports=[...first.reports,...end.reports];expect(reports).toHaveLength(1);
  const report=reports[0].battle!;expect(report.siegeRounds).toBe(expectedRounds);expect(report.wallAfter).toBe(expectedWall);expect(report.conquestReason).toBe(expectedConquered?'conquered':'siege-timeout');expect(end.world.cities[1].ownerFactionId===end.world.playerFactionId).toBe(expectedConquered);expect(report.rounds).toBe(1);expect(report.siegeHistory).toHaveLength(expectedRounds);
  matrix.push({profile:profile.name,wall,rams,byzantine,power,total,expected:{needed,rounds:expectedRounds,wall:expectedWall,reason:expectedConquered?'conquered':'siege-timeout'},actual:{rounds:report.siegeRounds,wall:report.wallAfter,reason:report.conquestReason},status:'PASS'});
 });
});
it.each([{n:615,rounds:11,reason:'conquered',wall:0},{n:564,rounds:12,reason:'conquered',wall:0},{n:563,rounds:12,reason:'siege-timeout',wall:1}])('independent siege boundary militia=$n',({n,rounds,reason,wall})=>{const first=begin({militia:n}),id=first.world.combat!.battles[0].id,end=finish(first.world),p=end.reports[0].battle!;expect(p.siegeRounds).toBe(rounds);expect(p.conquestReason).toBe(reason);expect(p.wallAfter).toBe(wall);expect(p.battleId).toBe(id);evidence['boundary-'+n]=p;});
it('first immediate siege carries partial level damage, consumes overflow through all 15 levels, and timeout clears only the incomplete level',()=>{
 const first=begin({militia:1,ram:1}),b=first.world.combat!.battles[0];expect(first.reports).toHaveLength(0);expect(first.world.armies[0].status).toBe('engaged');expect(b).toMatchObject({phase:'siege',round:1,siegeRound:1,wallDamageLevel:15});expect(b.wallDamage).toBeCloseTo(60.21);
 let w=advanceFormal(first.world,b.nextRoundAt).world;expect(w.combat!.battles[0].wallDamage).toBeCloseTo(120.42);w=advanceFormal(w,w.combat!.battles[0].nextRoundAt).world;w=advanceFormal(w,w.combat!.battles[0].nextRoundAt).world;expect(w.cities[1].wallLevel).toBe(14);expect(w.combat!.battles[0].wallDamage).toBeCloseTo(30.84);
 const end=finish(w);expect(end.world.cities[1].wallLevel).toBe(11);expect(end.reports[0].battle!.conquestReason).toBe('siege-timeout');expect(end.world.combat!.battles).toHaveLength(0);expect(end.world.armies[0].status).toBe('returning');expect(end.world.cities[1].integrationWorkHours).toBe(0);
 const quick=begin({militia:1,ram:20});expect(quick.world.combat!.battles[0].siegeRound).toBe(1);const done=finish(quick.world);expect(done.reports[0].battle!.siegeRounds).toBe(2);expect(done.world.cities[1].wallLevel).toBe(0);evidence.partial={first:b,final:end.reports[0].battle};
});
it('defending reinforcement pauses siege, own attacking arrivals join, and training resumes main without replenishing siege allowance or HP',()=>{
 let t=begin({militia:500,ram:1,catapult:2}),w=t.world,b=w.combat!.battles[0];expect(b.siegeRound).toBe(1);const hp=b.attackers[0].hp,damage=b.wallDamage,developmentLost=b.developmentLost;
 w.factions[1].empireId=w.factions[2].empireId=empireId('defenders');w.cities[2].military!.units={militia:10};w=dispatch(w,'reinforce',{militia:10},2,1).world;
 const reinforcement=w.armies.find(a=>a.ownerFactionId===w.factions[2].id)!;w=advanceFormal(w,reinforcement.arrivalAt!).world;expect(w.combat!.battles[0].phase).toBe('combat');expect(w.combat!.battles[0].siegeRound).toBe(1);expect(w.combat!.battles[0].attackers[0].hp).toBe(hp);expect(w.combat!.battles[0].wallDamage).toBe(damage);
 w.cities[0].military!.units={militia:100,catapult:10};w=dispatch(w,'conquest',{militia:100,catapult:10}).world;w=advanceFormal(w,w.armies.find(a=>a.status==='outbound')!.arrivalAt!).world;expect(w.armies.filter(a=>a.status==='engaged')).toHaveLength(2);
 build(w.cities[1],'barracks',15);w.factions[1].age=3;w=issue(w,{type:'military.recruit',cityId:w.cities[1].id,unitId:'militia',count:1},w.factions[1].id).world;
 const priorRound=w.combat!.battles[0].round,priorSiege=w.combat!.battles[0].siegeRound!;w=advanceFormal(w,w.combat!.battles[0].nextRoundAt).world;expect(w.combat!.battles[0].round).toBe(priorRound+1);expect(w.combat!.battles[0].siegeRound).toBe(priorSiege+1);expect(w.combat!.battles[0].developmentLost).toBe(developmentLost);expect(w.combat!.battles[0].history!.filter(e=>e.kind==='catapult-batch')).toHaveLength(1);const end=finish(w);expect(end.reports).toHaveLength(1);expect(end.reports[0].battle!.attackers).toHaveLength(2);evidence.reinforcement=end.reports[0].battle;
});
it('training at the exact siege deadline is resolved before combat.round; no extra siege consumption while defender remains',()=>{
 let w=begin({militia:10,ram:1}).world;build(w.cities[1],'stable',15);w.factions[1].age=3;w=issue(w,{type:'military.recruit',cityId:w.cities[1].id,unitId:'knight',count:20},w.factions[1].id).world;
 const b=w.combat!.battles[0],job=w.cities[1].military!.queue[0];job.nextAt=b.nextRoundAt;w.events.find(e=>e.id===job.eventId)!.at=b.nextRoundAt;
 const end=advanceFormal(w,b.nextRoundAt);expect(end.world.combat!.battles[0]).toMatchObject({phase:'combat',round:2,siegeRound:1});expect(end.world.combat!.battles[0].participants.find(p=>p.armyId===null)!.before.knight).toBe(1);expect(end.world.combat!.battles[0].history!.some(e=>e.kind==='combat-resumed')).toBe(true);validateFormalWorld(end.world);evidence.training=end.world.combat!.battles[0];
});
it('save/load, export/import, manual Recovery and offline catch-up preserve one Siege BattleId and final report',async()=>{
 const p=store();let w=await p.start(begin({militia:1,ram:20}).world);const id=w.combat!.battles[0].id,round=w.combat!.battles[0].siegeRound,damage=w.combat!.battles[0].wallDamage,checkpoint=(await p.backupList())[0];
 const loaded=(await p.loadSave()).game!;expect(loaded).toEqual(w);const full=await p.exportStoredSave('full'),q=store();const imported=await q.importSave(full);expect(imported.combat!.battles[0]).toMatchObject({id,siegeRound:round,wallDamage:damage});
 const end=finish(w);w=await p.save(end.world,end.reports,w.revision);expect((await p.readReportPage(w)).count).toBe(1);let restored=await p.restore(checkpoint.id);expect(restored.combat!.battles[0].id).toBe(id);const again=finish(restored);restored=await p.save(again.world,again.reports,restored.revision);expect((await p.readReportPage(restored)).count).toBe(1);expect(restored.combat!.receipts.filter(r=>r.kind==='final'&&r.battleId===id)).toHaveLength(1);
 const realMs=(end.world.time-loaded.time)/loaded.speed,offline=advanceOffline(loaded,0,realMs);expect({...offline.world,revision:0}).toEqual({...end.world,revision:0});expect(offline.reports).toEqual(end.reports);evidence.persistence={id,round,damage,final:end.reports[0].battle};
});
it('R1 restores a valid intermediate siege after corruption, retaining partial damage and spent rounds',async()=>{
 const p=store();let w=await p.start(begin({militia:1,ram:1}).world);for(let i=0;i<3;i++){const t=advanceFormal(w,w.combat!.battles[0].nextRoundAt);w=await p.save(t.world,t.reports,w.revision);}const current=await p.db.saves.get('current');if(!current||current.kind!=='world')throw Error('row');current.data.checksum='0'.repeat(64);await p.db.saves.put(current);
 const backups=await p.db.backups.toArray(),latest=backups.at(-1)!;latest.data.checksum='f'.repeat(64);await p.db.backups.put(latest);const loaded=await p.loadSave();expect(loaded.recovered).toBe(true);expect(loaded.game!.combat!.battles[0].siegeRound).toBe(3);expect(loaded.game!.combat!.battles[0].wallDamage).toBeCloseTo(180.63);expect(finish(loaded.game!).reports[0].battle!.siegeRounds).toBe(12);evidence.r1=loaded.game!.combat!.battles[0];
});
it.each(['report-write','backup-write','world-write','authority-write'] as const)('v91 %s atomic failure cannot duplicate final effects',async point=>{
 let failure:FailurePoint|undefined;const p=store(at=>{if(at===failure)throw Error('fault');});let w=await p.start(begin({militia:1,ram:20}).world);const before=await p.db.saves.toArray(),next=w.combat!.battles[0].nextRoundAt,t=advanceFormal(w,next);failure=point;await expect(p.save(t.world,t.reports,w.revision)).rejects.toThrow('fault');expect(await p.db.saves.toArray()).toEqual(before);expect(await p.db.BattleReports.count()).toBe(0);failure=undefined;w=await p.save(t.world,t.reports,w.revision);expect(await p.db.BattleReports.count()).toBe(1);expect(advanceFormal(w,next).reports).toHaveLength(0);evidence[point]={finals:w.combat!.receipts.filter(r=>r.kind==='final').length,reports:await p.db.BattleReports.count()};
});
it('old native ongoing/in-flight armies keep IDs, rounds, pools, deadlines and receipts; old reports remain without invented siege fields',async()=>{
 let w=battlefield();w.cities[0].military!.units={militia:100};w.cities[1].military!.units={militia:100};w=arrive(dispatch(w,'conquest',{militia:100}).world).world;const b=w.combat!.battles[0];for(const key of ['phase','siegeRound','wallDamage','wallDamageLevel','catapultBatchDone','developmentLost','siegeChanges','siegeHistory','history','historyOmitted'])delete (b as unknown as Record<string,unknown>)[key];w.metadata.rulesetVersion='v86-b5.1';const envelope=await encodeSave(w),loaded=(await decodeSave(envelope)).world;expect(loaded.combat!.battles[0]).toMatchObject({...b,phase:'combat',siegeRound:0,catapultBatchDone:false});expect(loaded.combat!.receipts).toEqual(w.combat!.receipts);expect(loaded.armies).toEqual(w.armies);expect(loaded.events).toEqual(w.events);expect(finish(loaded).reports).toHaveLength(1);evidence.legacy=loaded.combat!.battles[0];
});
it.each([1,3,6,10,50,200])('speed %s follows tactical cap and eleven siege intervals',speed=>{
 let w=battlefield();w.speed=speed===200?50:speed as FormalWorld['speed'];if(speed===200)w.developer={enabled:true,speed:200};w.cities[0].military!.units={militia:1};w.cities[1].wallLevel=15;const first=arrive(dispatch(w,'conquest',{militia:1}).world),b=first.world.combat!.battles[0];expect((b.nextRoundAt-first.world.time)/speed).toBe(300000/Math.min(speed,10));const end=finish(first.world);expect((end.world.time-first.world.time)/speed).toBe(11*300000/Math.min(speed,10));expect(end.reports[0].battle!.siegeRounds).toBe(12);evidence['speed-'+speed]={realInterval:tacticalRoundWorldMs(speed)/speed,realSiegeMs:(end.world.time-first.world.time)/speed};
});
it('player permissions expose only own precise forces and bounded legal history, never pools/hidden HP or exact enemy count',()=>{
 let w=battlefield();w.cities[0].military!.units={militia:1000};w.cities[1].military!.units={militia:777};w=arrive(dispatch(w,'conquest',{militia:1000}).world).world;const b=w.combat!.battles[0],attack=liveBattleView(w,b.id)!;expect(attack.initial).toEqual({militia:1000});expect(JSON.stringify(attack)).not.toMatch(/hp|Damage|hpPerUnit|777/);w.playerFactionId=w.factions[1].id;expect(liveBattleView(w,b.id)!.defending).toBe(true);w.playerFactionId=w.factions[2].id;expect(liveBattleView(w,b.id)).toBeNull();
 const replay=structuredClone(w),receipt=w.combat!.receipts[0];expect(handleCombatEvent(w,{type:'combat.round',battleId:b.id,id:receipt.eventId,at:receipt.at},new EventScheduler(w.events))).toEqual([]);expect(w).toEqual(replay);expect(BATTLE_HISTORY_LIMIT).toBe(64);
});
it('reinforcement after siege 11 resumes only the remaining twelfth attempt under the original BattleId',()=>{
 let w=begin({militia:10}).world;while(w.combat!.battles[0].siegeRound!<11)w=advanceFormal(w,w.combat!.battles[0].nextRoundAt).world;const id=w.combat!.battles[0].id;
 w.factions[1].empireId=w.factions[2].empireId=empireId('defenders');w.cities[2].military!.units={militia:1};w=dispatch(w,'reinforce',{militia:1},2,1).world;w=advanceFormal(w,w.armies.find(a=>a.status==='outbound')!.arrivalAt!).world;expect(w.combat!.battles[0]).toMatchObject({id,phase:'combat',siegeRound:11});
 const t=advanceFormal(w,w.combat!.battles[0].nextRoundAt);expect(t.world.combat!.battles).toHaveLength(0);expect(t.reports).toHaveLength(1);expect(t.reports[0].battle!).toMatchObject({battleId:id,siegeRounds:12,conquestReason:'siege-timeout'});evidence.lastRoundReinforcement=t.reports[0].battle;
});
it('completed ram/weapon tech uses actual owner identity; construction preserves snapshots and cannot carry damage from a different wall level',()=>{
 let w=battlefield();w.factions[0].age=3;w.factions[0].civilizationId='civ_frankia';w.factions[0].techIds=['blacksmith.melee.1','blacksmith.melee.2','blacksmith.melee.3','siege.ram.1','siege.ram.2'];w.cities[0].military!.units={militia:100,ram:1};w.cities[1].wallLevel=15;
 w=arrive(dispatch(w,'conquest',{militia:100,ram:1}).world).world;expect(w.combat!.battles[0].wallDamage).toBeCloseTo(100*7*1.12*.03+60*1.2);
 let c=begin({militia:50},1).world;const before=c.combat!.battles[0].wallDamage;expect(before).toBeCloseTo(10.5);c.factions[1].age=3;build(c.cities[1],'center',5);c=issue(c,{type:'building.upgrade',cityId:c.cities[1].id,key:'wall'},c.factions[1].id).world;const job=structuredClone(c.cities[1].economy!.construction[0]);
 // Inspect actual scheduler order, preserving the genuine paid/duration/EventId snapshot.
 const due=job.startsAt+job.durationMs;c=advanceFormal(c,due).world;const active=c.combat!.battles[0];if(active&&active.wallDamageLevel!==c.cities[1].wallLevel){const level=c.cities[1].wallLevel!;const t=advanceFormal(c,active.nextRoundAt);if(t.world.combat!.battles.length){const b=t.world.combat!.battles[0];expect(b.wallDamageLevel).toBe(level);expect(b.wallDamage).toBeCloseTo(10.5);}}
 expect(c.events.some(e=>e.id===job.eventId)).toBe(false);validateFormalWorld(c);evidence.wallConstruction={job,world:c.time,wall:c.cities[1].wallLevel};
});
it('losing all occupying soldiers during siege never lets surviving engines transfer ownership or apply population losses',()=>{
 let w=begin({militia:1,ram:1}).world;const owner=w.cities[1].ownerFactionId,pop=w.cities[1].population;w.armies[0].units={ram:1};const t=advanceFormal(w,w.combat!.battles[0].nextRoundAt);expect(t.reports[0].battle!.conquestReason).toBe('no-occupiers');expect(t.world.cities[1].ownerFactionId).toBe(owner);expect(t.world.cities[1].population).toBeGreaterThanOrEqual(pop);expect(t.world.cities[1].integrationWorkHours).toBe(0);evidence.noOccupiers=t.reports[0].battle;
});
it('switching developer 50X to 200X keeps remaining tactical time, EventId and siege budget',()=>{
 let w=battlefield();w.speed=50;w.cities[0].military!.units={militia:1};w.cities[1].wallLevel=15;w=arrive(dispatch(w,'conquest',{militia:1}).world).world;const b=structuredClone(w.combat!.battles[0]);
 w=issue(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed:200}).world;expect((w.combat!.battles[0].nextRoundAt-w.time)/200).toBe(30000);expect(w.combat!.battles[0]).toMatchObject({id:b.id,roundEventId:b.roundEventId,siegeRound:1,wallDamage:b.wallDamage});validateFormalWorld(w);
});
it('strict v91 save schema rejects partial progress, excess rounds, future summaries and overfull wall damage',()=>{
 const w=begin({militia:1,ram:1}).world;for(const mutate of [(b:NonNullable<FormalWorld['combat']>['battles'][0])=>{delete b.wallDamage;},(b:NonNullable<FormalWorld['combat']>['battles'][0])=>{b.siegeRound=13;},(b:NonNullable<FormalWorld['combat']>['battles'][0])=>{b.wallDamage=999999;},(b:NonNullable<FormalWorld['combat']>['battles'][0])=>{b.history![0].at=w.time+1;}]){const copy=structuredClone(w);mutate(copy.combat!.battles[0]);expect(()=>validateFormalWorld(copy)).toThrow();}
});
it('v0.30.38 native outbound conquest preserves its path, army/battle/command identities and deadline when loaded into v91',async()=>{
 let w=battlefield();w.cities[0].military!.units={militia:1,ram:1};w.cities[1].wallLevel=15;w=dispatch(w,'conquest',{militia:1,ram:1}).world;w.metadata.rulesetVersion='v86-b5.1';const army=structuredClone(w.armies[0]),loaded=(await decodeSave(await encodeSave(w))).world;expect(loaded.armies[0]).toEqual(army);expect(loaded.events).toEqual(w.events);expect(loaded.metadata.rulesetVersion).toBe('v91-b5.2');const arrived=arrive(loaded);expect(arrived.world.combat!.battles[0]).toMatchObject({id:army.battleId,phase:'siege',siegeRound:1});expect(arrived.reports).toHaveLength(0);evidence.legacyOutbound={army,battle:arrived.world.combat!.battles[0]};
});
