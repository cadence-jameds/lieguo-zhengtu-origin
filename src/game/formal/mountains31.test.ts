import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {createFormalWorld} from './generator';
import {terrainAt,passable,buildable,generateTerrain} from './terrain';
import {mountainFootprint,migrateMountains} from './mountains';
import {route} from './routing';
import {encodeSave,decodeSave,OLD_CAMPAIGN_MESSAGE} from './saveCodec';
import {digest} from './canonical';
import {FORMAL_SAVE_FORMAT} from './versions';
import {validateFormalWorld} from './schema';
import {FormalPersistence} from '../persistence';
import {spatial,invalidateSpatial} from './spatial';
import {build,rich,order,commit} from './developmentTestSupport';
import {dispatch} from './combatTestSupport';
import {advanceFormal,submitFormalOrder} from './reducer';
import type {FormalWorld} from './model';
const make=(seed=90217)=>createFormalWorld({campaign:'mountains31-'+seed,seed});
function legacy(){const w=make();if(w.metadata.schemaVersion!==3)throw Error('native expected');w.metadata={...w.metadata,terrainVersion:2};w.worldLayer!.terrain=generateTerrain(w.seed);delete w.worldLayer!.mountains;return w;}
function addedPoint(w:FormalWorld){const base=generateTerrain(w.seed);return w.worldLayer!.mountains!.sprites.flatMap(mountainFootprint).find(p=>['L','F'].includes(base[p.y*384+p.x])&&!spatial(w).at(p.x,p.y).city&&!spatial(w).at(p.x,p.y).site)!;}
it('every rendered mountain footprint is forbidden to route and settle, including formerly legal projected cells',()=>{
 for(const seed of [0,1,90217,4294967295]){const w=make(seed),profile=w.worldLayer!.mountains!;expect(w.metadata.terrainVersion).toBe(3);expect(profile.sprites.length).toBeGreaterThan(30);for(const d of profile.sprites)for(const p of mountainFootprint(d)){expect(terrainAt(w,p.x,p.y)).toBe('mountain');expect(passable(terrainAt(w,p.x,p.y))).toBe(false);expect(buildable(terrainAt(w,p.x,p.y))).toBe(false);}const p=addedPoint(w);expect(p).toBeDefined();expect(()=>route(w,w.cities[0],p)).toThrow('No traversable route');for(const n of [...w.cities,...w.worldLayer!.wildSites])expect(buildable(terrainAt(w,n.x,n.y))).toBe(true);}
},15000);
it('the real settlement command rejects a mountain-covered target without spending or losing the ready unit',()=>{
 let w=make();const c=rich(w);w.factions[0].age=2;build(c,'castle',1);c.military!.units={spearman:30};w=commit(w,{type:'settlement.prepare',cityId:c.id});w=advanceFormal(w,4*3600000).world;const target=addedPoint(w),before=JSON.stringify(w),t=submitFormalOrder(w,order(w,{type:'settlement.dispatch',cityId:c.id,...target,name:'禁止山地城',escort:{spearman:20}}));expect(t.ack?.status).toBe('rejected');expect(t.ack?.reason).toContain('可建城');expect(JSON.stringify(w)).toBe(before);
});
it('seed/profile/terrain remain immutable across save/load, world time and site lifecycle data changes',async()=>{
 const w=make(),terrain=w.worldLayer!.terrain,profile=structuredClone(w.worldLayer!.mountains);const loaded=(await decodeSave(await encodeSave(w))).world;expect(loaded.worldLayer!.terrain).toBe(terrain);expect(loaded.worldLayer!.mountains).toEqual(profile);loaded.time=123;loaded.worldLayer!.wildSites[0].generation++;expect(migrateMountains(loaded)).toBe(loaded);expect(loaded.worldLayer!.mountains).toEqual(profile);
});
async function oldEnvelope(w:FormalWorld){const snapshot=structuredClone(w);snapshot.metadata={...snapshot.metadata,contentVersion:'lieguo-formal-b5.2'} as unknown as FormalWorld['metadata'];return {format:FORMAL_SAVE_FORMAT,metadata:{...snapshot.metadata},snapshot,checksum:await digest(snapshot)};}
it('old terrain campaigns are rejected without changing cities/sites, in-flight routes/timers, receipts or diagonal neighbours',async()=>{
 let w=legacy();const c=rich(w);c.military!.units={militia:20};const projected=make().worldLayer!.mountains!.sprites.flatMap(mountainFootprint).find(p=>buildable(terrainAt(w,p.x,p.y))&&!spatial(w).at(p.x,p.y).city&&!spatial(w).at(p.x,p.y).site)!;w.cities[1].x=projected.x;w.cities[1].y=projected.y;invalidateSpatial(w);w=dispatch(w,'raid',{militia:5}).world;
 const before=structuredClone(w),raw=await oldEnvelope(w),archive=structuredClone(raw);await expect(decodeSave(raw)).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);await expect(encodeSave(w)).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);expect(w).toEqual(before);expect(raw).toEqual(archive);
 expect(w.cities).toEqual(before.cities);expect(w.worldLayer!.wildSites).toEqual(before.worldLayer!.wildSites);expect(w.armies).toEqual(before.armies);expect(w.events).toEqual(before.events);expect(w.commandReceipts).toEqual(before.commandReceipts);expect(w.metadata.terrainVersion).toBe(2);expect(w.worldLayer!.mountains).toBeUndefined();
 for(const a of w.armies)for(const p of a.path!){expect(passable(terrainAt(w,p.x,p.y))).toBe(true);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)expect(terrainAt(w,p.x+dx,p.y+dy)).toBe(terrainAt(before,p.x+dx,p.y+dy));}expect(buildable(terrainAt(w,projected.x,projected.y))).toBe(true);
});
it('current checksum corruption and forged mountain footprints still fail; old corrupt campaigns stay blocked before migration',async()=>{
 const old=await oldEnvelope(legacy());old.checksum='0'.repeat(64);await expect(decodeSave(old)).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);const current=await encodeSave(make());current.checksum='0'.repeat(64);await expect(decodeSave(current)).rejects.toThrow('檢查碼');const w=make(),d=w.worldLayer!.mountains!.sprites[0],p=mountainFootprint(d)[0];w.worldLayer!.terrain=w.worldLayer!.terrain.slice(0,p.y*384+p.x)+'L'+w.worldLayer!.terrain.slice(p.y*384+p.x+1);expect(()=>validateFormalWorld(w)).toThrow();
});
it('old IndexedDB terrain campaigns reject load/import/Recovery without any write or geometry migration',async()=>{
 let writes=0;const db=new FormalPersistence({suffix:'old-mountains-'+crypto.randomUUID(),fault:p=>{if(p==='world-write'){writes++;throw Error('must not write old campaign');}}});
 try{const data=await oldEnvelope(legacy());await db.db.saves.put({id:'current',kind:'world',at:1000,data});const id=await db.db.backups.add({at:1000,label:'舊版山脈',campaignId:data.snapshot.campaignId,gameTime:data.snapshot.time,reportCursor:data.snapshot.sequences.report,data});const snapshot=async()=>[await db.db.saves.toArray(),await db.db.backups.toArray(),await db.db.BattleReports.toArray()],before=await snapshot();
  await expect(db.loadWithOffline(2000)).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);expect(await snapshot()).toEqual(before);await expect(db.importSave(JSON.stringify(data))).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);expect(await snapshot()).toEqual(before);await expect(db.restore(id)).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);expect(await snapshot()).toEqual(before);expect(writes).toBe(0);
 }finally{await db.db.delete();}
});
