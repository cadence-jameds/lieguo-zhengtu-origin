// Native synthetic campaign only; no player saves are read or committed.
import 'fake-indexeddb/auto';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=process.argv[2];if(!out)throw Error('Provide a temporary output directory');await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {createFormalWorld}=await server.ssrLoadModule('/src/game/formal/generator.ts'),{submitFormalOrder,advanceFormal}=await server.ssrLoadModule('/src/game/formal/reducer.ts'),{commandId}=await server.ssrLoadModule('/src/game/formal/ids.ts'),{quoteGrowthReward}=await server.ssrLoadModule('/src/game/formal/growthTasks.ts'),{GROWTH_TASK_BY_ID}=await server.ssrLoadModule('/src/game/formal/growthTaskCatalog.ts'),{enableAutonomy}=await server.ssrLoadModule('/src/game/formal/autonomy.ts'),{EventScheduler}=await server.ssrLoadModule('/src/game/formal/scheduler.ts'),{FormalPersistence}=await server.ssrLoadModule('/src/game/persistence.ts');
 let w=createFormalWorld({campaign:'update-p0-synthetic',seed:90217}),serial=0;
 const issue=p=>{const t=submitFormalOrder(w,{campaignId:w.campaignId,issuerId:w.playerFactionId,commandId:commandId('update-p0-'+(++serial)),issuedWorldTime:w.time,expectedRevision:w.revision,payload:p});assert.equal(t.ack.status,'committed',t.ack.reason);w=t.world;};
 issue({type:'field.upgrade',cityId:w.cities[0].id,slot:0});const job=w.cities[0].economy.construction[0];w=advanceFormal(w,job.startsAt+job.durationMs).world;
 issue({type:'tasks.claim',cityId:w.cities[0].id,taskId:'N01',expectedResources:quoteGrowthReward(w,w.cities[0],GROWTH_TASK_BY_ID.get('N01')).accepted});
 enableAutonomy(w);w.offlineHours=0;w.speed=1;
 for(const a of w.autonomy.agents)if(a.eventId){a.nextAt=w.time+30*86400000;w.events.find(e=>e.id===a.eventId).at=a.nextAt;}w.events=new EventScheduler(w.events).snapshot();
 // Exercise compatibility labels from PR19 as well as the current formal shape.
 w.metadata.appVersion='0.30.52';const db=new FormalPersistence({suffix:'update-p0-fixture'});
 try{w=await db.start(w);await fs.writeFile(path.join(out,'campaign.realm-save'),await db.exportStoredSave('full'));await fs.writeFile(path.join(out,'fixture.json'),JSON.stringify({source:'synthetic real commands/events; delayed synthetic AI only',campaignId:w.campaignId,appVersion:w.metadata.appVersion,revision:w.revision,receipts:w.commandReceipts.map(r=>({commandId:r.commandId,disposition:r.disposition})),claimedTasks:Object.keys(w.growthTasks.claimed)},null,2));}finally{await db.db.delete();}
}finally{await server.close();}
