import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createFormalWorld} from './generator';
import {terrainAt,passable,buildable,generateTerrain} from './terrain';
import {mountainFootprint,migrateMountains} from './mountains';
import {route} from './routing';
import {encodeSave,decodeSave} from './saveCodec';
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
it('legacy migration keeps cities/sites, in-flight army routes/timers/receipts and protected diagonal neighbours intact',async()=>{
 let w=legacy();const c=rich(w);c.military!.units={militia:20};const projected=make().worldLayer!.mountains!.sprites.flatMap(mountainFootprint).find(p=>buildable(terrainAt(w,p.x,p.y))&&!spatial(w).at(p.x,p.y).city&&!spatial(w).at(p.x,p.y).site)!;w.cities[1].x=projected.x;w.cities[1].y=projected.y;invalidateSpatial(w);w=dispatch(w,'raid',{militia:5}).world;const before=structuredClone(w),original=JSON.stringify(w),migrated=(await decodeSave(await encodeSave(w))).world;expect(JSON.stringify(w)).toBe(original);expect(migrated.metadata.terrainVersion).toBe(3);expect(migrated.cities).toEqual(before.cities);expect(migrated.worldLayer!.wildSites).toEqual(before.worldLayer!.wildSites);expect(migrated.armies).toEqual(before.armies);expect(migrated.events).toEqual(before.events);expect(migrated.commandReceipts).toEqual(before.commandReceipts);
 for(const a of migrated.armies)for(const p of a.path!){expect(passable(terrainAt(migrated,p.x,p.y))).toBe(true);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)if(passable(terrainAt(before,p.x+dx,p.y+dy)))expect(passable(terrainAt(migrated,p.x+dx,p.y+dy))).toBe(true);}
 expect(buildable(terrainAt(migrated,projected.x,projected.y))).toBe(true);validateFormalWorld(migrated);const reloaded=(await decodeSave(await encodeSave(migrated))).world;expect(reloaded).toEqual(migrated);mkdirSync('docs/terrain-v03031',{recursive:true});writeFileSync('docs/terrain-v03031/legacy-migration.json',JSON.stringify({oldVersion:2,newVersion:3,citiesPreserved:true,sitesPreserved:true,armyRoutesAndTimersPreserved:true,oldTerrain:before.worldLayer!.terrain,newTerrain:migrated.worldLayer!.terrain,mountains:migrated.worldLayer!.mountains},null,2));
});
it('corrupt envelopes and forged mountain footprints fail validation before migration',async()=>{
 const old=await encodeSave(legacy());old.checksum='0'.repeat(64);await expect(decodeSave(old)).rejects.toThrow('檢查碼');const w=make(),d=w.worldLayer!.mountains!.sprites[0],p=mountainFootprint(d)[0];w.worldLayer!.terrain=w.worldLayer!.terrain.slice(0,p.y*384+p.x)+'L'+w.worldLayer!.terrain.slice(p.y*384+p.x+1);expect(()=>validateFormalWorld(w)).toThrow();
});
it('legacy IndexedDB load persists matching geometry atomically and preserves the old save on write fault',async()=>{
 for(const fail of [false,true]){let armed=false;const db=new FormalPersistence({suffix:'mountains31-'+crypto.randomUUID(),fault:p=>{if(armed&&fail&&p==='world-write')throw Error('mountain-write-fault');}});try{const old=await db.start(legacy()),rows=await db.db.saves.toArray();armed=true;if(fail){await expect(db.loadWithOffline(Date.now())).rejects.toThrow('mountain-write-fault');expect(await db.db.saves.toArray()).toEqual(rows);}else{const loaded=await db.loadWithOffline(Date.now());expect(loaded.game!.metadata.terrainVersion).toBe(3);expect(loaded.game!.cities.map(c=>[c.id,c.x,c.y])).toEqual(old.cities.map(c=>[c.id,c.x,c.y]));expect((await db.loadSave()).game!.worldLayer).toEqual(loaded.game!.worldLayer);}}finally{await db.db.delete();}}
});
