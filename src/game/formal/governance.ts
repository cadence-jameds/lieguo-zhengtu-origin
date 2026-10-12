import type {FormalCity,FormalCommand,FormalEvent,FormalOrder,FormalWorld,Resources} from './model';
import {resourceKeys,zeroResources} from './model';
import type {CityId,FactionId,EventId} from './ids';
import {eventId,sequenceKey} from './ids';
import {buildingLevel,storageCapacity} from './catalogB3';
import {EventScheduler} from './scheduler';
import {requireRule,settleCity} from './economy';
import {traitsFor,type Agent} from './autonomyModel';
import {economicChoices,submitAutonomous,type Submit} from './autonomy';
import {spatial} from './spatial';
export const GOVERNANCE_POLICIES=['balanced','economy','population','military','reserve'] as const;
export type GovernancePolicy=typeof GOVERNANCE_POLICIES[number];
export type Governor={cityId:CityId;ownerFactionId:FactionId;enabled:boolean;policy:GovernancePolicy;budget:number;reserve:number;spent:Resources;period:number;eventId:EventId|null;nextAt:number;decisions:number;blocked:string};
export type GovernanceCommand={type:'governance.set';cityId:CityId;enabled:boolean;policy:GovernancePolicy;budget:number;reserve:number};
export const GOVERNOR_DEFAULTS={budget:2400,reserve:180}; // Retain existing source city.ts defaultGovernor, CALIBRATE rather than new locked values.
const HOUR=3600000;
export function applyGovernance(w:FormalWorld,c:FormalCity,o:FormalOrder,p:GovernanceCommand,s:EventScheduler){requireRule(c.economy&&(!p.enabled||buildingLevel(c,'townhall')>=1),'委任總督需要本城市政廳 Lv1。');const old=w.governors?.find(g=>g.cityId===c.id),period=Math.floor(w.time/HOUR);if(old?.eventId){const keep=s.snapshot().filter(e=>e.id!==old.eventId);while(s.size)s.pop();for(const e of keep)s.push(e);}
 const g:Governor={cityId:c.id,ownerFactionId:o.issuerId,enabled:p.enabled,policy:p.policy,budget:p.budget,reserve:p.reserve,spent:old?.ownerFactionId===o.issuerId&&old.period===period?{...old.spent}:zeroResources(),period,eventId:p.enabled?eventId(sequenceKey(w.sequences.event++)):null,nextAt:w.time,decisions:old?.decisions??0,blocked:p.enabled?'等待正式治理排程':'已停止'};
 w.governors=(w.governors??[]).filter(g=>g.cityId!==c.id);w.governors.push(g);if(g.eventId)s.push({id:g.eventId,type:'governance.decide',cityId:c.id,at:g.nextAt});
}
export function retireGovernors(w:FormalWorld,s:EventScheduler){const removed=new Set<string>();for(const g of w.governors??[]){const c=spatial(w).cities.get(g.cityId);if(g.enabled&&(!c||c.ownerFactionId!==g.ownerFactionId||buildingLevel(c,'townhall')<1)){if(g.eventId)removed.add(g.eventId);g.enabled=false;g.eventId=null;g.blocked='城市所有權或市政廳資格已失效';}}if(removed.size){const keep=s.snapshot().filter(e=>!removed.has(e.id));while(s.size)s.pop();for(const e of keep)s.push(e);}}
export function handleGovernance(w:FormalWorld,e:FormalEvent,s:EventScheduler,submit:Submit){if(e.type!=='governance.decide')return null;let g=w.governors?.find(g=>g.cityId===e.cityId&&g.eventId===e.id);if(!g||!g.enabled)return[];const c=spatial(w).cities.get(g.cityId)!;settleCity(w,c);const period=Math.floor(w.time/HOUR);if(period!==g.period){g.period=period;g.spent=zeroResources();}g.decisions++;
 g.nextAt=(period+1)*HOUR;g.eventId=eventId(sequenceKey(w.sequences.event++));s.push({type:'governance.decide',id:g.eventId,cityId:c.id,at:g.nextAt});
 const agent=w.autonomy?.agents.find(a=>a.factionId===g!.ownerFactionId)??({factionId:g.ownerFactionId,traits:traitsFor(w.seed,g.ownerFactionId),decisions:g.decisions,nextAt:0,eventId:null,active:true,budgetPercent:100,lastWarAt:0,memory:[],intel:[]} satisfies Agent);
 const preference=g.policy,spent=resourceKeys.reduce((n,r)=>n+g!.spent[r],0),choices=preference==='reserve'?[]:economicChoices(w,c,agent).filter(q=>resourceKeys.reduce((n,r)=>n+q.cost[r],0)+spent<=g!.budget&&resourceKeys.every(r=>q.cost[r]<=Math.max(0,c.stock[r]-g!.reserve))).sort((a,b)=>{const score=(q:typeof a)=>q.score+(preference===q.category?3:0);return score(b)-score(a)||(JSON.stringify(a.command)<JSON.stringify(b.command)?-1:1);});
 const choice=choices[0];if(!choice){g.blocked=preference==='reserve'?'資源儲備方針：保留庫存':'等待前置、資源或本世界小時預算';return[];}
 const before=w.commandReceipts.length;const reports=submitAutonomous(w,s,e,g.ownerFactionId,[choice.command],submit);g=w.governors!.find(t=>t.cityId===c.id)!;if(w.commandReceipts.length>before){for(const r of resourceKeys)g.spent[r]+=choice.cost[r];g.blocked='已下達正式'+choice.category+'命令';}else g.blocked='正式命令未接受；沒有扣款';return reports;
}
export function supplyDecision(w:FormalWorld,c:FormalCity):FormalCommand|undefined{if(buildingLevel(c,'market')<1||c.stock.food<1200||(w.logistics??[]).some(t=>t.sourceCityId===c.id))return;const target=spatial(w).owned(c.ownerFactionId).find(n=>n.id!==c.id&&n.stock.food<200&&storageCapacity(n)-n.stock.food-(n.economy?.reservedIncoming.food??0)>=100);if(!target)return;const food=Math.floor(Math.min(1000,c.stock.food-600,storageCapacity(target)-target.stock.food-(target.economy?.reservedIncoming.food??0)));return{type:'logistics.dispatch',cityId:c.id,destinationCityId:target.id,resources:{...zeroResources(),food}};}
