import {PROTECTION_DURATION} from './protection';
import {isScoutUnit,scoutCount} from './unitCatalog';
import {effectiveUnit} from './combatModifiers';
import type {FormalWorld,FormalCity,FormalOrder,ResearchProject,WildSite,FormalEvent,Construction} from './model';
import type {FactionId,CityId,ArmyId,EventId} from './ids';
import {cityId,wildSiteId,sequenceKey} from './ids';
import {isMissionArmy,type MissionArmy,type Point} from './combatModel';
import {armyPosition} from './armyPosition';
import {seedHash,buildable,terrainAt,fieldDistribution} from './terrain';
import {spatial,invalidateSpatial} from './spatial';
import {removePoliticalMember} from './politics';
import {enqueue,initializeCityEconomy,requireRule,applyEconomyCommand} from './economy';
import {initialCity} from './generator';
import {initialMilitary} from './military';
import {route} from './routing';
import type {EventScheduler} from './scheduler';
import {UNIT_CATALOG} from './unitCatalog';
export type ExileSite=WildSite&{exile:true;sourceFactionId:FactionId;civilizationId:string;createdAt:number;defeatedAt?:number};
export type Craftsman={id:string;ownerFactionId:FactionId;civilizationId:string;siteId:WildSite['id'];cityId:CityId|null;carrierArmyId:ArmyId|null;eventId:EventId|null;destinationCityId:CityId|null;arrivalAt:number|null;path:Point[];departedAt:number;constructionCommandId:string|null};
export type ExtinctionState={extinct:FactionId[];sites:ExileSite[];craftsmen:Craftsman[];cancelledResearch:ResearchProject[];rebirths:number;resumedAt?:number;defeat?:{at:number;ended:boolean;battleId?:import('./ids').BattleId}};
export type ExtinctionCommand={type:'player.rebirth';cityId:CityId;name:string;x?:number;y?:number;candidate?:number}|{type:'player.end';cityId:CityId}|{type:'craftsman.move';cityId:CityId;craftsmanId:string;destinationCityId:CityId}|{type:'craftsman.castle';cityId:CityId;craftsmanId:string};
export const initialExtinction=():ExtinctionState=>({extinct:[],sites:[],craftsmen:[],cancelledResearch:[],rebirths:0});
export const worldPaused=(w:FormalWorld)=>!!w.extinction?.defeat;
export function rebirthLocationReason(w:FormalWorld,p:Point){
 if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=w.dimensions.width||p.y>=w.dimensions.height)return '座標須為 0～383 的整數';
 const terrain=terrainAt(w,p.x,p.y);if(!buildable(terrain))return terrain==='mountain'?'山地不可建城':'水域不可建城';
 const cell=spatial(w).at(p.x,p.y);if(cell.city)return '此處已有城市';
 if(cell.site||w.worldLayer?.wildSites.some(s=>s.x===p.x&&s.y===p.y))return '此處已有野外據點';
 if(cell.reservation)return '此處已有正式建城預約';return '';
}
function legal(w:FormalWorld,p:Point){return !rebirthLocationReason(w,p);}
function nearest(w:FormalWorld,p:Point){for(let r=0;r<Math.max(w.dimensions.width,w.dimensions.height);r++){const points:Point[]=[];for(let y=Math.max(0,Math.floor(p.y)-r);y<=Math.min(w.dimensions.height-1,Math.floor(p.y)+r);y++)for(let x=Math.max(0,Math.floor(p.x)-r);x<=Math.min(w.dimensions.width-1,Math.floor(p.x)+r);x++)if(Math.max(Math.abs(x-Math.floor(p.x)),Math.abs(y-Math.floor(p.y)))===r&&legal(w,{x,y}))points.push({x,y});if(points.length)return points.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)||a.y-b.y||a.x-b.x)[0];}throw new Error('No legal exile/rebirth location');}
export const exileUnits=(units:Record<string,number>)=>Object.fromEntries(Object.entries(units).filter(([id,n])=>!isScoutUnit(id)&&n>0));
export const eligibleExile=(units:Record<string,number>)=>Object.entries(units).some(([id,n])=>n>0&&effectiveUnit(id));
/** Keep legacy site identity/history; retire only invalid active sites and never revoke earned rewards. */
export function reconcileExileSites(w:FormalWorld){let changed=false;for(const site of w.extinction?.sites??[]){if(site.phase!=='active')continue;if(!eligibleExile(site.defenders??{})){site.phase='cooldown';site.defenders={};site.defeatedAt??=w.time;changed=true;}else if(site.defenders&&scoutCount(site.defenders)>0){site.defenders=exileUnits(site.defenders);changed=true;}}if(changed)invalidateSpatial(w);return w;}
export function createExile(w:FormalWorld,owner:FactionId,units:Record<string,number>,path:Point[],near:Point){if(!eligibleExile(units))return;units=exileUnits(units);const state=w.extinction??=initialExtinction(),key=sequenceKey(w.sequences.project++),sample=path.length?path[seedHash(w.seed,w.sequences.project,0,701)%path.length]:near,point=legal(w,sample)?sample:nearest(w,sample);const site:ExileSite={id:wildSiteId('exile-'+key),exile:true,sourceFactionId:owner,civilizationId:w.factions.find(f=>f.id===owner)!.civilizationId,createdAt:w.time,spawnSlot:432+w.sequences.project,generation:0,region:spatial(w).regionAt(point.x,point.y),...point,resource:'bandit',level:1,phase:'active',defenders:{...units},initialDefenders:{...units},loot:{food:0,wood:0,stone:0,gold:0}};state.sites.push(site);invalidateSpatial(w);}
/** Called after every resolution. Already engaged troops finish that battle before conversion. */
export function resolveExtinctions(w:FormalWorld,s:EventScheduler){
 reconcileExileSites(w);
 const inBattle=(a:MissionArmy)=>w.combat?.battles.some(b=>b.id===a.battleId&&a.status==='engaged'||b.defenders.some(p=>p.armyId===a.id));
 const pending=w.armies.filter(isMissionArmy).filter(a=>a.extinctionPending&&!inBattle(a));
 for(const a of pending)createExile(w,a.ownerFactionId,a.units,[],a.position);
 w.armies=w.armies.filter(a=>!pending.includes(a as MissionArmy));
 if(pending.length){const pendingEvents=new Set(pending.map(a=>a.movementEventId));const saved=s.snapshot().filter(e=>!pendingEvents.has(e.id));while(s.pop()){};for(const e of saved)s.push(e);invalidateSpatial(w);}

 for(const f of w.factions){if(spatial(w).owned(f.id).length)continue;const state=w.extinction??=initialExtinction();if(!state.extinct.includes(f.id)){state.extinct.push(f.id);if(f.id===w.playerFactionId){const final=w.combat?.receipts.findLast(r=>r.kind==='final'&&r.at===w.time&&r.ownerBefore===f.id&&r.outcome==='conquered');delete state.resumedAt;state.defeat={at:w.time,ended:false,...(final?{battleId:final.battleId}:{})};}for(const a of w.armies.filter(isMissionArmy))if(a.ownerFactionId===f.id)a.extinctionPending=true;removePoliticalMember(w,f.id);const projects=w.researchProjects.filter(p=>p.ownerFactionId===f.id&&p.phase!=='completed');state.cancelledResearch.push(...projects);const lostCraftEvents=new Set(state.craftsmen.filter(c=>c.ownerFactionId===f.id).flatMap(c=>c.eventId?[c.eventId]:[]));state.craftsmen=state.craftsmen.filter(c=>c.ownerFactionId!==f.id);w.researchProjects=w.researchProjects.filter(p=>!projects.includes(p));f.researchQueue=null;const removed=new Set<EventId>([...lostCraftEvents,...projects.flatMap(p=>p.completionEventId?[p.completionEventId]:[])]);if(f.ageQueue){removed.add(f.ageQueue.eventId);f.ageQueue=null;}
 const settlements=(w.settlements??[]).filter(p=>p.ownerFactionId===f.id);for(const p of settlements){removed.add(p.prepEventId);if(p.arrivalEventId)removed.add(p.arrivalEventId);if(p.escort)createExile(w,f.id,p.escort,p.path??[],p.path?.at(-1)??w.cities.find(c=>c.id===p.sourceCityId)!);}
 w.settlements=w.settlements?.filter(p=>p.ownerFactionId!==f.id);w.colonizationUnits=w.colonizationUnits?.filter(p=>p.ownerFactionId!==f.id);w.largeProjects=w.largeProjects.filter(p=>!!p.catchup||p.owner.kind!=='faction'||p.owner.factionId!==f.id);const kept=s.snapshot().filter(e=>!removed.has(e.id));while(s.pop()){};for(const e of kept)s.push(e);invalidateSpatial(w);}
 const armies=w.armies.filter(isMissionArmy).filter(a=>a.ownerFactionId===f.id&&!w.combat?.battles.some(b=>b.id===a.battleId&&a.status==='engaged'||b.defenders.some(p=>p.armyId===a.id)));
 const removed=new Set(armies.flatMap(a=>a.movementEventId?[a.movementEventId]:[]));for(const a of armies)createExile(w,f.id,a.units,['outbound','returning','waiting'].includes(a.status)?a.path:[],armyPosition(a,w.time)??a.position);
 if(!armies.length)continue;w.armies=w.armies.filter(a=>!armies.includes(a as MissionArmy));const kept=s.snapshot().filter(e=>!removed.has(e.id));while(s.pop()){};for(const e of kept)s.push(e);invalidateSpatial(w);
 }
}
export function defeatExile(w:FormalWorld,site:ExileSite,a:MissionArmy,before:Record<string,number>){
 if(site.phase!=='active'||!eligibleExile(before))return false;
 for(const [id,n] of Object.entries(exileUnits(before))){const recovered=Math.floor(n*.25);if(recovered)a.units[id]=(a.units[id]??0)+recovered;}
 site.phase='cooldown';site.defenders={};site.defeatedAt=w.time;const state=w.extinction!;state.craftsmen.push({id:'craftsman:'+sequenceKey(w.sequences.project++),ownerFactionId:a.ownerFactionId,civilizationId:site.civilizationId,siteId:site.id,cityId:null,carrierArmyId:a.id,eventId:null,destinationCityId:null,arrivalAt:null,path:[],departedAt:w.time,constructionCommandId:null});invalidateSpatial(w);return true;
}
export function deliverCraftsmen(w:FormalWorld,a:MissionArmy,c:FormalCity){for(const craft of w.extinction?.craftsmen??[])if(craft.carrierArmyId===a.id){craft.carrierArmyId=null;craft.cityId=c.id;}}
export function rebirthCandidates(w:FormalWorld){const regions=Array.from({length:144},(_,r)=>r).sort((a,b)=>{const score=(r:number)=>w.cities.reduce((n,c)=>n+Math.max(0,48-Math.hypot(c.x-(r%12*32+16),c.y-(Math.floor(r/12)*32+16)))*(1+(w.factions.find(f=>f.id===c.ownerFactionId)?.empireId?1:0)),0);return score(a)-score(b)||seedHash(w.seed,a,w.extinction?.rebirths??0,702)-seedHash(w.seed,b,w.extinction?.rebirths??0,702);});const out:Point[]=[];for(const r of regions){for(let n=0;n<1024;n++){const x=r%12*32+n%32,y=Math.floor(r/12)*32+Math.floor(n/32),food=fieldDistribution(w.seed,x,y)[0];if(legal(w,{x,y})&&(food===6||food===7)&&out.every(p=>Math.hypot(x-p.x,y-p.y)>=32)){out.push({x,y});break;}}if(out.length===3)break;}return out;}
export function applyExtinctionCommand(w:FormalWorld,c:FormalCity|undefined,o:FormalOrder,p:ExtinctionCommand,s:EventScheduler){
 if(p.type==='player.end'){requireRule(o.issuerId===w.playerFactionId&&w.extinction?.defeat&&!w.extinction.defeat.ended,'僅滅國玩家可結束本局。');w.extinction.defeat.ended=true;return;}
 if(p.type==='player.rebirth'){requireRule(o.issuerId===w.playerFactionId&&!w.cities.some(c=>c.ownerFactionId===o.issuerId)&&w.extinction?.extinct.includes(o.issuerId)&&w.extinction.defeat&&!w.extinction.defeat.ended,'僅未結束本局的滅國玩家可復國。');requireRule((p.x!==undefined&&p.y!==undefined&&p.candidate===undefined)||(p.x===undefined&&p.y===undefined&&p.candidate!==undefined),'請指定完整復國座標。');const point=p.x!==undefined&&p.y!==undefined?{x:p.x,y:p.y}:rebirthCandidates(w)[p.candidate!];requireRule(point,'復國候選已失效，請重新選擇。');requireRule(!rebirthLocationReason(w,point),rebirthLocationReason(w,point)+'，請重新選擇。');const f=w.factions.find(f=>f.id===o.issuerId)!;const newCity=initialCity(f.id,cityId('rebirth-'+sequenceKey(w.sequences.project++)),point.x,point.y,p.name,false,fieldDistribution(w.seed,point.x,point.y));newCity.integrationWorkHours=newCity.integrationTotalWorkHours=0;initializeCityEconomy(w,newCity,s);newCity.military=initialMilitary();newCity.autoLogistics=[];w.cities.push(newCity);w.extinction!.rebirths++;w.extinction!.extinct=w.extinction!.extinct.filter(id=>id!==f.id);f.protectionUntil=w.time+PROTECTION_DURATION;f.protectionKind='rebirth';delete f.protectionEnded;delete w.extinction!.defeat;w.extinction!.resumedAt=w.time;invalidateSpatial(w);return;}
 requireRule(c,'城市不存在。');const craft=w.extinction?.craftsmen.find(x=>x.id===p.craftsmanId&&x.ownerFactionId===o.issuerId&&x.cityId===c.id&&!x.eventId&&!x.carrierArmyId&&!x.constructionCommandId);requireRule(craft,'工匠團不在此城待命。');
 if(p.type==='craftsman.move'){const dest=w.cities.find(c=>c.id===p.destinationCityId&&c.ownerFactionId===o.issuerId);requireRule(dest&&dest.id!==c.id,'只能轉移至另一座自有城市。');const r=route(w,c,dest);craft.path=r.path;craft.departedAt=w.time;craft.arrivalAt=w.time+Math.max(1,Math.ceil(r.distance*45000));craft.destinationCityId=dest.id;craft.cityId=null;craft.eventId=enqueue(w,s,{type:'craftsman.arrive',craftsmanId:craft.id,at:craft.arrivalAt});return;}
 requireRule(!Object.keys(c.buildings).some(k=>k==='castle'||k.startsWith('castle.'))&&!c.economy?.construction.some(j=>j.target.kind==='building'&&j.target.key==='castle'),'每城只可建一座城堡。');applyEconomyCommand(w,c,o,{type:'building.upgrade',cityId:c.id,key:'castle'},s);c.economy!.construction.find(j=>j.commandId===o.commandId)!.castleCivilizationId=craft.civilizationId;craft.constructionCommandId=o.commandId;
}
export function handleCraftsmanEvent(w:FormalWorld,e:FormalEvent,s:EventScheduler){
 if(e.type!=='craftsman.arrive')return false;
 const craft=w.extinction?.craftsmen.find(c=>c.eventId===e.id&&c.id===e.craftsmanId);if(!craft)return true;
 const dest=w.cities.find(c=>c.id===craft.destinationCityId&&c.ownerFactionId===craft.ownerFactionId);
 if(!dest){
  const from=craft.path.at(-1)!,candidates=[...spatial(w).owned(craft.ownerFactionId)].sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y)||(a.id<b.id?-1:a.id>b.id?1:0));
  for(const fallback of candidates){
   let r:ReturnType<typeof route>;
   try{r=route(w,from,fallback);}catch(error){if(error instanceof Error&&error.message==='No traversable route')continue;throw error;}
   craft.path=r.path;craft.departedAt=w.time;craft.arrivalAt=w.time+Math.max(1,Math.ceil(r.distance*45000));craft.destinationCityId=fallback.id;
   craft.eventId=enqueue(w,s,{type:'craftsman.arrive',craftsmanId:craft.id,at:craft.arrivalAt});return true;
  }
  // No legal continuation: retire only this craftsman, without refunds or rewards.
  w.extinction!.craftsmen=w.extinction!.craftsmen.filter(x=>x!==craft);s.discard(new Set([e.id]));return true;
 }
 craft.cityId=dest.id;craft.eventId=null;craft.arrivalAt=null;craft.destinationCityId=null;craft.path=[];return true;
}
/** Bind special work to its original applied authorization, craft, city and civilization. */
export function craftsmanForConstruction(w:FormalWorld,c:FormalCity,job:Construction){
 if(job.target.kind!=='building'||job.target.key!=='castle'||!job.castleCivilizationId)return undefined;
 const crafts=(w.extinction?.craftsmen??[]).filter(x=>x.constructionCommandId===job.commandId);
 if(crafts.length!==1)return undefined;
 const craft=crafts[0];if(craft.cityId!==c.id||craft.ownerFactionId!==c.ownerFactionId||craft.civilizationId!==job.castleCivilizationId||craft.eventId||craft.carrierArmyId||w.extinction?.extinct.includes(craft.ownerFactionId))return undefined;
 const receipt=w.commandReceipts.find(r=>r.commandId===job.commandId&&r.issuerId===craft.ownerFactionId&&r.disposition==='applied');
 try{const p=receipt&&JSON.parse(receipt.fingerprint).payload;if(p?.type!=='craftsman.castle'||p.cityId!==c.id||p.craftsmanId!==craft.id)return undefined;}catch{return undefined;}
 return craft;
}
/** Involuntary loss of special authorization, NOT player cancellation: no refunds.
 * Other buildings/fields/walls keep their payment, durations, start times and events. */
function discardCraftsmanConstruction(w:FormalWorld,c:FormalCity,job:Construction,s:EventScheduler){
 if(job.target.kind!=='building')return;const key=job.target.key,e=c.economy!;
 const cancelled=e.construction.filter(j=>j.target.kind==='building'&&j.target.key===key&&j.fromLevel>=job.fromLevel),ids=new Set(cancelled.map(j=>j.eventId));
 e.construction=e.construction.filter(j=>!cancelled.includes(j));
 for(const craft of w.extinction?.craftsmen??[])if(cancelled.some(j=>j.commandId===craft.constructionCommandId))craft.constructionCommandId=null;
 if((c.buildings[key]??0)===0){delete c.buildings[key];delete e.slots[key];if(key==='castle')delete c.castleCivilizationId;}
 const retained=s.snapshot().filter(e=>!ids.has(e.id));while(s.size)s.pop();for(const event of retained)s.push(event);
}
/** Called in the same owner-transfer transition, using its active scheduler. */
export function reconcileCityCraftsmen(w:FormalWorld,c:FormalCity,s:EventScheduler){
 for(const job of [...c.economy?.construction??[]])if(job.castleCivilizationId&&!craftsmanForConstruction(w,c,job))discardCraftsmanConstruction(w,c,job,s);
 if(w.extinction)w.extinction.craftsmen=w.extinction.craftsmen.filter(craft=>craft.cityId!==c.id||craft.ownerFactionId===c.ownerFactionId);
}
/** Owner-approved capture cleanup: no replacement army, exile, refund or award. */
export function discardCapturedArmies(w:FormalWorld,armies:readonly MissionArmy[],s:EventScheduler){
 if(!armies.length)return;
 const ids=new Set(armies.map(a=>a.id)),events=new Set(armies.flatMap(a=>a.movementEventId?[a.movementEventId]:[]));
 w.armies=w.armies.filter(a=>!ids.has(a.id));
 if(w.extinction)w.extinction.craftsmen=w.extinction.craftsmen.filter(c=>!c.carrierArmyId||!ids.has(c.carrierArmyId));
 if(w.politics){for(const joint of w.politics.joints)joint.armyIds=joint.armyIds.filter(id=>!ids.has(id));w.politics.joints=w.politics.joints.filter(j=>j.armyIds.length||w.combat?.battles.some(b=>b.jointId===j.id));}
 s.discard(events);invalidateSpatial(w);
}
/** Successful conquest only. No new departure, refund, exile reward or sequence allocation.
 * Already outbound/returning units are deliberately outside this city-local transition. */
export function clearCapturedNoncombatants(w:FormalWorld,c:FormalCity,s:EventScheduler){
 const removed=new Set<EventId>(),lostArmies=new Set<ArmyId>();
 const clear=(units:Record<string,number>)=>{for(const id of Object.keys(units))if(['scout','logistics'].includes(UNIT_CATALOG[id]?.combatClass))delete units[id];};
 if(c.military)clear(c.military.units);
 const resident=w.armies.filter(isMissionArmy).filter(a=>a.status==='stationed'&&a.target.kind==='city'&&a.target.cityId===c.id||a.status==='waiting'&&a.originCityId===c.id&&a.departedAt>=w.time);
 for(const a of resident){clear(a.units);clear(a.initialUnits);if(a.status==='waiting'||!Object.values(a.units).some(n=>n>0))lostArmies.add(a.id);}
 if(w.extinction)w.extinction.craftsmen=w.extinction.craftsmen.filter(craft=>!resident.some(a=>a.id===craft.carrierArmyId));
 discardCapturedArmies(w,resident.filter(a=>lostArmies.has(a.id)),s);
 const lost=(w.settlements??[]).filter(p=>p.sourceCityId===c.id&&p.phase!=='travelling'),projects=new Set(lost.map(p=>p.projectId));
 for(const p of lost)removed.add(p.prepEventId);
 w.settlements=w.settlements?.filter(p=>!projects.has(p.projectId));w.colonizationUnits=w.colonizationUnits?.filter(u=>!projects.has(u.projectId));
 s.discard(removed);invalidateSpatial(w);
}
export function finishCraftsmanCastle(w:FormalWorld,c:FormalCity,command:string){
 const job=c.economy?.construction.find(j=>j.commandId===command),craft=job&&craftsmanForConstruction(w,c,job);if(!craft)return false;
 c.castleCivilizationId=craft.civilizationId;w.extinction!.craftsmen=w.extinction!.craftsmen.filter(x=>x!==craft);return true;
}
