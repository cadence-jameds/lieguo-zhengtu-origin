import fs from 'node:fs/promises';
import path from 'node:path';

export async function inspect(page) {
  return page.evaluate(async () => {
    const { FormalDatabase } = await import('/src/game/persistence.ts');
    const db = new FormalDatabase();
    const row = await db.saves.get('current');
    db.close();
    const w = row.data.snapshot;
    return { campaignId:w.campaignId, revision:w.revision, time:w.time, dimensions:w.dimensions, factions:w.factions.length, sites:w.worldLayer.wildSites.length,
      home:w.cities.find(c=>c.ownerFactionId===w.playerFactionId), armies:w.armies.map(a=>({id:a.id,owner:a.ownerFactionId,status:a.status,mission:a.mission,target:a.target,path:a.path,segmentTimes:a.segmentTimes,departedAt:a.departedAt,arrivalAt:a.arrivalAt})),
      battles:w.combat.battles, finalReceipts:w.combat.receipts.filter(r=>r.kind==='final'), governors:w.governors,
      autonomy:w.autonomy?{accepted:w.autonomy.accepted,rejected:w.autonomy.rejected,decisions:w.autonomy.agents.reduce((n,a)=>n+a.decisions,0)}:null };
  });
}

export async function fixtures(page, outDir) {
  const result = await page.evaluate(async () => {
    const { createFormalWorld } = await import('/src/game/formal/generator.ts');
    const { submitFormalOrder, advanceFormal } = await import('/src/game/formal/reducer.ts');
    const { spatial, invalidateSpatial } = await import('/src/game/formal/spatial.ts');
    const { buildable, terrainAt } = await import('/src/game/formal/terrain.ts');
    const { encodeSave } = await import('/src/game/formal/saveCodec.ts');
    const { enableAutonomy } = await import('/src/game/formal/autonomy.ts');
    const { FormalDatabase } = await import('/src/game/persistence.ts');
    const db=new FormalDatabase(),row=await db.saves.get('current');db.close();
    const normal=JSON.stringify(row.data);
    const setup = (campaign) => {
      const w=createFormalWorld({campaign,seed:92049,speed:50,name:'R3受控驗收',offlineHours:0});
      for(const c of w.cities) c.military.units={militia:30};
      for(const c of w.cities.slice(0,3)) {
        c.buildings={'center':10,'warehouse.0':15,residence:15,townhall:1,castle:1};
        c.economy.slots={'warehouse.0':0,residence:1,townhall:2,castle:3};
        c.housing=30400;c.population=15000;c.stock={food:50000,wood:50000,stone:50000,gold:50000};
        w.factions.find(f=>f.id===c.ownerFactionId).age=2;
      }
      const home=w.cities[0],index=spatial(w);let moved=0;
      for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
        if(moved===2)break;const x=home.x+dx,y=home.y+dy;
        if(buildable(terrainAt(w,x,y))&&!index.at(x,y).city&&!index.at(x,y).site){const c=w.cities[++moved];c.x=x;c.y=y;}
      }
      if(moved!==2)throw Error('No nearby legal battle coordinates');
      invalidateSpatial(w);return w;
    };
    let serial=0;
    const issue=(w,source,target,mission,units)=>{
      const c=w.cities[source],t=submitFormalOrder(w,{commandId:'command:r3-browser-'+(++serial),campaignId:w.campaignId,issuerId:c.ownerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,
        payload:{type:'army.dispatch',cityId:c.id,mission,target:{kind:'city',cityId:w.cities[target].id},units}});
      if(t.ack.status!=='committed')throw Error(t.ack.reason);return t.world;
    };
    let w=setup('r3-browser-controlled-100');
    w.cities[1].military.units={militia:40,ram:1};w.cities[2].military.units={};w.cities[2].wallLevel=15;
    w=issue(w,1,2,'conquest',{militia:30,ram:1});w=advanceFormal(w,w.armies[0].arrivalAt).world;
    if(w.combat.battles[0]?.phase!=='siege')throw Error('Expected genuine Lv15 siege');
    w=issue(w,0,4,'raid',{militia:10});
    w=issue(w,1,4,'raid',{militia:5});
    for(let i=3;i<100;i++)w=issue(w,i,i===99?4:i+1,'raid',{militia:10});
    const scene=JSON.stringify(await encodeSave(w));
    const next=advanceFormal(w,w.combat.battles[0].nextRoundAt).world;
    const afterRound=JSON.stringify(await encodeSave(next));
    const ended=advanceFormal(w,w.time+3600000).world;
    const afterFinal=JSON.stringify(await encodeSave(ended));
    // A separate mature scenario lets the actual AI scheduler choose and dispatch.
    let ai=createFormalWorld({campaign:'r3-browser-autonomous',seed:92049,speed:50,name:'R3正式AI決策驗收',offlineHours:0});
    for(const c of ai.cities){c.buildings={center:10,'warehouse.0':15,residence:15,barracks:5};c.economy.slots={'warehouse.0':0,residence:1,barracks:2};c.housing=30400;c.population=2000;c.stock={food:50000,wood:50000,stone:50000,gold:50000};c.military.units={militia:120,scout:15};}
    enableAutonomy(ai);
    let steps=0;
    while(steps++<36){ai=advanceFormal(ai,ai.time+300000).world;if(ai.armies.filter(a=>a.ownerFactionId!==ai.playerFactionId&&a.status==='outbound').length>=5)break;}
    const autonomous=JSON.stringify(await encodeSave(ai));
    return {normal,scene,afterRound,afterFinal,autonomous,meta:{controlled:{armies:w.armies.length,aiArmies:w.armies.filter(a=>a.ownerFactionId!==w.playerFactionId).length,battles:w.combat.battles,home:w.cities[0],target:w.cities[2],nextBattles:next.combat.battles,endedBattles:ended.combat.battles,finalReceipts:ended.combat.receipts.filter(r=>r.kind==='final')},autonomous:{steps,time:ai.time,armies:ai.armies.map(a=>({id:a.id,owner:a.ownerFactionId,status:a.status,mission:a.mission,path:a.path,arrivalAt:a.arrivalAt,departedAt:a.departedAt,target:a.target})),accepted:ai.autonomy.accepted,rejected:ai.autonomy.rejected,decisionCount:ai.autonomy.agents.reduce((n,a)=>n+a.decisions,0),receipts:ai.commandReceipts.filter(r=>r.commandId.startsWith('command:ai-')).map(r=>({commandId:r.commandId,issuer:r.issuerId}))}}};
  });
  for(const [key,file] of Object.entries({normal:'normal-new-game.realm-save',scene:'controlled-100-siege.realm-save',afterRound:'controlled-next-siege-round.realm-save',afterFinal:'controlled-final.realm-save',autonomous:'autonomous-ai.realm-save'}))await fs.writeFile(path.join(outDir,file),result[key]);
  await fs.writeFile(path.join(outDir,'scenario-metadata.json'),JSON.stringify(result.meta,null,2));
  return {controlled:{armies:result.meta.controlled.armies,aiArmies:result.meta.controlled.aiArmies,battle:result.meta.controlled.battles.map(b=>({id:b.id,phase:b.phase,nextRoundAt:b.nextRoundAt})),target:{x:result.meta.controlled.target.x,y:result.meta.controlled.target.y},nextPhase:result.meta.controlled.nextBattles[0]?.phase,finalBattles:result.meta.controlled.endedBattles.length},autonomous:{time:result.meta.autonomous.time,armies:result.meta.autonomous.armies.length,accepted:result.meta.autonomous.accepted,decisions:result.meta.autonomous.decisionCount}};
}

export async function importFixture(page,outDir,file) {
  await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'戰役設定'}).click();
  await page.locator('input[type=file]').setInputFiles(path.join(outDir,file));
  await page.getByRole('button',{name:'確認匯入',exact:true}).click();
  await page.locator('.formal-city-panel').waitFor();
  return inspect(page);
}

export async function mapTarget(page,x,y) {
  await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'世界地圖'}).click();
  await page.getByRole('button',{name:'展開地圖工具',exact:true}).click();
  await page.getByRole('button',{name:/XY.*定位/}).click();
  await page.getByLabel('X 座標').fill(String(x));await page.getByLabel('Y 座標').fill(String(y));
  await page.getByRole('button',{name:'前往',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('.map-overlay').dataset.armyOverlay).visibleBattles>=1);
  return page.locator('.map-overlay').evaluate(el=>({...el.dataset}));
}
