import {expect} from 'vitest';
import {createFormalFixture} from './fixture';
import {withModernHistory} from './catchupTestSupport';
import {initializeEconomy,handleEconomyEvent} from './economy';
import {initialMilitary} from './military';
import {initialCombat} from './combatModel';
import {build,order} from './developmentTestSupport';
import {eventId} from './ids';
import {EventScheduler} from './scheduler';
import {applyRepairCommand,handleRepairEvent,reconcileWonders} from './wonderCondition';
import {wonderRemaining} from './wonder';
import {resourceKeys,zeroResources,type FormalWorld} from './model';
import {validateFormalWorld} from './schema';
import {orderFingerprint,submitFormalOrder} from './reducer';
export function endgameWorld(active=false){
 let w=createFormalFixture({campaign:'endgame-'+crypto.randomUUID()});initializeEconomy(w);w=withModernHistory(w);w.armies=[];w.combat=initialCombat();for(const f of w.factions)f.age=3;
 const p=w.largeProjects[1],owner=p.owner.kind==='empire'?p.owner.empireId:null,f=w.factions[1].id;if(!owner)throw Error('Historical empire missing');
 w.largeProjects[0].wonder!.hostOwnerFactionId=f;w.factions[1].empireId=owner;w.politics={legions:[{id:'legion:b95',name:'奇觀軍團',description:'',leader:f,members:[f],empireId:owner}],empires:[{id:owner,name:'奇觀帝國',leader:f,legions:['legion:b95'],color:'red'}],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};
 for(const c of w.cities){c.military=initialMilitary();build(c,'market',15);build(c,'warehouse.0',15);build(c,'embassy',15);c.stock={food:100000,wood:100000,stone:100000,gold:100000};}
 if(active){
  w.factions[1].modernQualification='none';p.createdAt=w.time;p.shipments[0].dispatchedAt=w.time;p.shipments[0].authorizationSnapshot.checkedAt=w.time;
  if(p.shipments[0].phase!=='arrived')throw Error('Historical shipment missing');p.shipments[0].arrivedAt=w.time;
  Object.assign(p.breakthrough!,{phase:'building',workPeriods:[],discardedWorkMs:0,activeSince:w.time,completionEventId:eventId('b95-breakthrough-complete'),completedAt:null,qualifiedFactionIds:[]});
  w.events.push({type:'breakthrough.complete',projectId:p.projectId,id:p.breakthrough!.completionEventId!,at:w.time+p.durationMs});
 }
 const s=new EventScheduler(w.events);reconcileWonders(w,s);w.events=s.snapshot();return validateFormalWorld(w);
}
export function act(w:FormalWorld,payload:import('./model').FormalCommand,issuer=w.playerFactionId,id?:string){const t=submitFormalOrder(w,order(w,payload,id,issuer));expect(t.ack?.status,t.ack?.reason).toBe('committed');return t.world;}
/** Synthetic resupply; each repair resource still uses the actual market, stock debit,
 * capacity-bounded scheduled shipment, payment receipt and independent arrival ledger. */
export function fundRepair(w:FormalWorld,id:import('./ids').ProjectId){
 const p=w.largeProjects.find(p=>p.projectId===id)!,c=w.cities.find(c=>c.id===p.initiatingCityId)!,s=new EventScheduler(w.events),paid=zeroResources();
 while(resourceKeys.some(k=>wonderRemaining(p)[k]>0)){
  const needed=wonderRemaining(p),cargo=zeroResources();let capacity=30000;
  for(const k of resourceKeys){cargo[k]=Math.min(capacity,needed[k]);capacity-=cargo[k];}
  c.stock={...cargo};const o=order(w,{type:'wonder.repair.ship',cityId:c.id,projectId:id,resources:cargo},undefined,c.ownerFactionId),before={...c.stock};
  applyRepairCommand(w,c,o,o.payload as Extract<typeof o.payload,{type:'wonder.repair.ship'}>,s);w.revision++;w.commandReceipts.push({commandId:o.commandId,issuerId:o.issuerId,fingerprint:orderFingerprint(o),committedRevision:w.revision,disposition:'applied'});
  for(const k of resourceKeys){expect(before[k]-c.stock[k]).toBe(cargo[k]);expect(p.poolResources[k]).toBe(paid[k]);paid[k]+=cargo[k];}
  const until=w.logistics!.at(-1)!.returnAt;while(s.peek()&&s.peek()!.at<=until){const e=s.pop()!;w.time=e.at;if(!handleRepairEvent(w,e,s)&&!handleEconomyEvent(w,e,s))throw Error('Unexpected repair fixture event '+e.type);}
 }
 w.events=s.snapshot();expect(paid).toEqual(p.requiredResources);expect(p.poolResources).toEqual(p.requiredResources);validateFormalWorld(w);return w;
}
