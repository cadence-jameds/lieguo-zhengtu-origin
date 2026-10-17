import {expect,it} from 'vitest';
import {painterlyGround} from './painterlyGround';

it('相鄰地表區塊共用紋理與河流座標，不產生接縫',()=>{
 const texture={width:6,height:4,data:new Uint8ClampedArray(Array.from({length:96},(_,i)=>(i*37)%256))};
 for(const version of [0,1]){
  const a=painterlyGround(112,96,902,version,.25,texture),b=painterlyGround(128,96,902,version,.25,texture);
  let checked=0;
  for(let y=40;y<96;y++)for(let x=80;x<176;x++){
   const ai=(y*a.width+x)*4,bi=((y-40)*b.width+x-80)*4;
   if(!a.data[ai+3]||!b.data[bi+3])continue;
   checked++;for(let k=0;k<3;k++)expect(Math.abs(a.data[ai+k]-b.data[bi+k])).toBeLessThanOrEqual(1);
  }
  expect(checked).toBeGreaterThan(1000);
 }
});
