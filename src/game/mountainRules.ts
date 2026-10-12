import {setMountainClearings,regionalTerrainAt} from './terrainRegions';
import type {Game} from './legacyTypes';
export function configureMountains(g:Game){setMountainClearings(g.seed,g.mountainClearings??[]);}
export function upgradeMountains(g:Game){
 if(!g.terrainVersion){configureMountains(g);return;}
 if(g.mountainRevision!==1){
  const active=new Set(g.marches.flatMap(m=>[m.from,m.to]));
  g.mountainClearings=g.nodes.filter(n=>n.kind==='capital'||n.kind==='village'||active.has(n.id)).map(n=>({x:n.x,y:n.y}));
  g.mountainRevision=1;
 }
 configureMountains(g);
 // Inactive wild sites keep identity and contents, but find an unblocked nearby
 // cell. Active destinations were protected above and keep their coordinates.
 const active=new Set(g.marches.flatMap(m=>[m.from,m.to]));
 for(const n of g.nodes){if(['capital','village','ruins'].includes(n.kind)||active.has(n.id)||regionalTerrainAt(n.x,n.y,g.seed,1)!=='mountain')continue;
  let found=false;for(let r=1;r<256&&!found;r++)for(let dx=-r;dx<=r&&!found;dx++)for(let dy=-r;dy<=r;dy++){
   if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=n.x+dx,y=n.y+dy;
   if(x<0||y<0||x>255||y>255||['water','mountain'].includes(regionalTerrainAt(x,y,g.seed,1))||g.nodes.some(other=>other!==n&&!other.respawnAt&&other.x===x&&other.y===y))continue;
   n.x=x;n.y=y;found=true;break;
  }
 }
}
