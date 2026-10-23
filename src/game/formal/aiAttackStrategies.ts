import {publicWonderThreats,modernPressure,ownCombatPower,knownCombatPower,conquestAxes,endgamePriority,endgameDispatchReason,mobilizationRatio} from './endgameAI';
import {isScoutUnit,isModernUnit} from './unitCatalog';
import type {FormalCity,FormalCommand,FormalWorld} from './model';
import type {CityId,FactionId} from './ids';
import type {Agent} from './autonomyModel';
import {aiRandom} from './autonomyModel';
import {publicSituation,HOUR,intelFor} from './aiKnowledge';
import {canCoordinate,empireOf,embassy} from './politics';
import {effectiveUnit,baseUnit} from './combatModifiers';
import {spatial} from './spatial';
import {storageCapacity} from './catalogB3';

/** Candidate formulas approved from fa038a0; distance denominators deliberately remain 24. */
export const ATTACK_STRATEGIES=['A48','V2B48','V3Parallel48','WildPriority60','WildParallel48'] as const;
export type AttackStrategy=typeof ATTACK_STRATEGIES[number];
export type AttackPolicy=AttackStrategy|'equal'|'traits';
export const ATTACK_SEARCH_RADIUS:Record<AttackStrategy,number>={A48:48,V2B48:48,V3Parallel48:48,WildPriority60:60,WildParallel48:48};
export function portion(c:FormalCity,ratio:number){return Object.fromEntries(Object.entries(c.military?.units??{}).filter(([id])=>effectiveUnit(id)).map(([id,n])=>[id,Math.floor(n*ratio)]).filter(([,n])=>Number(n)>0)) as Record<string,number>;}
export function strategyWeights(a:Agent):Record<AttackStrategy,number>{
 const t=a.traits;
 // Distinct positive weights; every strategy remains possible for every AI.
 return {
  A48:.70+.55*t.risk+.35*t.defense,
  V2B48:.70+1.6*t.economy+.55*t.raiding,
  V3Parallel48:.65+1.25*t.military+.90*t.expansion+.35*t.risk,
  WildPriority60:.70+1.7*t.economy+.65*(1-t.risk),
  WildParallel48:.70+1.35*t.raiding+.95*t.military+.55*t.economy,
 };
}
/** The runtime uses traits. Explicit policies are pure comparators for the isolated engine harness. */
export function pickAttackStrategy(w:FormalWorld,a:Agent,policy:AttackPolicy='traits'):AttackStrategy{
 if(policy!=='traits'&&policy!=='equal')return policy;
 const weights=policy==='traits'?strategyWeights(a):Object.fromEntries(ATTACK_STRATEGIES.map(s=>[s,1])) as Record<AttackStrategy,number>;
 let draw=aiRandom(w.seed,a.factionId,a.decisions+1923)*ATTACK_STRATEGIES.reduce((n,s)=>n+weights[s],0);
 for(const strategy of ATTACK_STRATEGIES){draw-=weights[strategy];if(draw<0)return strategy;}
 return ATTACK_STRATEGIES.at(-1)!;
}
const clamp=(n:number,low=0,high=1)=>Math.max(low,Math.min(high,n));
const compareId=(x:{id:string},y:{id:string})=>x.id<y.id?-1:x.id>y.id?1:0;
export function combatCount(units:Record<string,number>){return Object.entries(units).reduce((n,[id,count])=>n+(effectiveUnit(id)?count:0),0);}
/** Check every requested troop, including scout/siege keys absent from the wild detachment.
 * The research's 30% per-type garrison reserve concerns effective combat troops;
 * scouts and siege still obey exact availability and their original city allocation. */
export function parallelFits(c:FormalCity,first:Record<string,number>,second:Record<string,number>){
 const own=c.military?.units??{};
 return [...new Set([...Object.keys(first),...Object.keys(second)])].every(id=>{
  const used=(first[id]??0)+(second[id]??0),available=own[id]??0;
  return Number.isSafeInteger(used)&&used>=0&&used<=available&&(!effectiveUnit(id)||used<=Math.floor(available*.70));
 });
}
/** Common main city choice, unchanged; never consults another strategy's scoring. */
export function originalCityAttack(w:FormalWorld,c:FormalCity,a:Agent):{hasCity:boolean;commands:FormalCommand[]}{
 const ownUnits=c.military?.units??{},targets=publicSituation(w,a,c).filter(t=>t.relation!=='friendly'),threats=publicWonderThreats(w,c,a);
 for(const t of threats)if(t.relation!=='friendly'&&t.relation!=='own'&&t.threat>=40&&t.stage!=='modernized'&&!targets.some(n=>n.id===t.cityId)){const city=spatial(w).cities.get(t.cityId)!;targets.push({id:city.id,ownerFactionId:city.ownerFactionId,x:city.x,y:city.y,population:city.population,modern:w.factions.find(f=>f.id===city.ownerFactionId)!.modernQualification==='full',relation:t.relation,intel:intelFor(a,city.id,w.time),memory:a.memory.find(m=>m.factionId===city.ownerFactionId)});}
 targets.sort((x,y)=>(x.relation==='war'?0:1)-(y.relation==='war'?0:1)||Math.hypot(x.x-c.x,x.y-c.y)-Math.hypot(y.x-c.x,y.y-c.y));
 if(!targets.length)return{hasCity:false,commands:[]};
 const priority=threats.find(t=>t.threat>=75&&t.stage!=='modernized'&&t.relation!=='friendly'&&t.relation!=='own')??threats.find(t=>t.threat>=40&&t.stage!=='modernized'&&t.relation!=='friendly'&&t.relation!=='own'&&!a.intel.some(i=>i.cityId===t.cityId&&w.time-i.at<=12*HOUR));
 const target=priority?targets.find(t=>t.id===priority.cityId)??targets[0]:targets[Math.floor(aiRandom(w.seed,a.factionId,a.decisions+312)*Math.min(targets.length,4))],info=target.intel;
 if(!info?.confidence||info.ownerFactionId!==target.ownerFactionId||!info.units){const scout=Object.keys(ownUnits).find(id=>isScoutUnit(id)&&ownUnits[id]>0);return{hasCity:true,commands:scout?[{type:'army.dispatch',cityId:c.id,mission:'scout',target:{kind:'city',cityId:target.id},units:{[scout]:Math.max(1,Math.min(15,Math.floor(ownUnits[scout]*.8)))}}]:[]};}
 const threat=threats.find(t=>t.cityId===target.id&&t.threat>=75&&t.stage!=='modernized'),pressure=modernPressure(w,c,a,target),desired=threat?threat.threat>=90?.5:.3:pressure?.55:.2+a.traits.risk*.2,ratio=threat||pressure?mobilizationRatio(w,c,desired,threat&&threat.threat<90?.35:.6):desired,units=portion(c,ratio),force=combatCount(units),enemyCount=combatCount(info.units),own=ownCombatPower(w,a.factionId,units),enemy=knownCombatPower(info.units)/info.confidence;
 if(force<10||c.stock.food<200||(!pressure&&!threat&&force<enemyCount*(1.5-.5*a.traits.risk)/info.confidence))return{hasCity:true,commands:[]};
 const factor=threat?threat.threat>=90?1.5:1.25:pressure?target.population>=10000?1.25:1.85:1.5-.5*a.traits.risk;
 if((pressure||threat)&&own<enemy*factor||w.factions.find(f=>f.id===a.factionId)?.modernQualification!=='full'&&Object.keys(info.units).some(isModernUnit)&&own<enemy*.75)return{hasCity:true,commands:[]};
 const axes=conquestAxes(w,a.factionId),conquest=pressure&&axes.count<axes.limit&&aiRandom(w.seed,a.factionId,a.decisions+313)<(.03+.12*a.traits.expansion)*1.75||!pressure&&!threat&&aiRandom(w.seed,a.factionId,a.decisions+313)<(.03+.12*a.traits.expansion);
 let mission:'raid'|'conquest'|'wonder-destruction'=threat?target.population>=10000&&axes.count<axes.limit?'conquest':'wonder-destruction':conquest?'conquest':'raid';
 if(pressure&&axes.count>=axes.limit)mission='raid';
 if(threat||mission==='conquest')for(const [id,n] of Object.entries(ownUnits))if(['ram','catapult'].includes(baseUnit(id)))units[id]=Math.max(1,Math.floor(n*(threat&&threat.threat>=90?.7:.4)));
 if(threat&&!Object.keys(units).some(id=>baseUnit(id)==='catapult'&&units[id]>0))return{hasCity:true,commands:[]};
 const empire=empireOf(w,a.factionId),joint=!!empire&&embassy(w,empire.leader)>=15||canCoordinate(w,a.factionId,a.factionId,14);
 if(threat&&joint)return{hasCity:true,commands:[{type:'joint.create',cityId:c.id,targetCityId:target.id,units,arrivalAt:w.time+2*HOUR,mission:mission==='wonder-destruction'?'wonder-destruction':'conquest',...(mission==='conquest'?{wonderPriority:true}:{})}]};
 if(mission==='conquest'&&!pressure&&joint&&aiRandom(w.seed,a.factionId,a.decisions+314)<.4)return{hasCity:true,commands:[{type:'joint.create',cityId:c.id,targetCityId:target.id,units,arrivalAt:w.time+2*HOUR}]};
 return{hasCity:true,commands:[{type:'army.dispatch',cityId:c.id,mission,target:{kind:'city',cityId:target.id},units,...(threat&&mission==='conquest'?{wonderPriority:true}:{})}]};
}
/** A48 preserves main city priority. Other modes retain the research's original
 * nearest-within-24 fallback before comparing their enlarged candidate set. */
function originalWildAttack(w:FormalWorld,c:FormalCity,radius:number):FormalCommand[]{
 const total=combatCount(c.military?.units??{});if(total<50)return[];
 const wild=spatial(w).nearby(c.x,c.y,radius).sites.filter(t=>t.level<=Math.max(1,Math.floor(total/100)))
  .sort((x,y)=>Math.hypot(x.x-c.x,x.y-c.y)-Math.hypot(y.x-c.x,y.y-c.y))[0];
 return wild?[{type:'army.dispatch',cityId:c.id,mission:'raid',target:{kind:'wild',siteId:wild.id,generation:wild.generation},units:portion(c,.3)}]:[];
}
function chooseV2(w:FormalWorld,c:FormalCity,a:Agent,base:FormalCommand[],radius=24):FormalCommand[]{
 if(base.some(cmd=>cmd.type!=='army.dispatch'))return base;
 if(base.some(cmd=>cmd.type==='army.dispatch'&&cmd.target.kind==='wild'))return base;
 const own=c.military?.units??{};
 const total=Object.entries(own).reduce((sum,[id,n])=>sum+(effectiveUnit(id)?n:0),0);
 if(total<50)return base;
 const units=portion(c,.3);
 if(Object.values(units).reduce((sum,n)=>sum+n,0)<10)return base;
 const sites=spatial(w).nearby(c.x,c.y,radius).sites
   .filter(site=>site.level<=Math.max(1,Math.floor(total/100)))
   .sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y)||compareId(a,b))
   .slice(0,8);
 if(!sites.length)return base;
 const capacity=storageCapacity(c);
 const deficit=(r:'food'|'wood'|'stone'|'gold')=>clamp(1-c.stock[r]/Math.max(1,.75*capacity));
 const need=(site:typeof sites[number])=>site.resource==='bandit'
    ?(['food','wood','stone','gold'] as const).reduce((n,r)=>n+deficit(r),0)/4
    :deficit(site.resource);
 const best=sites.map(site=>{
   const distance=Math.hypot(site.x-c.x,site.y-c.y);
   const safety=clamp(1-site.level/Math.max(1,total/80));
   const value=0.45*need(site)+.3*(1-distance/24)+.2*safety+.05*clamp(site.level/10);
   return {site,value,need:need(site)};
 }).sort((x,y)=>y.value-x.value||compareId(x.site,y.site))[0];
 const source=base[0];
 const kind=!source?'blocked':source.type==='army.dispatch'&&source.mission==='scout'?'scout':'city';
 // Separate reconnaissance from raid choice: allow only small, trait-driven wild diversion.
 const shortage=best.need;
 const war=publicSituation(w,a,c).some(t=>t.relation==='war');
 let chance=kind==='blocked'?.50+.28*a.traits.raiding+.16*shortage-.08*a.traits.military:
   .07+.16*a.traits.raiding+.12*a.traits.economy+.20*shortage-.12*a.traits.military-.10*a.traits.expansion-(war?.06:0);
 if(kind==='scout')chance=Math.min(chance,.26);
 chance=clamp(chance,0,.88);
 chance/=endgamePriority(w,c,a,base[0]);
 if(aiRandom(w.seed,a.factionId,a.decisions+1511)>=chance)return base;
 return [{type:'army.dispatch',cityId:c.id,mission:'raid',target:{kind:'wild',siteId:best.site.id,generation:best.site.generation},units}];
}

function chooseV3(w:FormalWorld,c:FormalCity,a:Agent,base:FormalCommand[],adaptive=false,radius=24):FormalCommand[]{
 const own=c.military?.units??{},total=Object.entries(own).reduce((n,[id,v])=>n+(effectiveUnit(id)?v:0),0);
 const ext=w.armies.filter(x=>x.ownerFactionId===a.factionId&&x.originCityId===c.id).length;
 if(base.some(cmd=>cmd.type!=='army.dispatch'))return base;
 if(total<50)return base;
 if(base.some(cmd=>cmd.type==='army.dispatch'&&cmd.target.kind==='wild'))return base;
 const cap=storageCapacity(c);
 const need=(r:'food'|'wood'|'stone'|'gold')=>clamp(1-c.stock[r]/Math.max(1,.75*cap));
 const sites=spatial(w).nearby(c.x,c.y,radius).sites
   .filter(site=>site.level<=Math.max(1,Math.floor(total/100)))
   .sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y)||compareId(a,b)).slice(0,8);
 if(!sites.length)return base;
 const rank=sites.map(site=>{
   const d=Math.hypot(site.x-c.x,site.y-c.y);
   const n=site.resource==='bandit'?
     (['food','wood','stone','gold'] as const).reduce((s,r)=>s+need(r),0)/4:need(site.resource);
   const e=n, g=clamp(.2+.4*a.traits.raiding+.18*a.traits.economy+.12*n);
   const p=clamp(1-site.level/Math.max(1,total/80)),distance=clamp(1-d/24);
   return {site,n,score:100*(.30*e+.25*g+.25*p+.15*distance+.05*.5)};
 }).sort((x,y)=>y.score-x.score||compareId(x.site,y.site));
 const best=rank[0],units=portion(c,adaptive?.28:.24);
 if(best.score<(adaptive?35:43)||Object.values(units).reduce((a,b)=>a+b,0)<(adaptive?14:10))return base;
 const wild:FormalCommand={type:'army.dispatch',cityId:c.id,mission:'raid',target:{kind:'wild',siteId:best.site.id,generation:best.site.generation},units};
 const city=base.find((cmd):cmd is Extract<FormalCommand,{type:'army.dispatch'}>=>cmd.type==='army.dispatch'&&cmd.target.kind==='city');
 if(!city)return [wild];
 const cityRef=city.target.kind==='city'?city.target.cityId:null;
 const intel=publicSituation(w,a,c).find(x=>x.id===cityRef);
 const enemy=Object.entries(intel?.intel?.units??{}).reduce((s,[id,n])=>s+(effectiveUnit(id)?n:0),0);
 const force=Object.entries(city.units).reduce((s,[id,n])=>s+(effectiveUnit(id)?n:0),0);
 const war=intel?.relation==='war',d=Math.hypot((intel?.x??c.x)-c.x,(intel?.y??c.y)-c.y);
 const ce=clamp(.32+.25*a.traits.economy+.15*best.n);
 const cg=clamp(.3+.35*a.traits.expansion+.2*a.traits.military+(war?.15:0));
 const cp=city.mission==='scout'?.7:clamp(1-enemy/Math.max(1,force+enemy));
 const cs=endgamePriority(w,c,a,city)*100*(.30*ce+.25*cg+.25*cp+.15*clamp(1-d/48)+.05*(war?.85:.5));
 const reserve=parallelFits(c,units,city.units);
 if(total>=(adaptive?90:140)&&ext<=1&&reserve&&cs>=(adaptive?33:37))return cs>=best.score?[city,wild]:[wild,city];
 if(city.mission==='scout')return base;
 return best.score>cs+8?[wild]:base;
}


function chooseWildPriority(w:FormalWorld,c:FormalCity,a:Agent,base:FormalCommand[],parallel:boolean,radius=24):FormalCommand[]{
 const own=c.military?.units??{},total=Object.entries(own).reduce((n,[id,x])=>n+(effectiveUnit(id)?x:0),0);
 const outbound=w.armies.filter(t=>t.ownerFactionId===a.factionId&&t.originCityId===c.id).length;
 if(base.some(p=>p.type!=='army.dispatch'))return base;
 if(total<50||base.some(p=>p.type==='army.dispatch'&&p.target.kind==='wild'))return base;
 const stockLimit=storageCapacity(c);
 const short=(r:'food'|'wood'|'stone'|'gold')=>clamp(1-c.stock[r]/Math.max(1,stockLimit*.75));
 const sites=spatial(w).nearby(c.x,c.y,radius).sites
   .filter(x=>x.level<=Math.max(1,Math.floor(total/100)))
   .sort((x,y)=>Math.hypot(x.x-c.x,x.y-c.y)-Math.hypot(y.x-c.x,y.y-c.y)||compareId(x,y)).slice(0,8);
 if(!sites.length)return base;
 const units=portion(c,.26);
 if(Object.values(units).reduce((a,b)=>a+b,0)<12)return base;
 const wilds=sites.map(site=>{
   const need=site.resource==='bandit'?
     (['food','wood','stone','gold'] as const).reduce((s,r)=>s+short(r),0)/4:short(site.resource);
   const dist=Math.hypot(site.x-c.x,site.y-c.y);
   const safety=clamp(1-site.level/Math.max(1,total/80));
   const distance=clamp(1-dist/24);
   const score=100*(.40*need+.25*safety+.20*distance+.15*(.45*a.traits.economy+.55*a.traits.raiding));
   return {site,score,need,safety};
 }).sort((x,y)=>y.score-x.score||compareId(x.site,y.site));
 const best=wilds[0];
 // Minimum positive expected opportunity even for a strongly wild-first AI.
 if(best.score<38||best.safety<.14)return base;
 const wild:FormalCommand={type:'army.dispatch',cityId:c.id,mission:'raid',target:{kind:'wild',siteId:best.site.id,generation:best.site.generation},units};
 const city=base.find((p):p is Extract<FormalCommand,{type:'army.dispatch'}>=>p.type==='army.dispatch'&&p.target.kind==='city');
 if(!city)return[wild];
 if(city.mission==='scout'){
   // Reconnaissance is an investment in information, not a city raid.
   const eligible=parallel&&total>=90&&outbound<=1&&parallelFits(c,units,city.units);
   return eligible?[city,wild]:base;
 }
 const nearbyCity=publicSituation(w,a,c).find(t=>city.target.kind==='city'&&t.id===city.target.cityId);
 const enemy=Object.entries(nearbyCity?.intel?.units??{}).reduce((s,[id,n])=>s+(effectiveUnit(id)?n:0),0);
 const attacking=Object.entries(city.units).reduce((s,[id,n])=>s+(effectiveUnit(id)?n:0),0);
 const winProxy=clamp(1-enemy/Math.max(1,enemy+attacking));
 const dist=Math.hypot((nearbyCity?.x??c.x)-c.x,(nearbyCity?.y??c.y)-c.y);
 const war=nearbyCity?.relation==='war';
 const cityEconomy=clamp(.32+.22*a.traits.raiding+.20*a.traits.economy);
 const cityStrategy=clamp(.22+.30*a.traits.expansion+.25*a.traits.military+(city.mission==='conquest'?.18:0)+(war?.12:0));
 const cityScore=endgamePriority(w,c,a,city)*100*(.31*cityEconomy+.28*cityStrategy+.24*winProxy+.12*clamp(1-dist/48)+.05*(war?.9:.3));
 // Wild opportunity gets a moderate strategic preference, but does not override
 // a clearly better city opportunity. Parallel allocation consumes both commands.
 const reserve=parallelFits(c,units,city.units);
 const sendBoth=parallel&&total>=90&&outbound<=1&&reserve&&cityScore>=32;
 if(sendBoth)return [wild,city];
 return best.score+12>=cityScore?[wild]:base;
}


/** Called once after the unchanged activity/cooldown/military trigger and coordination priority. */
export function executeAttackStrategy(w:FormalWorld,c:FormalCity,a:Agent,strategy:AttackStrategy,candidate=originalCityAttack(w,c,a)):FormalCommand[]{
 const base=candidate.hasCity?candidate.commands:originalWildAttack(w,c,strategy==='A48'?48:24);
 switch(strategy){
  case 'A48':return base;
  case 'V2B48':return chooseV2(w,c,a,base,48);
  case 'V3Parallel48':return chooseV3(w,c,a,base,true,48);
  case 'WildPriority60':return chooseWildPriority(w,c,a,base,false,60);
  case 'WildParallel48':return chooseWildPriority(w,c,a,base,true,48);
 }
}

/** Ephemeral per-round reservation floor; never persisted and never a second transaction. */
export function attackGarrisons(w:FormalWorld,commands:readonly FormalCommand[]){
 const floors=new Map<CityId,Record<string,number>>();
 const counts=new Map<CityId,number>();for(const p of commands)if(p.type==='army.dispatch')counts.set(p.cityId,(counts.get(p.cityId)??0)+1);
 for(const [id,count] of counts){
  if(count<2)continue;const c=spatial(w).cities.get(id);if(!c)continue;
  floors.set(c.id,Object.fromEntries(Object.entries(c.military?.units??{}).filter(([id])=>effectiveUnit(id)).map(([id,n])=>[id,n-Math.floor(n*.70)])));
 }
 return floors;
}
/** Recheck the live ledger immediately before each submitted detachment.
 * Mission/ownership/intel generation/path checks remain in the ordinary reducer. */
export function autonomousDispatchReason(w:FormalWorld,issuer:FactionId,p:FormalCommand,floors:Map<CityId,Record<string,number>>):string|undefined{
 const endgame=endgameDispatchReason(w,issuer,p);if(endgame)return endgame;
 if(p.type!=='army.dispatch')return;
 const c=w.cities.find(c=>c.id===p.cityId&&c.ownerFactionId===issuer);
 if(!c?.military)return 'AI departure city is no longer owned';
 if(w.armies.filter(a=>a.ownerFactionId===issuer&&a.originCityId===c.id).length>=3)return 'AI departure army capacity exhausted';
 for(const [id,n] of Object.entries(p.units)){
  if(!Number.isSafeInteger(n)||n<0||n>(c.military.units[id]??0))return 'AI departure troops no longer available';
 }
 if(p.mission!=='scout'&&p.mission!=='reinforce'&&p.mission!=='wonder-destruction'&&combatCount(p.units)<1)return 'AI departure has no effective combat troops';
 const floor=floors.get(c.id);
 if(floor&&Object.entries(floor).some(([id,n])=>(c.military!.units[id]??0)-(p.units[id]??0)<n))return 'AI parallel garrison reserve no longer available';
}
