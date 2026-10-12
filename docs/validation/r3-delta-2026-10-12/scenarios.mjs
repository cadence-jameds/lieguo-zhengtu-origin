import fs from 'node:fs/promises';
import path from 'node:path';
export async function state(page){return page.evaluate(async()=>{const databases=await indexedDB.databases(),name=databases.find(d=>d.name?.includes('formal'))?.name;if(!name)throw Error('Formal database missing');const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const row=await new Promise((resolve,reject)=>{const r=db.transaction('saves','readonly').objectStore('saves').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return row.data.snapshot;});}
export async function load(page,outDir,file){
 const n=await page.evaluate(()=>window.__runtime.filter(e=>e.type==='switched').length);
 await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'戰役設定'}).click();
 await page.locator('input[type=file]').setInputFiles(path.join(outDir,file));
 await page.getByRole('button',{name:'確認匯入',exact:true}).click();
 await page.waitForFunction(n=>window.__runtime.filter(e=>e.type==='switched').length>n,n);
 await page.locator('.formal-city-panel').waitFor();return state(page);
}
export async function center(page,x,y){
 await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'世界地圖'}).click();
 if(await page.getByRole('button',{name:'展開地圖工具',exact:true}).count())await page.getByRole('button',{name:'展開地圖工具',exact:true}).click();
 await page.getByRole('button',{name:/XY.*定位/}).click();
 await page.getByLabel('X 座標').fill(String(x));await page.getByLabel('Y 座標').fill(String(y));await page.getByRole('button',{name:'前往',exact:true}).click();
 await page.locator('.map-overlay').waitFor();return page.locator('.map-overlay').evaluate(el=>({...el.dataset}));
}
export async function generate(page,outDir){
 const old=JSON.parse(await fs.readFile(path.resolve(outDir,'../r3-local-2026-10-12/controlled-100-siege.realm-save'),'utf8'));
 const result=await page.evaluate(async old=>{
  const {createFormalWorld}=await import('/src/game/formal/generator.ts');
  const {submitFormalOrder,advanceFormal}=await import('/src/game/formal/reducer.ts');
  const {encodeSave,decodeSave}=await import('/src/game/formal/saveCodec.ts');
  const {terrainAt,buildable}=await import('/src/game/formal/terrain.ts');
  const {spatial,invalidateSpatial}=await import('/src/game/formal/spatial.ts');
  const {createExile}=await import('/src/game/formal/extinction.ts');
  const {changeCityOwner}=await import('/src/game/formal/economy.ts');
  const {CivilianCache,civilianRoutes}=await import('/src/game/presentation/civilianOverlay.ts');
  const out={},meta={};let serial=0;
  const issue=(w,p)=>{const t=submitFormalOrder(w,{commandId:'command:delta-'+(++serial),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload:p});if(t.ack.status!=='committed')throw Error(JSON.stringify({p,ack:t.ack}));return t.world;};
  const build=(c,key,level)=>{c.buildings[key]=level;if(key!=='center'&&c.economy.slots[key]===undefined)c.economy.slots[key]=Object.keys(c.economy.slots).length;if(key==='residence')c.housing=30400;};
  const rich=c=>{build(c,'center',10);build(c,'warehouse.0',15);build(c,'residence',15);build(c,'townhall',5);build(c,'academy',5);build(c,'market',5);c.population=15000;c.stock={food:50000,wood:50000,stone:50000,gold:50000};c.military.units={militia:1000};};
  const open=(w,near,r=12)=>{const index=spatial(w);for(let d=r;d<r+10;d++)for(let y=Math.max(0,near.y-d);y<=Math.min(383,near.y+d);y++)for(let x=Math.max(0,near.x-d);x<=Math.min(383,near.x+d);x++){if(Math.max(Math.abs(x-near.x),Math.abs(y-near.y))!==d)continue;const p=index.at(x,y);if(buildable(terrainAt(w,x,y))&&!p.city&&!p.site&&!p.reservation)return{x,y};}throw Error('no legal tile');};
  for(const speed of [1,10,50])for(const dense of [false,true]){const w=dense?(await decodeSave(old)).world:createFormalWorld({campaign:'delta-low-'+speed,seed:92049,speed,offlineHours:0});w.campaignId='campaign:delta-matrix-'+speed+'-'+dense;w.speed=speed;rich(w.cities[0]);out['matrix-'+speed+'-'+dense+'.realm-save']=JSON.stringify(await encodeSave(w));}
  let w=createFormalWorld({campaign:'delta-civilians',seed:92049,speed:50,offlineHours:0});rich(w.cities[0]);build(w.cities[0],'castle',1);w.factions[0].age=2;
  const home=w.cities[0],dest=w.cities[1],point=open(w,home,12);changeCityOwner(w,dest,w.playerFactionId,'receive');dest.x=point.x;dest.y=point.y;dest.integrationWorkHours=0;rich(dest);dest.stock={food:1000,wood:1000,stone:1000,gold:1000};invalidateSpatial(w);
  const source=w.factions.find(f=>f.civilizationId==='civ_japan');createExile(w,source.id,{scout:4},[],open(w,home,3));
  const site=w.extinction.sites[0];w=issue(w,{type:'army.dispatch',cityId:home.id,mission:'raid',target:{kind:'wild',siteId:site.id,generation:0},units:{militia:500}});w=advanceFormal(w,w.armies[0].arrivalAt).world;w=advanceFormal(w,w.armies[0].arrivalAt).world;
  w=issue(w,{type:'settlement.prepare',cityId:home.id});const prep=w.settlements[0];w=advanceFormal(w,prep.startedAt+prep.prepDurationMs).world;
  w=issue(w,{type:'craftsman.move',cityId:home.id,craftsmanId:w.extinction.craftsmen[0].id,destinationCityId:dest.id});
  w=issue(w,{type:'logistics.dispatch',cityId:home.id,destinationCityId:dest.id,resources:{food:100,wood:0,stone:0,gold:0}});
  const target=open(w,home,10);w=issue(w,{type:'settlement.dispatch',cityId:home.id,...target,name:'R3拓殖驗收',escort:{militia:20}});
  createExile(w,source.id,{militia:12},[],open(w,home,4));meta.civilians={home:w.cities[0],destination:w.cities[1],exile:w.extinction.sites.at(-1),routes:civilianRoutes(w,new CivilianCache())};out['civilians.realm-save']=JSON.stringify(await encodeSave(w));
  const civs=[...new Set(w.factions.map(f=>f.civilizationId))];meta.castles=[];
  for(let i=0;i<civs.length;i++){
   let c=createFormalWorld({campaign:'delta-castle-'+i,seed:92049,speed:1,offlineHours:0,civilizationId:civs[(i+1)%civs.length]});rich(c.cities[0]);c.factions[0].age=2;const f=c.factions.find(f=>f.civilizationId===civs[i]);createExile(c,f.id,{scout:4},[],open(c,c.cities[0],2));const s=c.extinction.sites[0];
   c=issue(c,{type:'army.dispatch',cityId:c.cities[0].id,mission:'raid',target:{kind:'wild',siteId:s.id,generation:0},units:{militia:500}});c=advanceFormal(c,c.armies[0].arrivalAt).world;c=advanceFormal(c,c.armies[0].arrivalAt).world;
   c=issue(c,{type:'craftsman.castle',cityId:c.cities[0].id,craftsmanId:c.extinction.craftsmen[0].id});const job=c.cities[0].economy.construction[0];c=advanceFormal(c,job.startsAt+job.durationMs).world;
   if(c.cities[0].castleCivilizationId!==civs[i])throw Error('castle mismatch');out['castle-'+i+'.realm-save']=JSON.stringify(await encodeSave(c));meta.castles.push({file:'castle-'+i+'.realm-save',owner:c.factions[0].civilizationId,source:civs[i],city:c.cities[0].id,slots:c.cities[0].economy.slots});
  }
  let raid=createFormalWorld({campaign:'delta-raid',seed:92049,speed:50,offlineHours:0});rich(raid.cities[0]);const targetCity=raid.cities[1],p=open(raid,raid.cities[0],8);targetCity.x=p.x;targetCity.y=p.y;targetCity.military.units={};invalidateSpatial(raid);raid=issue(raid,{type:'army.dispatch',cityId:raid.cities[0].id,mission:'raid',target:{kind:'city',cityId:targetCity.id},units:{militia:100}});meta.raid={home:raid.cities[0],target:targetCity,army:raid.armies[0]};out['raid.realm-save']=JSON.stringify(await encodeSave(raid));
  return{out,meta};
 },old);
 for(const [file,value] of Object.entries(result.out))await fs.writeFile(path.join(outDir,file),value);
 await fs.writeFile(path.join(outDir,'scenario-metadata.json'),JSON.stringify(result.meta,null,2));return result.meta;
}
