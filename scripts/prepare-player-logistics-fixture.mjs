// Native synthetic world only, with nearby legal cities and a normal hourly settlement approaching.
import 'fake-indexeddb/auto';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=process.argv[2];if(!out)throw Error('Provide a temporary fixture directory');await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {createFormalWorld}=await server.ssrLoadModule('/src/game/formal/generator.ts'),{submitFormalOrder}=await server.ssrLoadModule('/src/game/formal/reducer.ts'),{commandId}=await server.ssrLoadModule('/src/game/formal/ids.ts'),{changeCityOwner,HOUR}=await server.ssrLoadModule('/src/game/formal/economy.ts'),{buildable,terrainAt}=await server.ssrLoadModule('/src/game/formal/terrain.ts'),{FormalPersistence}=await server.ssrLoadModule('/src/game/persistence.ts');
 let w=createFormalWorld({campaign:'player-logistics-browser',seed:90217,speed:25,offlineHours:0});const c=w.cities[0],d=w.cities[1],host=w.cities[2];c.name='補給甲城';d.name='物流乙城';host.name='奇觀承載城';
 const candidates=[];for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++){const x=c.x+dx,y=c.y+dy;if(x<0||y<0||x>=384||y>=384||Math.abs(dx)+Math.abs(dy)<4||!buildable(terrainAt(w,x,y))||w.cities.some(v=>v.x===x&&v.y===y)||w.worldLayer.wildSites.some(v=>v.x===x&&v.y===y))continue;candidates.push({x,y});}assert.ok(candidates.length>=2);Object.assign(d,candidates[0]);Object.assign(host,candidates.at(-1));
 w=structuredClone(w);changeCityOwner(w,w.cities[1],w.playerFactionId,'receive');w.cities[1].integrationWorkHours=0;
 function build(city,key,level){city.buildings[key]=level;if(key!=='center')city.economy.slots[key]=Object.keys(city.economy.slots).length;}
 for(const city of [w.cities[0],w.cities[1],w.cities[2]]){build(city,'embassy',15);build(city,'market',6);build(city,'warehouse.0',15);}
 w.cities[0].stock={food:20000,wood:16000,stone:12000,gold:10000};w.cities[1].stock={food:0,wood:0,stone:0,gold:0};w.factions[0].age=3;w.factions[0].techIds.push('logistics.auto');w.factions.find(f=>f.id===host.ownerFactionId).age=2;
 let serial=0;function issue(payload,issuer=w.playerFactionId){const t=submitFormalOrder(w,{commandId:commandId('logistics-browser-'+(++serial)),campaignId:w.campaignId,issuerId:issuer,issuedWorldTime:w.time,expectedRevision:w.revision,payload});assert.equal(t.ack.status,'committed',t.ack.reason);w=t.world;}
 issue({type:'politics',cityId:c.id,action:'legion-create',name:'甲'});issue({type:'politics',cityId:host.id,action:'legion-create',name:'乙'},host.ownerFactionId);issue({type:'politics',cityId:c.id,action:'empire-propose',target:host.ownerFactionId,name:'物流驗證帝國'});issue({type:'politics',cityId:host.id,action:'request-accept',requestId:w.politics.requests[0].id},host.ownerFactionId);issue({type:'wonder.start',cityId:c.id,hostCityId:host.id});
 w.time=HOUR-600000;
 const store=new FormalPersistence({suffix:'player-logistics-browser'});try{w=await store.start(w);await fs.writeFile(path.join(out,'logistics.realm-save'),await store.exportStoredSave('full'));await fs.writeFile(path.join(out,'plan.json'),JSON.stringify({source:c.id,destination:d.id,host:host.id,projectId:w.largeProjects[0].projectId,reserve:{food:8000,wood:6000,stone:4000,gold:2000},generalCaravans:1,wonderCaravans:2,manualCaravans:3},null,2));}finally{await store.db.delete();}
}finally{await server.close();}
