import {expect,it} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {spatial} from '../formal/spatial';
import {showMapCaption} from '../mapDisplay';
import {project} from './mapGeometry';
import {paintTerrainOverview,overviewZoom} from './mapPaint';
import {detailedMap,visibleWildSite,mapMarkerSize,mapNodeSize,mapPickBounds,mapHit,overviewGeometry} from './mapViewRules';
const w=createFormalWorld({campaign:'overview-rules',seed:90217});

it('a fitted mobile/desktop 384 overview uses small markers; DEMO 13% and normal views retain art dimensions',()=>{
 for(const [width,height] of [[360,640],[393,500],[699,841],[1440,900]]){
  const z=overviewZoom(w,width,height);expect(15360*z).toBeLessThanOrEqual(width-40);expect(7680*z).toBeLessThanOrEqual(height-40);expect(detailedMap(z)).toBe(false);expect(mapMarkerSize(z).width*2).toBeLessThanOrEqual(6);
 }
 for(const z of [.12,.13,.22,.5,.75,1,2]){expect(detailedMap(z)).toBe(true);expect(mapNodeSize(true,z)).toBe(Math.max(7,Math.min(17,z*19)));expect(mapMarkerSize(z)).toEqual({width:28*z+8,height:14*z+4});}
});
it('DEMO wild-site/political visibility and selected/normal level-label thresholds are exact',()=>{
 for(const z of [.02,.12,.22])expect(visibleWildSite(z,false)).toBe(false);
 for(const z of [.220001,.5,2]){expect(visibleWildSite(z,false)).toBe(true);expect(visibleWildSite(z,true)).toBe(false);}
 expect(showMapCaption(false,true,.22,true,false)).toBe(false);
 expect(showMapCaption(false,true,.3,true,true)).toBe(true);
 expect(showMapCaption(false,true,.5,false,false)).toBe(false);
 expect(showMapCaption(false,true,.500001,false,false)).toBe(true);
 expect(showMapCaption(false,true,2,false,true)).toBe(false);
 expect(showMapCaption(false,false,2,true,false)).toBe(false);
 expect(showMapCaption(true,true,2,true,false)).toBe(false);
});
it('a sprite-tip click is queried at DEMO minimum zoom even beyond the old six-cell radius',()=>{
 const c=w.cities[0],cam={...project(c),z:.12},anchor={x:196.5,y:250},pointer={x:anchor.x,y:anchor.y-mapNodeSize(true,cam.z)*2.7};
 expect(mapHit(true,cam.z,anchor,pointer)).toBe(true);
 expect(spatial(w).query(mapPickBounds(cam,393,500,pointer)).cities).toContain(c);
});
it('overview city picking follows the small visible marker instead of the old oversized art hitbox',()=>{
 const anchor={x:100,y:100};expect(mapHit(true,.02,anchor,anchor)).toBe(true);expect(mapHit(true,.02,anchor,{x:100,y:85})).toBe(false);
});
it('first-frame overview covers DEMO 50-cell surroundings and contains real Formal rivers and mountains',()=>{
 const before=JSON.stringify(w),geometry=overviewGeometry(w),p=paintTerrainOverview(w),again=paintTerrainOverview(w);
 expect(geometry).toEqual({origin:{x:-9680,y:-1010},width:19360,height:9680,scale:.075});
 expect(p.width).toBe(484);expect(p.height).toBe(242);expect(p.data).toEqual(again.data);
 let water=0,mountains=0;for(let i=0;i<p.data.length;i+=4){expect(p.data[i+3]).toBe(255);if(p.data[i]===43&&p.data[i+1]===111&&p.data[i+2]===143)water++;if(p.data[i+1]-p.data[i]===4&&p.data[i]-p.data[i+2]===24)mountains++;}
 expect(water).toBeGreaterThan(100);expect(mountains).toBeGreaterThan(20);expect(JSON.stringify(w)).toBe(before);
});
