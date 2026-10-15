import {it,expect} from 'vitest';
import {route} from './routing';
import {passable,buildable,terrainAt} from './terrain';
import {battlefield,dispatch} from './combatTestSupport';
import {isMissionArmy} from './combatModel';
import {encodeSave,decodeSave} from './saveCodec';
import {validateFormalWorld} from './schema';
import {advanceFormal} from './reducer';
import type {FormalWorld} from './model';

function grid(rows:string[]){return {dimensions:{width:rows[0].length,height:rows.length},worldLayer:{terrain:rows.join('')}} as FormalWorld;}
it('D2 water passes at twice land time; mountain blocks; river rule is unchanged',()=>{
 expect(passable('water')).toBe(true);for(const t of ['water','mountain','river'] as const)expect(buildable(t)).toBe(false);
 expect(passable('mountain')).toBe(false);expect(passable('river')).toBe(true);
 expect(route(grid(['LWWL']),{x:0,y:0},{x:3,y:0}).distance).toBe(5);
 expect(route(grid(['LRRL']),{x:0,y:0},{x:3,y:0}).distance).toBe(3);
 expect(()=>route(grid(['LML']),{x:0,y:0},{x:2,y:0})).toThrow('No traversable route');
 expect(()=>route(grid(['LM','ML']),{x:0,y:0},{x:1,y:1})).toThrow('No traversable route');
});
it('D2 weighted A* chooses faster land detour rather than shorter water route',()=>{
 const w=grid(['LLLLLLL','LWWWWWL','LLLLLLL']),r=route(w,{x:0,y:1},{x:6,y:1});
 expect(r.distance).toBeLessThan(11);expect(r.path.slice(1,-1).every(p=>terrainAt(w,p.x,p.y)==='land')).toBe(true);
 expect(route(w,{x:0,y:1},{x:6,y:1})).toEqual(r);
});
it.each([1,10,50] as const)('D2 real military snapshots use weighted segment times at %sX and survive SaveLoad/slicing',async speed=>{
 let w=battlefield();w.speed=speed;w.offlineHours=0;
 const home=w.cities[0],cells=w.worldLayer!.terrain.split('');
 // Water around the home forces every new route to pay the approved cost.
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy){
  const x=home.x+dx,y=home.y+dy;
  if(!w.cities.some(c=>c.x===x&&c.y===y)&&!w.worldLayer!.wildSites.some(s=>s.x===x&&s.y===y))cells[y*384+x]='W';
 }
 w.worldLayer!.terrain=cells.join('');
 w.cities[0].military!.units={militia:20};w.cities[1].military!.units={};
 w=dispatch(w,'raid',{militia:10}).world;const a=w.armies.filter(isMissionArmy)[0];
 let ms=0;for(let i=1;i<a.path.length;i++){const p=a.path[i],prev=a.path[i-1];ms+=Math.hypot(p.x-prev.x,p.y-prev.y)*(terrainAt(w,p.x,p.y)==='water'?2:1)*a.marchSecondsPerTile*1000;expect(a.segmentTimes[i]).toBe(Math.ceil(ms));}
 expect(a.path.some(p=>terrainAt(w,p.x,p.y)==='water')).toBe(true);
 expect(a.arrivalAt).toBe(w.time+Math.ceil(ms));
 const loaded=(await decodeSave(await encodeSave(w))).world;expect(loaded).toEqual(w);validateFormalWorld(loaded);
 const forged=structuredClone(w),bad=forged.armies.filter(isMissionArmy)[0];delete bad.marchTerrainVersion;
 expect(()=>validateFormalWorld(forged)).toThrow();
 const before=advanceFormal(loaded,a.arrivalAt-1),direct=advanceFormal(w,a.arrivalAt),sliced=advanceFormal(before.world,a.arrivalAt);
 expect(sliced.world.armies).toEqual(direct.world.armies);expect(sliced.reports).toEqual(direct.reports);
});
it('D2 unversioned existing land march retains exact original path, deadlines and IDs',async()=>{
 let w=battlefield();w.cities[0].military!.units={militia:20};w=dispatch(w,'raid',{militia:10}).world;
 const a=w.armies.filter(isMissionArmy)[0];delete (a as typeof a&{marchTerrainVersion?:number}).marchTerrainVersion;
 const old=structuredClone(w);expect((await decodeSave(await encodeSave(w))).world).toEqual(old);
});
