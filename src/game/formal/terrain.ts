import type {FormalWorld,TerrainClass} from './model';
/** Stateless uint32 mixer. Geometry depends only on world generation inputs. */
export function seedHash(seed:number,x:number,y:number,salt=0):number {
 let n=(seed^Math.imul(x+1,0x9e3779b1)^Math.imul(y+1,0x85ebca6b)^Math.imul(salt+1,0xc2b2ae35))>>>0;
 n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return (n^(n>>>16))>>>0;
}
export const TERRAIN_CODES={land:'L',forest:'F',river:'R',water:'W',mountain:'M'} as const;
const classes:Record<string,TerrainClass>={L:'land',F:'forest',R:'river',W:'water',M:'mountain'};
export function generateTerrain(seed:number):string {
 const cells:string[]=[];
 for(let y=0;y<384;y++)for(let x=0;x<384;x++){
  const riverX=80+(seed%41)+Math.round(19*Math.sin((y+(seed%100))/32));
  const riverY=225+(seed%23)+Math.round(15*Math.sin((x+(seed%53))/40));
  const ridge=260+(seed%17)+Math.round(25*Math.sin(y/45));
  const h=seedHash(seed,x,y);
  cells.push(Math.abs(x-riverX)<=1||Math.abs(y-riverY)<=1?'R':(x<13&&y<25&&h%7<5)?'W':Math.abs(x-ridge)<3&&y%90<65?'M':h%100<28?'F':'L');
 }
 return cells.join('');
}
export function terrainAt(w:FormalWorld,x:number,y:number):TerrainClass|undefined {
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=w.dimensions.width||y>=w.dimensions.height)return undefined;
 return w.worldLayer?classes[w.worldLayer.terrain[y*w.dimensions.width+x]]:'land';
}
export const buildable=(t:TerrainClass|undefined)=>t==='land'||t==='forest';
export const passable=(t:TerrainClass|undefined)=>t==='land'||t==='forest'||t==='river'||t==='water';
/** Player-approved R4 delta: entering a water tile costs twice ordinary land time. */
export const terrainTravelMultiplier=(t:TerrainClass|undefined)=>t==='water'?2:1;
/** Legal coordinate's field configuration is visible before settlement; never rerolled at load. */
export function fieldDistribution(seed:number,x:number,y:number):readonly number[] {
 const roll=(seedHash(seed,x,y,55)%100000)/1000;
 if(roll<20.5)return [6,4,4,4];
 const six=[[6,3,4,5],[6,3,5,4],[6,4,3,5],[6,4,5,3],[6,5,3,4],[6,5,4,3]];
 if(roll<83.5)return six[Math.floor((roll-20.5)/10.5)];
 if(roll<98.5)return [[7,3,4,4],[7,4,3,4],[7,4,4,3]][Math.floor((roll-83.5)/5)];
 const extreme=roll>=99.75,index=seedHash(seed,x,y,56)%4;
 return Array.from({length:4},(_,i)=>i===index?(extreme?15:9):(extreme?1:3));
}
