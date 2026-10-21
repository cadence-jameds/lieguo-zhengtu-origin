import {expect,it} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {fieldDistribution} from '../formal/terrain';
import {projectId} from '../formal/ids';
import {invalidateSpatial} from '../formal/spatial';
import {SpecialFieldCache,specialClassification,specialSettlementTile,visibleSpecialFields,DEFAULT_SPECIAL_FIELDS,readSpecialPreferences} from './specialFields';
const base=createFormalWorld({campaign:'special-fields',seed:90217});
const make=()=>structuredClone(base);
it('all 7/9/15 labels derive exactly from official fieldDistribution, including every legal resource type',()=>{
 const found=new Set<string>(),cache=new SpecialFieldCache();for(let y=0;y<160;y++)for(let x=0;x<160;x++){const s=cache.get(90217,x,y);expect(s).toEqual(specialClassification(fieldDistribution(90217,x,y)));if(s)found.add(s.label);}
 expect([...found].sort()).toEqual(['7糧','9糧','9木','9石','9金','15糧','15木','15石','15金'].sort());expect(cache.size).toBeLessThanOrEqual(8192);expect(specialClassification([6,4,4,4])).toBeUndefined();
});
it('only formally buildable empty tiles qualify: cities, ordinary/bandit/exile sites, terrain and legal reservations excluded',()=>{
 const w=make(),c=w.cities[0];expect(specialSettlementTile(w,c.x,c.y)).toBe(false);for(const s of w.worldLayer!.wildSites)expect(specialSettlementTile(w,s.x,s.y)).toBe(false);
 let p:{x:number;y:number}|undefined;for(let y=0;y<384&&!p;y++)for(let x=0;x<384;x++){if(specialSettlementTile(w,x,y)){p={x,y};break;}}expect(p).toBeDefined();
 for(const terrain of ['R','W','M']){const a=w.worldLayer!.terrain.indexOf(terrain);expect(specialSettlementTile(w,a%384,Math.floor(a/384))).toBe(false);}
 w.settlements=[{projectId:projectId('reserved'),phase:'travelling',target:p} as NonNullable<typeof w.settlements>[number]];invalidateSpatial(w);expect(specialSettlementTile(w,p!.x,p!.y)).toBe(false);
 w.settlements=[];w.extinction={sites:[{id:'wild:exile-test',phase:'active',x:p!.x,y:p!.y}]} as typeof w.extinction;invalidateSpatial(w);expect(specialSettlementTile(w,p!.x,p!.y)).toBe(false);
});
it('default off and overview do zero classification; repeated visible region is cached, offscreen and filters excluded',()=>{
 const w=make(),cache=new SpecialFieldCache(),bounds={minX:0,minY:0,maxX:383,maxY:383},screen=(p:{x:number;y:number})=>p;
 expect(visibleSpecialFields(w,bounds,screen,384,384,DEFAULT_SPECIAL_FIELDS,cache)).toMatchObject({visited:0,misses:0,points:[]});expect(visibleSpecialFields(w,bounds,screen,384,384,{...DEFAULT_SPECIAL_FIELDS,enabled:true},cache)).toMatchObject({visited:0,lodHidden:true});
 const near={minX:0,minY:0,maxX:50,maxY:50},prefs={...DEFAULT_SPECIAL_FIELDS,enabled:true},a=visibleSpecialFields(w,near,screen,30,30,prefs,cache),b=visibleSpecialFields(w,near,screen,30,30,prefs,cache);expect(a.visited).toBeLessThanOrEqual(31*31);expect(b.misses).toBe(0);expect(a.points).toEqual(b.points);expect(a.points.every(p=>p.x<=30&&p.y<=30)).toBe(true);expect(visibleSpecialFields(w,near,screen,30,30,{...prefs,seven:false,nine:false,fifteen:false},cache).points).toEqual([]);
});
it('malformed preferences are safe, filter choices persist and seed change cannot return stale classification',()=>{
 expect(readSpecialPreferences({getItem:()=>'{broken'})).toEqual(DEFAULT_SPECIAL_FIELDS);expect(readSpecialPreferences({getItem:()=>JSON.stringify({enabled:true,seven:false,nine:true,fifteen:false})})).toEqual({enabled:true,seven:false,nine:true,fifteen:false});const cache=new SpecialFieldCache();cache.get(1,5,6);expect(cache.get(2,5,6)).toEqual(specialClassification(fieldDistribution(2,5,6)));expect(cache.size).toBe(1);
});

import {readFileSync,writeFileSync} from 'node:fs';
import {spatial} from '../formal/spatial';
it('exports only public coordinates for an explicitly supplied synthetic browser fixture',()=>{
 if(!process.env.UX2_BROWSER_POINTS)return;
 const data=JSON.parse(readFileSync('/workspace/research/p0c-master/controlled-fixtures.json','utf8')),w=JSON.parse(data.base).snapshot,points:Record<string,{x:number;y:number}>={};
 for(let y=0;y<384&&Object.keys(points).length<9;y++)for(let x=0;x<384;x++){const s=specialClassification(fieldDistribution(w.seed,x,y));if(!s||points[s.label]||!specialSettlementTile(w,x,y))continue;const near=spatial(w).nearby(x,y,4);if(near.cities.length||near.sites.length)continue;points[s.label]={x,y};}
 expect(Object.keys(points)).toHaveLength(9);writeFileSync(process.env.UX2_BROWSER_POINTS,JSON.stringify(points));
});
