import {cityId,projectId,sequenceKey} from './ids';
import type {DevelopmentCommand,FormalCity,FormalEvent,FormalOrder,FormalWorld} from './model';
import {resourceKeys} from './model';
import {buildingLevel} from './catalogB3';
import {initialCity} from './generator';
import {fieldDistribution,buildable,terrainAt} from './terrain';
import {spatial} from './spatial';
import {EventScheduler} from './scheduler';
import {enqueue,HOUR,initializeCityEconomy,requireRule,settleCity,spend,addStock} from './economy';
import {initialMilitary} from './military';
import {producerMultiplier,UNIT_CATALOG} from './unitCatalog';
import {route} from './routing';
export const SETTLEMENT_COST={food:6000,wood:8000,stone:12000,gold:4000};
export const colonizationUnits=(w:FormalWorld,cityId:FormalCity['id'])=>(w.colonizationUnits??[]).filter(u=>u.sourceCityId===cityId);
export const readyColonizationUnit=(w:FormalWorld,cityId:FormalCity['id'])=>colonizationUnits(w,cityId).find(u=>u.phase==='ready');
/** Called only after an old native envelope has passed checksum and strict validation. */
export function migrateColonizationUnits(w:FormalWorld){
 if(w.fixture||w.metadata.rulesetVersion!=='v84-b4.1')return w;
 w.colonizationUnits=(w.settlements??[]).filter(p=>p.phase!=='preparing').map(p=>({id:'colonization:'+p.projectId.slice(8),kind:'colonization',quantity:1,ownerFactionId:p.ownerFactionId,sourceCityId:p.sourceCityId,projectId:p.projectId,phase:p.phase as 'ready'|'travelling',population:400,producedAt:p.startedAt+p.prepDurationMs}));
 w.metadata={...w.metadata,rulesetVersion:'v85-b4.2'};return w;
}
export function applySettlementCommand(w:FormalWorld,c:FormalCity,o:FormalOrder,p:Extract<DevelopmentCommand,{type:'settlement.prepare'|'settlement.cancel'|'settlement.dispatch'}>,s:EventScheduler){
 const f=w.factions.find(f=>f.id===o.issuerId)!,projects=w.settlements??=[],existing=projects.find(p=>p.sourceCityId===c.id&&p.phase!=='travelling');
 if(p.type==='settlement.prepare'){
  requireRule(!existing&&(f.age??0)>=2&&buildingLevel(c,'castle')>=1&&c.population>=2000,'拓殖需要城堡時代、城堡及2000人口，且來源城不可有既存拓殖隊。');
  spend(c,SETTLEMENT_COST);c.population-=400;const id=projectId(sequenceKey(w.sequences.project++)),prepDurationMs=Math.round(4*HOUR*producerMultiplier(buildingLevel(c,'castle'))),prepEventId=enqueue(w,s,{type:'settlement.ready',projectId:id,at:w.time+prepDurationMs});
  (w.settlements??=[]).push({projectId:id,commandId:o.commandId,ownerFactionId:o.issuerId,sourceCityId:c.id,phase:'preparing',population:400,resourcesPaid:{...SETTLEMENT_COST},startedAt:w.time,prepDurationMs,prepEventId});return;
 }
 requireRule(existing&&existing.ownerFactionId===o.issuerId,'此城沒有自己的拓殖隊。');
 if(p.type==='settlement.cancel'){
  requireRule(existing.phase==='preparing','只能取消尚未完成的整備。');requireRule(c.population+400<=c.housing,'請先擴充住房，以完整接回400名移民。');c.population+=400;const refund={...existing.resourcesPaid};for(const r of resourceKeys)refund[r]*=.8;addStock(c,refund);w.settlements=projects.filter(t=>t!==existing);const keep=s.snapshot().filter(e=>e.id!==existing.prepEventId);while(s.size)s.pop();for(const e of keep)s.push(e);return;
 }
 const unit=readyColonizationUnit(w,c.id);
 requireRule(existing.phase==='ready'&&unit&&unit.projectId===existing.projectId&&unit.ownerFactionId===o.issuerId,'沒有待命拓殖隊，或拓殖隊已出發。');const index=spatial(w),cell=index.at(p.x,p.y);
 requireRule(buildable(terrainAt(w,p.x,p.y))&&!cell.city&&!cell.site&&!cell.reservation,'目標不是可建城的空格或已被預約。');
 requireRule(c.military,'護衛軍資料不存在。');let combat=0;
 for(const [id,count] of Object.entries(p.escort)){const u=UNIT_CATALOG[id];requireRule(u&&count<=(c.military.units[id]??0)&&u.combatClass!=='siege','護衛不存在、不足，或選入不可同行的攻城器。');if(['infantry','ranged','cavalry','mounted-ranged'].includes(u.combatClass))combat+=count;}
 requireRule(combat>=20,'至少需20名有效戰鬥護衛。');let path:ReturnType<typeof route>;try{path=route(w,c,p);}catch{requireRule(false,'目的地沒有可通行的拓殖路徑。');}const arrivalAt=w.time+Math.max(1,Math.ceil(path!.distance*45000));
 for(const [id,count] of Object.entries(p.escort)){c.military.units[id]-=count;if(!c.military.units[id])delete c.military.units[id];}
 unit.phase='travelling';existing.phase='travelling';existing.target={x:p.x,y:p.y,name:p.name};existing.escort=Object.fromEntries(Object.entries(p.escort).filter(([,n])=>n>0));existing.path=path!.path;existing.distance=path!.distance;existing.arrivalAt=arrivalAt;existing.arrivalEventId=enqueue(w,s,{type:'settlement.arrive',projectId:existing.projectId,at:arrivalAt});index.reserve(p.x,p.y,existing.projectId);
}
export function handleSettlementEvent(w:FormalWorld,e:Extract<FormalEvent,{type:'settlement.ready'|'settlement.arrive'}>,s:EventScheduler){
 const p=w.settlements?.find(p=>p.projectId===e.projectId);if(!p)return;
 if(e.type==='settlement.ready'){if(p.phase==='preparing'&&p.prepEventId===e.id){requireRule(!readyColonizationUnit(w,p.sourceCityId),'此城已有待命拓殖隊。');p.phase='ready';(w.colonizationUnits??=[]).push({id:'colonization:'+p.projectId.slice(8),kind:'colonization',quantity:1,ownerFactionId:p.ownerFactionId,sourceCityId:p.sourceCityId,projectId:p.projectId,phase:'ready',population:400,producedAt:e.at});}return;}
 requireRule(p.phase==='travelling'&&p.arrivalEventId===e.id&&p.target&&p.escort,'拓殖抵達契約不一致。');
 const unit=(w.colonizationUnits??[]).find(u=>u.projectId===p.projectId&&u.phase==='travelling');requireRule(unit,'拓殖行軍單位不存在。');
 const t=p.target,index=spatial(w);requireRule(index.at(t.x,t.y).reservation===p.projectId&&!index.at(t.x,t.y).city&&!index.at(t.x,t.y).site&&buildable(terrainAt(w,t.x,t.y)),'拓殖預約失效。');
 const source=index.cities.get(p.sourceCityId);if(source)settleCity(w,source);
 const c=initialCity(p.ownerFactionId,cityId('settlement-'+sequenceKey(w.sequences.project++)),t.x,t.y,t.name,false,fieldDistribution(w.seed,t.x,t.y));initializeCityEconomy(w,c,s);c.military=initialMilitary();c.military.units={...p.escort};c.autoLogistics=[];
 // Escort origins are now the new city; no free population or duplicate source units are added.
 index.release(t.x,t.y,p.projectId);w.cities.push(c);index.addCity(c);w.settlements=w.settlements!.filter(q=>q!==p);w.colonizationUnits=w.colonizationUnits!.filter(u=>u!==unit);settleCity(w,c);
}
