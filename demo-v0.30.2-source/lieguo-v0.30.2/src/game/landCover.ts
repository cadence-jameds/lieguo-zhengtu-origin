import {hash,regionalTerrainAt,terrainEnvironmentAt} from './terrainRegions';

const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export function coverNoise(x:number,y:number,seed:number){
 const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);
 const n=(dx:number,dy:number)=>hash(ix+dx,iy+dy,seed)/4294967295;
 return (n(0,0)*(1-fx)+n(1,0)*fx)*(1-fy)+(n(0,1)*(1-fx)+n(1,1)*fx)*fy;
}
// Visual land cover does not change save geography, yields, or travel costs.
export function landCoverWeights(x:number,y:number,seed:number,version=0):[number,number,number]{
 const e=terrainEnvironmentAt(x,y,seed,version);
 const dry=coverNoise(x/39,y/34,seed^82347)*.8+coverNoise(x/9,y/11,seed^2254)*.2;
 const rock=coverNoise(x/26,y/31,seed^9173)*.75+Math.min(1,e.uplift/25)*.25;
 const barren=smooth((dry-.50)/.24)*(1-e.forest*.8)*Math.min(1,e.bank/4);
 const stone=smooth((rock-.57)/.22)*(1-barren*.5)*(1-e.forest*.55);
 const meadow=Math.max(.03,1-barren-stone),sum=meadow+barren+stone;
 return [meadow/sum,barren/sum,stone/sum];
}
export function landCoverName(x:number,y:number,seed:number,version=0){
 const kind=regionalTerrainAt(x,y,seed,version);
 if(kind==='water')return '水域';if(kind==='mountain')return '山脈';if(kind==='forest')return '森林';
 const weights=landCoverWeights(x,y,seed,version);
 return ['草原','荒原','石塊地'][weights.indexOf(Math.max(...weights))];
}
