import {armyUpkeep} from './military';
import {canDestroyWonder} from './wonder';
import {unitMilitaryPower} from './militaryPower';
import {baseUnit} from './combatModifiers';
import {isScoutUnit} from './unitCatalog';
import {diplomaticRelation} from './politics';
import {protectedFaction} from './playtest';
import {armyId,battleId,sequenceKey} from './ids';
import type {FormalCity,FormalOrder,FormalWorld} from './model';
import {zeroResources} from './model';
import type {ArmyCommand,MissionArmy,Point} from './combatModel';
import {isMissionArmy,initialCombat} from './combatModel';
import {UNIT_CATALOG} from './unitCatalog';
import {effectiveUnit,marchSeconds,carryCapacity} from './combatModifiers';
import {enqueue,requireRule,settleCity,settleFaction,HOUR} from './economy';
import type {EventScheduler} from './scheduler';
import {spatial,invalidateSpatial} from './spatial';
import {route,segmentTravelDistance} from './routing';
export function canReinforce(w:FormalWorld,a:FormalCity['ownerFactionId'],b:FormalCity['ownerFactionId']){return diplomaticRelation(w,a,b)==='own'||diplomaticRelation(w,a,b)==='friendly'||!w.politics&&!!w.factions.find(f=>f.id===a)?.empireId&&w.factions.find(f=>f.id===a)?.empireId===w.factions.find(f=>f.id===b)?.empireId;}
export function hostileAllowed(w:FormalWorld,a:FormalCity['ownerFactionId'],b:FormalCity['ownerFactionId']){return a!==b&&!canReinforce(w,a,b);}
function scheduleMarch(w:FormalWorld,a:MissionArmy,from:Point,to:Point,s:EventScheduler,returning=false){
 const r=route(w,from,to),f=w.factions.find(f=>f.id===a.ownerFactionId)!;const seconds=marchSeconds(a.units,f),times=[0];for(let i=1;i<r.path.length;i++)times.push(times[i-1]+segmentTravelDistance(w,r.path[i-1],r.path[i])*seconds*1000);
 a.marchTerrainVersion=2;a.marchSecondsPerTile=seconds;a.path=r.path;a.segmentTimes=times.map(Math.ceil);a.position={x:from.x,y:from.y};a.departedAt=w.time;a.arrivalAt=w.time+Math.max(1,Math.ceil(times.at(-1)!));a.status=returning?'returning':'outbound';a.movementEventId=enqueue(w,s,{type:returning?'army.return':'army.arrive',armyId:a.id,at:a.arrivalAt});invalidateSpatial(w);
}
export function removeArmy(w:FormalWorld,a:MissionArmy){w.armies=w.armies.filter(x=>x.id!==a.id);invalidateSpatial(w);}
export function returnArmy(w:FormalWorld,a:MissionArmy,s:EventScheduler){
 for(const b of w.combat?.battles??[]){b.defenders=b.defenders.filter(p=>p.armyId!==a.id);const participant=b.participants.find(p=>p.armyId===a.id);if(participant){participant.after={...a.units};participant.departedAt=w.time;}}
 if(!Object.values(a.units).some(n=>n>0)){removeArmy(w,a);return;}
 const owned=spatial(w).owned(a.ownerFactionId),origin=owned.find(c=>c.id===a.originCityId),candidates=origin?[origin,...owned.filter(c=>c!==origin)]:owned.sort((c,d)=>Math.hypot(c.x-a.position.x,c.y-a.position.y)-Math.hypot(d.x-a.position.x,d.y-a.position.y)||(c.id<d.id?-1:1));
 for(const c of candidates){try{settleFaction(w,a.ownerFactionId);a.returnCityId=c.id;scheduleMarch(w,a,a.position,c,s,true);return;}catch(error){if(!(error instanceof Error)||error.message!=='No traversable route')throw error;}}
 // The B7 extinction resolver consumes this retained original-owner army; no B7 work is performed here.
 a.status='stranded';a.movementEventId=null;a.returnCityId=null;invalidateSpatial(w);
}
export function applyArmyCommand(w:FormalWorld,c:FormalCity,o:FormalOrder,p:ArmyCommand,s:EventScheduler,joiningId?:string){
 w.combat??=initialCombat();
 if(p.type==='army.advance'){
  const a=w.armies.find(a=>a.id===p.armyId),target=spatial(w).cities.get(p.targetCityId);
  requireRule(a&&isMissionArmy(a)&&a.ownerFactionId===o.issuerId&&a.chain&&a.chain.conquests>=1&&a.chain.conquests<3&&a.status==='returning'&&a.departedAt===w.time&&a.target.kind==='city'&&a.target.cityId===c.id,'只能在合法征服完成當下評估同一主攻群續進。');
  requireRule(w.combat!.receipts.some(r=>r.battleId===a.battleId&&r.kind==='final'&&r.outcome==='conquered'&&r.at===w.time&&r.ownerAfter===o.issuerId),'續進需要真實征服收據。');
  const f=w.factions.find(f=>f.id===o.issuerId)!;requireRule(f.modernQualification==='full','現代突破連續攻勢需要完整現代軍事資格。');const power=Object.entries(a.units).reduce((n,[id,count])=>n+count*unitMilitaryPower(id,f),0);requireRule(power>=a.chain.initialPower*.55&&carryCapacity(a.units,f)>0,'續進兵力或實體後勤不足。');
  requireRule(target&&hostileAllowed(w,o.issuerId,target.ownerFactionId)&&!protectedFaction(w,target.ownerFactionId),'續進目標不合法。');const path=route(w,c,target),duration=path.distance*marchSeconds(a.units,f)*1000;requireRule(duration<=HOUR,'續進目標超過60世界分鐘。');const original=spatial(w).cities.get(a.originCityId),payer=original?.ownerFactionId===o.issuerId?original:spatial(w).owned(o.issuerId).sort((a,b)=>a.id.localeCompare(b.id))[0];requireRule(payer,'續進沒有合法補給城市。');settleCity(w,payer);requireRule(payer.stock.food>=Math.ceil(armyUpkeep(w,payer)*duration/HOUR),'續進實際城市軍糧不足。');
  if(a.movementEventId)s.discard(new Set([a.movementEventId]));a.battleId=battleId(sequenceKey(w.sequences.project++));a.target={kind:'city',cityId:target.id};a.returnCityId=null;delete a.jointId;delete a.wonderPriority;scheduleMarch(w,a,c,target,s);return;
 }
 if(p.type==='army.recall'){const a=w.armies.find(a=>a.id===p.armyId);requireRule(a&&isMissionArmy(a)&&a.ownerFactionId===o.issuerId&&a.status==='stationed'&&a.mission==='reinforce','只能召回自己已駐防的援軍。');settleFaction(w,a.ownerFactionId);returnArmy(w,a,s);return;}
 requireRule(c.military,'此城市沒有正式軍隊。');const units=Object.fromEntries(Object.entries(p.units).filter(([,n])=>n>0));requireRule(Object.keys(units).length>0,'請選擇派遣兵力。');
 for(const [id,count] of Object.entries(units))requireRule(UNIT_CATALOG[id]&&Number.isSafeInteger(count)&&count<=(c.military.units[id]??0),'選取兵種不存在或城內兵力不足。');
 const target=p.target.kind==='city'?spatial(w).cities.get(p.target.cityId):spatial(w).sites.get(p.target.siteId);requireRule(target,'目標已不存在或正處於冷卻。');requireRule(target.x!==c.x||target.y!==c.y,'不能派遣到出發城市。');
 if(p.target.kind==='wild'){requireRule((p.mission==='raid'||p.mission==='scout')&&'generation' in target&&target.generation===p.target.generation,'野外據點只接受掠奪或偵察，且目標世代必須相符。');}
 else{const dest=target as FormalCity;requireRule(p.mission==='reinforce'||!protectedFaction(w,dest.ownerFactionId),'目標仍在新手保護中。');requireRule(p.mission==='reinforce'?canReinforce(w,o.issuerId,dest.ownerFactionId):hostileAllowed(w,o.issuerId,dest.ownerFactionId),'此目標不符合任務的勢力授權。');}
 if(p.mission==='wonder-destruction'||p.wonderPriority){requireRule(p.target.kind==='city'&&w.largeProjects.some(q=>q.wonder&&q.wonder.phase!=='funding'&&(p.mission!=='wonder-destruction'||canDestroyWonder(w,q))&&q.initiatingCityId===(p.target.kind==='city'?p.target.cityId:null)),'奇觀破壞只能指定仍有有效耐久的實體世界奇觀。');const joint=joiningId?w.politics?.joints.find(j=>j.id===joiningId):undefined;requireRule(Object.keys(units).some(id=>baseUnit(id)==='catapult')||joint&&joint.armyIds.some(id=>w.armies.find(a=>a.id===id)?.units&&Object.entries(w.armies.find(a=>a.id===id)!.units!).some(([id,n])=>baseUnit(id)==='catapult'&&n>0)),'奇觀轟擊至少需要一台合法投石機。');requireRule(p.mission==='wonder-destruction'||p.mission==='conquest','只有奇觀破壞或征服可選擇奇觀目標。');}
 if(p.mission==='scout')requireRule((p.target.kind==='city'||p.scoutMode==='resources-army')&&Object.keys(units).every(isScoutUnit),'偵察只能派遣斥候；野外據點固定偵察資源與軍隊。');
 else{requireRule(p.scoutMode===undefined,'非偵察任務不可攜帶情報選项。');if(p.mission!=='reinforce'&&p.mission!=='wonder-destruction')requireRule(Object.keys(units).some(effectiveUnit),'掠奪／征服至少需要一名有效戰鬥兵。');}
 const key=sequenceKey(w.sequences.project++),a:MissionArmy={id:armyId(key),battleId:battleId(key),commandId:o.commandId,ownerFactionId:o.issuerId,originCityId:c.id,units,initialUnits:{...units},mission:p.mission,...(p.mission==='conquest'?{chain:{initialPower:Object.entries(units).reduce((n,[id,count])=>n+count*unitMilitaryPower(id,w.factions.find(f=>f.id===o.issuerId)),0),conquests:0,battles:[]}}:{}),...(p.wonderPriority?{wonderPriority:true}:{}),target:{...p.target},status:'outbound',path:[],segmentTimes:[],marchSecondsPerTile:1,position:{x:c.x,y:c.y},departedAt:w.time,arrivalAt:w.time,movementEventId:null,returnCityId:null,cargo:zeroResources(),...(p.scoutMode?{scoutMode:p.scoutMode}:{})};
 try{scheduleMarch(w,a,c,target,s);}catch{requireRule(false,'目標沒有可通行的行軍路徑。');}
 if(p.target.kind==='city'&&p.mission!=='reinforce'&&!(p.mission==='scout'&&w.extinction?.rebirths&&o.issuerId===w.playerFactionId&&!w.developer?.enabled)){const f=w.factions.find(f=>f.id===o.issuerId)!;if(f.protectionUntil!==undefined)f.protectionUntil=Math.min(f.protectionUntil,w.time);}
 settleCity(w,c);for(const [id,count] of Object.entries(units)){c.military.units[id]-=count;if(!c.military.units[id])delete c.military.units[id];}w.armies.push(a);invalidateSpatial(w);
}
