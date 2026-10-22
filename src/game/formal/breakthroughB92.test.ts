import 'fake-indexeddb/auto';
import {afterEach,beforeAll,it,expect} from 'vitest';
import {completedWonder,breakthroughWorld,fundedBreakthrough} from './breakthroughTestSupport';
import {wonderWorld,wonderAct} from './wonderTestSupport';
import {order} from './developmentTestSupport';
import {advanceFormal,advanceFormalCooperative,submitFormalOrder} from './reducer';
import {settleCity,changeCityOwner,HOUR} from './economy';
import {BREAKTHROUGH_COST,BREAKTHROUGH_DURATION,breakthroughWork,handleBreakthroughEvent,updateWonderIntegrity} from './breakthrough';
import {EventScheduler} from './scheduler';
import {zeroResources,type FormalWorld} from './model';
import {validateFormalWorld} from './schema';
import {encodeSave,decodeSave} from './saveCodec';
import {advanceOfflineCooperative} from './offline';
import {wonderDecision} from './aiActions';
import {enableAutonomy} from './autonomy';
import {make,build,rich} from './developmentTestSupport';
import {empireId} from './ids';
let funded:FormalWorld;
beforeAll(()=>{funded=fundedBreakthrough();},240000);
const end=(w:FormalWorld)=>w.largeProjects[1].breakthrough!.activeSince!+BREAKTHROUGH_DURATION;
it('B9-2 requires a completed usable wonder, leader and current members; creation and replay cannot spend or create extra projects',()=>{
 const notDone=wonderWorld(),bad=submitFormalOrder(notDone,order(notDone,{type:'breakthrough.start',cityId:notDone.cities[0].id}));expect(bad.ack?.status).toBe('rejected');expect(bad.world).toBe(notDone);
 let w=completedWonder();expect(submitFormalOrder(w,order(w,{type:'breakthrough.start',cityId:w.cities[2].id},undefined,w.factions[1].id)).ack?.status).toBe('rejected');
 for(const c of w.cities)settleCity(w,c);
 const cmd=order(w,{type:'breakthrough.start',cityId:w.cities[0].id}),before=structuredClone(w);w=submitFormalOrder(w,cmd).world;
 expect(w.largeProjects[1].requiredResources).toEqual(BREAKTHROUGH_COST);expect(w.cities).toEqual(before.cities);expect(w.events).toEqual(before.events);expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');
 expect(submitFormalOrder(w,order(w,{type:'breakthrough.start',cityId:w.cities[0].id})).ack?.status).toBe('rejected');
});
it('B9-2 stock is debited once, cargo arrives once into its own pool; paused arrivals are returned and can be dispatched after recapture',()=>{
 let w=breakthroughWorld();w.cities[1].stock={food:100,wood:200,stone:300,gold:400};const cargo={...w.cities[1].stock},cmd=order(w,{type:'breakthrough.ship',cityId:w.cities[1].id,projectId:w.largeProjects[1].projectId,resources:cargo});w=submitFormalOrder(w,cmd).world;
 expect(w.cities[1].stock).toEqual(zeroResources());expect(w.largeProjects[1].poolResources).toEqual(zeroResources());expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');const t=structuredClone(w.logistics![0]);
 w=wonderAct(w,{type:'politics',cityId:w.cities[2].id,action:'empire-leave'},w.factions[1].id);changeCityOwner(w,w.cities[0],w.factions[1].id,'conquest');expect(w.largeProjects[1].breakthrough!.phase).toBe('paused');
 expect(submitFormalOrder(w,order(w,{type:'breakthrough.ship',cityId:w.cities[1].id,projectId:w.largeProjects[1].projectId,resources:cargo})).ack?.status).toBe('rejected');
 w=advanceFormal(w,t.arrivalAt).world;expect(w.largeProjects[1].poolResources).toEqual(zeroResources());expect(w.logistics![0].returnCargo).toEqual(cargo);expect(w.largeProjects[1].shipments[0].phase).toBe('returned');
 w=advanceFormal(w,t.returnAt).world;expect(w.cities[1].stock).toEqual(cargo);changeCityOwner(w,w.cities[0],w.playerFactionId,'conquest');expect(w.largeProjects[1].breakthrough!.phase).toBe('funding');
 w=wonderAct(w,{type:'breakthrough.ship',cityId:w.cities[1].id,projectId:w.largeProjects[1].projectId,resources:cargo});const next=w.logistics![0];w=advanceFormal(w,next.arrivalAt).world;expect(w.largeProjects[1].poolResources).toEqual(cargo);expect(w.largeProjects[0].poolResources).not.toEqual(cargo);
 const before=structuredClone(w);handleBreakthroughEvent(w,{type:'logistics.arrive',shipmentId:next.shipmentId,id:next.arrivalEventId,at:next.arrivalAt},new EventScheduler(w.events),[]);expect(w).toEqual(before);
});
it('B9-2 60M takes 2000 real market trips and exactly 48 world hours, once, with save/offline/cooperative equivalence',async()=>{
 const w=structuredClone(funded),deadline=end(w);expect(w.largeProjects[1].poolResources).toEqual(BREAKTHROUGH_COST);expect(w.events.filter(e=>e.type==='breakthrough.complete')).toHaveLength(1);
 const before=advanceFormal(w,deadline-1).world;expect(before.factions.every(f=>f.modernQualification==='none')).toBe(true);const loaded=(await decodeSave(await encodeSave(before))).world;
 const complete=advanceFormal(loaded,deadline),cooperative=await advanceFormalCooperative(loaded,deadline);expect(cooperative).toEqual(complete);
 const offline=await advanceOfflineCooperative(loaded,0,1);expect(offline.world.largeProjects).toEqual(complete.world.largeProjects);expect(offline.reports.filter(r=>r.title==='文明突破完成')).toHaveLength(1);
 expect(complete.world.largeProjects[1].breakthrough!.qualifiedFactionIds).toEqual(complete.world.factions.map(f=>f.id).sort());expect(complete.world.factions.every(f=>f.modernQualification==='full')).toBe(true);expect(complete.reports.filter(r=>r.title==='文明突破完成')).toHaveLength(1);
 expect(advanceFormal(complete.world,deadline+HOUR).reports.filter(r=>r.title==='文明突破完成')).toHaveLength(0);expect((await decodeSave(await encodeSave(complete.world))).world).toEqual(complete.world);
 const duplicate=structuredClone(complete.world),reports:import('./model').FormalReport[]=[];handleBreakthroughEvent(duplicate,{type:'breakthrough.complete',projectId:w.largeProjects[1].projectId,id:w.largeProjects[1].breakthrough!.completionEventId!,at:deadline},new EventScheduler(duplicate.events),reports);expect(reports).toEqual([]);expect(duplicate).toEqual(complete.world);
 const bad=structuredClone(before);bad.events.find(e=>e.type==='breakthrough.complete')!.at--;expect(()=>validateFormalWorld(bad)).toThrow();
});
it('B9-2 conquest freezes elapsed work immediately, forbids inheritance, and recapture resumes the remainder',async()=>{
 let w=advanceFormal(funded,end(funded)-24*HOUR).world;const work=breakthroughWork(w,w.largeProjects[1]);w=wonderAct(w,{type:'politics',cityId:w.cities[2].id,action:'empire-leave'},w.factions[1].id);changeCityOwner(w,w.cities[0],w.factions[1].id,'conquest');
 expect(w.largeProjects[1].breakthrough!.phase).toBe('paused');expect(w.events.some(e=>e.type==='breakthrough.complete')).toBe(false);expect(w.largeProjects[1].owner).toEqual(funded.largeProjects[1].owner);
 w=advanceFormal(w,w.time+72*HOUR).world;expect(breakthroughWork(w,w.largeProjects[1])).toBe(work);expect(w.factions.every(f=>f.modernQualification==='none')).toBe(true);w=(await decodeSave(await encodeSave(w))).world;
 changeCityOwner(w,w.cities[0],w.playerFactionId,'conquest');const event=w.events.find(e=>e.type==='breakthrough.complete')!;expect(event.at-w.time).toBe(BREAKTHROUGH_DURATION-work);
 w=advanceFormal(w,event.at).world;expect(w.factions[0].modernQualification).toBe('full');expect(w.factions[1].modernQualification).toBe('none');
});
it('B9-2 awards the current membership snapshot only; leaving and rejoining before completion is sufficient, later joining grants nothing',()=>{
 let w=structuredClone(funded);const member=w.factions[1].id;
 w=wonderAct(w,{type:'politics',cityId:w.cities[2].id,action:'empire-leave'},member);
 const noMember=advanceFormal(w,end(w)).world;expect(noMember.factions[1].modernQualification).toBe('none');
 let late=wonderAct(noMember,{type:'politics',cityId:noMember.cities[0].id,action:'empire-propose',target:member});late=wonderAct(late,{type:'politics',cityId:late.cities[2].id,action:'request-accept',requestId:late.politics!.requests[0].id},member);expect(late.factions[1].modernQualification).toBe('none');
 w=wonderAct(w,{type:'politics',cityId:w.cities[0].id,action:'empire-propose',target:member});w=wonderAct(w,{type:'politics',cityId:w.cities[2].id,action:'request-accept',requestId:w.politics!.requests[0].id},member);w=advanceFormal(w,end(w)).world;expect(w.factions[1].modernQualification).toBe('full');
 w=wonderAct(w,{type:'politics',cityId:w.cities[2].id,action:'empire-leave'},member);expect(w.factions[1].modernQualification).toBe('full');changeCityOwner(w,w.cities[0],member,'conquest');w=wonderAct(w,{type:'politics',cityId:w.cities[1].id,action:'empire-dissolve'});expect(w.factions.every(f=>f.modernQualification==='full')).toBe(true);validateFormalWorld(w);
});
it('B9-2 future integrity signals pause damage, roll ruins back to the last 25% checkpoint, and require intact restoration',()=>{
 let w=advanceFormal(funded,end(funded)-17*HOUR).world;let s=new EventScheduler(w.events);updateWonderIntegrity(w,w.largeProjects[0].projectId,'damaged',s);w.events=s.snapshot();const work=breakthroughWork(w,w.largeProjects[1]);w=advanceFormal(w,w.time+HOUR).world;expect(breakthroughWork(w,w.largeProjects[1])).toBe(work);
 s=new EventScheduler(w.events);updateWonderIntegrity(w,w.largeProjects[0].projectId,'ruins',s);w.events=s.snapshot();expect(breakthroughWork(w,w.largeProjects[1])).toBe(24*HOUR);validateFormalWorld(w);
 s=new EventScheduler(w.events);updateWonderIntegrity(w,w.largeProjects[0].projectId,'intact',s);w.events=s.snapshot();expect(w.events.find(e=>e.type==='breakthrough.complete')!.at-w.time).toBe(24*HOUR);validateFormalWorld(w);
});
it('B9-2 all 99 native AI use the same real-stock breakthrough start and contribution rules',()=>{
 const original=completedWonder(),template=original.largeProjects[0];let w=make();enableAutonomy(w);w.politics={legions:[],empires:[],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};w.time=original.time;w.revision=original.revision;
 for(const c of w.cities){rich(w,c);build(c,'market',15);build(c,'embassy',15);c.economy!.lastSettledAt=w.time;w.events.find(e=>e.id===c.economy!.settlementEventId)!.at=w.time+HOUR;}
 for(const a of w.autonomy!.agents){a.nextAt=w.time+100*HOUR;w.events.find(e=>e.id===a.eventId)!.at=a.nextAt;}
 for(let i=0;i<100;i++){w.factions[i].age=3;const id=empireId('b92-'+Math.floor(i/20));w.factions[i].empireId=id;if(i%10===0)w.politics.legions.push({id:'legion:b92-'+i,name:'同權',description:'',leader:w.factions[i].id,members:w.factions.slice(i,i+10).map(f=>f.id),empireId:id});if(i%20===0){
  w.politics.empires.push({id,name:'同權',leader:w.factions[i].id,legions:['legion:b92-'+i,'legion:b92-'+(i+10)],color:'green'});
  // Remap an actually completed prerequisite and its payment receipts into this native empire.
  const mapping=new Map<string,string>([[original.campaignId,w.campaignId],[original.factions[0].id,w.factions[i].id],[original.factions[1].id,w.factions[i+10].id],[original.cities[0].id,w.cities[i].id],[original.cities[1].id,w.cities[i].id],[original.cities[2].id,w.cities[i+10].id],[original.factions[0].empireId!,id]]);
  const remap=(value:unknown):any=>typeof value==='string'?mapping.get(value)??(/^(project|shipment|event|command):/.test(value)?value.replace(':',':native-'+i+'-'):value):Array.isArray(value)?value.map(remap):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,remap(v)])):value;
  w.largeProjects.push(remap(template));const paid=new Set([template.wonder!.creationCommandId,...template.shipments.map(t=>t.commandId!)]);
  for(const r of original.commandReceipts.filter(r=>paid.has(r.commandId))){const mapped=remap(r);mapped.fingerprint=JSON.stringify(remap(JSON.parse(r.fingerprint)));w.commandReceipts.push(mapped);}
 }}
 validateFormalWorld(w);
 for(let i=0;i<100;i++){const c=w.cities[i],f=w.factions[i],agent=w.autonomy!.agents.find(a=>a.factionId===f.id);if(i%20===0){if(agent)expect(wonderDecision(w,c,{...agent,active:true})).toEqual({type:'breakthrough.start',cityId:c.id});w=wonderAct(w,{type:'breakthrough.start',cityId:c.id},f.id);}
  if(agent)expect(wonderDecision(w,w.cities[i],{...agent,active:true})?.type).toBe('breakthrough.ship');const p=w.largeProjects.find(p=>p.kind==='civilization-breakthrough'&&p.owner.kind==='empire'&&p.owner.empireId===f.empireId)!;const before={...w.cities[i].stock};w=wonderAct(w,{type:'breakthrough.ship',cityId:c.id,projectId:p.projectId,resources:{food:1,wood:2,stone:3,gold:4}},f.id);expect(w.cities[i].stock).toEqual({food:before.food-1,wood:before.wood-2,stone:before.stone-3,gold:before.gold-4});
 }
 expect(w.logistics!.filter(t=>t.sourceFactionId!==w.playerFactionId)).toHaveLength(99);expect(w.factions.every(f=>f.modernQualification==='none')).toBe(true);w=advanceFormal(w,Math.max(...w.logistics!.map(t=>t.arrivalAt))).world;for(const p of w.largeProjects.filter(p=>p.kind==='civilization-breakthrough'))expect(p.poolResources).toEqual({food:20,wood:40,stone:60,gold:80});validateFormalWorld(w);
},90000);

const databases:import('../persistence').FormalPersistence[]=[];
afterEach(async()=>{for(const db of databases.splice(0))await db.db.delete();});
it('B9-2 atomic persistence, export/import and Recovery preserve cargo, pause, membership snapshot and one completion',async()=>{
 const {FormalPersistence}=await import('../persistence');let fail=false;const db=new FormalPersistence({suffix:'b92-'+crypto.randomUUID(),fault:p=>{if(fail&&p==='world-write')throw Error('breakthrough transaction fault');}});databases.push(db);
 let w=breakthroughWorld();w.cities[1].stock={food:100,wood:200,stone:300,gold:400};w=await db.start(w);
 const cmd=order(w,{type:'breakthrough.ship',cityId:w.cities[1].id,projectId:w.largeProjects[1].projectId,resources:{...w.cities[1].stock}}),draft=submitFormalOrder(w,cmd);fail=true;await expect(db.save(draft.world,[],w.revision)).rejects.toThrow('breakthrough transaction fault');expect((await db.loadSave()).game!.largeProjects).toEqual(w.largeProjects);fail=false;w=await db.save(draft.world,[],w.revision);const transit=(await db.backupList())[0];
 const copy=new FormalPersistence({suffix:'b92-copy-'+crypto.randomUUID()});databases.push(copy);const imported=await copy.importSave(await db.exportStoredSave('full'));expect(imported.largeProjects).toEqual(w.largeProjects);expect(imported.logistics).toEqual(w.logistics);
 const arrived=advanceFormal(w,w.logistics![0].arrivalAt);w=await db.save(arrived.world,arrived.reports,w.revision);expect(w.largeProjects[1].poolResources.food).toBe(100);const restored=await db.restore(transit.id);expect(restored.largeProjects[1].poolResources).toEqual(zeroResources());expect(submitFormalOrder(restored,cmd).ack?.status).toBe('duplicate');expect(advanceFormal(restored,restored.logistics![0].arrivalAt).world.largeProjects).toEqual(w.largeProjects);
 // The full funded checkpoint uses the same real 60M transport fixture as the boundary tests.
 const clock=new FormalPersistence({suffix:'b92-clock-'+crypto.randomUUID()});databases.push(clock);let active=await clock.start(structuredClone(funded));const checkpoint=(await clock.backupList())[0],result=advanceFormal(active,end(active));active=await clock.save(result.world,result.reports,active.revision);expect((await clock.readReportPage(active,0,'all')).rows.filter(r=>r.title==='文明突破完成')).toHaveLength(1);
 const back=await clock.restore(checkpoint.id);expect(back.factions.every(f=>f.modernQualification==='none')).toBe(true);expect((await clock.readReportPage(back,0,'all')).rows.filter(r=>r.title==='文明突破完成')).toHaveLength(0);const replay=advanceFormal(back,end(back));expect(replay.world.largeProjects).toEqual(active.largeProjects);expect(replay.reports.filter(r=>r.title==='文明突破完成')).toHaveLength(1);await clock.save(replay.world,replay.reports,back.revision);
 await clock.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const recovery=await clock.loadSave();expect(recovery.recovered).toBe(true);expect(recovery.game!.largeProjects[1].breakthrough!.phase).toBe('completed');expect(advanceFormal(recovery.game!,recovery.game!.time+1).reports.filter(r=>r.title==='文明突破完成')).toHaveLength(0);
},60000);
it('B9-2 a conquest at the exact deadline takes priority; recapture can finish the preserved zero remainder once',()=>{
 let w=advanceFormal(funded,end(funded)-1).world;w=wonderAct(w,{type:'politics',cityId:w.cities[2].id,action:'empire-leave'},w.factions[1].id);w.time=end(funded);changeCityOwner(w,w.cities[0],w.factions[1].id,'conquest');expect(breakthroughWork(w,w.largeProjects[1])).toBe(BREAKTHROUGH_DURATION);expect(w.factions[0].modernQualification).toBe('none');w=advanceFormal(w,w.time+HOUR).world;changeCityOwner(w,w.cities[0],w.playerFactionId,'conquest');validateFormalWorld(w);const finished=advanceFormal(w,w.time);expect(finished.world.factions[0].modernQualification).toBe('full');expect(finished.reports.filter(r=>r.title==='文明突破完成')).toHaveLength(1);
 const ruined=advanceFormal(funded,end(funded)-1).world;ruined.time=end(funded);const scheduler=new EventScheduler(ruined.events);updateWonderIntegrity(ruined,ruined.largeProjects[0].projectId,'ruins',scheduler);ruined.events=scheduler.snapshot();expect(breakthroughWork(ruined,ruined.largeProjects[1])).toBe(36*HOUR);expect(ruined.factions.every(f=>f.modernQualification==='none')).toBe(true);validateFormalWorld(ruined);
});
