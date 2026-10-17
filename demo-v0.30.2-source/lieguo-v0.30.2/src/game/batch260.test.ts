import {it,expect} from 'vitest';
import {newGame} from './world';
import {terrainEnvironmentAt,terrainHeightAt,downstreamCoordinate,waterSurfaceHeight,waterGeography,regionalTerrainAt} from './terrainRegions';
import {mapProject,mapInverse,mapGlyphSize,tileCorners} from './mapProjection';
import {initializeWildSites,pruneRetiredWildSites} from './wildSpawns';
import {isWildSite} from './npc';
import {command,advance,owned} from './engine';
import {exportSave,importSave} from './persistence';
import {emptyTroops} from './types';
it('flat projection preserves tile size and round trips across seeds, zooms and river versions',()=>{
 for(const version of [0,1])for(const seed of [1,902])for(let x=0;x<256;x+=17)for(let y=0;y<256;y+=19){
  for(const offset of [0,.49,-.49]){const p={x:x+offset,y:y-offset},world=mapProject(p,seed,version);
   expect(world).toEqual({x:(p.x-p.y)*20,y:(p.x+p.y)*10});
   for(const zoom of [.13,.75,2]){const screen={x:(world.x-100)*zoom+390/2,y:(world.y-800)*zoom+700/2};const q=mapInverse((screen.x-195)/zoom+100,(screen.y-350)/zoom+800,seed,version);expect(q.x).toBeCloseTo(p.x,4);expect(q.y).toBeCloseTo(p.y,4);}
  }
  const a=tileCorners({x,y}),b=tileCorners({x:x+1,y});expect(mapProject(a[1],seed,version)).toEqual(mapProject(b[0],seed,version));
 }
});
it('regional relief stays smooth, forests coexist on slopes and lakes remain level',()=>{
 let woodedSlopes=0,rocky=0,riverLow=0,maxStep=0;const bands=new Set<string>();
 for(let x=0;x<256;x+=3)for(let y=0;y<256;y+=3){const e=terrainEnvironmentAt(x,y,902,1);bands.add(e.band);if(e.uplift>12&&e.forest>.3)woodedSlopes++;if(e.uplift>25&&e.forest<.25)rocky++;if(e.bank<2&&e.uplift<1)riverLow++;maxStep=Math.max(maxStep,Math.abs(e.height-terrainHeightAt(x+1,y,902,1)),Math.abs(e.height-terrainHeightAt(x,y+1,902,1)));}
 expect(woodedSlopes).toBeGreaterThan(0);expect(rocky).toBeGreaterThan(0);expect(riverLow).toBeGreaterThan(0);expect(bands.size).toBe(4);expect(maxStep).toBeLessThan(6);
 for(const l of waterGeography(902).lakes){const h=waterSurfaceHeight(l.x,l.y,902,1);expect(waterSurfaceHeight(l.x+1,l.y+1,902,1)).toBeCloseTo(h,5);}
 const flow=Array.from({length:256},(_,y)=>({t:downstreamCoordinate(y,y,902,1),h:waterSurfaceHeight(y,y,902,1)})).sort((a,b)=>a.t-b.t);for(let i=1;i<flow.length;i++)expect(flow[i].h).toBeLessThanOrEqual(flow[i-1].h+1e-8);
 for(const zoom of [.13,.75,2])expect(mapGlyphSize(false,zoom)/mapGlyphSize(true,zoom)).toBeCloseTo(.85);
});
it('384-site migration preserves an outbound target and its return route, then converges to 256',()=>{
 const g=newGame('civ_zhongguo',902,1,0);g.events=[];const home=owned(g,g.player)[0],template=g.nodes.find(isWildSite)!;
 // Simulate a previous 384-slot save, with an outbound scout committed to a target.
 const used=new Set(g.nodes.map(n=>n.x+','+n.y));let cursor=0;
 for(let i=0;i<128;i++){while(used.has((cursor%256)+','+Math.floor(cursor/256))||regionalTerrainAt(cursor%256,Math.floor(cursor/256),g.seed,1)==='water')cursor++;const n=structuredClone(template);n.id='previous_site_'+i;n.npcResource='food';n.x=cursor%256;n.y=Math.floor(cursor/256);used.add(n.x+','+n.y);g.nodes.push(n);cursor++;}
 g.wildVersion=1;const target=g.nodes.at(-1)!;expect(command(g,{type:'march',from:home.id,to:target.id,kind:'scout',troops:{...emptyTroops(),scout:1}})).toBe('');const before=structuredClone(g.marches[0]),coordinates={x:target.x,y:target.y};
 const copy=importSave(exportSave(g));expect(copy.marches[0]).toEqual(before);const retained=copy.nodes.find(n=>n.id===target.id)!;expect(retained).toBeDefined();expect({x:retained.x,y:retained.y}).toEqual(coordinates);expect(copy.nodes.filter(n=>isWildSite(n)&&!n.retiring)).toHaveLength(256);
 const stable=exportSave(copy);initializeWildSites(copy);expect(exportSave(copy)).toBe(stable);advance(copy,copy.marches[0].at);advance(copy,copy.marches[0].at);pruneRetiredWildSites(copy);expect(copy.nodes.filter(isWildSite)).toHaveLength(256);expect(()=>importSave(exportSave(copy))).not.toThrow();
});
