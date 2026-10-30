import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {GROWTH_TASKS,GROWTH_TASK_BY_ID} from './growthTaskCatalog';
import {GROWTH_REWARDS_V1} from './growthTaskRewardsV1';
import {growthTaskState,quoteGrowthReward,syncGrowthTasks,claimableGrowthCount} from './growthTasks';
import {createFormalFixture} from './fixture';
import {initializeEconomy,changeCityOwner,citySnapshot} from './economy';
import {initialMilitary} from './military';
import {BUILDING_CATALOG,storageCapacity} from './catalogB3';
import {advanceFormal,advanceFormalCooperative,submitFormalOrder} from './reducer';
import {order,rich,build} from './developmentTestSupport';
import {validateFormalWorld} from './schema';
import {encodeSave,decodeSave} from './saveCodec';
import {FormalPersistence,type FailurePoint} from '../persistence';
import {HOUR} from './time';
import {TECH_CATALOG} from './techCatalog';
import {UNIT_CATALOG} from './unitCatalog';
import type {FormalWorld} from './model';
import {resourceKeys} from './model';
import {battlefield,dispatch,arrive,issue} from './combatTestSupport';
import {isMissionArmy} from './combatModel';
import {createExile} from './extinction';
import {spatial} from './spatial';
import {buildable,terrainAt} from './terrain';
const stores:FormalPersistence[]=[];afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();});
const store=(fault?:(point:FailurePoint)=>void)=>{const s=new FormalPersistence({suffix:'growth-'+crypto.randomUUID(),fault});stores.push(s);return s;};
function fixture(){const w=createFormalFixture({campaign:'growth-fixture-'+crypto.randomUUID()});w.armies=[];for(const c of w.cities){c.fields=Array.from({length:18},(_,slot)=>({slot,resource:resourceKeys[slot<6?0:slot<11?1:slot<15?2:3],level:0}));c.wallLevel=0;c.cityPromotionCompleted=false;c.integrationWorkHours=0;c.military=initialMilitary();}initializeEconomy(w);return w;}
function claim(w:FormalWorld,id:string,city=w.cities[0],key='claim-'+crypto.randomUUID()){const t=GROWTH_TASK_BY_ID.get(id)!;return order(w,{type:'tasks.claim',cityId:city.id,taskId:id,rewardVersion:2,expectedResources:quoteGrowthReward(w,city,t).accepted},key);}
function ready(){let w=fixture();w=issue(w,{type:'field.upgrade',cityId:w.cities[0].id,slot:0}).world;const at=w.cities[0].economy!.construction[0].startsAt+w.cities[0].economy!.construction[0].durationMs;w=advanceFormal(w,at).world;for(const c of w.cities.filter(c=>c.ownerFactionId===w.playerFactionId))c.stock={food:0,wood:600,stone:0,gold:0};return w;}
it('all 80 IDs and unchanged names match v94, while immutable v1 rewards preserve every original row',()=>{
 const text=readFileSync('docs/b6-v94/河谷戰役_vNext_平衡重構討論_v94.md','utf8'),rows=[...text.matchAll(/^\| ([NFCI]\d{2}) \| (.*?) \| ([\d,]+) \| ([\d,]+) \| ([\d,]+) \| ([\d,]+) \| ([\d,]+) \|/gm)];expect(rows).toHaveLength(80);expect(GROWTH_TASKS).toHaveLength(80);expect(new Set(GROWTH_TASKS.map(t=>t.id)).size).toBe(80);
 for(const [prefix,count]of [['N',14],['F',29],['C',20],['I',17]] as const)expect(GROWTH_TASKS.filter(t=>t.era===prefix).map(t=>t.id)).toEqual(Array.from({length:count},(_,i)=>prefix+String(i+1).padStart(2,'0')));
 for(const row of rows){const t=GROWTH_TASK_BY_ID.get(row[1])!;expect(t.title).toBe(row[2]);expect(resourceKeys.map(r=>GROWTH_REWARDS_V1[t.id][r])).toEqual(row.slice(3,7).map(n=>Number(n.replaceAll(',',''))));expect(Object.values(GROWTH_REWARDS_V1[t.id]).reduce((a,b)=>a+b,0)).toBe(Number(row[7].replaceAll(',','')));expect(t.prerequisites.length).toBeGreaterThan(10);if(t.fact.startsWith('building:'))expect(Object.hasOwn(BUILDING_CATALOG,t.fact.split(':')[1])).toBe(true);}
 expect(resourceKeys.map(r=>GROWTH_TASKS.reduce((n,t)=>n+GROWTH_REWARDS_V1[t.id][r],0))).toEqual([231300,522275,796550,762875]);
});
for(const t of GROWTH_TASKS.filter(t=>t.fact.startsWith('field:')&&t.fact.split(':')[1]!=='any'))it(`${t.id} uses a real lawful field completion at its exact level`,()=>{
 let w=fixture(),c=w.cities[0];rich(w,c);build(c,'center',10);w.factions[0].age=3;const field=c.fields!.find(f=>f.resource===t.fact.split(':')[1])!;field.level=t.target-1;
 const pending=submitFormalOrder(w,order(w,{type:'field.upgrade',cityId:c.id,slot:field.slot}));expect(pending.ack?.status,pending.ack?.reason).toBe('committed');expect(pending.world.growthTasks?.completed[t.id]).toBeUndefined();const job=pending.world.cities[0].economy!.construction[0];w=advanceFormal(pending.world,job.startsAt+job.durationMs).world;expect(w.growthTasks?.completed[t.id]).toBeDefined();
 if(t.target>1)expect(w.growthTasks?.completed['N0'+(resourceKeys.indexOf(t.fact.split(':')[1] as typeof resourceKeys[number])+1)]).toBeUndefined();
});
for(const t of GROWTH_TASKS.filter(t=>t.fact.startsWith('building:')))it(`${t.id} requires the player's real building completion, never a conquered snapshot`,()=>{
 let w=fixture(),c=w.cities[0];rich(w,c);build(c,'center',10);w.factions[0].age=3;const kind=t.fact.split(':')[1] as keyof typeof BUILDING_CATALOG,key=kind==='warehouse'||kind==='bunker'?kind+'.1':kind;
 for(const [k,n]of Object.entries(BUILDING_CATALOG[kind].prerequisites))build(c,k,n);if(['mill','lumbermill','masonry','mint'].includes(kind))for(const field of c.fields!)field.level=5;
 if(kind==='wall')c.wallLevel=t.target-1;else if(t.target>1)build(c,key,t.target-1);else{delete c.buildings[key];delete c.economy!.slots[key];}
 const pending=submitFormalOrder(w,order(w,{type:'building.upgrade',cityId:c.id,key}));expect(pending.ack?.status,pending.ack?.reason).toBe('committed');expect(pending.world.growthTasks?.completed[t.id]).toBeUndefined();const job=pending.world.cities[0].economy!.construction.find(j=>j.target.kind==='building'&&j.target.key===key)!;w=advanceFormal(pending.world,job.startsAt+job.durationMs).world;expect(w.growthTasks?.completed[t.id]).toBeDefined();
});
it('old snapshots never fabricate construction, troop or military history; provable age/tech milestones may be recognized',()=>{
 const w=fixture();w.cities[0].buildings.barracks=15;w.cities[0].fields![0].level=10;w.cities[0].military!.units.militia=500;w.factions[0].age=3;w.factions[0].techIds=['elite.infantry','elite.ranged','logistics.auto'];expect(growthTaskState(w).completed).toEqual({});const migrated=structuredClone(w);syncGrowthTasks(migrated);const state=growthTaskState(migrated);expect(state.completed.N01).toBeUndefined();expect(state.completed.N11).toBeUndefined();expect(state.completed.N10).toBeUndefined();for(const id of ['N14','F29','I01','F22','C14','I11','I12'])expect(state.completed[id]).toBeDefined();expect(w.growthTasks).toBeUndefined();
});
it('player/AI ownership, cancellation and captured high buildings cannot produce completion or bulk lower-level rewards',()=>{
 let w=fixture();const ai=w.cities[2];ai.fields![0].level=10;w=issue(w,{type:'field.upgrade',cityId:ai.id,slot:1},ai.ownerFactionId).world;const job=w.cities[2].economy!.construction[0];w=advanceFormal(w,job.startsAt+job.durationMs).world;expect(w.growthTasks?.completed.N01).toBeUndefined();changeCityOwner(w,w.cities[2],w.playerFactionId,'receive');syncGrowthTasks(w);expect(w.growthTasks?.completed.I02).toBeUndefined();
 let cancel=fixture();cancel=issue(cancel,{type:'field.upgrade',cityId:cancel.cities[0].id,slot:0}).world;const j=cancel.cities[0].economy!.construction[0];cancel=issue(cancel,{type:'construction.cancel',cityId:cancel.cities[0].id,constructionCommandId:j.commandId}).world;cancel=advanceFormal(cancel,j.startsAt+j.durationMs).world;expect(cancel.growthTasks?.completed.N01).toBeUndefined();
});
it('manual claims require all four resources to fit, including reservations, and credit once atomically',()=>{
 let w=ready();const c=w.cities[1],cap=storageCapacity(c);c.stock={food:cap-10,wood:cap,stone:cap-50,gold:cap-100};c.economy!.reservedIncoming.gold=20;const q=quoteGrowthReward(w,c,GROWTH_TASK_BY_ID.get('N01')!);expect(q.available).toEqual({food:10,wood:0,stone:50,gold:80});expect(q.shortfall).toEqual({food:40,wood:175,stone:100,gold:45});expect(q.canClaim).toBe(false);
 c.economy!.reservedIncoming.gold=0;const before=structuredClone(w);expect(submitFormalOrder(w,claim(w,'N01',c)).ack?.status).toBe('rejected');expect(w).toEqual(before);expect(w.growthTasks!.claimed.N01).toBeUndefined();
 c.stock={food:0,wood:0,stone:0,gold:0};const o=claim(w,'N01',c),t=submitFormalOrder(w,o);expect(t.ack?.status,t.ack?.reason).toBe('committed');expect(t.reports).toEqual([]);expect(t.world.cities[1].stock).toEqual(GROWTH_TASK_BY_ID.get('N01')!.reward);expect(t.world.growthTasks!.claimed.N01.rewardVersion).toBe(2);expect(t.world.growthTasks!.claimed.N01.lost).toEqual({food:0,wood:0,stone:0,gold:0});expect(submitFormalOrder(t.world,o).ack?.status).toBe('duplicate');expect(submitFormalOrder(t.world,claim(t.world,'N01',t.world.cities[0])).ack?.status).toBe('rejected');expect(claimableGrowthCount(t.world)).toBe(claimableGrowthCount(w)-1);
 const transferred=structuredClone(t.world);changeCityOwner(transferred,transferred.cities[1],transferred.factions[1].id,'receive');expect(()=>validateFormalWorld(transferred)).not.toThrow();expect(submitFormalOrder(transferred,claim(transferred,'N01',transferred.cities[0])).ack?.status).toBe('rejected');
});
it('rejects unknown/uncompleted tasks, AI claimants, changed ownership and stale reward confirmations',()=>{
 const w=ready(),p=w.cities[0],o=claim(w,'N01');expect(()=>submitFormalOrder(w,{...o,payload:{...o.payload,taskId:'N99'}})).toThrow('命令格式無效');
 expect(submitFormalOrder(w,claim(w,'F01')).ack?.status).toBe('rejected');const aiOrder=claim(w,'N01',w.cities[2]);aiOrder.issuerId=w.cities[2].ownerFactionId;expect(submitFormalOrder(w,aiOrder).ack?.status).toBe('rejected');
 const transferred=structuredClone(w);changeCityOwner(transferred,transferred.cities[0],transferred.factions[1].id,'receive');expect(submitFormalOrder(transferred,o).ack?.status).toBe('rejected');p.stock.wood=storageCapacity(p);expect(submitFormalOrder(w,o).ack?.status).toBe('rejected');
});
it('full inventory preserves the entire unclaimed reward indefinitely',()=>{
 let w=ready();w=advanceFormal(w,w.time+3*HOUR).world;const c=w.cities[0],cap=storageCapacity(c);for(const r of resourceKeys)c.stock[r]=cap;const before=structuredClone(w),t=submitFormalOrder(w,claim(w,'N01'));expect(t.ack?.status).toBe('rejected');expect(t.world).toEqual(before);expect(t.world.growthTasks!.claimed.N01).toBeUndefined();expect(claimableGrowthCount(t.world)).toBe(claimableGrowthCount(w));
});
it('population milestones are single-city, sticky, do not trust inherited city milestones and agree across offline/segmented replay',async()=>{
 const w=fixture();for(const c of w.cities.filter(c=>c.ownerFactionId===w.playerFactionId)){c.population=300;c.housing=30400;}syncGrowthTasks(w);expect(w.growthTasks?.completed.N13).toBeUndefined();w.cities[0].population=490;w.cities[0].economy!.milestones=[30000];const end=5*HOUR,a=advanceFormal(w,end).world;let b=w;for(let at=HOUR/3;at<=end;at+=HOUR/3)b=advanceFormal(b,at).world;const cooperative=(await advanceFormalCooperative(w,end,undefined,{yieldIntervalMs:0})).world;expect(a.growthTasks).toEqual(b.growthTasks);expect(a.growthTasks).toEqual(cooperative.growthTasks);expect(a.growthTasks?.completed.N13).toBeDefined();expect(a.growthTasks?.completed.I10).toBeUndefined();a.cities[0].population=1;syncGrowthTasks(a);expect(a.growthTasks?.completed.N13).toBeDefined();
});
it('scouting counts only returned enemy-city intel; raids count only surviving returned loot',()=>{
 let w=battlefield();w.cities[0].military!.units={scout:5,militia:200};w=dispatch(w,'scout',{scout:5}).world;w=arrive(w).world;expect(w.growthTasks?.completed.F23).toBeUndefined();const scout=w.armies.filter(isMissionArmy).find(a=>a.status==='returning')!;w=advanceFormal(w,scout.arrivalAt).world;expect(w.growthTasks?.completed.F23).toBeDefined();w=dispatch(w,'raid',{militia:100}).world;w=arrive(w).world;expect(w.growthTasks?.completed.C08).toBeUndefined();const army=w.armies.filter(isMissionArmy).find(a=>a.status==='returning')!;w=advanceFormal(w,army.arrivalAt).world;expect(w.growthTasks?.completed.C08).toBeDefined();
});
it('claim and durable task authority survive reload, corrupt-checkpoint Recovery and command resending without new IDs bypassing claims',async()=>{
 const s=store();let w=await s.start(ready());const before=(await s.backupList())[0].id,o=claim(w,'N01');const t=submitFormalOrder(w,o);w=await s.save(t.world,t.reports,w.revision);expect((await s.loadSave()).game!.growthTasks).toEqual(w.growthTasks);const restored=await s.restore(before);expect(restored.growthTasks!.claimed.N01).toBeDefined();expect(submitFormalOrder(restored,o).ack?.status).toBe('rolled-back');expect(submitFormalOrder(restored,claim(restored,'N01')).ack?.status).toBe('rejected');
 const imported=await s.importSave(JSON.stringify(await encodeSave(ready())));expect(imported.growthTasks).toBeDefined();
});
it('claim transaction failure leaves inventory, claim ledger and CAS authority untouched; retry then awards once',async()=>{
 let fail=false;const s=store(point=>{if(fail&&point==='authority-write')throw Error('injected task save fault');});const w=await s.start(ready()),o=claim(w,'N01'),t=submitFormalOrder(w,o);fail=true;await expect(s.save(t.world,t.reports,w.revision)).rejects.toThrow('injected');expect((await s.loadSave()).game).toEqual(w);fail=false;const next=await s.save(t.world,t.reports,w.revision);expect(next.growthTasks!.claimed.N01).toBeDefined();expect(submitFormalOrder(next,o).ack?.status).toBe('duplicate');expect((await decodeSave(await encodeSave(next))).world).toEqual(next);
});
it('validates tamper and prevents ordinary saves dropping irreversible task authority',async()=>{
 const s=store(),w=await s.start(ready()),t=submitFormalOrder(w,claim(w,'N01')),saved=await s.save(t.world,[],w.revision);const bad=structuredClone(saved);bad.growthTasks!.claimed.N01.accepted.food++;expect(()=>validateFormalWorld(bad)).toThrow();const dropped=structuredClone(saved);dropped.revision++;delete dropped.growthTasks;await expect(s.save(dropped,[],saved.revision)).rejects.toThrow('Durable growth task');
});
for(const [unit,id,count]of [['militia','N11',5],['guard.civ_zhongguo','C04',1],['baggage','C05',1],['ram','C06',1],['catapult','C07',1]]as const)it(`${id} records only actual completed ${unit} training`,()=>{
 let w=fixture(),c=w.cities[0];rich(w,c);w.factions[0].age=3;build(c,UNIT_CATALOG[unit].producer,1);w=issue(w,{type:'military.recruit',cityId:c.id,unitId:unit,count}).world;expect(w.growthTasks?.completed[id]).toBeUndefined();const first=w.cities[0].military!.queue[0];w=advanceFormal(w,first.nextAt+first.durationMs*(count-1)).world;expect(w.growthTasks?.completed[id]).toBeDefined();
});
for(const [tech,id]of [['blacksmith.melee.1','F22'],['logistics.auto','C14'],['elite.infantry','I11'],['elite.ranged','I12'],['elite.cavalry','I12'],['elite.guard','I13']]as const)it(`${id} observes the completed ${tech} project without introducing new research rules`,()=>{
 let w=fixture(),c=w.cities[0];rich(w,c);w.factions[0].age=3;const d=TECH_CATALOG[tech];for(const [k,n]of Object.entries(d.buildings))build(c,k,n);w.factions[0].techIds=[...d.prerequisites];c.economy!.milestones=[10000,15000,20000,22000,25000,30000];w=issue(w,{type:'research.start',cityId:c.id,techId:tech}).world;expect(w.growthTasks?.completed[id]).toBeUndefined();const p=w.researchProjects.at(-1)!;if(p.phase!=='researching')throw Error('Not researching');w=advanceFormal(w,p.startedAt+p.durationSnapshot.durationMs).world;expect(w.growthTasks?.completed[id]).toBeDefined();
});
it('all three age tasks are awarded only on actual age completion, with no task prerequisite gates',()=>{
 let w=fixture();for(const [age,id]of [[1,'N14'],[2,'F29'],[3,'I01']]as const){rich(w,w.cities[0]);build(w.cities[0],'center',10);w=issue(w,{type:'age.start',cityId:w.cities[0].id}).world;expect(w.growthTasks?.completed[id]).toBeUndefined();const p=w.factions[0].ageQueue!;w=advanceFormal(w,p.startedAt+p.durationMs).world;expect(w.factions[0].age).toBe(age);expect(w.growthTasks?.completed[id]).toBeDefined();}
});
it('City promotion and Lv11 field tasks follow actual project completions and never infer lower-level construction history',()=>{
 let w=fixture(),c=w.cities[0];rich(w,c);build(c,'townhall',5);build(c,'center',10);w.factions[0].age=3;c.economy!.milestones=[10000,15000];w=issue(w,{type:'city.promote',cityId:c.id}).world;expect(w.growthTasks?.completed.C18).toBeUndefined();const p=w.cities[0].economy!.promotion!;w=advanceFormal(w,p.startedAt+p.durationMs).world;expect(w.growthTasks?.completed.C18).toBeDefined();rich(w,w.cities[0]);w.cities[0].fields![0].level=10;w=issue(w,{type:'field.upgrade',cityId:c.id,slot:0}).world;const job=w.cities[0].economy!.construction[0];w=advanceFormal(w,job.startsAt+job.durationMs).world;expect(w.growthTasks?.completed.C19).toBeDefined();for(const id of ['N01','F01','F05','I02'])expect(w.growthTasks?.completed[id]).toBeUndefined();
});
it('real reserved incoming capacity remains protected when a reward is claimed before a shipment arrives',()=>{
 let w=ready();const source=w.cities[0],dest=w.cities[1];build(source,'market',1);dest.stock.wood=0;w=issue(w,{type:'logistics.dispatch',cityId:source.id,destinationCityId:dest.id,resources:{food:0,wood:500,stone:0,gold:0}}).world;const t=submitFormalOrder(w,claim(w,'N01',w.cities[1]));expect(t.ack?.status).toBe('committed');expect(t.world.growthTasks!.claimed.N01.accepted.wood).toBe(175);expect(t.world.growthTasks!.claimed.N01.lost.wood).toBe(0);const shipment=t.world.logistics![0],expectedWood=citySnapshot({...t.world,time:shipment.arrivalAt},dest.id)!.stock.wood+500;w=advanceFormal(t.world,shipment.arrivalAt).world;expect(w.cities[1].stock.wood).toBe(expectedWood);expect(w.cities[1].economy!.reservedIncoming.wood).toBe(0);expect(w.growthTasks?.completed.C13).toBeDefined();
});
it('automatic logistics completion uses scheduler provenance; a forged auto command ID cannot claim it',()=>{
 let w=fixture();build(w.cities[0],'market',1);w.factions[0].techIds=['logistics.auto'];for(const r of resourceKeys)w.cities[1].stock[r]=0;
 w=issue(w,{type:'logistics.dispatch',cityId:w.cities[0].id,destinationCityId:w.cities[1].id,resources:{food:100,wood:0,stone:0,gold:0}},w.playerFactionId,'auto-forged').world;w=advanceFormal(w,w.logistics![0].arrivalAt).world;expect(w.growthTasks?.completed.C13).toBeDefined();expect(w.growthTasks?.completed.C15).toBeUndefined();w=advanceFormal(w,w.logistics![0].returnAt).world;
 w=issue(w,{type:'logistics.auto.set',cityId:w.cities[0].id,rules:[{destinationCityId:w.cities[1].id,reserve:{food:0,wood:0,stone:0,gold:0},maxCaravans:1}]}).world;w=advanceFormal(w,HOUR).world;expect(w.growthTasks?.completed.C15).toBeUndefined();const shipment=w.logistics![0];expect(w.growthTasks?.autoShipments).toContain(shipment.shipmentId);w=advanceFormal(w,shipment.arrivalAt).world;expect(w.growthTasks?.completed.C15).toBeDefined();
});
it('importing an older same-campaign save preserves irreversible claims even across a world-time rewind',async()=>{
 const s=store();let w=await s.start(fixture());const old=await s.exportStoredSave('full');w=issue(w,{type:'field.upgrade',cityId:w.cities[0].id,slot:0}).world;w=await s.save(w,[],w.revision-1);const job=w.cities[0].economy!.construction[0];const a=advanceFormal(w,job.startsAt+job.durationMs);w=await s.save(a.world,a.reports,w.revision);const o=claim(w,'N01'),t=submitFormalOrder(w,o);w=await s.save(t.world,t.reports,w.revision);const restored=await s.importSave(old);expect(restored.time).toBe(0);expect(restored.growthTasks!.claimed.N01.at).toBeGreaterThan(restored.time);expect(restored.cities[0].stock).toEqual({food:600,wood:600,stone:600,gold:600});expect(submitFormalOrder(restored,claim(restored,'N01')).ack?.status).toBe('rejected');expect(submitFormalOrder(restored,o).ack?.status).toBe('rolled-back');expect(()=>validateFormalWorld(restored)).not.toThrow();
});
for(const t of GROWTH_TASKS.filter(t=>t.fact==='population'))it(`${t.id} recognizes a single own city's real crossing of ${t.target}`,()=>{
 const w=fixture();w.cities[0].population=t.target-1;w.cities[0].housing=30400;syncGrowthTasks(w);expect(w.growthTasks?.completed[t.id]).toBeUndefined();const n=advanceFormal(w,HOUR).world;expect(n.growthTasks?.completed[t.id]).toBeDefined();expect(n.growthTasks!.completed[t.id]).toBeGreaterThan(0);expect(n.growthTasks!.completed[t.id]).toBeLessThan(HOUR);
});
it('F25, F26 and I14 follow lawful governance, legion creation and consented empire membership',()=>{
 let w=battlefield();for(const c of w.cities.slice(0,2)){build(c,'townhall',1);build(c,'embassy',15);w.factions.find(f=>f.id===c.ownerFactionId)!.age=2;}
 w=issue(w,{type:'governance.set',cityId:w.cities[0].id,enabled:true,policy:'reserve',budget:2400,reserve:180}).world;expect(w.growthTasks?.completed.F25).toBeDefined();
 const act=(i:number,action:Extract<import('./model').FormalCommand,{type:'politics'}>['action'],extra:object={})=>{w=issue(w,{type:'politics',cityId:w.cities[i].id,action,...extra},w.cities[i].ownerFactionId).world;};
 act(0,'legion-create',{name:'玩家軍團'});expect(w.growthTasks?.completed.F26).toBeDefined();act(1,'legion-create',{name:'友方軍團'});act(0,'empire-propose',{target:w.cities[1].ownerFactionId,name:'成長帝國'});expect(w.growthTasks?.completed.I14).toBeUndefined();act(1,'request-accept',{requestId:w.politics!.requests[0].id});expect(w.growthTasks?.completed.I14).toBeDefined();
});
it('C20 counts only real friendly stationed reinforcements, while I15 requires real joint conquest ownership transfer',()=>{
 let w=battlefield();for(const c of w.cities.slice(0,3)){build(c,'embassy',15);w.factions.find(f=>f.id===c.ownerFactionId)!.age=2;c.military!.units={militia:100,ram:2};}
 w=issue(w,{type:'politics',cityId:w.cities[0].id,action:'legion-create',name:'合法聯軍'}).world;w=issue(w,{type:'politics',cityId:w.cities[0].id,action:'legion-invite',target:w.cities[1].ownerFactionId}).world;w=issue(w,{type:'politics',cityId:w.cities[1].id,action:'request-accept',requestId:w.politics!.requests[0].id},w.cities[1].ownerFactionId).world;
 w=dispatch(w,'reinforce',{militia:5}).world;expect(w.growthTasks?.completed.C20).toBeUndefined();w=arrive(w).world;expect(w.growthTasks?.completed.C20).toBeDefined();
 w.cities[2].military!.units={};w.cities[2].wallLevel=0;w=issue(w,{type:'joint.create',cityId:w.cities[0].id,targetCityId:w.cities[2].id,units:{militia:50},arrivalAt:w.time+HOUR}).world;const joint=w.politics!.joints[0];w=issue(w,{type:'joint.join',cityId:w.cities[1].id,jointId:joint.id,units:{militia:50}},w.cities[1].ownerFactionId).world;expect(w.growthTasks?.completed.I15).toBeUndefined();w=advanceFormal(w,joint.arrivalAt).world;expect(w.cities[2].ownerFactionId).toBe(w.playerFactionId);expect(w.growthTasks?.completed.I15).toBeDefined();expect(w.growthTasks?.completed.C09).toBeDefined();
});
it('C10, C11 and C12 require the real colonization unit, founded city and completed integration',()=>{
 let w=battlefield(),c=w.cities[0];w.factions[0].age=2;build(c,'castle',1);build(c,'center',5);c.military!.units={militia:30};w=issue(w,{type:'settlement.prepare',cityId:c.id}).world;expect(w.growthTasks?.completed.C10).toBeUndefined();const p=w.settlements![0];w=advanceFormal(w,p.startedAt+p.prepDurationMs).world;expect(w.growthTasks?.completed.C10).toBeDefined();const migrated={...w,growthTasks:undefined as import('./growthTasks').GrowthTaskState|undefined};syncGrowthTasks(migrated);expect(growthTaskState(migrated).completed.C10).toBeDefined();
 const home=w.cities[0];let target:{x:number;y:number}|undefined;for(let dy=-4;dy<=4&&!target;dy++)for(let dx=-4;dx<=4;dx++){const x=home.x+dx,y=home.y+dy,cell=spatial(w).at(x,y);if(x>=0&&y>=0&&x<384&&y<384&&buildable(terrainAt(w,x,y))&&!cell.city&&!cell.site&&!cell.reservation){target={x,y};break;}}
 expect(target).toBeDefined();w=issue(w,{type:'settlement.dispatch',cityId:c.id,...target!,name:'正式拓殖城',escort:{militia:20}}).world;expect(w.growthTasks?.completed.C11).toBeUndefined();w=advanceFormal(w,w.settlements![0].arrivalAt!).world;expect(w.growthTasks?.completed.C11).toBeDefined();expect(w.growthTasks?.completed.C12).toBeUndefined();w=advanceFormal(w,w.time+13*HOUR).world;expect(w.growthTasks?.completed.C12).toBeDefined();
});
it('F24/I16 use real exile defeat and existing recruitment settlement; I17 consumes a lawful foreign craftsman only on castle completion',()=>{
 let w=battlefield();const c=w.cities[0];w.factions[0].age=2;build(c,'center',8);build(c,'townhall',5);build(c,'academy',5);const foreign=w.factions.find(f=>f.civilizationId==='civ_japan')!;createExile(w,foreign.id,{militia:4},[],w.cities[1]);const site=w.extinction!.sites[0];c.military!.units={militia:100};w=issue(w,{type:'army.dispatch',cityId:c.id,mission:'raid',target:{kind:'wild',siteId:site.id,generation:0},units:{militia:50}}).world;w=arrive(w).world;expect(w.growthTasks?.completed.F24).toBeDefined();expect(w.growthTasks?.completed.I16).toBeDefined();w=advanceFormal(w,w.armies.filter(isMissionArmy)[0].arrivalAt).world;const craft=w.extinction!.craftsmen[0];w=issue(w,{type:'craftsman.castle',cityId:c.id,craftsmanId:craft.id}).world;expect(w.growthTasks?.completed.I17).toBeUndefined();const job=w.cities[0].economy!.construction[0];w=advanceFormal(w,job.startsAt+job.durationMs).world;expect(w.growthTasks?.completed.I17).toBeDefined();expect(w.growthTasks?.completed.C02).toBeDefined();expect(w.extinction!.craftsmen).toHaveLength(0);
});
it('loading a pre-feature native save with zero or positive offline replay initializes only trusted state and preserves claims',async()=>{
 const s=store();const w=fixture();w.cities[0].population=490;w.cities[0].housing=30400;await s.start(w);const before=await s.exportStoredSave('full'),loaded=await s.loadWithOffline(Date.now()+2*HOUR);expect(loaded.game?.growthTasks?.completed.N13).toBeDefined();expect(loaded.game?.growthTasks?.completed.N01).toBeUndefined();const other=store();await other.importSave(before);const zero=await other.loadWithOffline(Date.now());expect(zero.game?.growthTasks?.completed.N01).toBeUndefined();expect(zero.game?.metadata.schemaVersion).toBe(w.metadata.schemaVersion);
});
it('two distinct simultaneous claims to different cities cannot both pass durable CAS',async()=>{
 const s=store(),w=await s.start(ready()),left=submitFormalOrder(w,claim(w,'N01',w.cities[0])),right=submitFormalOrder(w,claim(w,'N01',w.cities[1]));const results=await Promise.allSettled([s.save(left.world,[],w.revision),s.save(right.world,[],w.revision)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);const current=(await s.loadSave()).game!;expect(Object.keys(current.growthTasks!.claimed)).toEqual(['N01']);const receipt=current.growthTasks!.claimed.N01;for(const c of current.cities){const old=w.cities.find(o=>o.id===c.id)!;for(const r of resourceKeys)expect(c.stock[r]).toBe(old.stock[r]+(c.id===receipt.cityId?receipt.accepted[r]:0));}
});
it('I12 remains one task and one reward after both ranged and cavalry elite qualifications are present',()=>{
 let w=fixture();w.factions[0].techIds=['elite.ranged','elite.cavalry'];build(w.cities[0],'warehouse.0',15);syncGrowthTasks(w);const o=claim(w,'I12'),t=submitFormalOrder(w,o);expect(t.ack?.status).toBe('committed');w=t.world;expect(Object.keys(w.growthTasks!.claimed)).toEqual(['I12']);expect(submitFormalOrder(w,claim(w,'I12')).ack?.status).toBe('rejected');
});
it('counts a lawful construction completed during player ownership after a gift, but never an already-finished captured snapshot',()=>{
 let w=fixture();const donor=w.cities[2];w=issue(w,{type:'field.upgrade',cityId:donor.id,slot:0},donor.ownerFactionId).world;const job=w.cities[2].economy!.construction[0];changeCityOwner(w,w.cities[2],w.playerFactionId,'receive');expect(w.growthTasks?.completed.N01).toBeUndefined();w=advanceFormal(w,job.startsAt+job.durationMs).world;expect(w.growthTasks?.completed.N01).toBeDefined();
});
it('I15 trusts the existing lawful joint protocol without adding a new minimum-army-count rule',()=>{
 let w=battlefield();w.factions[0].age=2;build(w.cities[0],'embassy',15);w.cities[0].military!.units={militia:100};w.cities[1].military!.units={};w.cities[1].wallLevel=0;w=issue(w,{type:'politics',cityId:w.cities[0].id,action:'legion-create',name:'正式會師'}).world;w=issue(w,{type:'joint.create',cityId:w.cities[0].id,targetCityId:w.cities[1].id,units:{militia:50},arrivalAt:w.time+HOUR}).world;const group=w.politics!.joints[0];w=advanceFormal(w,group.arrivalAt).world;expect(w.growthTasks?.completed.I15).toBeDefined();expect(w.cities[1].ownerFactionId).toBe(w.playerFactionId);
});

it('idle time and sub-threshold population growth leave the durable achievement history unchanged across Recovery',async()=>{
 let w=fixture();rich(w);w.cities[0].population=15000;syncGrowthTasks(w);const db=store();w=await db.start(w);const backup=(await db.backupList())[0],history=structuredClone(w.growthTasks);
 const later=advanceFormal(w,w.time+HOUR).world;expect(later.growthTasks).toEqual(history);const saved=await db.save(later,[],w.revision);const restored=await db.restore(backup.id);expect(restored.growthTasks).toEqual(history);expect(restored.time).toBe(w.time);expect(saved.time).toBeGreaterThan(restored.time);
});

it('an unclaimed achievement survives time-rewinding Recovery and can be claimed immediately exactly once',async()=>{
 const db=store();let w=await db.start(fixture());
 let revision=w.revision;w=issue(w,{type:'field.upgrade',cityId:w.cities[0].id,slot:0}).world;w=await db.save(w,[],revision);const backup=(await db.backupList())[0];const job=w.cities[0].economy!.construction[0];revision=w.revision;w=advanceFormal(w,job.startsAt+job.durationMs).world;w=await db.save(w,[],revision);
 const completedAt=w.growthTasks!.completed.N01;expect(completedAt).toBeGreaterThan(0);w=await db.restore(backup.id);expect(w.time).toBeLessThan(completedAt);expect(w.growthTasks!.claimed.N01).toBeUndefined();
 const t=submitFormalOrder(w,claim(w,'N01'));expect(t.ack?.status,t.ack?.reason).toBe('committed');w=await db.save(t.world,t.reports,w.revision);expect(w.growthTasks!.claimed.N01.at).toBeLessThan(completedAt);validateFormalWorld(w);expect((await db.loadSave()).game!.growthTasks!.claimed.N01).toEqual(w.growthTasks!.claimed.N01);expect(submitFormalOrder(w,claim(w,'N01')).ack?.status).toBe('rejected');
});
