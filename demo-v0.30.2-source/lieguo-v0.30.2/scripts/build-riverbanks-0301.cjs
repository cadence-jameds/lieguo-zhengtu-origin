// Literal reference pixels, cropped with user authorization. Only alpha and
// column alignment change; no generated or sharpened replacement colors.
const sharp=require('sharp');
(async()=>{
 const {data,info}=await sharp('docs/art-source/v0.30.1/bank-reference-crop.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=12,out=Buffer.alloc(W*H*4),edge=[];
 const blue=(x,y)=>{const i=(y*W+x)*4;return data[i+2]>data[i+1]+4&&data[i+1]>data[i]+12;};
 for(let x=0;x<W;x++){let y=25;for(;y<info.height-3;y++)if(blue(x,y)&&blue(x,y+1)&&blue(x,y+2))break;edge[x]=Math.min(y,53);}
 for(let x=0;x<W;x++){
  const bottom=[edge[Math.max(0,x-1)],edge[x],edge[Math.min(W-1,x+1)]].sort((a,b)=>a-b)[1];
  for(let y=0;y<H;y++){const sy=bottom+y-9;if(sy<0||sy>=info.height)continue;const from=(sy*W+x)*4,to=(y*W+x)*4;data.copy(out,to,from,from+4);out[to+3]=Math.round(255*Math.min(1,y/3,(H-1-y)/2));}
 }
 await sharp(out,{raw:{width:W,height:H,channels:4}}).webp({lossless:true}).toFile('public/art/world-riverbanks-0301.webp');
})();
