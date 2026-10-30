// Synthetic evidence only: real orders/events, temporary fake-indexeddb; never reads player saves.
// node scripts/prepare-journey-goals-fixtures.mjs /tmp/journey-goals-fixtures
import 'fake-indexeddb/auto';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=process.argv[2];if(!out)throw Error('Provide a temporary fixture directory.');await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {createFormalWorld}=await server.ssrLoadModule('/src/game/formal/generator.ts');
 const {submitFormalOrder,advanceFormal}=await server.ssrLoadModule('/src/game/formal/reducer.ts');
 const {commandId,empireId}=await server.ssrLoadModule('/src/game/formal/ids.ts');
 const {spatial,invalidateSpatial}=await server.ssrLoadModule('/src/game/formal/spatial.ts');
 const {buildable,terrainAt}=await server.ssrLoadModule('/src/game/formal/terrain.ts');
 const {changeCityOwner}=await server.ssrLoadModule('/src/game/formal/economy.ts');
 const {EventScheduler}=await server.ssrLoadModule('/src/game/formal/scheduler.ts');
 const {reconcileVictory}=await server.ssrLoadModule('/src/game/formal/victory.ts');
 const {invalidateMilitaryPower}=await server.ssrLoadModule('/src/game/formal/militaryPower.ts');
 const {FormalPersistence}=await server.ssrLoadModule('/src/game/persistence.ts');
 const HOUR=3600000,manifest={source:'synthetic real-order fixtures',cases:[]};let serial=0;
 const issue=(w,p)=>{const t=submitFormalOrder(w,{campaignId:w.campaignId,issuerId:w.playerFactionId,commandId:commandId('journey-fixture-'+(++serial)),expectedRevision:w.revision,issuedWorldTime:w.time,payload:p});assert.equal(t.ack.status,'committed',t.ack.reason);return t;};
 async function persist(name,w,reports=[]){const s=new FormalPersistence({suffix:'journey-fixture-'+name});try{w=await s.start(w);if(reports.length){w={...w,revision:w.revision+1};w=await s.save(w,reports,w.revision-1);}await fs.writeFile(path.join(out,name+'.realm-save'),await s.exportStoredSave('full'));manifest.cases.push({name,time:w.time,readyTasks:Object.keys(w.growthTasks?.completed??{}),claimedTasks:Object.keys(w.growthTasks?.claimed??{}),victory:w.victory??null,reportStatus:await s.reportStatus(w)});}finally{await s.db.delete();}}
 let w=createFormalWorld({campaign:'journey-browser-growth',seed:90217});w=issue(w,{type:'field.upgrade',cityId:w.cities[0].id,slot:0}).world;let job=w.cities[0].economy.construction[0];w=advanceFormal(w,job.startsAt+job.durationMs).world;
 changeCityOwner(w,w.cities[1],w.playerFactionId,'receive');const home=w.cities[0],index=spatial(w);let spot;
 for(let dy=-4;dy<=4&&!spot;dy++)for(let dx=-4;dx<=4;dx++){const x=home.x+dx,y=home.y+dy,cell=index.at(x,y);if(x>=0&&y>=0&&x<384&&y<384&&buildable(terrainAt(w,x,y))&&!cell.city&&!cell.site&&!cell.reservation){spot={x,y};break;}}
 assert.ok(spot);Object.assign(w.cities[2],spot);invalidateSpatial(w);w.cities[0].military.units={militia:100};w.cities[2].military.units={};w=issue(w,{type:'army.dispatch',cityId:home.id,mission:'raid',target:{kind:'city',cityId:w.cities[2].id},units:{militia:50}}).world;
 let a=w.armies.find(a=>a.status==='outbound'),result=advanceFormal(w,a.arrivalAt),reports=[...result.reports];w=result.world;a=w.armies.find(a=>a.status==='returning');assert.ok(a);result=advanceFormal(w,a.arrivalAt);w=result.world;reports.push(...result.reports);assert.ok(w.growthTasks.completed.N01!==undefined&&w.growthTasks.completed.C08!==undefined);
 await persist('growth-ready',w,reports);
 if(process.env.JOURNEY_INTEGRATION==='1'){
  const {build}=await server.ssrLoadModule('/src/game/formal/developmentTestSupport.ts');
  const {storageCapacity}=await server.ssrLoadModule('/src/game/formal/catalogB3.ts');
  const v2=structuredClone(w),owned=v2.cities.filter(c=>c.ownerFactionId===v2.playerFactionId);
  for(const c of owned){build(c,'warehouse.0',15);c.stock={food:0,wood:0,stone:0,gold:0};}
  for(const r of ['food','wood','stone','gold'])owned[0].stock[r]=storageCapacity(owned[0]);
  await persist('growth-v2',v2,reports);
 }

 let victory=structuredClone(w);for(let i=0;i<75;i++)victory.cities[i].ownerFactionId=victory.playerFactionId;invalidateSpatial(victory);let s=new EventScheduler(victory.events);reconcileVictory(victory,s);victory.events=s.snapshot();const started=victory.time;result=advanceFormal(victory,started+6*HOUR);victory=result.world;await persist('conquest-half',victory,[...reports,...result.reports]);result=advanceFormal(victory,started+12*HOUR);await persist('conquest-terminal',result.world,[...reports,...result.reports]);
 let heg=createFormalWorld({campaign:'journey-browser-hegemony',seed:90217}),id=empireId('journey-browser'),members=heg.factions.slice(0,15).map(f=>f.id);heg.politics={legions:[],empires:[{id,name:'征途驗收帝國',leader:members[0],legions:[],color:'red'}],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};
 for(let i=0;i<3;i++){const group=members.slice(i*5,i*5+5),key='legion:journey-browser-'+i;heg.politics.legions.push({id:key,name:'驗收軍團 '+(i+1),description:'',leader:group[0],members:group,empireId:id});heg.politics.empires[0].legions.push(key);}
 for(const f of heg.factions)f.empireId=members.includes(f.id)?id:null;
 for(let i=0;i<100;i++){heg.cities[i].population=100;if(i<45)heg.cities[i].ownerFactionId=members[i%15];}heg.cities[0].military.units={militia:100};invalidateSpatial(heg);invalidateMilitaryPower(heg);s=new EventScheduler(heg.events);reconcileVictory(heg,s);heg.events=s.snapshot();heg=advanceFormal(heg,12*HOUR).world;assert.ok(heg.victory.candidates.some(c=>c.kind==='hegemony'));await persist('hegemony-half',heg);
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest.cases.map(c=>({name:c.name,time:c.time,reports:c.reportStatus.unread,completed:c.readyTasks}))));
}finally{await server.close();}
