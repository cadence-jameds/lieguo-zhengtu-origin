import {configureMountains} from './mountainRules';
import {initializeWildSites} from './wildSpawns';
import {INITIAL_POPULATION} from '../config/realm';
import {resourceLayout} from './resourceFields';
import {normalizeCityNames} from './cityNames';
import { STARTING_STOCK } from './balance';
import { isWildSite } from './npc';
import { upgradeBatch } from './progress';
import {lordName} from '../content/lordNames';
import { civilizations } from '../content/civilizations';
import { CONTENT, SCHEMA, MINUTE, type Game, type Node, type Point, buildingIds, emptyStock, emptyTroops } from './types';
import { makePlots, defaultGovernor } from './city';
import { PROTECTION } from './content';
export const SIZE = 256;
import {hash,regionalTerrainAt,type Terrain} from './terrainRegions';
export {hash} from './terrainRegions';
export type {Terrain} from './terrainRegions';
export const terrainAt=regionalTerrainAt;
export const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const capitals = [[64,64], [128,40], [192,64], [192,192], [128,216], [64,192]];
const capitalNames = ['洛川', '紫穹', '白石', '長林', '櫻原', '蒼野'];
const names = ['青麓', '河口', '南原', '麥田', '松林', '石橋', '北岸', '杉谷', '白楊', '風丘', '東埠', '遠山', '鐵嶺', '牧原', '荒寨'];
export function legacyGame(player: string, seed: number, speed: number, wall = Date.now()): Game {
  if (!civilizations.some(c => c.id === player) || ![1,3,6,10,50,100,12,120].includes(speed) || (!Number.isSafeInteger(seed)||seed<0||seed>4294967295)) throw new Error('無效的文明、速度或世界種子。');
  const g: Game = { schema: SCHEMA, campaign: `river-${seed}-${player}-${wall}`, acceptedCommands: [], content: CONTENT, seed: seed >>> 0, player, speed, time: 0, savedAt: wall, revision: 0, next: 1, rng: (seed >>> 0) || 1, nodes: [], factions: [], events: [], marches: [], battles: [], reports: [], protectionUntil: PROTECTION, treaties: [], log: [], hegemony: null, result: null, sandbox: false };
  civilizations.forEach((c, k) => {
    const [cx,cy] = capitals[k];
    for (let i = 0; i < 16; i++) {
      let x = cx, y = cy;
      if (i) { const angle = (i - 1) * Math.PI * 2 / 15; const r = 15 + (hash(i,k,seed) % 16); x = Math.round(cx + Math.cos(angle) * r); y = Math.round(cy + Math.sin(angle) * r); }
      while (g.nodes.some(n => distance(n,{x,y}) < 4)) { x++; y = Math.max(3,y-1); }
      const levels = Object.fromEntries(buildingIds.map(b => [b, ['hall','farm','lumber','quarry','mine','house','warehouse','barracks'].includes(b) ? 1 : 0])) as Node['buildings'];
      const n: Node = { id: `node_${k}_${i}`, name: i === 0 ? capitalNames[k] : `${capitalNames[k][0]}${names[i-1]}`, x, y, kind: i === 0 ? 'capital' : i === 13 ? 'iron' : i === 14 ? 'horses' : i === 15 ? 'camp' : i === 12 ? 'ruins' : 'village', owner: i === 0 ? c.id : i<12 ? (c.id===player?civilizations[(k+1+(i%5))%6].id:c.id) : null, stock: { food: i === 0 ? 1200 : 180, wood: i === 0 ? 1200 : 140, stone: i === 0 ? 800 : 100, gold: i === 0 ? 550 : 70 }, population: i === 0 ? 300 : 180, integration: 100, stability: 100, buildings: levels, troops: { ...emptyTroops(), militia: i === 0 ? 12 : i === 15 ? 10 : 3 + hash(i,k,seed) % 5, spear: i === 0 ? 4 : 0, scout: i === 0 ? 3 : 0 }, build: [], train: [], policy: 'balanced', plots: [], governor: defaultGovernor() };
      if (n.kind === 'iron' || n.kind === 'horses' || n.kind === 'camp') n.buildings.hall = 0;
      if(n.kind==='village'&&n.owner===player)n.owner=civilizations[(k+1)%6].id;
      if(n.kind==='village'){ n.buildings.barracks=0; n.population=180; }
      if(n.kind==='ruins'){n.stock=emptyStock();for(const b of buildingIds)n.buildings[b]=0;n.troops=emptyTroops();n.population=0;}
      if(i===0&&c.id===player)for(const b of buildingIds)n.buildings[b]=b==='hall'?1:0;
      n.plots=makePlots(n.buildings);

      g.nodes.push(n);
    }
    g.factions.push({ id: c.id, capital: `node_${k}_0`, era: 0, tech: [], research: null, intel: {}, vassal: null, regent: true, intent: ['鞏固邊境與發展','城防與守勢','集結騎兵進攻','情報與遠程兵力','步兵與快速整備','機動襲擾'][k], exile: null });
  });
  for (const f of g.factions) {
    const cap = g.nodes.find(n => n.id === f.capital)!;
    for (const n of g.nodes) if (f.id!==player&&distance(n,cap)<48) f.intel[n.id] = { at: 0, troops: {...n.troops}, wall: n.buildings.wall, owner: n.owner };
    if (f.id !== player) g.events.push({ id: g.next++, at: (20 + g.factions.indexOf(f) * 3) * MINUTE, type: 'ai', ref: f.id });
  }
  g.events.push({ id: g.next++, at: MINUTE, type: 'pulse', ref: '' });
  g.reports.push({ id: g.next++, at: 0, realAt:wall, owner: player, kind: 'system', title: '列國征途：河谷戰役開始', text: '先在空地建造四種資源建築，再完成民居，之後自由發展與募兵。領主與文明公開，派斥候才能取得駐軍情報。正規聚落由五個 AI 文明分別經營；點選空白陸地可派居民建立新城。擊敗五個文明，或以三十座有效聚落建立霸權。' });
  repairWaterCities(g);for(const n of g.nodes)n.plots=makePlots(n.buildings,resourceLayout(g.seed,n,!!n.owner&&n.kind==='capital'));normalizeCityNames(g);upgradeBatch(g);for(const r of g.reports)r.read=false;
  return g;
}
const costs: Record<Terrain, number> = { grass: 100, field: 100, forest: 140, hill: 170, water: 220, mountain: 350 };
// Weighted A* keeps roads and marches on the same legal grid. Legacy cities
// are protected during migration; mountain cells never become route endpoints.
export function shortestRoute(a:Point,b:Point,seed:number,version:number,step:(from:Point,to:Point)=>number,minStep=1){
 const index=(p:Point)=>p.y*SIZE+p.x,start=index(a),goal=index(b);
 if(start===goal)return {path:[{x:a.x,y:a.y}],cost:0};
 if([a,b].some(p=>terrainAt(p.x,p.y,seed,version)==='mountain'))throw new Error('山脈不可通行');
 const distance=new Float64Array(SIZE*SIZE).fill(Infinity),previous=new Int32Array(SIZE*SIZE).fill(-1),closed=new Uint8Array(SIZE*SIZE);
 const heap:{index:number;priority:number}[]=[];
 const push=(entry:{index:number;priority:number})=>{let i=heap.length;heap.push(entry);while(i>0){const parent=(i-1)>>1;if(heap[parent].priority<=entry.priority)break;heap[i]=heap[parent];i=parent;}heap[i]=entry;};
 const pop=()=>{const top=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].priority<heap[child].priority)child++;if(heap[child].priority>=last.priority)break;heap[i]=heap[child];i=child;}heap[i]=last;}return top;};
 distance[start]=0;push({index:start,priority:0});
 while(heap.length){const current=pop().index;if(closed[current])continue;if(current===goal)break;closed[current]=1;
  const x=current%SIZE,y=Math.floor(current/SIZE),from={x,y};
  for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
   if(nx<0||nx>=SIZE||ny<0||ny>=SIZE)continue;
   const next=ny*SIZE+nx;
   if(closed[next]||terrainAt(nx,ny,seed,version)==='mountain')continue;
   const to={x:nx,y:ny},candidate=distance[current]+step(from,to);
   if(candidate>=distance[next])continue;
   distance[next]=candidate;previous[next]=current;
   push({index:next,priority:candidate+(Math.abs(b.x-nx)+Math.abs(b.y-ny))*minStep});
  }
 }
 if(!Number.isFinite(distance[goal]))throw new Error('山脈阻斷了路線');
 const path:Point[]=[];for(let at=goal;at!==-1;at=previous[at])path.push({x:at%SIZE,y:Math.floor(at/SIZE)});
 path.reverse();return {path,cost:distance[goal]};
}
export function route(a: Point, b: Point, seed: number, version=0) {
  if([a,b].some(p=>terrainAt(p.x,p.y,seed,version)==='mountain'))throw new Error('山脈不可通行');
  const path = [{x:a.x,y:a.y}]; let x = a.x, y = a.y, cost = 0;
  while (x !== b.x || y !== b.y) {
    const nx = x + Math.sign(b.x - x), ny = y + Math.sign(b.y - y);
    const next=x!==b.x&&(y===b.y||costs[terrainAt(nx,y,seed,version)]<=costs[terrainAt(x,ny,seed,version)])?{x:nx,y}:{x,y:ny};
    if(terrainAt(next.x,next.y,seed,version)==='mountain'&&(next.x!==b.x||next.y!==b.y))
      return shortestRoute(a,b,seed,version,(_from,to)=>costs[terrainAt(to.x,to.y,seed,version)]/100);
    x=next.x;y=next.y;
    cost += costs[terrainAt(x,y,seed,version)]; path.push({x,y});
  }
  return { path, cost: cost / 100 };
}
export function addStock(a: ReturnType<typeof emptyStock>, b: ReturnType<typeof emptyStock>, scale = 1) { for (const k of ['food','wood','stone','gold'] as const) a[k] += b[k] * scale; }

export function newGame(player:string,seed:number,speed:number,wall=Date.now()):Game{
 const g=legacyGame(player,seed,speed,wall),oldPlayer=player,original=g.factions;
 g.terrainVersion=1;g.mountainRevision=1;g.mountainClearings=[];configureMountains(g);
 const homes=g.nodes.filter(n=>n.kind==='capital'||(n.kind==='village'&&Number(n.id.split('_')[2])<=5));
 g.factions=homes.map((n,i)=>{const civilization=civilizations[Number(n.id.split('_')[1])].id,id=civilization+'~'+i,base=original.find(f=>f.id===civilization)!;if(n.owner===oldPlayer&&n.id===base.capital)g.player=id;n.owner=id;n.kind='capital';n.stock={...STARTING_STOCK};n.population=INITIAL_POPULATION;for(const b of buildingIds)n.buildings[b]=b==='hall'?1:0;n.troops={...emptyTroops(),militia:12,spear:4,scout:3};n.plots=makePlots(n.buildings);return {...structuredClone(base),protectionUntil:PROTECTION,id,civilization,name:lordName(id,g.seed),capital:n.id,intel:{},league:null,empire:null};});
 for(const n of g.nodes)if(n.owner&&!g.factions.some(f=>f.id===n.owner)){n.kind='ruins';n.owner=null;n.stock=emptyStock();n.population=0;n.troops=emptyTroops();for(const b of buildingIds)n.buildings[b]=0;n.plots=makePlots(n.buildings);}
 // Scatter all starting capitals across a jittered world grid, independent of culture.
 const cells=Array.from({length:36},(_,i)=>i).sort((a,b)=>hash(a,911,seed)-hash(b,911,seed));
 for(const [i,n] of homes.entries()){
  const cell=cells[i];let x=14+(cell%6)*40+hash(i,921,seed)%19,y=14+Math.floor(cell/6)*40+hash(i,922,seed)%19;
  for(let k=0;k<10000;k++){if(!['water','mountain'].includes(terrainAt(x,y,seed,g.terrainVersion))&&!g.nodes.some(other=>other!==n&&distance(other,{x,y})<4))break;x=8+(x+7)%240;y=8+(y+11)%240;}
  n.x=x;n.y=y;
 }
 g.events=g.events.filter(e=>e.type==='pulse');for(const [i,f] of g.factions.entries())if(f.id!==g.player)g.events.push({id:g.next++,at:(10+i)*MINUTE,type:'ai',ref:f.id});
 g.reports=g.reports.map(r=>({...r,owner:g.player,text:'河谷有36位獨立領主，同文明不代表同國。城郊十八塊資源地零級即產出，城內自由安排建設；斥候可探索資源營地，再與其他領主結成軍團。'}));g.campaign='lords-'+g.campaign;
 g.nodes=g.nodes.filter(n=>!isWildSite(n));
 repairWaterCities(g);for(const n of g.nodes)n.plots=makePlots(n.buildings,resourceLayout(g.seed,n,!!n.owner&&n.kind==='capital'));normalizeCityNames(g);upgradeBatch(g);for(const r of g.reports)r.read=false;
 initializeWildSites(g);
 return g;
}

// Deterministic legacy repair: preserve city IDs and contents; relocate only illegal water cities.
export function repairWaterCities(g:Game){
 for(const n of g.nodes){if(!['capital','village'].includes(n.kind)||terrainAt(n.x,n.y,g.seed,g.terrainVersion)!=='water')continue;
 const origin={x:n.x,y:n.y};let found=false;
 for(let r=1;r<256&&!found;r++)for(let dx=-r;dx<=r&&!found;dx++)for(let dy=-r;dy<=r;dy++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const q={x:origin.x+dx,y:origin.y+dy};if(q.x<0||q.y<0||q.x>=256||q.y>=256||terrainAt(q.x,q.y,g.seed,g.terrainVersion)==='water'||g.nodes.some(a=>a!==n&&!a.respawnAt&&a.x===q.x&&a.y===q.y))continue;n.x=q.x;n.y=q.y;found=true;break;}
 if(found){for(const m of g.marches){if(m.from===n.id&&m.path.length)m.path[0]={x:n.x,y:n.y};if(m.to===n.id&&m.path.length)m.path[m.path.length-1]={x:n.x,y:n.y};}}
 }
}
