import {describe,it,expect,vi} from 'vitest';
import type {FormalWorld,FormalCity,FormalCommand,Resources} from './model';
import type {Agent} from './autonomyModel';

type Mode='baseline'|'fallback'|'contextual'|'proactive';
const trace=vi.hoisted(()=>({
 mode:'baseline' as 'baseline'|'fallback'|'contextual'|'proactive',
 decisions:0,
 attempted:{wild:0,city:0,scout:0,joint:0},
 overrides:{blockedToWild:0,scoutToWild:0,cityToWild:0},
 returns:0,
 returnedLoot:{food:0,wood:0,stone:0,gold:0},
 wildReturnLoot:{food:0,wood:0,stone:0,gold:0},
 wildLosses:0,
 eligibleWild:0,
 blockedWithWild:0
}));
vi.mock('./aiActions',async(importOriginal)=>{
 const actual=await importOriginal<typeof import('./aiActions')>();
 return {...actual,militaryDecision:(w:FormalWorld,c:FormalCity,a:Agent)=>{
   const base=actual.militaryDecision(w,c,a);
   const next=trace.mode==='baseline'?base:chooseV2(w,c,a,base,actual.portion);
   trace.decisions++;
   for(const cmd of next){
     if(cmd.type==='joint.create')trace.attempted.joint++;
     if(cmd.type==='army.dispatch'){
       if(cmd.mission==='scout')trace.attempted.scout++;
       else if(cmd.target.kind==='wild')trace.attempted.wild++;
       else trace.attempted.city++;
     }
   }
   return next;
 }};
});
vi.mock('./battles',async(importOriginal)=>{
 const actual=await importOriginal<typeof import('./battles')>();
 return {...actual,handleCombatEvent:(...args:Parameters<typeof actual.handleCombatEvent>)=>{
   const [w,e]=args; let returning:undefined|{id:string,cargo:Resources,wild:boolean};
   let arriving:undefined|{id:string,initial:Record<string,number>,wild:boolean};
   if(e.type==='army.return'){
     const army=w.armies.find(a=>a.id===e.armyId);
     if(army?.cargo&&army.status==='returning')returning={id:army.id,cargo:{...army.cargo},wild:army.target?.kind==='wild'};
   }
   if(e.type==='army.arrive'){
     const army=w.armies.find(a=>a.id===e.armyId);
     if(army?.mission==='raid'&&army.status==='outbound'&&army.target?.kind==='wild')
       arriving={id:army.id,initial:{...(army.initialUnits??{})},wild:true};
   }
   const result=actual.handleCombatEvent(...args);
   if(returning&&!w.armies.some(a=>a.id===returning!.id)){
     trace.returns++;
     for(const r of ['food','wood','stone','gold'] as const){
       trace.returnedLoot[r]+=returning.cargo[r]??0;
       if(returning.wild)trace.wildReturnLoot[r]+=returning.cargo[r]??0;
     }
   }
   if(arriving?.wild){
     const alive=w.armies.find(a=>a.id===arriving!.id)?.units??{};
     trace.wildLosses+=Object.entries(arriving.initial).reduce((n,[id,count])=>n+Math.max(0,count-(alive[id]??0)),0);
   }
   return result;
 }};
});
import {createFormalWorld} from './generator';
import {enableAutonomy} from './autonomy';
import {advanceFormal} from './reducer';
import {incomingAlerts,publicSituation,HOUR} from './aiKnowledge';
import {aiRandom} from './autonomyModel';
import {effectiveUnit} from './combatModifiers';
import {spatial} from './spatial';
import {storageCapacity} from './catalogB3';

const clamp=(n:number,low=0,high=1)=>Math.max(low,Math.min(high,n));
function chooseV2(w:FormalWorld,c:FormalCity,a:Agent,base:FormalCommand[],portion:(c:FormalCity,r:number)=>Record<string,number>):FormalCommand[]{
 // Keep the original protection gates, defense / recall / joint decisions and the military coin flip.
 if(!a.active||incomingAlerts(w,a.factionId).some(t=>t.ownerFactionId===a.factionId)
  ||w.time-a.lastWarAt<HOUR
  ||w.armies.filter(t=>t.ownerFactionId===a.factionId&&t.originCityId===c.id).length>=3
  ||aiRandom(w.seed,a.factionId,a.decisions+311)>.15+a.traits.military*.55)
   return base;
 if(base.some(cmd=>cmd.type!=='army.dispatch'))return base;
 if(base.some(cmd=>cmd.type==='army.dispatch'&&cmd.target.kind==='wild'))return base;
 const own=c.military?.units??{};
 const total=Object.entries(own).reduce((sum,[id,n])=>sum+(effectiveUnit(id)?n:0),0);
 if(total<50)return base;
 const units=portion(c,.3);
 if(Object.values(units).reduce((sum,n)=>sum+n,0)<10)return base;
 const sites=spatial(w).nearby(c.x,c.y,24).sites
   .filter(site=>site.level<=Math.max(1,Math.floor(total/100)))
   .sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y)||String(a.id).localeCompare(String(b.id)))
   .slice(0,8);
 if(!sites.length)return base;
 trace.eligibleWild++;
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
 }).sort((x,y)=>y.value-x.value||String(x.site.id).localeCompare(String(y.site.id)))[0];
 const source=base[0];
 const kind=!source?'blocked':source.type==='army.dispatch'&&source.mission==='scout'?'scout':'city';
 if(kind==='blocked')trace.blockedWithWild++;
 if(trace.mode==='fallback'&&kind!=='blocked')return base;
 // Separate reconnaissance from raid choice: allow only small, trait-driven wild diversion.
 const shortage=best.need;
 const war=publicSituation(w,a,c).some(t=>t.relation==='war');
 let chance=kind==='blocked'?.50+.28*a.traits.raiding+.16*shortage-.08*a.traits.military:
   .07+.16*a.traits.raiding+.12*a.traits.economy+.20*shortage-.12*a.traits.military-.10*a.traits.expansion-(war?.06:0);
 if(kind==='scout')chance=Math.min(chance,.26);
 if(trace.mode==='proactive')chance+=kind==='scout'?.06:.17;
 if(trace.mode==='fallback')chance=kind==='blocked'?1:0;
 chance=clamp(chance,0,.88);
 if(aiRandom(w.seed,a.factionId,a.decisions+1511)>=chance)return base;
 if(kind==='blocked')trace.overrides.blockedToWild++;
 else if(kind==='scout')trace.overrides.scoutToWild++;
 else trace.overrides.cityToWild++;
 return [{type:'army.dispatch',cityId:c.id,mission:'raid',target:{kind:'wild',siteId:best.site.id,generation:best.site.generation},units}];
}
const sumResource=(x:Resources)=>Object.values(x).reduce((a,b)=>a+b,0);
describe('P0-C-9 V2: baseline, fallback, context and proactive on exact main',()=>{
 it('preserves the original engine and compares natural AI worlds',()=>{
   const hours=Number(process.env.P0C9_HOURS||168);
   const seeds=(process.env.P0C9_SEEDS||'90217').split(',').map(Number);
   const variants:Mode[]=['baseline','fallback','contextual','proactive'];
   const results=[];
   for(const seed of seeds)for(const mode of variants){
     trace.mode=mode;trace.decisions=0;
     trace.attempted={wild:0,city:0,scout:0,joint:0};
     trace.overrides={blockedToWild:0,scoutToWild:0,cityToWild:0};
     trace.returns=0;trace.returnedLoot={food:0,wood:0,stone:0,gold:0};
     trace.wildReturnLoot={food:0,wood:0,stone:0,gold:0};trace.wildLosses=0;
     trace.eligibleWild=0;trace.blockedWithWild=0;
     let w=createFormalWorld({campaign:'p0c9-v2-'+seed,seed,speed:1});
     enableAutonomy(w);
     for(let h=1;h<=hours;h++)w=advanceFormal(w,h*HOUR).world;
     const counts=w.combat?.statistics;
     const receipts=w.combat?.receipts.filter(r=>r.kind==='final')??[];
     const activeAI=w.factions.filter(f=>f.role==='ai'&&w.cities.some(c=>c.ownerFactionId===f.id)).length;
     results.push({seed,mode,completedHours:hours,ai:activeAI,decisions:trace.decisions,
       attempts:{...trace.attempted},overrides:{...trace.overrides},eligibleWild:trace.eligibleWild,blockedWithWild:trace.blockedWithWild,
       accepted:w.autonomy?.accepted,rejected:w.autonomy?.rejected,
       wildCleared:receipts.filter(r=>r.outcome==='wild-cleared').length,
       actualReturnedLoot:{...trace.returnedLoot},actualReturnedLootSum:sumResource(trace.returnedLoot),
       wildReturnedLoot:{...trace.wildReturnLoot},wildReturnedLootSum:sumResource(trace.wildReturnLoot),
       wildCombatLosses:trace.wildLosses,returnEvents:trace.returns,
       statistics:counts,cityCount:w.cities.length,
       totalCombatUnits:w.cities.reduce((sum,c)=>sum+Object.entries(c.military?.units??{}).reduce((v,[id,n])=>v+(effectiveUnit(id)?n:0),0),0),
       population:w.cities.reduce((sum,c)=>sum+c.population,0)});
   }
   console.log('P0C9_V2_RESULTS_BEGIN');
   console.log(JSON.stringify({mainBase:'06c4cb93779f1f679bb77470515fd8aee1c42de9',
    mode:'main Formal World natural start; no injected troops or intel, real dependencies and combat, test-only wrapper; revenue counted at army.return',
    seeds,hours,results}));
   console.log('P0C9_V2_RESULTS_END');
   expect(results).toHaveLength(seeds.length*4);
   expect(results.every(r=>r.ai>=0&&r.ai<=99)).toBe(true);
 },900000);
});
