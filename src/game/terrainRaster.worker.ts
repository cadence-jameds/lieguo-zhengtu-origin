import {painterlyGround} from './painterlyGround';
import {setMountainClearings} from './terrainRegions';
import type {GroundTexture} from './terrainRaster';
let texture:GroundTexture|undefined;
const worker=self as unknown as {onmessage:((e:MessageEvent)=>void)|null;postMessage:(message:unknown,transfer?:Transferable[])=>void};
worker.onmessage=({data}:{data:{x:number;y:number;seed:number;version:number;scale:number;generation:number;texture?:GroundTexture;clearings:{x:number;y:number}[]}})=>{
 try{
  setMountainClearings(data.seed,data.clearings);if(data.texture)texture=data.texture;
  const pixels=painterlyGround(data.x,data.y,data.seed,data.version,data.scale,texture);
  worker.postMessage({generation:data.generation,pixels},[pixels.data.buffer]);
 }catch(error){worker.postMessage({generation:data.generation,error:String(error)});}
};
