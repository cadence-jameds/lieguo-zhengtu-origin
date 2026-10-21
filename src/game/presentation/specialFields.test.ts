import {expect,it} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {fieldDistribution} from '../formal/terrain';
import {projectId} from '../formal/ids';
import {invalidateSpatial} from '../formal/spatial';
import {SpecialFieldCache,specialClassification,specialSettlementTile,visibleSpecialFields,DEFAULT_SPECIAL_FIELDS,readSpecialPreferences} from './specialFields';
const base=createFormalWorld({campaign:'special-fields',seed:90217});
const make=()=>structuredClone(base);
it('all 9/15 labels derive exactly from official fieldDistribution, including every legal resource type',()=>{
 const found=new Set<string>(),cache=new SpecialFieldCache();for(let y=0;y<160;y++)for(let x=0;x<160;x++){const s=cache.get(90217,x,y);expect(s).toEqual(specialClassification(fieldDistribution(90217,x,y)));if(s)found.add(s.label);}
 expect([...found].sort()).toEqual(['9糧','9木','9石','9金','15糧','15木','15石','15金'].sort());expect(cache.size).toBeLessThanOrEqual(8192);expect(specialClassification([6,4,4,4])).toBeUndefined();
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
 const near={minX:0,minY:0,maxX:50,maxY:50},prefs={...DEFAULT_SPECIAL_FIELDS,enabled:true},a=visibleSpecialFields(w,near,screen,30,30,prefs,cache),b=visibleSpecialFields(w,near,screen,30,30,prefs,cache);expect(a.visited).toBeLessThanOrEqual(31*31);expect(b.misses).toBe(0);expect(a.points).toEqual(b.points);expect(a.points.every(p=>p.x<=30&&p.y<=30)).toBe(true);expect(visibleSpecialFields(w,near,screen,30,30,{...prefs,nine:false,fifteen:false},cache).points).toEqual([]);
});
it('malformed preferences are safe, filter choices persist and seed change cannot return stale classification',()=>{
 expect(readSpecialPreferences({getItem:()=>'{broken'})).toEqual(DEFAULT_SPECIAL_FIELDS);expect(readSpecialPreferences({getItem:()=>JSON.stringify({enabled:true,seven:false,nine:true,fifteen:false})})).toEqual({enabled:true,nine:true,fifteen:false});const cache=new SpecialFieldCache();cache.get(1,5,6);expect(cache.get(2,5,6)).toEqual(specialClassification(fieldDistribution(2,5,6)));expect(cache.size).toBe(1);
});

import {readFileSync,writeFileSync} from 'node:fs';
import {spatial} from '../formal/spatial';
it('exports only public coordinates for an explicitly supplied synthetic browser fixture',()=>{
 if(!process.env.UX2_BROWSER_POINTS)return;
 const data=JSON.parse(readFileSync('/workspace/research/p0c-master/controlled-fixtures.json','utf8')),w=JSON.parse(data.base).snapshot,points:Record<string,{x:number;y:number}>={};
 for(let y=0;y<384&&Object.keys(points).length<8;y++)for(let x=0;x<384;x++){const s=specialClassification(fieldDistribution(w.seed,x,y));if(!s||points[s.label]||!specialSettlementTile(w,x,y))continue;const near=spatial(w).nearby(x,y,4);if(near.cities.length||near.sites.length)continue;points[s.label]={x,y};}
 expect(Object.keys(points)).toHaveLength(8);writeFileSync(process.env.UX2_BROWSER_POINTS,JSON.stringify(points));
});

import {project} from './mapGeometry';
import {mapQueryBounds} from './mapViewRules';
it('seven-field ground stays unchanged but is never a special marker, and old seven preferences are ignored',()=>{const original=fieldDistribution(90217,50,50);expect(specialClassification([7,3,4,4])).toBeUndefined();expect(readSpecialPreferences({getItem:()=>JSON.stringify({enabled:true,seven:true,nine:false,fifteen:true})})).toEqual({enabled:true,nine:false,fifteen:true});expect(fieldDistribution(90217,50,50)).toEqual(original);});
it('a desktop medium viewport paints nine/fifteen without needing maximum zoom, then reuses the same cache',()=>{const w=make(),width=1200,height=700,z=.75,center=project({x:180,y:180}),camera={...center,z},bounds=mapQueryBounds(camera,width,height,{left:0,top:0,right:width,bottom:height}),screen=(p:{x:number;y:number})=>{const q=project(p);return{x:(q.x-center.x)*z+width/2,y:(q.y-center.y)*z+height/2};},cache=new SpecialFieldCache(),prefs={...DEFAULT_SPECIAL_FIELDS,enabled:true},first=visibleSpecialFields(w,bounds,screen,width,height,prefs,cache),again=visibleSpecialFields(w,bounds,screen,width,height,prefs,cache);expect(first.lodHidden).toBe(false);expect(first.points.length).toBeGreaterThan(0);expect(first.points.every(p=>p.kind==='nine'||p.kind==='fifteen')).toBe(true);expect(first.visited).toBeLessThanOrEqual(8192);expect(again.misses).toBe(0);});
