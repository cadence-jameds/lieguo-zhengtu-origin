// Reproducible original-engine v1 claims; no player saves or refreshed historical evidence.
import 'fake-indexeddb/auto';
import {createServer} from 'vite';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const out=process.argv[2];if(!out)throw Error('Pass the synthetic v1 witness output path; run with cwd set to an unmodified archived baseline.');
const pinned={"src/game/formal/growthTaskCatalog.ts": "92eba1770f267daae8d9640478e4bffbc522219ad52bc7fbc5ea4eb4c3f5a65b", "src/game/formal/growthTasks.ts": "b87d9fa90cec64179df68f41b144eaa7737ce0a3236d1668f8e419b1b3e07056", "src/game/formal/schema.ts": "ce348e89af518411b711035d1c1659297b3f11dea92bf846350f53a56b306bc4", "src/game/formal/growthTaskSchema.ts": "c50d3e1da579b28c45188417e1b2c06414fb382cb9a71f6f52b68feadc36cf14"};
for(const [p,digest]of Object.entries(pinned))if(createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==digest)throw Error('Legacy engine source mismatch: '+p);
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {createFormalFixture}=await server.ssrLoadModule('/src/game/formal/fixture.ts');
 const {initializeEconomy}=await server.ssrLoadModule('/src/game/formal/economy.ts');
 const {initialMilitary}=await server.ssrLoadModule('/src/game/formal/military.ts');
 const {submitFormalOrder,advanceFormal}=await server.ssrLoadModule('/src/game/formal/reducer.ts');
 const {order}=await server.ssrLoadModule('/src/game/formal/developmentTestSupport.ts');
 const {quoteGrowthReward}=await server.ssrLoadModule('/src/game/formal/growthTasks.ts');
 const {GROWTH_TASK_BY_ID}=await server.ssrLoadModule('/src/game/formal/growthTaskCatalog.ts');
 const {storageCapacity}=await server.ssrLoadModule('/src/game/formal/catalogB3.ts');
 const {encodeSave}=await server.ssrLoadModule('/src/game/formal/saveCodec.ts');
 let w=createFormalFixture({campaign:'journey-v1-compatibility'});w.armies=[];
 for(const c of w.cities){c.fields=Array.from({length:18},(_,slot)=>({slot,resource:['food','wood','stone','gold'][slot<6?0:slot<11?1:slot<15?2:3],level:0}));c.wallLevel=0;c.cityPromotionCompleted=false;c.integrationWorkHours=0;c.military=initialMilitary();}
 initializeEconomy(w);w=submitFormalOrder(w,order(w,{type:'field.upgrade',cityId:w.cities[0].id,slot:0},'v1-field')).world;const job=w.cities[0].economy.construction[0];w=advanceFormal(w,job.startsAt+job.durationMs).world;
 const cases=[];
 for(const mode of ['full','partial','zero']){
  let old=structuredClone(w),c=old.cities[0],cap=storageCapacity(c);c.stock=mode==='full'?{food:0,wood:0,stone:0,gold:0}:mode==='partial'?{food:cap-10,wood:cap,stone:cap-50,gold:cap-100}:{food:cap,wood:cap,stone:cap,gold:cap};
  const command=order(old,{type:'tasks.claim',cityId:c.id,taskId:'N01',expectedResources:quoteGrowthReward(old,c,GROWTH_TASK_BY_ID.get('N01')).accepted},'v1-claim-'+mode);const result=submitFormalOrder(old,command);if(result.ack.status!=='committed')throw Error(result.ack.reason);
  cases.push({name:mode,command,save:await encodeSave(result.world)});
 }
 fs.writeFileSync(out,JSON.stringify({sourceCommit:'9ac3ccc06e1bc8915147ee405d385c369ea47027',source:'Unmodified original engine; synthetic formal fixture; full/partial/zero v1 claims',cases}).replace(/[^\x00-\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')));
 console.log('PASS: 3 original-engine v1 save witnesses');
}finally{await server.close();}
