import {it,expect} from 'vitest';
import {parseWorldSeed} from './worldSeed';
import {newGame} from './world';
import {importSave,exportSave} from './persistence';
import {landWeights,isWaterTile,regionalTerrainAt} from './terrainRegions';
import {terrainPixel,rasterGround} from './terrainRaster';
it('keeps every legacy water tile and produces long contiguous land regions',()=>{
 for(const seed of [1,902,20260906]){
  let newEdges=0,oldEdges=0,waterMismatch=0,invalidWeights=0;
  const old=(x:number,y:number)=>{let n=Math.imul(Math.floor(x/7),374761393)^Math.imul(Math.floor(y/7),668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);const v=((n^(n>>>16))>>>0)%100;return v<26?'forest':v<39?'hill':v<54?'field':'grass';};
  const kinds=new Set();
  for(let x=0;x<256;x++)for(let y=0;y<256;y++){
   waterMismatch+=+(isWaterTile(x,y,seed)!==(Math.abs(x-(126+Math.sin((y+seed%79)/23)*20))<2.7));
   const weights=landWeights(x,y,seed);invalidWeights+=+(Math.abs(weights.reduce((a,b)=>a+b)-1)>1e-8||!weights.every(w=>w>=0&&w<=1));
   const t=regionalTerrainAt(x,y,seed);kinds.add(t);if(x&&t!=='water'&&regionalTerrainAt(x-1,y,seed)!=='water'){newEdges+=+(t!==regionalTerrainAt(x-1,y,seed));oldEdges+=+(old(x,y)!==old(x-1,y));}
  }
  expect(waterMismatch).toBe(0);expect(invalidWeights).toBe(0);expect(kinds.size).toBe(5);expect(newEdges).toBeLessThan(oldEdges*.7);
 }
});
it('ground transitions are continuous across former seven-cell boundaries and chunk boundaries',()=>{
 for(const x of [7,14,16,28,32,48,64])for(let y=1;y<100;y++){
  const a=terrainPixel(x-.001,y,902),b=terrainPixel(x+.001,y,902);expect(Math.max(...a.map((n,i)=>Math.abs(n-b[i])))).toBeLessThan(.1);
 }
});
it('neighboring terrain chunks sample identical world pixels, with finite texture colors',()=>{
 const texture={width:6,height:4,data:new Uint8ClampedArray(6*4*4).fill(120)};
 const a=rasterGround(80,96,902,4,texture),b=rasterGround(96,96,902,4,texture);
 // Shared padded samples: chunk B is 320 world pixels right and 160 down.
 let shared=0;
 for(let y=40;y<96;y++)for(let x=80;x<176;x++){
  const ai=(y*a.width+x)*4,bi=((y-40)*b.width+x-80)*4;
  if(a.data[ai+3]&&b.data[bi+3]){shared++;for(let k=0;k<3;k++)expect(Math.abs(a.data[ai+k]-b.data[bi+k])).toBeLessThanOrEqual(1);}
 }
 expect(shared).toBeGreaterThan(0);expect(a.data.some(n=>n>0)).toBe(true);
});
it('seed entry accepts uint32 boundaries and rejects empty, fractional and overflow values',()=>{
 expect(parseWorldSeed('0')).toBe(0);expect(parseWorldSeed('4294967295')).toBe(4294967295);expect(parseWorldSeed(' 000902 ')).toBe(902);
 for(const text of ['', ' ', '-1', '1.5', '1e3', '4294967296', 'abc'])expect(parseWorldSeed(text)).toBeNull();
 for(const seed of [-1,4294967296,1.5])expect(()=>newGame('civ_zhongguo',seed,1,0)).toThrow();
});
it('same seed reproduces initial world; a different seed changes geography and placement',()=>{
 const a=newGame('civ_zhongguo',902,1,0),b=newGame('civ_zhongguo',902,1,0),c=newGame('civ_zhongguo',903,1,0);
 expect(a).toEqual(b);expect(a.nodes.map(n=>[n.x,n.y])).not.toEqual(c.nodes.map(n=>[n.x,n.y]));
 expect(Array.from({length:256},(_,x)=>regionalTerrainAt(x,90,902))).not.toEqual(Array.from({length:256},(_,x)=>regionalTerrainAt(x,90,903)));
 const saved=importSave(exportSave(a));expect(saved.seed).toBe(902);expect(saved.nodes.map(n=>[n.id,n.x,n.y])).toEqual(a.nodes.map(n=>[n.id,n.x,n.y]));
});
