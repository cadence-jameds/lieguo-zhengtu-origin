// Observe actual Formal code in a disposable compiled directory; never change AI policy.
// P0_INSTRUMENT=0 node scripts/p0-profile-prepare.mjs . artifacts/v95/compiled
// node scripts/v95-simulate.mjs artifacts/v95/compiled 90217 artifacts/v95/simulation
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const [compiledArg='artifacts/v95/compiled',seedArg='90217',outputArg='artifacts/v95/simulation']=process.argv.slice(2),compiled=path.resolve(compiledArg),out=path.resolve(outputArg),seed=Number(seedArg);
fs.mkdirSync(out,{recursive:true});
const load=name=>import(pathToFileURL(path.join(compiled,'src/game/formal',name+'.js')).href);
// Wrappers in temporary generated JS only. One observation per authoritative city settlement.
const economyFile=path.join(compiled,'src/game/formal/economy.js'),reducerFile=path.join(compiled,'src/game/formal/reducer.js');
let economy=fs.readFileSync(economyFile,'utf8'),reducer=fs.readFileSync(reducerFile,'utf8');
assert.ok(!economy.includes('__v95_original_settleCity'));
economy=economy.replace('export function settleCity(', 'function __v95_original_settleCity(')+`\nexport function settleCity(w,c,at=w.time,legacy=false){
 const real=globalThis.__v95metrics&&w.cities.includes(c)&&c.economy&&at>c.economy.lastSettledAt;
 if(real){const h=(at-c.economy.lastSettledAt)/HOUR,penalty=Math.min(h,(c.integrationWorkHours??0)*administrationMultiplier(w,c.ownerFactionId)),lv=buildingLevel(c,'monastery'),offering=legacy?0:(populationGrowth(c.population,c.housing,lv,h).cappedPersonHours-.6*populationGrowth(c.population,c.housing,lv,penalty).cappedPersonHours)*monasteryGoldPerHour(1,lv),rates=productionPerHour(w,c,legacy),cap=storageCapacity(c);
 globalThis.__v95metrics.offeringGold+=offering;globalThis.__v95metrics.settlements++;
 for(const r of resourceKeys){const generated=rates[r]*(h-.6*penalty)+(r==='gold'?offering:0),exact=c.stock[r]+c.economy.productionRemainder[r]+generated-(r==='food'?armyUpkeep(w,c)*h:0);globalThis.__v95metrics.fieldProduction[r]+=rates[r]*(h-.6*penalty);globalThis.__v95metrics.overflow[r]+=Math.max(0,exact-(cap-c.economy.reservedIncoming[r]));}}
 return __v95_original_settleCity(w,c,at,legacy);
}\n`;
reducer=reducer.replace('function advanceOneEvent(', 'function __v95_original_advanceOneEvent(')+`\nfunction advanceOneEvent(...args){const e=args[1].peek();if(globalThis.__v95metrics){const m=globalThis.__v95metrics;m.events++;m.eventsByType[e.type]=(m.eventsByType[e.type]??0)+1;}return __v95_original_advanceOneEvent(...args);}\n`;
// A reducer draft can settle before later rejecting a command. Discard those
// observations along with the draft, just as the real ledger does.
reducer=reducer.replace('function submitOrderDraft(', 'function __v95_original_submitOrderDraft(')+`\nfunction submitOrderDraft(...args){
 const m=globalThis.__v95metrics,before=m?structuredClone(m):null;
 const result=__v95_original_submitOrderDraft(...args);
 if(m&&result.ack?.status!=='committed'){const discarded=Math.max(0,m.settlements-before.settlements);Object.assign(m,before);m.discardedDraftSettlements=(m.discardedDraftSettlements??0)+discarded;}
 return result;
}\n`;
fs.writeFileSync(economyFile,economy);fs.writeFileSync(reducerFile,reducer);
const {createFormalWorld}=await load('generator'),{enableAutonomy}=await load('autonomy'),{advanceFormal}=await load('reducer'),{storageCapacity}=await load('catalogB3');
const zero=()=>({food:0,wood:0,stone:0,gold:0});
const m=globalThis.__v95metrics={events:0,eventsByType:{},offeringGold:0,fieldProduction:zero(),overflow:zero(),settlements:0};
let w=createFormalWorld({campaign:'v95-long-'+seed,seed,speed:1});enableAutonomy(w);assert.equal(w.autonomy.agents.length,99);assert.equal(w.cities.length,100);
const started=performance.now();let peakHeap=0,peakRss=0;const snapshots=[];
for(let hour=1;hour<=720;hour++){
 w=advanceFormal(w,hour*3600000).world;
 const mem=process.memoryUsage();peakHeap=Math.max(peakHeap,mem.heapUsed);peakRss=Math.max(peakRss,mem.rss);
 if(hour%24===0||[168,360,720].includes(hour)){const progress={hour,elapsedMs:Math.round(performance.now()-started),events:m.events,cities:w.cities.length,ai:99,population:w.cities.reduce((n,c)=>n+c.population,0),monasteries:w.cities.filter(c=>c.buildings.monastery>0).length,offeringGold:m.offeringGold};fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(progress));console.log(JSON.stringify(progress));}
 if([168,360,720].includes(hour)){
  const histogram=(items)=>items.reduce((o,k)=>(o[k]=(o[k]??0)+1,o),{}),stock=zero();for(const c of w.cities){for(const r of Object.keys(stock)){assert.ok(c.stock[r]>=0&&c.stock[r]<=storageCapacity(c));stock[r]+=c.stock[r];}assert.ok(c.economy.construction.length<=5);assert.ok(c.military.queue.length<=5);}
  const row={hours:hour,seed,aiAgents:w.autonomy.agents.length,liveAI:w.autonomy.agents.filter(a=>w.cities.some(c=>c.ownerFactionId===a.factionId)).length,cities:w.cities.length,population:w.cities.reduce((n,c)=>n+c.population,0),stock,ages:histogram(w.factions.map(f=>f.age)),fieldLevels:histogram(w.cities.flatMap(c=>c.fields.map(f=>f.level))),buildingLevels:histogram(w.cities.flatMap(c=>Object.entries(c.buildings).map(([k,v])=>k.split('.')[0]+':'+v))),techs:histogram(w.factions.flatMap(f=>f.techIds)),constructionJobs:w.cities.reduce((n,c)=>n+c.economy.construction.length,0),trainingJobs:w.cities.reduce((n,c)=>n+c.military.queue.length,0),aiAccepted:w.autonomy.accepted,aiRejected:w.autonomy.rejected,metrics:structuredClone(m),performance:{elapsedMs:performance.now()-started,peakHeapBytes:peakHeap,peakRssBytes:peakRss,eventsPerSecond:m.events/((performance.now()-started)/1000)}};
  snapshots.push(row);fs.writeFileSync(path.join(out,hour+'h.json'),JSON.stringify(row,null,2));
 }
}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({source:JSON.parse(fs.readFileSync(path.join(compiled,'source-metadata.json'))),snapshots,limitations:['single seed, one continuous 99 AI world at 168/360/720h checkpoints','Node CPU/memory; not physical-phone FPS','offering and overflow observe only committed settlement intervals; rejected command draft observations are rolled back; no extra income applied']},null,2));
