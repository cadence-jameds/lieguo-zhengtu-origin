import {readFileSync,writeFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {spatial} from '../formal/spatial';
import {project} from './mapGeometry';
import {paintSurface,decorations} from './mapPaint';
import {civilizationIndex,visualAge} from './artMap';
import {eraAtlas,eraBounds} from '../assets';
import {relationColor} from './mapRelations';
it('export actual presentation inputs for honest offscreen review (no browser Smoke claim)',()=>{
 const out=process.env.PARITY_EVIDENCE;if(!out)return;
 const w=createFormalWorld({campaign:'map-evidence',seed:90217}),textureRaw=readFileSync(out+'/ground-atlas.rgba'),texture={width:1536,height:1024,data:new Uint8ClampedArray(textureRaw)},perf:Record<string,number>={};
 for(const [name,center] of [['near',w.cities[0]],['river',{x:103,y:150}],['ridge',{x:282,y:120}]] as const){
  const scale=.9,width=1200,height=700,p=project(center),origin={x:p.x-width/scale/2,y:p.y-height/scale/2},start=performance.now(),pix=paintSurface(w,origin,width/scale,height/scale,scale,texture);perf[name]=performance.now()-start;expect(pix.width).toBe(width);expect(pix.height).toBe(height);writeFileSync(out+'/map-'+name+'-ground.rgba',pix.data);
  const ds:ReturnType<typeof decorations>=[];for(let y=Math.max(0,Math.floor((center.y-70)/2)*2);y<Math.min(384,center.y+70);y+=2)for(let x=Math.max(0,Math.floor((center.x-70)/2)*2);x<Math.min(384,center.x+70);x+=2)if(!spatial(w).at(x,y).city)ds.push(...decorations(w,x,y).filter(d=>d.kind!=='mountain'));for(let y=Math.max(0,Math.ceil((center.y-70)/3)*3);y<Math.min(384,center.y+70);y+=3)for(let x=Math.max(0,Math.floor(center.x-70));x<Math.min(384,center.x+70);x++)ds.push(...decorations(w,x,y).filter(d=>d.kind==='mountain'));
  const cities=w.cities.map(c=>{const f=w.factions.find(f=>f.id===c.ownerFactionId)!;const index=civilizationIndex(f.civilizationId),age=visualAge(f.age??0);return {...c,index,age,artPath:eraAtlas(age),crop:eraBounds(14+index,age),relationColor:relationColor(w,c)};});
  writeFileSync(out+'/map-'+name+'-scene.json',JSON.stringify({width,height,origin,scale,terrain:w.worldLayer!.terrain,decorations:ds,cities,sites:w.worldLayer!.wildSites}));
 }
 writeFileSync(out+'/map-render-time.json',JSON.stringify(perf,null,2));
},30000);
