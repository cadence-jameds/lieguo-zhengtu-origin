// Native-browser synthetic fixture/formal-load validation; not part of the game bundle.
import {createFormalWorld} from '../../src/game/world';
import {encodeSave} from '../../src/game/formal/saveCodec';
import {FormalPersistence} from '../../src/game/persistence';
import {submitFormalOrder} from '../../src/game/formal/reducer';
import {commandId} from '../../src/game/formal/ids';
import {HOUSING} from '../../src/game/formal/catalogB3';
import type {FormalCommand} from '../../src/game/formal/model';
self.onmessage=async e=>{try{
 if(e.data.op==='validate'){
  const p=new FormalPersistence(),loaded=await p.loadSave(),current=await p.db.saves.get('current'),authority:any=await p.db.saves.get('authority'),backups=await p.db.backups.toArray(),inbox=await p.db.Inbox.toArray();
  const w=loaded.game,c=w?.cities.find(c=>c.ownerFactionId===w.playerFactionId);self.postMessage({result:{valid:!!w&&!loaded.recovered,at:current?.kind==='world'?current.at:null,savedAt:authority?.savedAt,recovery:authority?.recovery.map((r:any)=>({at:r.at,checkpointAt:backups.find(b=>b.id===r.id)?.at})),revision:w?.revision,time:w?.time,city:c?{stock:c.stock,construction:c.economy?.construction.length,training:c.military?.queue.length,fieldLevels:c.fields?.map(f=>f.level)}:null,research:w?.researchProjects.filter(p=>p.phase!=='completed').length,ai:w?.autonomy?.agents.length,inbox:inbox.map(r=>({id:r.commandId,state:r.state,type:r.order.payload.type}))}});p.db.close();return;
 }
 let w=createFormalWorld({campaign:crypto.randomUUID(),seed:884422,speed:e.data.speed??25,name:'背景保存驗證',civilizationId:'civ_zhongguo',offlineHours:1});const c=w.cities.find(c=>c.ownerFactionId===w.playerFactionId)!;c.stock={food:600,wood:600,stone:600,gold:600};
 if(e.data.jobs){
  const build=(key:string,level:number)=>{c.buildings[key]=level;if(key!=='center'&&c.economy!.slots[key]===undefined)c.economy!.slots[key]=Object.keys(c.economy!.slots).length;};
  for(const [key,level] of [['center',10],['warehouse.0',15],['residence',15],['academy',1],['blacksmith',1],['barracks',1],['townhall',1]] as const)build(key,level);c.housing=400+HOUSING[15];c.population=15000;c.stock={food:100000,wood:100000,stone:100000,gold:100000};w.factions.find(f=>f.id===w.playerFactionId)!.age=1;c.fields![0].level=8;
  const commands:FormalCommand[]=[{type:'field.upgrade',cityId:c.id,slot:0},{type:'military.recruit',cityId:c.id,unitId:'militia',count:100},{type:'research.start',cityId:c.id,techId:'blacksmith.melee.1'}];
  for(const [i,payload]of commands.entries()){const result=submitFormalOrder(w,{commandId:commandId('background-fixture-'+i),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload});if(result.ack?.status!=='committed')throw Error('Fixture command: '+result.ack?.reason);w=result.world;}
 }
 self.postMessage({result:await encodeSave(w)});
}catch(error){self.postMessage({error:String(error)});}};
