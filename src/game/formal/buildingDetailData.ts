import {modernUnitAuthorized} from './modernAwareness';
/** Read-only Formal projections. No UI-only balance tables or new commands. */
import type {FormalCity,FormalWorld} from './model';
import {BUILDING_CATALOG,buildingLevel,FIELD_PRODUCTION,RESOURCE_BOOSTS,resourceBoostMultiplier,resourceBoostRequirement} from './catalogB3';
import type {BuildingKind} from './catalogB3';
import {BLACKSMITH_CAPS,BLACKSMITH_LINES,TECH_CATALOG,type TechDefinition} from './techCatalog';
import {UNIT_CATALOG,isModernUnit} from './unitCatalog';
import {resourceKeys} from './model';
import {academyMultiplier} from './research';
import {WALL_DURABILITY} from './siege';
export type Requirement={kind:'age'|'building'|'tech'|'milestone'|'civilization'|'modern'|'field'|'cap';id:string;current:number|string;required:number|string;met:boolean;fieldMode?:'single'|'pair'|'average'|'count'};
export function boostFieldRequirementText(r:Requirement){return r.fieldMode==='count'?'至少兩格不同的對應資源田（單田城市加工最高 Lv1）':r.fieldMode==='single'?'任一對應資源田 Lv'+r.required:r.fieldMode==='pair'?'兩格不同的對應資源田各 Lv'+r.required:'全部同類資源田平均 Lv'+r.required;}
export function buildingRequirements(w:FormalWorld,c:FormalCity,kind:BuildingKind,next:number):Requirement[]{
 return constructionRequirements(c,kind,next,w.factions.find(f=>f.id===c.ownerFactionId)?.age??0);
}
export function constructionRequirements(c:FormalCity,kind:BuildingKind,next:number,age:number):Requirement[]{
 const d=BUILDING_CATALOG[kind];
 const out:Requirement[]=[{kind:'age',id:'age',current:age,required:d.age,met:age>=d.age},...Object.entries(d.prerequisites).map(([id,required])=>({kind:'building' as const,id,current:buildingLevel(c,id),required,met:buildingLevel(c,id)>=required}))];
 const r=RESOURCE_BOOSTS[kind as keyof typeof RESOURCE_BOOSTS];if(r){
  const fields=[...new Map((c.fields??[]).filter(f=>f.resource===r).map(f=>[f.slot,f])).values()],levels=fields.map(f=>f.level).sort((a,b)=>b-a),fieldMode=next===1?'single':next<=3?'pair':'average',value=fieldMode==='single'?(levels[0]??0):fieldMode==='pair'?(levels[1]??0):levels.reduce((n,lv)=>n+lv,0)/Math.max(1,levels.length),required=resourceBoostRequirement(next);
  if(next>1)out.push({kind:'field',id:r,current:fields.length,required:2,met:fields.length>=2,fieldMode:'count'});
  out.push({kind:'field',id:r,current:value,required,met:fields.length>0&&value>=required,fieldMode});
 }return out;
}
export function researchRequirements(w:FormalWorld,c:FormalCity,d:TechDefinition):Requirement[]{
 const f=w.factions.find(f=>f.id===c.ownerFactionId)!,age=f.age??0;
 const out:Requirement[]=[{kind:'age',id:'age',current:age,required:d.age,met:age>=d.age},...Object.entries(d.buildings).map(([id,required])=>({kind:'building' as const,id,current:buildingLevel(c,id),required,met:buildingLevel(c,id)>=required})),...d.prerequisites.map(id=>({kind:'tech' as const,id,current:f.techIds.includes(id)?1:0,required:1,met:f.techIds.includes(id)}))];
 if(d.milestone)out.push({kind:'milestone',id:String(d.milestone),current:c.economy?.milestones.includes(d.milestone)?d.milestone:0,required:d.milestone,met:!!c.economy?.milestones.includes(d.milestone)});
 if(d.civilizationId)out.push({kind:'civilization',id:d.civilizationId,current:f.civilizationId,required:d.civilizationId,met:f.civilizationId===d.civilizationId});
 if(d.category==='blacksmith'){const [,line,tier]=d.id.split('.'),cap=BLACKSMITH_CAPS[f.civilizationId][BLACKSMITH_LINES.indexOf(line as typeof BLACKSMITH_LINES[number])];out.push({kind:'cap',id:line,current:cap,required:+tier,met:cap>=+tier});}
 if(d.scope!=='traditional')out.push({kind:'modern',id:'modern',current:f.modernQualification,required:'full',met:f.modernQualification==='full'});
 if(d.scope==='modern-common'||d.scope==='modern-civilization')out.push({kind:'tech',id:'research.cooperation',current:f.researchCooperation&&f.techIds.includes('research.cooperation')?1:0,required:1,met:f.researchCooperation&&f.techIds.includes('research.cooperation')});
 return out;
}
export function researchQuote(w:FormalWorld,c:FormalCity,d:TechDefinition){const f=w.factions.find(f=>f.id===c.ownerFactionId)!,cost={...d.cost};if(f.techIds.includes('civilization.kaogong')&&d.category!=='elite'&&d.category!=='civilization')for(const r of resourceKeys)cost[r]=Math.round(cost[r]*.85);const multiplier=d.category==='elite'?1:academyMultiplier(buildingLevel(c,'academy'));return {cost,multiplier,durationMs:Math.round(d.baseDurationMs*multiplier)};}
export function castleSource(w:FormalWorld,c:FormalCity){const initial=c.economy?.construction.find(j=>j.target.kind==='building'&&j.target.key==='castle'&&j.fromLevel===0&&j.action!=='demolish'),creator=initial&&w.commandReceipts.find(r=>r.commandId===initial.commandId)?.issuerId;return c.castleCivilizationId??initial?.castleCivilizationId??w.factions.find(f=>f.id===(creator??c.ownerFactionId))!.civilizationId;}
export function producerUnits(w:FormalWorld,c:FormalCity,kind:string){const f=w.factions.find(f=>f.id===c.ownerFactionId)!,source=castleSource(w,c);return Object.values(UNIT_CATALOG).filter(u=>u.producer===kind&&(!u.civilizationId||u.civilizationId===source)).map(u=>({unit:u,qualified:(isModernUnit(u.id)?modernUnitAuthorized(f,u.id):(f.age??0)>=u.age)&&buildingLevel(c,kind)>=1&&(!u.eliteTech||f.techIds.includes(u.eliteTech)&&!!c.economy?.milestones.includes(u.milestone)),operable:!u.civilizationId||u.civilizationId===source}));}
export function boostedFieldProduction(c:FormalCity,kind:keyof typeof RESOURCE_BOOSTS){const r=RESOURCE_BOOSTS[kind],base=(c.fields??[]).filter(f=>f.resource===r).reduce((n,f)=>n+FIELD_PRODUCTION[f.level],0);return {resource:r,base,boosted:base*resourceBoostMultiplier(buildingLevel(c,kind))};}
export function wallDurability(w:FormalWorld,c:FormalCity){const f=w.factions.find(f=>f.id===c.ownerFactionId)!;return WALL_DURABILITY[c.wallLevel??0]*(f.techIds.includes('civilization.imperial-wall')?1.2:1);}
export function nextBuildingUnlocks(w:FormalWorld,c:FormalCity,kind:BuildingKind,current:number,next:number){const f=w.factions.find(f=>f.id===c.ownerFactionId)!;return Object.values(TECH_CATALOG).filter(d=>d.scope==='traditional'&&(!d.civilizationId||d.civilizationId===f.civilizationId)&&(d.buildings[kind]??0)>current&&(d.buildings[kind]??0)<=next);}
