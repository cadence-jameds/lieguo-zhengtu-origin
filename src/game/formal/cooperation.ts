import {effectiveUnit} from './combatModifiers';
import {UNIT_CATALOG} from './unitCatalog';
import type {FormalWorld,FormalCity,FormalOrder} from './model';
import type {CooperationCommand} from './politics';
import {initialPolitics,canCoordinate,legionOf,empireOf,embassy,politicalScope} from './politics';
import {requireRule,enqueue} from './economy';
import {applyArmyCommand} from './armies';
import {isMissionArmy} from './combatModel';
import {sequenceKey} from './ids';
import type {EventScheduler} from './scheduler';
export function applyCooperation(w:FormalWorld,c:FormalCity,o:FormalOrder,p:CooperationCommand,s:EventScheduler){
 const political=w.politics??=initialPolitics();
 if(p.type==='defense.set'){requireRule(legionOf(w,o.issuerId)&&embassy(w,legionOf(w,o.issuerId)!.leader)>=13||empireOf(w,o.issuerId)&&embassy(w,empireOf(w,o.issuerId)!.leader)>=15,'聯防需要軍團使館 Lv13／帝國 Lv15。');requireRule(Object.entries(p.units).every(([id,n])=>!!UNIT_CATALOG[id]&&Number.isSafeInteger(n)&&n>=0&&n<=(c.military?.units[id]??0)),'預備兵力不可超過本城兵力。');const reserve={cityId:c.id,units:{...p.units},keep:p.keep,enabled:p.enabled};political.reserves=political.reserves.filter(r=>r.cityId!==c.id);political.reserves.push(reserve);return;}
 if(p.type==='defense.dispatch'){const target=w.cities.find(c=>c.id===p.targetCityId),r=political.reserves.find(r=>r.cityId===c.id&&r.enabled);requireRule(target&&r&&canCoordinate(w,o.issuerId,target.ownerFactionId,13),'不符合聯防協議。');const units:Record<string,number>=Object.fromEntries(Object.entries(r.units).map(([id,n])=>[id,Math.min(n,c.military?.units[id]??0)]).filter(([,n])=>Number(n)>0));let left=Object.entries(c.military?.units??{}).reduce((n,[id,v])=>n+(effectiveUnit(id)?v:0),0)-Object.entries(units).reduce((n,[id,v])=>n+(effectiveUnit(id)?v:0),0);for(const id of Object.keys(units)){const reduction=effectiveUnit(id)?Math.min(units[id],Math.max(0,r.keep-left)):0;units[id]-=reduction;left+=reduction;if(!units[id])delete units[id];}requireRule(Object.keys(units).length,'沒有可派出的預備隊。');applyArmyCommand(w,c,o,{type:'army.dispatch',cityId:c.id,mission:'reinforce',target:{kind:'city',cityId:target.id},units},s);return;}
 const j=p.type==='joint.join'?political.joints.find(j=>j.id===p.jointId):undefined;
 if(p.type==='joint.join')requireRule(j&&canCoordinate(w,o.issuerId,j.initiator,14),'不符合聯軍會師資格。');
 const l=legionOf(w,o.issuerId);if(p.type==='joint.create')requireRule(l&&embassy(w,l.leader)>=14||empireOf(w,o.issuerId)&&embassy(w,empireOf(w,o.issuerId)!.leader)>=15,'聯軍需要軍團使館 Lv14／帝國 Lv15。');
 const targetId=p.type==='joint.create'?p.targetCityId:j!.targetCityId;
 applyArmyCommand(w,c,o,{type:'army.dispatch',cityId:c.id,mission:'conquest',target:{kind:'city',cityId:targetId},units:p.units},s);
 const a=w.armies.filter(isMissionArmy).at(-1)!,travel=a.arrivalAt-w.time;
 const group=j??{id:'joint:'+sequenceKey(w.sequences.project++),initiator:o.issuerId,targetCityId:targetId,arrivalAt:Math.max(p.type==='joint.create'?p.arrivalAt:0,a.arrivalAt),armyIds:[],scope:politicalScope(w,o.issuerId)};
 if(!j)political.joints.push(group);group.armyIds.push(a.id);a.jointId=group.id;
 const depart=Math.max(w.time,group.arrivalAt-travel);
 if(depart>w.time){const retained=s.snapshot().filter(e=>e.id!==a.movementEventId);while(s.pop()){};for(const e of retained)s.push(e);a.departedAt=depart;a.arrivalAt=depart+travel;a.status='waiting';a.movementEventId=enqueue(w,s,{type:'army.depart',armyId:a.id,at:depart});}
}
