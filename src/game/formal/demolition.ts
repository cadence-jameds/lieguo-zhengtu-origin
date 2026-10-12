import type {FormalCity,FormalOrder,FormalWorld,Construction} from './model';
import type {EventScheduler} from './scheduler';
import {buildingKind,buildingLevel,HOUSING} from './catalogB3';
import {enqueue,requireRule,settleFaction} from './economy';
import {reconcileSiegeStorage} from './siege';
import {TECH_CATALOG} from './techCatalog';

export function demolitionReasons(w:FormalWorld,c:FormalCity,key:string){
 const kind=buildingKind(key),reasons:string[]=[];
 if(!kind||key==='center'||key==='wall'||c.economy?.slots[key]===undefined||(c.buildings[key]??0)<1)reasons.push('這裡沒有可拆除的城內建築');
 if((c.economy?.construction.length??0)>=3||c.economy?.construction.some(j=>j.target.kind==='building'&&j.target.key===key))reasons.push('請先等候建造工程完成');
 if(c.military?.queue.some(j=>j.producer===kind))reasons.push('請先等候這座建築的訓練完成');
 const faction=w.factions.find(f=>f.id===c.ownerFactionId);
 if(kind==='academy'&&(faction?.researchQueue||faction?.ageQueue))reasons.push('請先等候研究與時代晉升完成');
 if(w.researchProjects.some(p=>p.phase==='researching'&&p.initiatingCityId===c.id&&!!(kind&&TECH_CATALOG[p.techId]?.buildings[kind])))reasons.push('請先等候使用此建築的研究完成');
 if(kind==='center'&&c.economy?.promotion||kind==='townhall'&&c.economy?.promotion)reasons.push('請先等候城市晉升完成');
 if(kind==='castle'&&w.settlements?.some(p=>p.sourceCityId===c.id&&p.phase!=='travelling'))reasons.push('請先完成或取消拓殖隊整備');
 return reasons;
}
export const demolitionDuration=(level:number)=>level*15*60000;
export function startDemolition(w:FormalWorld,c:FormalCity,o:FormalOrder,key:string,s:EventScheduler){
 const reasons=demolitionReasons(w,c,key);requireRule(!reasons.length,reasons.join('、'));
 const e=c.economy!,durationMs=demolitionDuration(c.buildings[key]);
 const ends=[0,1].map(l=>Math.max(w.time,...e.construction.filter(j=>j.lane===l).map(j=>j.startsAt+j.durationMs))),lane=e.milestones.includes(15000)&&ends[1]<ends[0]?1:0,startsAt=ends[lane];
 const id=enqueue(w,s,{type:'construction.complete',cityId:c.id,at:startsAt+durationMs});
 e.construction.push({eventId:id,commandId:o.commandId,lane,target:{kind:'building',key},action:'demolish',fromLevel:c.buildings[key],toLevel:0,createdAt:w.time,startsAt,durationMs,qualificationHousing:c.housing});
}
export function completeDemolition(w:FormalWorld,c:FormalCity,j:Construction){
 if(j.target.kind!=='building')throw new Error('Demolition requires a building');
 if(j.target.key==='townhall')settleFaction(w,c.ownerFactionId);
 if(j.target.key==='castle')delete c.castleCivilizationId;
 delete c.buildings[j.target.key];delete c.economy!.slots[j.target.key];
 if(j.target.key==='residence'){c.housing=400+HOUSING[buildingLevel(c,'residence')];if(c.population>c.housing)c.housingShortage=true;else delete c.housingShortage;}
 reconcileSiegeStorage(w,c);
}
