import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [compiledArg,seedArg='90217',hoursArg='168',policy='traits',outArg='artifacts/p0c9/results']=process.argv.slice(2);
const compiled=path.resolve(compiledArg??'artifacts/p0c9/compiled'),out=path.resolve(outArg),seed=Number(seedArg),hours=Number(hoursArg);
const modes=['A48','V2B48','V3Parallel48','WildPriority60','WildParallel48','equal','traits'];
assert.ok(modes.includes(policy)&&Number.isSafeInteger(seed)&&seed>=0&&seed<=4294967295&&Number.isInteger(hours)&&hours>0&&hours<=720);
fs.mkdirSync(out,{recursive:true});
const load=async name=>import(pathToFileURL(path.join(compiled,'src/game/formal',name+'.js')).href);
const {createFormalWorld}=await load('generator'),{enableAutonomy}=await load('autonomy'),{advanceFormal}=await load('reducer'),{canonicalJSON}=await load('canonical');
const {effectiveUnit}=await load('combatModifiers'),{UNIT_CATALOG}=await load('unitCatalog');
const zero=()=>({food:0,wood:0,stone:0,gold:0}),inc=(o,k,n=1)=>o[k]=(o[k]??0)+n;
const metadata=JSON.parse(fs.readFileSync(path.join(compiled,'p0c9-harness.json'),'utf8'));
let w=createFormalWorld({campaign:'p0c9-v2-'+seed,seed,speed:1});enableAutonomy(w);
assert.equal(w.autonomy.agents.length,99);assert.equal(w.cities.length,100);
assert.ok(w.cities.every(c=>c.population===200&&Object.values(c.military.units).every(n=>n===0)));
const roles=new Map(w.factions.map(f=>[f.id,f.role])),isAI=id=>roles.get(id)==='ai';
const m={picks:{},picksWithOrders:{},submittedByStrategy:{},choicesByPersonality:{},attempts:{ordinaryWild:0,exile:0,cityRaid:0,cityConquest:0,scout:0,reinforce:0,joint:0},committed:{ordinaryWild:0,exile:0,cityRaid:0,cityConquest:0,scout:0,reinforce:0,joint:0},outcomes:{ordinaryWildCleared:0,exileCleared:0,cityRaids:0,cityConquered:0,scouts:0},rejectionReasons:{},preflightReasons:{},actualOrdinaryWildDeposits:zero(),ordinaryWildCargoAtReturn:zero(),actualOtherDeposits:zero(),lossesByUnit:{},ordinaryWildLossesByUnit:{},catalogReplacementCost:zero(),ordinaryWildCatalogReplacementCost:zero(),parallelPlanned:0,parallelCommitted:0,partialParallel:0,maxCityArmies:0,minParallelGarrisonFraction:1,events:0,eventsByType:{},returnDeposits:0,distances:{beyond24:0,beyond48:0,max:0},faults:[]};
const picked=new Map(),personalities=['economy','military','expansion','raiding','risk','defense'];
let round=null,returning=null;
const kind=p=>p.type==='joint.create'||p.type==='joint.join'?'joint':p.type!=='army.dispatch'?null:p.mission==='scout'?'scout':p.mission==='reinforce'?'reinforce':p.target.kind==='wild'?(p.target.siteId.startsWith('wild:exile-')?'exile':'ordinaryWild'):p.mission==='conquest'?'cityConquest':'cityRaid';
globalThis.__p0c9={policy,
 before(name,args){
  if(name==='advanceOneEvent'){const e=args[1].peek();m.events++;inc(m.eventsByType,e.type);}
  if(name==='militaryDecision')picked.delete(args[2].factionId);
  if(name==='submitAutonomous'){const previous=round;round={committed:0,planned:args[4].filter(p=>p.type==='army.dispatch').length,garrisons:new Map(args[0].cities.filter(c=>args[4].some(p=>p.type==='army.dispatch'&&p.cityId===c.id)).map(c=>[c.id,{...c.military.units}]))};if(round.planned>=2)m.parallelPlanned++;return previous;}
  if(name==='submitOrderDraft'){const o=args[1];if(!isAI(o?.issuerId))return;const k=kind(o.payload);if(k)inc(m.attempts,k);return {k,owner:o.issuerId};}
  if(name==='handleCombatEvent'){
   const previous=returning,[world,e]=args;returning=null;
   if(e.type==='army.return'){const a=world.armies.find(a=>a.id===e.armyId&&a.movementEventId===e.id);if(a&&isAI(a.ownerFactionId))returning={id:a.id,cityId:a.returnCityId,cargo:{...a.cargo},ordinary:a.target.kind==='wild'&&!a.target.siteId.startsWith('wild:exile-')};}
   return previous;
  }
  if(name==='addStock'&&returning&&args[0].id===returning.cityId)return{stock:{...args[0].stock},returning};
 },
 after(name,args,result,token){
  if(name==='pickAttackStrategy'){
   const a=args[1],dominant=[...personalities].sort((x,y)=>a.traits[y]-a.traits[x]||x.localeCompare(y,'en'))[0];
   inc(m.picks,result);const dist=m.choicesByPersonality[dominant]??={};inc(dist,result);picked.set(a.factionId,result);
  }
  if(name==='militaryDecision'){
   const [world,c,a]=args,s=picked.get(a.factionId);if(result.some(p=>p.type==='army.dispatch')&&s)inc(m.picksWithOrders,s);
   const ext=world.armies.filter(t=>t.ownerFactionId===a.factionId&&t.originCityId===c.id).length;m.maxCityArmies=Math.max(m.maxCityArmies,ext);
   for(const p of result)if(p.type==='army.dispatch'&&p.target.kind==='wild'){
    const site=world.worldLayer.wildSites.find(t=>t.id===p.target.siteId);if(site){const d=Math.hypot(site.x-c.x,site.y-c.y);if(d>24)m.distances.beyond24++;if(d>48)m.distances.beyond48++;m.distances.max=Math.max(m.distances.max,d);}
   }
  }
  if(name==='autonomousDispatchReason'&&result)inc(m.preflightReasons,result);
  if(name==='submitOrderDraft'&&token){
   if(result.ack?.status==='committed'){
    if(token.k){inc(m.committed,token.k);const s=picked.get(token.owner);if(s)inc(m.submittedByStrategy,s);}
    if(round&&args[1].payload.type==='army.dispatch')round.committed++;
   }else if(result.ack?.status!=='duplicate')inc(m.rejectionReasons,result.ack?.reason??result.ack?.status??'unknown');
  }
  if(name==='submitAutonomous'){
   if(round.planned>=2){if(round.committed>=2)m.parallelCommitted++;else if(round.committed===1)m.partialParallel++;for(const [id,units] of round.garrisons){const c=args[0].cities.find(c=>c.id===id);for(const [unit,n] of Object.entries(units))if(n&&effectiveUnit(unit))m.minParallelGarrisonFraction=Math.min(m.minParallelGarrisonFraction,(c?.military.units[unit]??0)/n);}}
   const world=args[0];for(const c of world.cities.filter(c=>c.ownerFactionId===args[3]))m.maxCityArmies=Math.max(m.maxCityArmies,world.armies.filter(a=>a.originCityId===c.id&&a.ownerFactionId===args[3]).length);
   round=token;
  }
  if(name==='finishReceipt'&&result){
   const [world,p]=args;if(!p.attackers.some(g=>isAI(g.ownerFactionId)))return;
   const ordinary=p.target.kind==='wild'&&!p.target.siteId.startsWith('wild:exile-');
   if(p.outcome==='wild-cleared')inc(m.outcomes,ordinary?'ordinaryWildCleared':'exileCleared');
   if(p.target.kind==='city'&&p.mission==='raid')m.outcomes.cityRaids++;
   if(p.outcome==='conquered')m.outcomes.cityConquered++;
   if(p.mission==='scout')m.outcomes.scouts++;
   for(const g of [...p.attackers,...p.defenders])if(isAI(g.ownerFactionId))for(const [id,n] of Object.entries(g.before)){
    const lost=Math.max(0,n-(g.after[id]??0));inc(m.lossesByUnit,id,lost);
    if(ordinary&&p.attackers.includes(g))inc(m.ordinaryWildLossesByUnit,id,lost);
    for(const r of Object.keys(m.catalogReplacementCost)){const cost=lost*(UNIT_CATALOG[id]?.cost[r]??0);m.catalogReplacementCost[r]+=cost;if(ordinary&&p.attackers.includes(g))m.ordinaryWildCatalogReplacementCost[r]+=cost;}
   }
  }
  if(name==='addStock'&&token){
   const c=args[0],r=token.returning,target=r.ordinary?m.actualOrdinaryWildDeposits:m.actualOtherDeposits;
   for(const resource of Object.keys(target)){const delivered=c.stock[resource]-token.stock[resource];assert.ok(delivered>=0&&delivered<=r.cargo[resource]);target[resource]+=delivered;if(r.ordinary)m.ordinaryWildCargoAtReturn[resource]+=r.cargo[resource];}m.returnDeposits++;
  }
  if(name==='handleCombatEvent')returning=token;
 },fault(name,error){m.faults.push({name,message:String(error)});}
};
const started=performance.now(),hourly=[];let peakHeap=0,peakRss=0;
for(let hour=1;hour<=hours;hour++){
 w=advanceFormal(w,hour*3600000).world;
 const mem=process.memoryUsage();peakHeap=Math.max(peakHeap,mem.heapUsed);peakRss=Math.max(peakRss,mem.rss);
 const live=w.autonomy.agents.filter(a=>w.cities.some(c=>c.ownerFactionId===a.factionId)).length;
 hourly.push({hour,liveAI:live,cities:w.cities.length,population:Math.floor(w.cities.reduce((n,c)=>n+c.population,0)),armies:w.armies.length,events:m.events,ordinaryWildDepartures:m.committed.ordinaryWild,ordinaryWildCleared:m.outcomes.ordinaryWildCleared,actualOrdinaryWildResources:Object.values(m.actualOrdinaryWildDeposits).reduce((n,v)=>n+v,0),elapsedMs:Math.round(performance.now()-started),heapBytes:mem.heapUsed,rssBytes:mem.rss});
 if(hour%24===0||hour===hours){const progress={seed,policy,hour,hours,...hourly.at(-1)};fs.writeFileSync(path.join(out,`${seed}-${hours}-${policy}.progress.json`),JSON.stringify(progress));console.log(JSON.stringify(progress));}
}
const summary={head:metadata.head,sourceTreeHash:metadata.sourceTreeHash,harness:metadata,seed,policy,hours,initial:{ai:99,cities:100,populationPerCity:200,injectedTroops:0,injectedIntel:0,injectedResources:0,speed:1},metrics:m,autonomy:{accepted:w.autonomy.accepted,rejected:w.autonomy.rejected,agents:w.autonomy.agents.length,decisions:w.autonomy.agents.reduce((n,a)=>n+a.decisions,0)},final:{liveAI:hourly.at(-1).liveAI,cities:w.cities.length,population:hourly.at(-1).population,stationedEffectiveUnits:w.cities.reduce((n,c)=>n+Object.entries(c.military.units).reduce((n,[id,v])=>n+(effectiveUnit(id)?v:0),0),0),awayEffectiveUnits:w.armies.reduce((n,a)=>n+Object.entries(a.units).reduce((n,[id,v])=>n+(effectiveUnit(id)?v:0),0),0),armies:w.armies.length,hash:createHash('sha256').update(canonicalJSON(w)).digest('hex')},performance:{elapsedMs:performance.now()-started,events:m.events,peakHeapBytes:peakHeap,peakRssBytes:peakRss,maxRssKiB:process.resourceUsage().maxRSS},limitations:['replacement cost is catalog equivalent, not actual recruitment spending','Node memory, not Android memory or mobile FPS','comparison policies override only the pure selector in disposable compiled files; no troops/resources/activity/timing changes']};
assert.equal(m.faults.length,0);assert.ok(m.maxCityArmies<=3);assert.ok(m.minParallelGarrisonFraction>=.30);assert.equal(w.autonomy.agents.length,99);
const label=`${seed}-${hours}-${policy}`;fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(summary,null,2));
const keys=Object.keys(hourly[0]);fs.writeFileSync(path.join(out,label+'.csv'),[keys.join(','),...hourly.map(r=>keys.map(k=>r[k]).join(','))].join('\n')+'\n');
console.log(JSON.stringify({completed:label,elapsedMs:summary.performance.elapsedMs,events:m.events,outcomes:m.outcomes,rejections:summary.autonomy.rejected}));
