import {describe,expect,it} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {spatial} from '../formal/spatial';
import {buildable,terrainAt} from '../formal/terrain';
import {projectId} from '../formal/ids';
import {settlementSiteReason} from './settlementSite';

describe('settlement map picker preview',()=>{
 it('offers only buildable, unoccupied and unreserved map cells',()=>{
  const w=createFormalWorld({campaign:'settlement-site-preview',seed:90217});
  expect(settlementSiteReason(w, {x:-1,y:0})).toBe('超出世界地圖範圍');
  expect(settlementSiteReason(w, {x:4,y:.5})).toBe('超出世界地圖範圍');
  expect(settlementSiteReason(w,w.cities[0])).toBe('此地格已有城市或據點');
  const idx=spatial(w);
  let free:{x:number;y:number}|undefined, blocked:{x:number;y:number}|undefined;
  for(let y=0;y<w.dimensions.height&&(!free||!blocked);y++)for(let x=0;x<w.dimensions.width&&(!free||!blocked);x++){
   const cell=idx.at(x,y);
   if(cell.city||cell.site||cell.reservation)continue;
   if(buildable(terrainAt(w,x,y)))free??={x,y};else blocked??={x,y};
  }
  expect(free).toBeDefined();expect(blocked).toBeDefined();
  expect(settlementSiteReason(w,blocked!)).toBe('此地形不可建城');
  expect(settlementSiteReason(w,free!)).toBeUndefined();
  idx.reserve(free!.x,free!.y,projectId('site-test'));
  expect(settlementSiteReason(w,free!)).toBe('此地格已被其他拓殖隊預約');
 });
});
