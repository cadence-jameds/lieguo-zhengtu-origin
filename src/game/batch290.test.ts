import {it,expect} from 'vitest';
import {newGame,route,terrainAt} from './legacyWorld';
import {tileReason} from './settlement';
import {travelRoute} from './travel';

it('山脈擋住建城與行軍，河流仍可行軍但不能建城',()=>{
 const g=newGame('civ_byzantion',902,1,0),version=g.terrainVersion;
 const mountain=Array.from({length:256*256},(_,i)=>({x:i%256,y:Math.floor(i/256)}))
  .find(p=>p.x>7&&p.x<248&&terrainAt(p.x,p.y,g.seed,version)==='mountain'
    &&terrainAt(p.x-7,p.y,g.seed,version)!=='mountain'&&terrainAt(p.x+7,p.y,g.seed,version)!=='mountain')!;
 expect(mountain).toBeDefined();expect(tileReason(g,mountain)).toContain('山脈');
 const a={x:mountain.x-7,y:mountain.y},b={x:mountain.x+7,y:mountain.y};
 for(const path of [route(a,b,g.seed,version).path,travelRoute(g,a,b).path]){
  expect(path[0]).toEqual(a);expect(path.at(-1)).toEqual(b);
  expect(path.slice(1,-1).every(p=>terrainAt(p.x,p.y,g.seed,version)!=='mountain')).toBe(true);
 expect(path.length).toBeGreaterThan(15);
 }
 expect(()=>route(mountain,b,g.seed,version)).toThrow('山脈不可通行');
 const water=Array.from({length:256*256},(_,i)=>({x:i%256,y:Math.floor(i/256)}))
  .find(p=>p.x<255&&terrainAt(p.x,p.y,g.seed,version)==='water'&&terrainAt(p.x+1,p.y,g.seed,version)==='water')!;
 expect(tileReason(g,water)).toContain('水域');
 expect(travelRoute(g,water,{x:water.x+1,y:water.y}).path).toHaveLength(2);
 expect(travelRoute(g,water,{x:water.x+1,y:water.y}).cost).toBe(2.2);
 expect(g.nodes.filter(n=>n.owner).every(n=>terrainAt(n.x,n.y,g.seed,version)!=='mountain')).toBe(true);
});
