import {banditShares,proportionalResources} from './banditLoot';
import type {FormalWorld,WildSite} from './model';
import {zeroResources} from './model';
import {buildable,seedHash,terrainAt} from './terrain';
import {spatial,invalidateSpatial} from './spatial';
import {enqueue} from './economy';
import type {EventScheduler} from './scheduler';
export const WILD_COOLDOWN=[30,40,50,60,75,90,120,150,180,240];
export const WILD_LOOT=[800,1500,2800,5000,8500,14000,23000,38000,60000,95000];
export const WILD_BUDGET=[60,120,210,350,570,900,1350,2000,2900,4200];
export const WILD_POINTS:Record<string,number>={militia:10,spearman:11,archer:12,skirmisher:10,'light-cavalry':20,knight:32};
const styles=[[22,20,18,15,15,10],[40,35,10,10,5,0],[18,48,12,10,7,5],[15,12,35,28,10,0],[10,12,12,8,38,20]];
const days=[1,7,15,21],levels=[[40,30,18,8,4,0,0,0,0,0],[22,20,18,15,10,7,4,2,1,1],[9,10,11,12,13,13,11,9,7,5],[5,6,7,8,10,12,16,14,12,10]];
export function wildLevelWeights(time:number){const day=1+time/86400000;if(day>=21)return [...levels[3]];const i=days.findIndex((_,n)=>n<3&&day<days[n+1]),t=(day-days[i])/(days[i+1]-days[i]);return levels[i].map((v,n)=>v+(levels[i+1][n]-v)*t);}
function weighted(weights:number[],roll:number){let x=roll*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){x-=weights[i];if(x<0)return i;}return weights.length-1;}
export function populateWild(w:FormalWorld,s:WildSite){
 const random=(salt:number)=>seedHash(w.seed,s.spawnSlot,s.generation,100+salt)/4294967296;
 const allowed=Object.keys(WILD_POINTS).slice(0,s.level<3?2:s.level<5?4:s.level<7?5:6),weights=s.level<3?[50,25,25,0,0]:s.level<5?[35,25,20,20,0]:s.level<7?[30,20,15,20,15]:[30,15,15,20,20];
 s.style=weighted(weights,random(0));const base=WILD_BUDGET[s.level-1]*(s.resource==='bandit'?1.2:1);
 // Lv1's integer two-type lattice has only 63/73-point legal mixtures near the budget.
 s.budget=s.level===1?(s.resource==='bandit'?74:60):Math.round(base*(.95+random(1)*.1));
 const shares=allowed.map((_,i)=>styles[s.style!][i]*(.85+.3*random(i+2))),sum=shares.reduce((a,b)=>a+b,0),units:Record<string,number>={};
 for(const id of allowed)units[id]=1;
 let points=allowed.reduce((n,id)=>n+WILD_POINTS[id],0);
 while(true){const choices=allowed.filter(id=>(units[id]+1)*WILD_POINTS[id]<=s.budget!*.55+1e-9&&points+WILD_POINTS[id]<=s.budget!*1.05+1e-9);if(!choices.length)break;
  choices.sort((a,b)=>{const score=(id:string)=>(shares[allowed.indexOf(id)]/sum*s.budget!-units[id]*WILD_POINTS[id])/WILD_POINTS[id];return score(b)-score(a)||(a<b?-1:1);});
  const id=choices[0];if(points>=s.budget!&&points+WILD_POINTS[id]>s.budget!*1.025)break;units[id]++;points+=WILD_POINTS[id];
 }
 s.defenders=units;s.initialDefenders={...units};s.loot=zeroResources();const loot=Math.round(WILD_LOOT[s.level-1]*(s.resource==='bandit'?1.5:1));
 if(s.resource==='bandit')s.loot=proportionalResources(banditShares(w.seed,s.spawnSlot,s.generation),loot,.15,.35);else s.loot[s.resource]=loot;
 s.phase='active';delete s.respawnAt;delete s.respawnEventId;
}
export function clearWild(w:FormalWorld,site:WildSite,s:EventScheduler){site.phase='cooldown';site.defenders={};site.loot=zeroResources();site.respawnAt=w.time+WILD_COOLDOWN[site.level-1]*60000;site.respawnEventId=enqueue(w,s,{type:'wild.respawn',siteId:site.id,generation:site.generation,at:site.respawnAt});invalidateSpatial(w);}
export function respawnWild(w:FormalWorld,site:WildSite){
 const generation=site.generation+1,index=spatial(w),home=Math.floor(site.spawnSlot/3),regions=Array.from({length:144},(_,i)=>i);
 const quota=(r:number)=>w.worldLayer!.wildSites.filter(s=>s.phase==='active'&&s.region===r).length;
 regions.sort((a,b)=>(quota(a)>=3?1:0)-(quota(b)>=3?1:0)||Math.hypot(a%12-home%12,Math.floor(a/12)-Math.floor(home/12))-Math.hypot(b%12-home%12,Math.floor(b/12)-Math.floor(home/12))||a-b);
 let point:{x:number;y:number}|undefined;
 for(const r of regions){const positions=Array.from({length:1024},(_,n)=>({x:r%12*32+n%32,y:Math.floor(r/12)*32+Math.floor(n/32)}));positions.sort((a,b)=>seedHash(w.seed,a.x,a.y,site.spawnSlot+generation*433)-seedHash(w.seed,b.x,b.y,site.spawnSlot+generation*433)||a.y-b.y||a.x-b.x);point=positions.find(p=>{const cell=index.at(p.x,p.y);return buildable(terrainAt(w,p.x,p.y))&&!cell.city&&!cell.site&&!cell.reservation;});if(point)break;}
 if(!point)throw new Error('No legal wild respawn coordinate');
 site.generation=generation;site.x=point.x;site.y=point.y;site.region=index.regionAt(point.x,point.y);const roll=seedHash(w.seed,site.spawnSlot,generation,91)/4294967296;
 site.level=1+weighted(wildLevelWeights(w.time),roll);const h=seedHash(w.seed,site.spawnSlot,generation,90)%100;site.resource=h<30?'food':h<55?'wood':h<75?'stone':h<85?'gold':'bandit';populateWild(w,site);invalidateSpatial(w);
}
