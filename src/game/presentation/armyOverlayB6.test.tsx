import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {battlefield,dispatch,arrive} from '../formal/combatTestSupport';
import {advanceFormal} from '../formal/reducer';
import {paintArmies,ArmyRouteCache,battleMarkers,paintBattleMarker} from './armyOverlay';
import {project} from './mapGeometry';
import {renderToStaticMarkup} from 'react-dom/server';
import {PoliticsView} from './PoliticsView';
it('actual AI-vs-AI conquest keeps overlay through siege and removes after final; no precise intel in public politics',()=>{let w=battlefield();w.cities[1].military!.units={militia:40,ram:1};w.cities[2].military!.units={};w.cities[2].wallLevel=15;w=dispatch(w,'conquest',{militia:30,ram:1},1,2).world;w=arrive(w).world;expect(w.combat!.battles[0].phase).toBe('siege');expect(battleMarkers(w)).toHaveLength(1);const html=renderToStaticMarkup(<PoliticsView world={w} city={w.cities[0]} issue={()=>{}} busy={false}/>);expect(html).not.toContain('hpPerUnit');expect(html).not.toContain('wallDamage');const finished=advanceFormal(w,w.time+3600000).world;expect(battleMarkers(finished)).toHaveLength(0);expect(finished.combat!.receipts.filter(r=>r.kind==='final')).toHaveLength(1);});
it('renderer culls distant routes, uses cached paths, own and neutral military visible; final paint order is explicit',()=>{let w=battlefield();w.cities[0].military!.units={militia:10};w=dispatch(w,'raid',{militia:5}).world;const cache=new ArmyRouteCache(),ctx=new Proxy({},{get:()=>()=>{},set:()=>true}) as CanvasRenderingContext2D;const cam={...project(w.cities[0]),z:.75},screen=(p:{x:number;y:number})=>{const q=project(p);return{x:(q.x-cam.x)*cam.z+200,y:(q.y-cam.y)*cam.z+300};};const first=paintArmies(ctx,w,w.time,cam,400,600,screen,cache,true,0);expect(first.markers).toBe(1);const second=paintArmies(ctx,w,w.time+1,cam,400,600,screen,cache,true,1);expect(second.misses).toBe(1);expect(second.hits).toBe(1);expect(paintArmies(ctx,w,w.time,{x:100000,y:100000,z:1},400,600,screen,cache,true,0).markers).toBe(0);paintBattleMarker(ctx,{x:200,y:300},.5,1000,true);const source=readFileSync(new URL('../FormalWorldMap.tsx',import.meta.url),'utf8');expect(source.indexOf('paintBattleMarker(ctx')).toBeGreaterThan(source.indexOf('paintMapGlyphs(ctx'));});

it('paints a one-pixel exterior casing before the unchanged marching triangle fill',()=>{
 const seed=battlefield();seed.cities[0].military!.units={militia:10};
 const w=dispatch(seed,'raid',{militia:5}).world;
 expect(w.armies).toHaveLength(1);
 const widths:number[]=[],rotations:number[]=[],vertices:number[][]=[];
 const g={lineWidth:0,lineJoin:'',fillStyle:'',strokeStyle:'',save(){},restore(){},translate(){},scale(){},setLineDash(){},beginPath(){},closePath(){},
  rotate(value:number){rotations.push(value);},moveTo(x:number,y:number){if(rotations.length)vertices.push([x,y]);},lineTo(x:number,y:number){if(rotations.length)vertices.push([x,y]);},
  stroke(){widths.push(this.lineWidth);},fill(){expect(this.strokeStyle).toBe('#18231d');expect(this.lineJoin).toBe('round');expect(this.fillStyle).toBe('#f4e5b5');}
 };
 const cam={...project(w.cities[0]),z:.55};
 const screen=(p:{x:number;y:number})=>{const q=project(p);return{x:(q.x-cam.x)*cam.z+200,y:(q.y-cam.y)*cam.z+200};};
 const result=paintArmies(g as unknown as CanvasRenderingContext2D,w,w.time,cam,400,400,screen,new ArmyRouteCache(),true,0);
 const size=cam.z*7+3;
 expect(result.markers).toBe(1);expect(rotations).toHaveLength(1);
 expect(widths).toEqual([2.7/.55,1.5/.55,2]);
 expect(vertices).toEqual([[0,-size],[size*.85,size*.7],[-size*.85,size*.7]]);
});
