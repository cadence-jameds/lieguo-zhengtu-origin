import {it,expect} from 'vitest';
import {wonderWorld,wonderAct,fundWonder} from './wonderTestSupport';
import {order,build,make,rich} from './developmentTestSupport';
import {submitFormalOrder,advanceFormal,advanceFormalCooperative} from './reducer';
import {resourceKeys,zeroResources} from './model';
import {validateFormalWorld} from './schema';
import {empireId} from './ids';
import {wonderDecision} from './aiActions';
import {WONDER_COST,WONDER_DURATION,wonderProgress} from './wonder';
import {enableAutonomy} from './autonomy';
import {EventScheduler} from './scheduler';
import {handleWonderEvent} from './wonder';
import {encodeSave,decodeSave} from './saveCodec';
import {advanceOfflineCooperative} from './offline';
import {reconcileSiegeStorage} from './siege';

it('B9-1 imperial ownership, one wonder, real stock/market rules, arrival pool and idempotent events',()=>{
 let w=wonderWorld();const p=w.largeProjects[0],city=w.cities[1],cargo={food:100,wood:200,stone:300,gold:400};city.stock={food:1000,wood:1000,stone:1000,gold:1000};
 const unchanged=structuredClone(w.cities.map(c=>[c.x,c.y,c.fields,c.economy!.slots]));
 expect(p.requiredResources).toEqual(WONDER_COST);expect(p.durationMs).toBe(WONDER_DURATION);
 const duplicate=submitFormalOrder(w,order(w,{type:'wonder.start',cityId:w.cities[0].id,hostCityId:city.id}));expect(duplicate.ack?.status).toBe('rejected');
 expect(submitFormalOrder(w,order(w,{type:'wonder.start',cityId:w.cities[2].id,hostCityId:city.id},undefined,w.factions[1].id)).ack?.status).toBe('rejected');
 const theft=submitFormalOrder(w,order(w,{type:'wonder.ship',cityId:city.id,projectId:p.projectId,resources:cargo},undefined,w.factions[1].id));expect(theft.ack?.status).toBe('rejected');
 const noMarket=structuredClone(w);delete noMarket.cities[1].buildings.market;expect(submitFormalOrder(noMarket,order(noMarket,{type:'wonder.ship',cityId:city.id,projectId:p.projectId,resources:cargo})).ack?.status).toBe('rejected');
 const insufficient=submitFormalOrder(w,order(w,{type:'wonder.ship',cityId:city.id,projectId:p.projectId,resources:{...cargo,gold:1001}}));expect(insufficient.ack?.status).toBe('rejected');expect(w.logistics).toEqual([]);
 const cmd=order(w,{type:'wonder.ship',cityId:city.id,projectId:p.projectId,resources:cargo});w=submitFormalOrder(w,cmd).world;
 expect(w.cities[1].stock).toEqual({food:900,wood:800,stone:700,gold:600});expect(w.largeProjects[0].poolResources).toEqual(zeroResources());expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');
 const t=w.logistics![0];expect(t.caravans).toBe(1);expect(t.path.length).toBeGreaterThan(1);expect(t.arrivalAt-w.time).toBe(t.distance*60000);
 const target=w.cities[0];expect(target.economy!.reservedIncoming).toEqual(zeroResources());reconcileSiegeStorage(w,target);expect(t.reservedResources).toBeUndefined();
 w=advanceFormal(w,t.arrivalAt-1).world;expect(w.largeProjects[0].poolResources).toEqual(zeroResources());
 w=advanceFormal(w,t.arrivalAt).world;expect(w.largeProjects[0].poolResources).toEqual(cargo);expect(w.logistics![0].phase).toBe('returning');
 const after=structuredClone(w);expect(handleWonderEvent(w,{type:'logistics.arrive',shipmentId:t.shipmentId,id:t.arrivalEventId,at:t.arrivalAt},new EventScheduler(w.events),[])).toBe(true);expect(w).toEqual(after);
 w=advanceFormal(w,t.returnAt).world;expect(w.logistics).toEqual([]);expect(w.largeProjects[0].shipments[0].phase).toBe('arrived');expect(w.cities.map(c=>[c.x,c.y,c.fields,c.economy!.slots])).toEqual(unchanged);
});

it('B9-1 host lock covers member leave, legion detach, kick and dissolution; other members may leave',()=>{
 const w=wonderWorld(),home=w.cities[0].id;
 for(const action of ['legion-leave','legion-dissolve','empire-leave','empire-dissolve'] as const){const t=submitFormalOrder(w,order(w,{type:'politics',cityId:home,action}));expect(t.ack?.status,action).toBe('rejected');expect(t.ack?.reason).toContain('奇觀');expect(t.world).toBe(w);}
 const left=wonderAct(w,{type:'politics',cityId:w.cities[2].id,action:'empire-leave'},w.factions[1].id);expect(left.factions[1].empireId).toBeNull();expect(left.largeProjects).toEqual(w.largeProjects);
 expect(submitFormalOrder(left,order(left,{type:'wonder.ship',cityId:left.cities[2].id,projectId:left.largeProjects[0].projectId,resources:{food:1,wood:1,stone:1,gold:1}},undefined,left.factions[1].id)).ack?.status).toBe('rejected');
 // Host on another legion: imperial expulsion cannot bypass the same lock.
 let other=structuredClone(w);other.largeProjects=[];other=wonderAct(other,{type:'wonder.start',cityId:home,hostCityId:other.cities[2].id});
 expect(submitFormalOrder(other,order(other,{type:'politics',cityId:home,action:'empire-kick',target:other.factions[1].id})).ack?.status).toBe('rejected');
});

it('B9-1 demand reservations reject overfunding, arbitrary IDs and malformed quantities atomically',()=>{
 let w=wonderWorld();const p=w.largeProjects[0];w.cities[1].stock={food:30000,wood:0,stone:0,gold:0};
 w=wonderAct(w,{type:'wonder.ship',cityId:w.cities[1].id,projectId:p.projectId,resources:{food:30000,wood:0,stone:0,gold:0}});
 expect(submitFormalOrder(w,order(w,{type:'wonder.ship',cityId:w.cities[1].id,projectId:p.projectId,resources:{food:1,wood:0,stone:0,gold:0}})).ack?.status).toBe('rejected');
 for(const bad of [-1,NaN,Infinity,1.5])expect(()=>submitFormalOrder(w,order(w,{type:'wonder.ship',cityId:w.cities[0].id,projectId:p.projectId,resources:{food:bad,wood:0,stone:0,gold:0}}))).toThrow('命令格式無效');
 const corrupt=structuredClone(w);corrupt.largeProjects[0].shipments[0].resources.food++;expect(()=>validateFormalWorld(corrupt)).toThrow();
 const double=structuredClone(w);double.largeProjects[0].shipments.push({...double.largeProjects[0].shipments[0],shipmentId:'shipment:double' as typeof w.largeProjects[0]['shipments'][0]['shipmentId']});expect(()=>validateFormalWorld(double)).toThrow();
 const free=structuredClone(w);free.largeProjects[0].poolResources.food++;expect(()=>validateFormalWorld(free)).toThrow();
 const unbound=structuredClone(w);delete unbound.logistics![0].projectId;expect(()=>validateFormalWorld(unbound)).toThrow();
});

it('B9-1 full 24M travels in 800 market trips, then exactly 24 world hours; save/offline/cooperative replay has one completion and no victory',async()=>{
 let w=fundWonder(wonderWorld());const p=w.largeProjects[0],state=p.wonder!,end=state.startedAt!+WONDER_DURATION;
 expect(p.shipments).toHaveLength(800);expect(p.poolResources).toEqual(WONDER_COST);expect(w.events.filter(e=>e.type==='wonder.complete')).toHaveLength(1);
 w=advanceFormal(w,end-1).world;expect(w.largeProjects[0].wonder!.phase).toBe('building');expect(wonderProgress(w,w.largeProjects[0])).toBeLessThan(100);
 const loaded=(await decodeSave(await encodeSave(w))).world;expect(loaded).toEqual(w);
 const online=advanceFormal(w,end),cooperative=await advanceFormalCooperative(loaded,end);expect(cooperative).toEqual(online);
 const offline=await advanceOfflineCooperative(loaded,1000,1001);expect(offline.world.largeProjects).toEqual(online.world.largeProjects);expect(offline.reports.filter(r=>r.title==='世界奇觀完成')).toHaveLength(1);
 const finished=online.world;expect(finished.largeProjects[0].wonder!.phase).toBe('completed');expect(finished.factions.every(f=>f.modernQualification==='none')).toBe(true);expect(online.reports.filter(r=>r.title==='世界奇觀完成')).toHaveLength(1);
 expect(advanceFormal(finished,end+WONDER_DURATION).reports.filter(r=>r.title==='世界奇觀完成')).toHaveLength(0);
 const noClock=structuredClone(w);noClock.events=noClock.events.filter(e=>e.type!=='wonder.complete');expect(()=>validateFormalWorld(noClock)).toThrow();
 const tooEarly=structuredClone(w);tooEarly.events.find(e=>e.type==='wonder.complete')!.at--;expect(()=>validateFormalWorld(tooEarly)).toThrow();
 expect((await decodeSave(await encodeSave(finished))).world).toEqual(finished);
},60000);

it('B9-1 all 99 native AI use the same imperial command, real four-resource stock and capacity as the player',async()=>{
 let w=make();enableAutonomy(w);w.politics={legions:[],empires:[],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};
 for(let i=0;i<100;i++){const c=w.cities[i];rich(w,c);build(c,'market',15);build(c,'embassy',15);w.factions[i].age=2;const n=Math.floor(i/20),id=empireId('parity-'+n);w.factions[i].empireId=id;
  if(i%10===0)w.politics.legions.push({id:'legion:parity-'+i,name:'同權軍團',description:'',leader:c.ownerFactionId,members:w.factions.slice(i,i+10).map(f=>f.id),empireId:id});
  if(i%20===0)w.politics.empires.push({id,name:'同權帝國',leader:c.ownerFactionId,legions:['legion:parity-'+i,'legion:parity-'+(i+10)],color:'green'});
 }
 validateFormalWorld(w);
 for(let i=0;i<100;i++){
  const c=w.cities[i],f=w.factions[i],a=w.autonomy!.agents.find(a=>a.factionId===f.id);
  if(i%20===0)w=wonderAct(w,{type:'wonder.start',cityId:c.id,hostCityId:c.id},f.id);
  if(a){const choice=wonderDecision(w,w.cities[i],{...a,active:true});expect(choice?.type).toBe('wonder.ship');}
  const p=w.largeProjects.find(p=>p.owner.kind==='empire'&&p.owner.empireId===f.empireId)!,before={...w.cities[i].stock};
  w=wonderAct(w,{type:'wonder.ship',cityId:c.id,projectId:p.projectId,resources:{food:1,wood:2,stone:3,gold:4}},f.id);
  for(const r of resourceKeys)expect(before[r]-w.cities[i].stock[r]).toBe({food:1,wood:2,stone:3,gold:4}[r]);
 }
 expect(w.logistics).toHaveLength(100);expect(w.largeProjects).toHaveLength(5);expect(w.logistics!.filter(t=>t.sourceFactionId!==w.playerFactionId)).toHaveLength(99);
 const allArrive=Math.max(...w.logistics!.map(t=>t.arrivalAt));
 // Retain the 99 seeded agents but defer their unrelated economy/military decisions for this transport check.
 for(const a of w.autonomy!.agents){a.nextAt=allArrive+60000;w.events.find(e=>e.id===a.eventId)!.at=a.nextAt;}
 w=advanceFormal(w,allArrive).world;for(const p of w.largeProjects)expect(p.poolResources).toEqual({food:20,wood:40,stone:60,gold:80});validateFormalWorld(w);expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
},60000);
