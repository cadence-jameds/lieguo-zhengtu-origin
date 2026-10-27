import 'fake-indexeddb/auto';
import {expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createFormalFixture} from './fixture';
import {build,order} from './developmentTestSupport';
import {cityId,factionId} from './ids';
import type {Agent} from './autonomyModel';
import {traitsFor} from './autonomyModel';
import {wonderDecision} from './aiActions';
import {initializeEconomy,changeCityOwner,caravanStatus} from './economy';
import {finishConquest} from './siege';
import {EventScheduler} from './scheduler';
import {runAutoLogistics,runWonderAutoSupply} from './autoLogistics';
import {logisticsAllocation,logisticsAvailable} from './logisticsAllocation';
import {zeroResources,resourceKeys,type FormalWorld,type FormalCommand} from './model';
import {submitFormalOrder,advanceFormal} from './reducer';
import {validateFormalWorld} from './schema';
import {encodeSave,decodeSave} from './saveCodec';
import {advanceOfflineCooperative} from './offline';
import {FormalPersistence} from '../persistence';

const cargo=(food:number)=>({food,wood:0,stone:0,gold:0});
function act(w:FormalWorld,payload:FormalCommand,issuer=w.playerFactionId){
 const t=submitFormalOrder(w,order(w,payload,undefined,issuer));
 expect(t.ack?.status,t.ack?.reason).toBe('committed');return t.world;
}
/** Two distinct empires: the losing player keeps its home, the AI has a legal wonder host. */
function setup(manual=2){
 let w=createFormalFixture({campaign:'logistics-ownership-'+crypto.randomUUID(),speed:1});
 for(const [name,x,y] of [['enemy',25,4],['enemy-ally',28,24]] as const){
  const f={...structuredClone(w.factions[1]),id:factionId(name),name,role:'ai' as const,age:3 as const};
  w.factions.push(f);w.cities.push({...structuredClone(w.cities[2]),id:cityId(name),ownerFactionId:f.id,name,x,y});
 }
 initializeEconomy(w);
 for(const f of w.factions)f.age=3;
 for(const c of w.cities){build(c,'embassy',15);build(c,'market',15);build(c,'warehouse.0',15);c.stock=cargo(100000);}
 for(const [leader,ally,name] of [[0,2,'玩家帝國'],[3,4,'AI帝國']] as const){
  for(const i of [leader,ally])w=act(w,{type:'politics',cityId:w.cities[i].id,action:'legion-create',name:name+i},w.cities[i].ownerFactionId);
  w=act(w,{type:'politics',cityId:w.cities[leader].id,action:'empire-propose',target:w.cities[ally].ownerFactionId,name},w.cities[leader].ownerFactionId);
  w=act(w,{type:'politics',cityId:w.cities[ally].id,action:'request-accept',requestId:w.politics!.requests.at(-1)!.id},w.cities[ally].ownerFactionId);
  w=act(w,{type:'wonder.start',cityId:w.cities[leader].id,hostCityId:w.cities[leader].id},w.cities[leader].ownerFactionId);
 }
 w.factions[0].techIds.push('logistics.auto');
 return act(w,{type:'logistics.configure',cityId:w.cities[1].id,
  rules:[{destinationCityId:w.cities[0].id,maxCaravans:5,reserve:zeroResources()}],
  settings:{reserve:{food:1234,wood:2345,stone:3456,gold:4567},manualCaravans:manual,
   wonder:{projectId:w.largeProjects[0].projectId,maxCaravans:15-5-manual,enabled:true}}});
}
function agent(w:FormalWorld):Agent{
 const faction=w.factions[2].id;
 return{factionId:faction,traits:traitsFor(w.seed,faction),decisions:0,nextAt:0,eventId:null,active:true,budgetPercent:30,lastWarAt:0,memory:[],intel:[]};
}
function conquer(w:FormalWorld){
 const s=new EventScheduler(w.events);finishConquest(w,w.cities[1],w.factions[2].id,0,1,s);w.events=s.snapshot();w.revision++;validateFormalWorld(w);return w;
}
function oldTrips(){
 let w=setup();w.cities[0].stock=zeroResources();w=act(w,{type:'logistics.dispatch',cityId:w.cities[1].id,destinationCityId:w.cities[0].id,resources:cargo(4000)});
 const s=new EventScheduler(w.events);runAutoLogistics(w,w.cities[1],s);runWonderAutoSupply(w,w.cities[1],s);w.events=s.snapshot();w.revision++;
 expect(w.logistics!.map(t=>[t.purpose,t.caravans])).toEqual([['manual',2],['general-auto',5],['wonder-auto',8]]);validateFormalWorld(w);return w;
}
function evidence(name:string,value:unknown){if(process.env.LOGISTICS_OWNERSHIP_EVIDENCE){mkdirSync(process.env.LOGISTICS_OWNERSHIP_EVIDENCE,{recursive:true});writeFileSync(join(process.env.LOGISTICS_OWNERSHIP_EVIDENCE,name+'.json'),JSON.stringify(value,null,2));}}

for(const manual of [2,0])it(`conquered city no longer caps AI wonder dispatch at old manual quota ${manual}`,()=>{
 let w=setup(manual);const before={allocation:logisticsAllocation(w.cities[1]),settings:structuredClone(w.cities[1].logisticsSettings)};
 w=conquer(w);const c=w.cities[1],proposal=wonderDecision(w,c,agent(w));
 expect(caravanStatus(w,c).available).toBe(15);expect(proposal?.type).toBe('wonder.ship');
 if(proposal?.type!=='wonder.ship')throw Error('AI did not propose wonder shipment');
 expect(resourceKeys.reduce((n,r)=>n+proposal.resources[r],0)).toBe(19880);
 const cmd=order(w,proposal,undefined,w.factions[2].id),t=submitFormalOrder(w,cmd);
 evidence('manual-'+manual,{before,afterOwnership:{allocation:logisticsAllocation(c),settings:c.logisticsSettings??null,manualAvailable:logisticsAvailable(w,c)},proposal,ack:t.ack});
 expect(t.ack?.status,t.ack?.reason).toBe('committed');w=t.world;
 expect(w.cities[1].stock.food).toBe(80120);expect(w.logistics!.at(-1)).toMatchObject({sourceFactionId:w.factions[2].id,resources:cargo(19880),caravans:10,purpose:'manual'});
 expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');
 const trip=w.logistics!.at(-1)!;w=advanceFormal(w,trip.arrivalAt).world;
 expect(w.largeProjects[1].poolResources).toEqual(cargo(19880));expect(w.largeProjects[0].poolResources).toEqual(zeroResources());
});

it('conquest preserves all old in-flight identities, cargo, purposes, bookings and events until normal arrival/return',()=>{
 let w=oldTrips();const trips=structuredClone(w.logistics),events=structuredClone(w.events),projects=structuredClone(w.largeProjects),stock={...w.cities[1].stock};
 w=conquer(w);expect(w.logistics).toEqual(trips);expect(w.events).toEqual(events);expect(w.largeProjects).toEqual(projects);expect(w.cities[1].stock).toEqual(stock);
 expect(w.cities[1].autoLogistics).toEqual([]);expect(w.cities[1].logisticsSettings).toBeUndefined();
 expect(logisticsAvailable(w,w.cities[1])).toBe(0);expect(wonderDecision(w,w.cities[1],agent(w))).toBeUndefined();
 const arrive=Math.max(...trips!.map(t=>t.arrivalAt)),returned=Math.max(...trips!.map(t=>t.returnAt));
 w=advanceFormal(w,arrive).world;expect(w.largeProjects[0].poolResources).toEqual(cargo(16000));expect(w.logistics!.every(t=>t.phase==='returning')).toBe(true);expect(logisticsAvailable(w,w.cities[1])).toBe(0);
 w=advanceFormal(w,returned).world;expect(w.logistics).toEqual([]);expect(logisticsAvailable(w,w.cities[1])).toBe(15);expect(w.cities[1].stock).toEqual(stock);
 const proposal=wonderDecision(w,w.cities[1],agent(w));expect(proposal?.type).toBe('wonder.ship');w=act(w,proposal!,w.factions[2].id);
 expect(w.logistics).toHaveLength(1);expect(w.logistics![0].sourceFactionId).toBe(w.factions[2].id);
 evidence('in-transit',{before:trips,stockAtConquest:stock,oldArrivalPool:cargo(16000),availableAfterReturn:15,newAITrip:w.logistics![0]});
});

const relevant=(w:FormalWorld)=>({cities:w.cities,projects:w.largeProjects,logistics:w.logistics,events:w.events,receipts:w.commandReceipts.map(({committedRevision:_,...r})=>r)});
async function checkpoint(w:FormalWorld){
 const decoded=(await decodeSave(await encodeSave(w))).world;expect(decoded).toEqual(w);
 const db=new FormalPersistence({suffix:'ownership-'+crypto.randomUUID()});
 try{const stored=await db.start(w);expect((await db.loadSave()).game).toEqual(stored);await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const loaded=await db.loadSave();expect(loaded.recovered).toBe(true);expect(loaded.game!.revision).toBe(stored.revision+1);expect({...loaded.game,revision:stored.revision}).toEqual(stored);return decoded;}finally{await db.db.delete();}
}
it('post-conquest Save/Load, actual Recovery and offline replay preserve old shipments and cleared settings',async()=>{
 let w=conquer(oldTrips());const arrive=Math.max(...w.logistics!.map(t=>t.arrivalAt)),returned=Math.max(...w.logistics!.map(t=>t.returnAt));w=await checkpoint(w);
 const online=advanceFormal(w,returned).world,offline=(await advanceOfflineCooperative(w,0,returned-w.time)).world;
 expect(relevant(offline)).toEqual(relevant(online));
 await checkpoint(advanceFormal(w,arrive).world);const restored=await checkpoint(online);
 expect(restored.cities[1].logisticsSettings).toBeUndefined();expect(restored.cities[1].autoLogistics).toEqual([]);expect(logisticsAvailable(restored,restored.cities[1])).toBe(15);
});
it('receive clears the prior owner route, reserve and allocations without touching in-flight records',()=>{
 let w=oldTrips();const trips=structuredClone(w.logistics);changeCityOwner(w,w.cities[1],w.factions[2].id,'receive');
 expect(w.cities[1].autoLogistics).toEqual([]);expect(w.cities[1].logisticsSettings).toBeUndefined();expect(w.logistics).toEqual(trips);
});
it('same-owner calls preserve the current owner settings and in-flight records',()=>{
 const w=oldTrips(),before={settings:structuredClone(w.cities[1].logisticsSettings),routes:structuredClone(w.cities[1].autoLogistics),trips:structuredClone(w.logistics)};
 changeCityOwner(w,w.cities[1],w.playerFactionId,'receive');expect(w.cities[1].logisticsSettings).toEqual(before.settings);expect(w.cities[1].autoLogistics).toEqual(before.routes);expect(w.logistics).toEqual(before.trips);
});
it('legacy route-only settings cannot follow a city into new ownership',()=>{
 const w=setup();delete w.cities[1].logisticsSettings;changeCityOwner(w,w.cities[1],w.factions[2].id,'receive');
 expect(w.cities[1].autoLogistics).toEqual([]);expect(logisticsAvailable(w,w.cities[1])).toBe(15);
});
it('a recaptured city starts unconfigured and accepts fresh allocations from its current player owner',()=>{
 let w=conquer(setup());changeCityOwner(w,w.cities[1],w.playerFactionId,'conquest');
 expect(w.cities[1].logisticsSettings).toBeUndefined();expect(logisticsAvailable(w,w.cities[1])).toBe(15);
 w=act(w,{type:'logistics.configure',cityId:w.cities[1].id,rules:[],settings:{reserve:cargo(5000),manualCaravans:7,wonder:{projectId:w.largeProjects[0].projectId,maxCaravans:8,enabled:true}}});
 expect(logisticsAllocation(w.cities[1])).toMatchObject({general:0,wonder:8,manual:7,allocated:15});
});
