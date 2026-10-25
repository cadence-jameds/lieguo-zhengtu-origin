// Synthetic fixtures only. No player saves or changes to production rules.
// node scripts/prepare-research-ui-fixtures.mjs /tmp/research-fixtures
import 'fake-indexeddb/auto';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out=process.argv[2];if(!out)throw Error('Provide a temporary output directory.');await fs.mkdir(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
 const {createFormalWorld}=await server.ssrLoadModule('/src/game/formal/generator.ts');
 const {submitFormalOrder}=await server.ssrLoadModule('/src/game/formal/reducer.ts');
 const {commandId}=await server.ssrLoadModule('/src/game/formal/ids.ts');
 const {BUILDING_CATALOG,HOUSING}=await server.ssrLoadModule('/src/game/formal/catalogB3.ts');
 const {FormalPersistence}=await server.ssrLoadModule('/src/game/persistence.ts');
 const {retireAutonomy}=await server.ssrLoadModule('/src/game/formal/autonomy.ts');
 const {EventScheduler}=await server.ssrLoadModule('/src/game/formal/scheduler.ts');
 const {changeCityOwner}=await server.ssrLoadModule('/src/game/formal/economy.ts');
 const manifest=[];
 for(const name of ['ready','active','funding']){
  let w=createFormalWorld({campaign:'research-ui-'+name,seed:90217,speed:1,offlineHours:0});
  const scheduler=new EventScheduler(w.events);retireAutonomy(w,scheduler);w.events=scheduler.snapshot();
  const c=w.cities[0],f=w.factions[0];f.age=3;f.techIds=['blacksmith.melee.1'];
  c.population=15000;c.housing=400+HOUSING[15];c.economy.milestones=[10000,15000];
  for(const key of ['academy','blacksmith','barracks','stable','archery','market','workshop','castle','townhall','embassy','mill','residence','warehouse.0','warehouse.1']){
   c.buildings[key]=BUILDING_CATALOG[key.split('.')[0]].maxLevel;c.economy.slots[key]=Object.keys(c.economy.slots).length;
  }
  c.stock={food:150000,wood:150000,stone:150000,gold:150000};
  changeCityOwner(w,w.cities[1],w.playerFactionId,'receive');w.cities[1].integrationWorkHours=0;
  if(name==='funding'){f.modernQualification='full';f.researchCooperation=true;f.techIds.push('research.cooperation');}
  if(name!=='ready'){
   const techId=name==='active'?'military.breeding':'modern.infantry-weapons';
   const t=submitFormalOrder(w,{campaignId:w.campaignId,issuerId:w.playerFactionId,commandId:commandId('research-ui-'+name),expectedRevision:w.revision,issuedWorldTime:w.time,payload:{type:'research.start',cityId:c.id,techId}});
   assert.equal(t.ack.status,'committed',t.ack.reason);w=t.world;
  }
  const store=new FormalPersistence({suffix:'research-ui-'+name});
  try{w=await store.start(w);await fs.writeFile(path.join(out,name+'.realm-save'),await store.exportStoredSave('full'));manifest.push({name,campaignId:w.campaignId,queue:w.factions[0].researchQueue,projects:w.researchProjects});}finally{await store.db.delete();}
 }
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log('Prepared ready, active and funding synthetic saves.');
}finally{await server.close();}
