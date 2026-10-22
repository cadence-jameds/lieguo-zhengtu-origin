import {expect} from 'vitest';
import {createFormalFixture} from './fixture';
import {initializeEconomy,handleEconomyEvent} from './economy';
import {order,build} from './developmentTestSupport';
import {empireId,projectId,shipmentId,eventId,commandId} from './ids';
import {resourceKeys,zeroResources,type FormalWorld,type LargeProject,type FormalCommand} from './model';
import {WONDER_COST,WONDER_DURATION,wonderRemaining} from './wonder';
import {BREAKTHROUGH_COST,BREAKTHROUGH_DURATION} from './breakthrough';
import {canonicalJSON} from './canonical';
import {advanceFormal,submitFormalOrder,orderFingerprint} from './reducer';
import {applyCatchupCommand,handleCatchupEvent} from './modernCatchup';
import {EventScheduler} from './scheduler';
import {validateFormalWorld} from './schema';
/** Historical B9-2 fixture only. We do not rerun B9-1/B9-2 construction here.
 * Every new B9-4 payment below uses real stock and capacity-limited scheduled cargo. */
export function withModernHistory(w:FormalWorld){
 const host=w.cities.find(c=>c.ownerFactionId!==w.playerFactionId)!,f=host.ownerFactionId,empire=empireId('historical-modern'),end=WONDER_DURATION+BREAKTHROUGH_DURATION;
 w=advanceFormal(w,Math.max(end,w.time)).world;w.factions.find(x=>x.id===f)!.modernQualification='full';
 const history=(kind:'world-wonder'|'civilization-breakthrough',cost:typeof WONDER_COST|typeof BREAKTHROUGH_COST,createdAt:number,durationMs:number):LargeProject=>{
  const id=projectId('history-'+kind),creation=commandId('history-'+kind+'-start'),payment=commandId('history-'+kind+'-ship'),type=kind==='world-wonder'?'wonder':'breakthrough';
  for(const [cid,payload] of [[creation,kind==='world-wonder'?{type:'wonder.start',cityId:host.id,hostCityId:host.id}:{type:'breakthrough.start',cityId:host.id}],[payment,{type:type+'.ship',cityId:host.id,projectId:id,resources:cost}]] as const)w.commandReceipts.push({commandId:cid,issuerId:f,fingerprint:canonicalJSON({campaignId:w.campaignId,issuerId:f,payload}),committedRevision:w.revision,disposition:'applied'});
  return{projectId:id,kind,owner:{kind:'empire',empireId:empire},legalContributors:{kind:'current-empire-members',empireId:empire},paymentMode:'physical-shipment',initiatingCityId:host.id,requiredResources:{...cost},poolResources:{...cost},shipments:[{shipmentId:shipmentId('history-'+kind),projectId:id,commandId:payment,sourceFactionId:f,sourceCityId:host.id,destinationCityId:host.id,resources:{...cost},dispatchedAt:createdAt,authorizationSnapshot:{sourceCityOwnerFactionId:f,contributorEmpireId:empire,checkedAt:createdAt},phase:'arrived',arrivedAt:createdAt,arrivalEventId:eventId('history-'+kind+'-arrival')}],createdAt,durationMs,...(kind==='world-wonder'?{wonder:{creationCommandId:creation,hostOwnerFactionId:w.playerFactionId,phase:'completed' as const,startedAt:createdAt,completionEventId:eventId('history-wonder-complete'),completedAt:createdAt+durationMs}}:{breakthrough:{creationCommandId:creation,wonderProjectId:projectId('history-world-wonder'),phase:'completed' as const,workPeriods:[{startedAt:createdAt,endedAt:createdAt+durationMs}],discardedWorkMs:0,activeSince:null,completionEventId:eventId('history-breakthrough-complete'),completedAt:createdAt+durationMs,qualifiedFactionIds:[f]}})};
 };
 w.largeProjects.push(history('world-wonder',WONDER_COST,0,WONDER_DURATION),history('civilization-breakthrough',BREAKTHROUGH_COST,WONDER_DURATION,BREAKTHROUGH_DURATION));return validateFormalWorld(w);
}
export function catchupWorld(){let w=createFormalFixture({campaign:'catchup-'+crypto.randomUUID()});initializeEconomy(w);for(const c of w.cities){build(c,'market',15);build(c,'embassy',15);build(c,'warehouse.0',15);}w=withModernHistory(w);w.modernAwareness={pools:{[w.playerFactionId]:{value:100,significantEncounter:true,encountered:['modern.knight']}},battles:[]};return w;}
export function act(w:FormalWorld,p:FormalCommand,issuer=w.playerFactionId,id?:string){const t=submitFormalOrder(w,order(w,p,id,issuer));expect(t.ack?.status,t.ack?.reason).toBe('committed');return t.world;}
/** Like the existing engineering fixtures, each trip is synthetically resupplied.
 * Batch only cloning/validation; commands, receipt fingerprints, stock spending,
 * caravan capacity, event scheduling, arrival credits and returns are production handlers. */
export function fundCatchup(w:FormalWorld,id:LargeProject['projectId']){
 const p=w.largeProjects.find(p=>p.projectId===id)!,c=w.cities.find(c=>c.id===p.initiatingCityId)!,s=new EventScheduler(w.events),deducted=zeroResources();
 while(p.catchup!.phase==='funding'){
  const needed=wonderRemaining(p),cargo=zeroResources();let capacity=30000;
  for(const r of resourceKeys){cargo[r]=Math.min(capacity,needed[r]);capacity-=cargo[r];}
  expect(capacity).toBeLessThan(30000);c.stock={...cargo};const o=order(w,{type:'modern.project.ship',cityId:c.id,projectId:id,resources:cargo},'fund-'+w.sequences.project,c.ownerFactionId),before={...c.stock};
  applyCatchupCommand(w,c,o,o.payload as Extract<typeof o.payload,{type:'modern.project.ship'}>,s);w.revision++;w.commandReceipts.push({commandId:o.commandId,issuerId:o.issuerId,fingerprint:orderFingerprint(o),committedRevision:w.revision,disposition:'applied'});
  for(const r of resourceKeys){expect(before[r]-c.stock[r]).toBe(cargo[r]);deducted[r]+=cargo[r];expect(p.poolResources[r]).toBe(deducted[r]-cargo[r]);}
  const until=w.logistics!.at(-1)!.returnAt;while(s.peek()&&s.peek()!.at<=until){const e=s.pop()!;w.time=e.at;if(!handleCatchupEvent(w,e,s)&&!handleEconomyEvent(w,e,s))throw Error('Unexpected fixture event: '+e.type);}
 }
 w.events=s.snapshot();expect(deducted).toEqual(p.requiredResources);expect(p.poolResources).toEqual(p.requiredResources);validateFormalWorld(w);return w;
}

export function empire(w:FormalWorld,members=w.factions.map(f=>f.id)){
 const id=empireId('catchup-current');w.politics={legions:[{id:'legion:catchup-current',name:'共同體',description:'',leader:members[0],members:[...members],empireId:id}],empires:[{id,name:'帝國',leader:members[0],legions:['legion:catchup-current'],color:'red'}],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};for(const f of w.factions){f.empireId=members.includes(f.id)?id:null;f.age=2;}w.modernAwareness??={pools:{},battles:[]};w.modernAwareness.pools[id]={value:100,significantEncounter:true,encountered:['modern.knight']};return w;
}
