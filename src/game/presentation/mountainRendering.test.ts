import {readFileSync,writeFileSync} from 'node:fs';
import {it,expect,vi,afterEach} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {terrainAt} from '../formal/terrain';
import {decorations,mountainVisualCells,paintSurface} from './mapPaint';
import {SceneryCache} from './DemoMapCache';
import {project} from './mapGeometry';
import atlas from '../sceneryAtlas.json';
afterEach(()=>vi.unstubAllGlobals());
const make=(seed=90217)=>createFormalWorld({campaign:'mountain-'+seed,seed});
function mountains(w:ReturnType<typeof make>){const out:ReturnType<typeof decorations>=[];for(let y=0;y<384;y+=3)for(let x=0;x<384;x++)if(terrainAt(w,x,y)==='mountain')out.push(...decorations(w,x,y).filter(d=>d.kind==='mountain'));return out;}
it('whole DEMO silhouettes match Formal blocked cells across different worlds',()=>{
 for(const seed of [0,1,90217,4294967295]){const w=make(seed),before=JSON.stringify(w),ds=mountains(w);expect(ds.length).toBeGreaterThan(30);for(const d of ds){expect(d.width).toBeGreaterThanOrEqual(24);expect(d.height/d.width).toBeCloseTo(atlas.mountains[d.variant].h/atlas.mountains[d.variant].w);const cells=mountainVisualCells(w,d);expect(cells.length).toBeGreaterThan(0);expect(terrainAt(w,d.x,d.y)).toBe('mountain');for(const p of cells)expect(terrainAt(w,p.x,p.y)).toBe('mountain');}expect(JSON.stringify(w)).toBe(before);}
},15000);
it('save/load and world clock changes retain exactly the same mountain art',()=>{
 const w=make(),first=mountains(w),loaded=JSON.parse(JSON.stringify(w));loaded.time=70000;expect(mountains(loaded)).toEqual(first);
});
it('scenery draws complete mountain crops without any per-sprite clipping',()=>{
 const clip=vi.fn(),drawImage=vi.fn(),ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip,translate(){},scale(){},drawImage,createRadialGradient(){return {addColorStop(){}};},fillRect(){}} as unknown as CanvasRenderingContext2D;
 vi.stubGlobal('Image',class{naturalWidth=1254;naturalHeight=1254;src='';});const w=make();new SceneryCache().render(ctx,w,{...project({x:285,y:120}),z:1},830,590,[]);expect(drawImage).toHaveBeenCalled();expect(drawImage.mock.calls.filter(a=>String(a[0].src).includes('world-mountains'))).not.toHaveLength(0);expect(clip).not.toHaveBeenCalled();
});
it('export renderer inputs for offscreen comparison, without claiming browser screenshots',()=>{
 const out=process.env.MOUNTAIN_EVIDENCE;if(!out)return;const w=make(),width=830,height=590,scale=.9,p=project({x:286,y:120}),origin={x:p.x-width/scale/2,y:p.y-height/scale/2},newMountains=mountains(w);
 writeFileSync(out+'/ground.rgba',paintSurface(w,origin,width/scale,height/scale,scale).data);writeFileSync(out+'/scene.json',JSON.stringify({width,height,scale,origin,terrain:w.worldLayer!.terrain,newMountains}));
 writeFileSync(out+'/reference.json',JSON.stringify({reference:'列國征途_原始碼_v0.30.2.zip',implementationBaseline:'0.30.30',terrainVersion:w.metadata.terrainVersion,mountainProfile:w.worldLayer!.mountains,renderSource:readFileSync('src/game/presentation/DemoMapCache.ts','utf8').includes('mountainVisualCells')?'masked':'complete sprites'},null,2));
});
