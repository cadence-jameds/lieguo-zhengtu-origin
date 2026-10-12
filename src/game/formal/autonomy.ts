import type {FormalCity,FormalCommand,FormalEvent,FormalReport,FormalWorld,Resources} from './model';
import {resourceKeys,zeroResources} from './model';
import {commandId,eventId,sequenceKey,type FactionId} from './ids';
import {EventScheduler} from './scheduler';
import {spatial,invalidateSpatial} from './spatial';
import {buildingCost,buildingLevel,BUILDING_CATALOG,fieldCost,storageCapacity,type BuildingKind} from './catalogB3';
import {buildingRequirements,researchRequirements,researchQuote} from './buildingDetailData';
import {UNIT_CATALOG,ELITE_VARIANTS} from './unitCatalog';
import {unitRecruitCost} from './military';
import {TECH_CATALOG} from './techCatalog';
import {AGE_CATALOG} from './research';
import {settleCity} from './economy';
import {aiRandom,traitsFor,type Agent,type Choice} from './autonomyModel';
export const AI_MINUTE=60000;
export function enableAutonomy(w:FormalWorld){if(w.fixture||w.autonomy)return false;w.autonomy={version:1,agents:[],accepted:0,rejected:0};const s=new EventScheduler(w.events);
 for(const f of w.factions.filter(f=>f.role==='ai')){const traits=traitsFor(w.seed,f.id),alive=spatial(w).owned(f.id).length>0,nextAt=w.time+Math.round((1+aiRandom(w.seed,f.id,20)*29)*AI_MINUTE),id=alive?eventId(sequenceKey(w.sequences.event++)):null;
  w.autonomy.agents.push({factionId:f.id,traits,decisions:0,nextAt,eventId:id,active:false,budgetPercent:Math.round(20+traits.risk*30),lastWarAt:0,memory:[],intel:[]});if(id)s.push({id,type:'ai.decide',factionId:f.id,at:nextAt});
 }w.events=s.snapshot();return true;
}
export function retireAutonomy(w:FormalWorld,s:EventScheduler){const removed=new Set<string>();for(const a of w.autonomy?.agents??[])if(a.eventId&&!spatial(w).owned(a.factionId).length){removed.add(a.eventId);a.eventId=null;a.active=false;}if(removed.size){const events=s.snapshot().filter(e=>!removed.has(e.id));while(s.size)s.pop();for(const e of events)s.push(e);}}
const affordable=(c:FormalCity,cost:Resources)=>resourceKeys.every(r=>cost[r]<=c.stock[r]);
/** Quotes use only own-city ledgers and public catalogs; reducer revalidates every admission. */
export function economicChoices(w:FormalWorld,c:FormalCity,a:Agent):Choice[]{const out:Choice[]=[],f=w.factions.find(f=>f.id===a.factionId)!;if(!c.economy||!c.military)return out;
 const offer=(command:FormalCommand,cost:Resources,score:number,category:Choice['category'])=>{if(affordable(c,cost))out.push({command,cost,score,category});};
 if(c.economy.construction.length<3){
  for(const field of c.fields??[]){if(field.level>=15||field.level>=10&&(!c.cityPromotionCompleted||!c.economy.milestones.includes(10000)||c.housing<10000)||c.economy.construction.some(j=>j.target.kind==='field'&&j.target.slot===field.slot))continue;
   const need=1-c.stock[field.resource]/Math.max(1,storageCapacity(c));offer({type:'field.upgrade',cityId:c.id,slot:field.slot},fieldCost(field.resource,field.level+1),1+a.traits.economy+need-field.level*.09,'economy');
  }
  for(const kind of Object.keys(BUILDING_CATALOG) as BuildingKind[]){const key=kind==='warehouse'||kind==='bunker'?kind+'.0':kind,lv=kind==='wall'?c.wallLevel??0:c.buildings[key]??0;
   if(lv>=BUILDING_CATALOG[kind].maxLevel||c.economy.construction.some(j=>j.target.kind==='building'&&j.target.key===key)||buildingRequirements(w,c,kind,lv+1).some(r=>!r.met)||kind!=='center'&&kind!=='wall'&&c.economy.slots[key]===undefined&&Object.keys(c.economy.slots).length>=15)continue;
   const pop=kind==='residence'||kind==='center'||kind==='monastery',mil=['barracks','stable','archery','workshop','castle','wall','embassy','blacksmith'].includes(kind);
   let score=pop? .7+a.traits.expansion:mil?.35+a.traits.military:.65+a.traits.economy;
   if(kind==='residence'&&c.population/c.housing>.8)score+=3;if(kind==='warehouse'&&resourceKeys.some(r=>c.stock[r]>storageCapacity(c)*.7))score+=2;
   if(kind==='center'&&lv<(AGE_CATALOG[(f.age??0) as number]?.center??10))score+=1.1;if(kind==='barracks'&&!lv)score+=.4;
   offer({type:'building.upgrade',cityId:c.id,key},buildingCost(kind,lv+1),score-lv*.08,pop?'population':mil?'military':'economy');
  }
 }
 const age=AGE_CATALOG[(f.age??0) as number];if(age&&!f.ageQueue&&c.population>=age.population&&buildingLevel(c,'center')>=age.center)offer({type:'age.start',cityId:c.id},{...age.cost},5,'research');
 if(!f.researchQueue)for(const t of Object.values(TECH_CATALOG)){if(f.techIds.includes(t.id)||researchRequirements(w,c,t).some(r=>!r.met)||t.scope!=='traditional'&&f.modernQualification!=='full'||['modern-common','modern-civilization'].includes(t.scope)&&!f.researchCooperation)continue;
  const cost=researchQuote(w,c,t).cost;offer({type:'research.start',cityId:c.id,techId:t.id},['modern-common','modern-civilization'].includes(t.scope)?zeroResources():cost,.8+a.traits.economy,'research');}
 const project=w.researchProjects.find(p=>p.ownerFactionId===f.id&&p.phase==='funding');if(project){const resources=zeroResources();for(const r of resourceKeys)resources[r]=Math.min(project.requiredResources[r]-project.contributedResources[r],Math.floor(Math.max(0,c.stock[r]-100)*.2));if(resourceKeys.some(r=>resources[r]))offer({type:'research.contribute',cityId:c.id,projectId:project.projectId,resources},resources,3,'research');}
 if(!c.cityPromotionCompleted&&!c.economy.promotion&&c.population>=10000&&c.housing>=10000&&buildingLevel(c,'townhall')>=5)offer({type:'city.promote',cityId:c.id},zeroResources(),4,'population');
 if(c.military.queue.length<2&&c.population>220&&c.stock.food>250){const stock=c.military.units;for(const u of Object.values(UNIT_CATALOG)){if((f.age??0)<u.age||!buildingLevel(c,u.producer)||u.civilizationId&&u.civilizationId!==(c.castleCivilizationId??f.civilizationId)||u.eliteTech&&(!f.techIds.includes(u.eliteTech)||!c.economy.milestones.includes(u.milestone))||ELITE_VARIANTS[u.id]&&f.techIds.includes(UNIT_CATALOG[ELITE_VARIANTS[u.id]].eliteTech!)&&!c.economy.milestones.includes(UNIT_CATALOG[ELITE_VARIANTS[u.id]].milestone))continue;
  const count=Math.min(u.id==='scout'?3:10,Math.floor((c.population-200)/u.population)),cost=unitRecruitCost(w,c,u);if(count<1)continue;for(const r of resourceKeys)cost[r]*=count;offer({type:'military.recruit',cityId:c.id,unitId:u.id,count},cost,(u.id==='scout'?(stock.scout??0)<5?2:-1:.6+a.traits.military)-((stock[u.id]??0)+c.military.queue.filter(q=>q.unitId===u.id).reduce((n,q)=>n+q.remaining,0))*.03,'military');
 }}return out;
}
export function chooseEconomic(choices:Choice[],a:Agent,seed:number,city:FormalCity){const budget=Object.fromEntries(resourceKeys.map(r=>[r,Math.floor(Math.max(0,city.stock[r]-100)*a.budgetPercent/100)])) as Resources;
 return choices.filter(q=>resourceKeys.every(r=>q.cost[r]<=budget[r])).sort((x,y)=>y.score-x.score||JSON.stringify(x.command).localeCompare(JSON.stringify(y.command),'en'))[Math.floor(aiRandom(seed,a.factionId,a.decisions+40)*Math.min(3,choices.filter(q=>resourceKeys.every(r=>q.cost[r]<=budget[r])).length))]?.command;
}
export type Submit=(w:FormalWorld,order:unknown)=>import('./model').FormalTransition;
export function submitAutonomous(w:FormalWorld,s:EventScheduler,e:FormalEvent,factionId:FactionId,commands:FormalCommand[],submit:Submit){const reports:FormalReport[]=[];
 for(let i=0;i<commands.length;i++){w.events=s.snapshot();const t=submit(w,{commandId:commandId('ai-'+e.id.slice(6)+'-'+i),campaignId:w.campaignId,issuerId:factionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:commands[i]});if(t.ack?.status==='committed'){Object.assign(w,t.world);invalidateSpatial(w);while(s.size)s.pop();for(const q of w.events)s.push(q);w.autonomy!.accepted++;reports.push(...t.reports.filter(r=>r.ownerFactionId===w.playerFactionId));}else w.autonomy!.rejected++;}return reports;
}
export function handleAutonomy(w:FormalWorld,e:FormalEvent,s:EventScheduler,submit:Submit):FormalReport[]|null{if(e.type!=='ai.decide')return null;const a=w.autonomy?.agents.find(a=>a.factionId===e.factionId);if(!a||a.eventId!==e.id)return[];
 const cities=spatial(w).owned(a.factionId);if(!cities.length){a.eventId=null;a.active=false;return[];}
 a.decisions++;a.active=aiRandom(w.seed,a.factionId,a.decisions+100)<.3+.65*a.traits.activity;
 a.nextAt=w.time+Math.round((20+(1-a.traits.activity)*40+(1-a.traits.reaction)*15+aiRandom(w.seed,a.factionId,a.decisions+200)*10)*AI_MINUTE);a.eventId=eventId(sequenceKey(w.sequences.event++));s.push({id:a.eventId,type:'ai.decide',factionId:a.factionId,at:a.nextAt});
 const c=cities[(a.decisions-1)%cities.length];settleCity(w,c);const chosen=a.active?chooseEconomic(economicChoices(w,c,a),a,w.seed,c):undefined;
 return submitAutonomous(w,s,e,a.factionId,chosen?[chosen]:[],submit);
}
