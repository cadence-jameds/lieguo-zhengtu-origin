// Synthetic fixtures only; never reads or publishes player storage.
import {createServer} from 'vite';
import fs from 'node:fs/promises';
const out=process.argv[2];if(!out)throw Error('Usage: node scripts/prepare-protection-extinction-fixtures.mjs <temporary fixture directory>');
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const load=p=>server.ssrLoadModule('/src/game/formal/'+p+'.ts');
 const {createFormalWorld}=await load('generator'),{submitFormalOrder,advanceFormal}=await load('reducer'),{spatial,invalidateSpatial}=await load('spatial'),{terrainAt,buildable}=await load('terrain'),{enableAutonomy}=await load('autonomy'),{EventScheduler}=await load('scheduler'),{commandId}=await load('ids'),{encodeSave}=await load('saveCodec'),{rebirthCandidates}=await load('extinction');
 const fresh=createFormalWorld({campaign:'p0c10-synthetic-protection',seed:90217,speed:25,offlineHours:0});
 let w=createFormalWorld({campaign:'p0c10-synthetic-defeat',seed:90217,speed:25,offlineHours:12});
 for(const f of w.factions)f.protectionUntil=0;
 const home=w.cities[0];let p;
 for(let dy=-3;dy<=3&&!p;dy++)for(let dx=-3;dx<=3&&!p;dx++){const x=home.x+dx,y=home.y+dy,cell=spatial(w).at(x,y);if(buildable(terrainAt(w,x,y))&&!cell.city&&!cell.site)p={x,y};}
 Object.assign(w.cities[1],p);invalidateSpatial(w);w.cities[1].military.units={militia:100};enableAutonomy(w);
 for(const a of w.autonomy.agents){a.nextAt=30*86400000;w.events.find(e=>e.id===a.eventId).at=a.nextAt;}w.events=new EventScheduler(w.events).snapshot();
 const order={campaignId:w.campaignId,issuerId:w.factions[1].id,commandId:commandId('synthetic-terminal'),expectedRevision:w.revision,issuedWorldTime:w.time,payload:{type:'army.dispatch',cityId:w.cities[1].id,mission:'conquest',target:{kind:'city',cityId:home.id},units:{militia:100}}};
 const dispatched=submitFormalOrder(w,order);if(dispatched.ack.status!=='committed')throw Error(dispatched.ack.reason);const t=advanceFormal(dispatched.world,dispatched.world.armies[0].arrivalAt+3600000);w=t.world;
 if(!w.extinction?.defeat)throw Error('Synthetic defeat did not freeze');
 await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/defeat.realm-save',JSON.stringify(await encodeSave(w,t.reports)));await fs.writeFile(out+'/protection.realm-save',JSON.stringify(await encodeSave(fresh)));
 await fs.writeFile(out+'/coordinates.json',JSON.stringify({time:w.time,point:rebirthCandidates(w)[0],occupied:{x:w.cities[0].x,y:w.cities[0].y}}));console.log('Synthetic frozen defeat + initial protection generated at '+out);
}finally{await server.close();}
