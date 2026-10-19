// Local synthetic/controlled fixtures, never private saves or natural-simulation substitutes.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [compiledArg,outArg]=process.argv.slice(2),compiled=path.resolve(compiledArg),out=path.resolve(outArg);
fs.mkdirSync(out,{recursive:true});
const load=async name=>import(pathToFileURL(path.join(compiled,'src/game/formal',name+'.js')).href);
const {createFormalWorld}=await load('generator'),{enableAutonomy}=await load('autonomy'),{advanceFormal}=await load('reducer'),{encodeSave}=await load('saveCodec'),{aiRandom}=await load('autonomyModel'),{militaryDecision}=await load('aiActions'),{publicSituation}=await load('aiKnowledge');
const metadata=JSON.parse(fs.readFileSync(path.join(compiled,'source-metadata.json'),'utf8')),HOUR=3600000;
const manifest={head:metadata.sha,sourceTreeHash:metadata.sourceTreeHash,fixtures:[]};
let w=createFormalWorld({campaign:'p0c9-v2-90217',seed:90217,speed:1,offlineHours:0});enableAutonomy(w);
for(let h=1;h<=168;h++){
 w=advanceFormal(w,h*HOUR).world;
 if([96,168].includes(h)){
  const owned=w.cities.filter(c=>c.ownerFactionId===w.playerFactionId).length;
  for(const speed of [1,10,50]){const copy=structuredClone(w);copy.speed=speed;const name=`natural-${h}h-${speed}x.realm-save`;fs.writeFileSync(path.join(out,name),JSON.stringify(await encodeSave(copy)));manifest.fixtures.push({name,hours:h,speed,owned,agents:w.autonomy.agents.length,liveAI:w.autonomy.agents.filter(a=>w.cities.some(c=>c.ownerFactionId===a.factionId)).length,prerequisites:'natural world; only speed/offline cap selected for controlled timing'});}
  console.log(JSON.stringify({hours:h,owned,agents:w.autonomy.agents.length}));
 }
}
let controlled=createFormalWorld({campaign:'p0c9-browser-parallel',seed:90217,speed:1,offlineHours:0});enableAutonomy(controlled);controlled=advanceFormal(controlled,2*HOUR).world;
const a=controlled.autonomy.agents.find(a=>publicSituation(controlled,a,controlled.cities.find(c=>c.ownerFactionId===a.factionId)).length),c=controlled.cities.find(c=>c.ownerFactionId===a.factionId);
c.military.units={militia:600,archer:200,scout:10,ram:20};for(const f of controlled.factions)f.protectionUntil=0;a.active=true;
a.intel=publicSituation(controlled,a,c).map(t=>({cityId:t.id,ownerFactionId:t.ownerFactionId,at:controlled.time,source:'scout',units:{},coarse:'personnel'}));
let chosen;for(let n=1;n<=5000;n++){a.decisions=n;if(aiRandom(controlled.seed,a.factionId,n+100)<.3+.65*a.traits.activity&&militaryDecision(controlled,c,a).filter(p=>p.type==='army.dispatch').length===2){chosen=n;break;}}
if(!chosen)throw Error('No deterministic controlled parallel fixture');a.decisions=chosen-1;
const e=controlled.events.find(e=>e.id===a.eventId);e.at=a.nextAt=controlled.time+1000;
const name='controlled-parallel.realm-save';fs.writeFileSync(path.join(out,name),JSON.stringify(await encodeSave(controlled)));
manifest.fixtures.push({name,hours:2,speed:1,agents:99,factionId:a.factionId,cityId:c.id,eventId:e.id,initialUnits:{...c.military.units},prerequisites:'CONTROLLED: explicit troops, observed-intel fixture, protection removed, decision identity/event set; other 99-AI schedules remain active; NOT natural performance evidence'});
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
