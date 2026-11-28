import {expect,it,vi} from 'vitest';
import {route} from './routing';
import * as terrain from './terrain';
import {wonderWorld} from './wonderTestSupport';
import type {FormalWorld} from './model';

const W=384;
const world=(set:ReadonlyArray<readonly [number,number,string]>):FormalWorld=>{
 const cells=Array<string>(W*W).fill('L');
 for(const [x,y,tile] of set)cells[y*W+x]=tile;
 return {...wonderWorld(false),dimensions:{width:W,height:W},worldLayer:{regionSize:32,terrain:cells.join(''),wildSites:[]}};
};
it('reuses exact directed geometry and never shares mutable route points',()=>{
 const w=world([[1,0,'W']]),a={x:0,y:0},b={x:1,y:0},spy=vi.spyOn(terrain,'terrainAt');
 try{
  const cold=route(w,a,b);expect(cold).toEqual({path:[a,b],distance:2});expect(spy.mock.calls.length).toBeGreaterThan(0);
  spy.mockClear();cold.path[0].x=222;cold.path.pop();
  const warm=route(w,a,b);expect(warm).toEqual({path:[a,b],distance:2});expect(spy).not.toHaveBeenCalled();
  warm.path[1].x=25;expect(route(w,a,b)).toEqual({path:[a,b],distance:2});
  expect(route(w,b,a)).toEqual({path:[b,a],distance:1});expect(spy).toHaveBeenCalled();
  expect(()=>route(world([[1,0,'M']]),a,b)).toThrow('No traversable route');
  expect(route(world([]),a,b)).toEqual({path:[a,b],distance:1});
 }finally{spy.mockRestore();}
});
it('evicts old directed queries and preserves exact tie-broken geometry after recomputation',()=>{
 const w=world([[0,0,'M']]),a={x:40,y:40},b={x:43,y:42};
 const first=route(w,a,b);
 for(let i=0;i<129;i++){const p={x:150+i%24,y:200+Math.floor(i/24)};route(w,p,{x:p.x+1,y:p.y});}
 const spy=vi.spyOn(terrain,'terrainAt');
 try{expect(route(w,a,b)).toEqual(first);expect(spy).toHaveBeenCalled();}finally{spy.mockRestore();}
});
