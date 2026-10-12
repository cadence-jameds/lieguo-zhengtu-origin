import {type Game,type Node,buildingIds,emptyStock,emptyTroops,MINUTE} from './legacyTypes';
import {hash,regionalTerrainAt} from './terrainRegions';
import {makePlots,defaultGovernor} from './city';
import {isWildSite,resetSite,rollSiteLevel,siteLevel} from './npc';
export const WILD_SLOTS=256;
export const wildCooldown=(n:Node)=> (30+(siteLevel(n)-1)*5)*MINUTE;
const regionOf=(n:{x:number;y:number})=>Math.floor(n.y/32)*8+Math.floor(n.x/32);
const quotaCache=new Map<string,number[]>();
export function regionQuotas(g:Pick<Game,'seed'|'terrainVersion'>){
 const key=g.seed+':'+(g.terrainVersion??0),old=quotaCache.get(key);if(old)return old;
 const land=Array.from({length:64},(_,i)=>{let count=0;for(let x=i%8*32;x<i%8*32+32;x++)for(let y=Math.floor(i/8)*32;y<Math.floor(i/8)*32+32;y++)if(!['water','mountain'].includes(regionalTerrainAt(x,y,g.seed,g.terrainVersion)))count++;return count;});
 const quota=land.map(n=>Math.min(n,3));let remaining=WILD_SLOTS-quota.reduce((a,b)=>a+b,0);
 while(remaining>0){const order=land.map((n,i)=>({i,score:n/(quota[i]+1)})).filter(({i})=>quota[i]<Math.min(5,land[i])).sort((a,b)=>b.score-a.score||a.i-b.i);if(!order.length)break;quota[order[0].i]++;remaining--;}
 if(quotaCache.size>=4)quotaCache.delete(quotaCache.keys().next().value!);quotaCache.set(key,quota);return quota;
}
export function relocateWildSite(g:Game,n:Node,initial=false){
 const quotas=regionQuotas(g),counts=new Array<number>(64).fill(0),blocked=new Set<string>();
 for(const a of g.nodes)if(a!==n&&((!a.respawnAt&&a.kind!=='ruins')||g.marches.some(m=>m.kind==='settle'&&m.status==='outbound'&&m.to===a.id)||g.factions.some(f=>f.exile?.refuge===a.id))){blocked.add(a.x+','+a.y);if(isWildSite(a)&&!a.retiring)counts[regionOf(a)]++;}
 const salt=hash(g.nodes.indexOf(n),(n.generation??0)+1,g.seed);
 const regions=quotas.map((q,i)=>({i,deficit:q-counts[i],tie:hash(i,99,salt)})).filter(r=>quotas[r.i]>0).sort((a,b)=>b.deficit-a.deficit||a.tie-b.tie);
 for(const {i} of regions){if(counts[i]>=quotas[i])continue;const offset=hash(i,13,salt)%1024;
  for(let k=0;k<1024;k++){const cell=(offset+k*683)%1024,x=i%8*32+cell%32,y=Math.floor(i/8)*32+Math.floor(cell/32);
   if((!initial&&x===n.x&&y===n.y)||blocked.has(x+','+y)||['water','mountain'].includes(regionalTerrainAt(x,y,g.seed,g.terrainVersion)))continue;
   n.x=x;n.y=y;delete n.respawnAt;n.generation=(n.generation??0)+(initial?0:1);resetSite(n,rollSiteLevel(g,n,hash(x,y,salt)));for(const f of g.factions)delete f.intel[n.id];return true;
  }
 }
 return false;
}
export function initializeWildSites(g:Game){
 if(g.wildVersion===2){
  for(const n of g.nodes.filter(n=>isWildSite(n)&&!n.retiring&&!n.respawnAt))
   if(regionalTerrainAt(n.x,n.y,g.seed,g.terrainVersion)==='mountain'&&!wildSiteReferenced(g,n)){
    n.respawnAt=g.time+MINUTE;relocateWildSite(g,n);
   }
  return;
 }
 const previousVersion=g.wildVersion;
 const existing=g.nodes.filter(isWildSite);
 // Retain IDs and occupied targets of existing marches/battles during migration.
 for(const n of existing){if(n.kind==='iron')n.npcResource='stone';if(n.kind==='horses')n.npcResource='food';n.kind='camp';
  if(previousVersion===undefined&&n.respawnAt)n.respawnAt=Math.max(g.time+MINUTE,n.respawnAt-6*60*MINUTE+wildCooldown(n));
  for(const f of g.factions)delete f.intel[n.id];
 }
 const targets=[77,64,51,26,38],kinds=['food','wood','stone','gold',undefined] as const;
 // Keep active orders first; surplus targets with an army remain until that army leaves.
 const references=new Set(existing.filter(n=>wildSiteReferenced(g,n)).map(n=>n.id));
 const retained=new Set<string>(),regional=new Array<number>(64).fill(0),left=[...targets],quota=regionQuotas(g);
 for(let i=0;i<Math.min(WILD_SLOTS,existing.length);i++){
  const candidates=existing.filter(n=>!retained.has(n.id)&&left[kinds.indexOf(n.npcResource)]>0);
  candidates.sort((a,b)=>{
   const score=(n:Node)=>+(references.has(n.id))*10000+(quota[regionOf(n)]-regional[regionOf(n)])*1000+hash(n.x,n.y,g.seed)%997;
   return score(b)-score(a)||a.id.localeCompare(b.id);
  });
  const n=candidates[0];if(!n)break;retained.add(n.id);left[kinds.indexOf(n.npcResource)]--;regional[regionOf(n)]++;
 }
 for(const n of existing)n.retiring=!retained.has(n.id)||undefined;
 pruneRetiredWildSites(g);
 const counts=kinds.map(r=>g.nodes.filter(n=>isWildSite(n)&&!n.retiring&&n.npcResource===r).length);
 for(let i=counts.reduce((a,b)=>a+b,0);i<WILD_SLOTS;i++){
  const kind=targets.map((v,j)=>({j,d:v-counts[j]})).sort((a,b)=>b.d-a.d||a.j-b.j)[0].j;counts[kind]++;
  let id='wild_'+i;while(g.nodes.some(n=>n.id===id))id+='x';
  const buildings=Object.fromEntries(buildingIds.map(b=>[b,0])) as Node['buildings'];
  const n:Node={id,name:'野外據點',x:0,y:0,kind:'camp',npcResource:kinds[kind],owner:null,population:0,integration:100,stability:100,stock:emptyStock(),troops:emptyTroops(),buildings,plots:makePlots(buildings),build:[],train:[],policy:'balanced',governor:defaultGovernor(),generation:0,respawnAt:g.time+MINUTE};
  g.nodes.push(n);relocateWildSite(g,n,true);
 }
 // Relocate only illegal legacy positions. Other active legacy sites retain contents until cleared.
 for(const n of g.nodes.filter(n=>isWildSite(n)&&!n.retiring))if(!n.respawnAt&&(regionalTerrainAt(n.x,n.y,g.seed,g.terrainVersion)==='water'||regionalTerrainAt(n.x,n.y,g.seed,g.terrainVersion)==='mountain'&&!wildSiteReferenced(g,n)||g.nodes.some(a=>a!==n&&!a.respawnAt&&a.kind!=='ruins'&&a.x===n.x&&a.y===n.y))){n.respawnAt=g.time+MINUTE;relocateWildSite(g,n);}
 // Existing uncommitted sites in overfull regions can move without changing any army's destination.
 const countsByRegion=new Array<number>(64).fill(0);for(const n of g.nodes)if(isWildSite(n)&&!n.retiring&&!n.respawnAt)countsByRegion[regionOf(n)]++;
 for(const n of g.nodes)if(isWildSite(n)&&!n.retiring&&!n.respawnAt&&!wildSiteReferenced(g,n)&&countsByRegion[regionOf(n)]>quota[regionOf(n)]){const oldRegion=regionOf(n);if(relocateWildSite(g,n)){countsByRegion[oldRegion]--;countsByRegion[regionOf(n)]++;}}
 g.wildVersion=2;
}

const wildSiteReferenced=(g:Game,n:Node)=>!!n.owner||g.marches.some(m=>m.from===n.id||m.to===n.id||m.redirect?.to===n.id)||g.battles.some(b=>b.target===n.id)||g.factions.some(f=>f.capital===n.id||f.exile?.refuge===n.id);
export function pruneRetiredWildSites(g:Game){
 const ids=new Set(g.nodes.filter(n=>n.retiring&&!wildSiteReferenced(g,n)).map(n=>n.id));if(!ids.size)return;
 g.nodes=g.nodes.filter(n=>!ids.has(n.id));for(const f of g.factions)for(const id of ids)delete f.intel[id];
}
