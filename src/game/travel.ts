import {configureMountains} from './mountainRules';
import {mountainProfileKey} from './terrainRegions';
import { route, shortestRoute, terrainAt } from './legacyWorld';
import type { Game, Point } from './legacyTypes';

// Grid resolution changes detail, not the physical size of the campaign world.
export const secondsPerTile = (width = 256) => 15 * 256 / width;
const terrainCost = { grass: 1, field: 1, forest: 1.4, hill: 1.7, water: 2.2, mountain: 3.5 };
const pointKey = (p: Point) => `${p.x},${p.y}`;
const edgeKey = (a: Point, b: Point) => [pointKey(a), pointKey(b)].sort().join(':');
type Network = { key: string; edges: Map<string, number>; lines: { path: Point[]; speed: number }[]; routes: Map<string, { path: Point[]; cost: number }> };
const cache = new WeakMap<Game, Network>();
const sharedNetworks=new Map<string,Network>();
export function roadNetwork(g: Game): Network {
  configureMountains(g);
  const towns = g.nodes.filter(n => n.owner && ['capital','village'].includes(n.kind) && n.buildings.market > 0);
  const key = `${g.seed}:${g.terrainVersion??0}:${mountainProfileKey(g.seed)}|${towns.map(n => `${n.id}:${n.owner}:${n.x},${n.y}`).join('|')}|${g.factions.map(f => `${f.id}:${f.capital}:${f.era}:${f.tech.includes('logistics')}`).join('|')}`;
  const existing = cache.get(g); if (existing?.key === key) return existing;
  const shared=sharedNetworks.get(key);if(shared){cache.set(g,shared);return shared;}
  const network: Network = { key, edges: new Map(), lines: [], routes: new Map() };
  for (const f of g.factions) {
    const capital = towns.find(n => n.id === f.capital && n.owner === f.id); if (!capital) continue;
    const speed = f.era >= 2 && f.tech.includes('logistics') ? 2 : 1.5;
    for (const town of towns.filter(n => n.owner === f.id && n !== capital)) {
      const path = route(capital, town, g.seed,g.terrainVersion).path;
      network.lines.push({ path, speed });
      for (let i=1; i<path.length; i++) {
        const key = edgeKey(path[i-1],path[i]);
        network.edges.set(key,Math.max(speed,network.edges.get(key) ?? 1));
      }
    }
  }
  if(sharedNetworks.size>=8)sharedNetworks.delete(sharedNetworks.keys().next().value!);sharedNetworks.set(key,network);cache.set(g, network); return network;
}
export function pathCost(g: Game, path: Point[]) {
  const network=roadNetwork(g);
  return path.slice(1).reduce((sum,p,i) => sum + terrainCost[terrainAt(p.x,p.y,g.seed,g.terrainVersion)] / (network.edges.get(edgeKey(path[i],p)) ?? 1),0);
}
export function travelRoute(g: Game, a: Point, b: Point) {
  const network=roadNetwork(g), key=`${pointKey(a)}>${pointKey(b)}`;
  if([a,b].some(p=>terrainAt(p.x,p.y,g.seed,g.terrainVersion)==='mountain'))throw new Error('山脈不可通行');
  const saved=network.routes.get(key); if(saved)return saved;
  const path:Point[]=[{x:a.x,y:a.y}];let x=a.x,y=a.y,cost=0;
  const step=(p:Point,q:Point)=>terrainCost[terrainAt(q.x,q.y,g.seed,g.terrainVersion)]/(network.edges.get(edgeKey(p,q))??1);
  while(x!==b.x||y!==b.y){
    const p={x,y},nextX={x:x+Math.sign(b.x-x),y},nextY={x,y:y+Math.sign(b.y-y)};
    const next=x!==b.x&&(y===b.y||step(p,nextX)<=step(p,nextY))?nextX:nextY;
    if(terrainAt(next.x,next.y,g.seed,g.terrainVersion)==='mountain'&&(next.x!==b.x||next.y!==b.y)){
      const result=shortestRoute(a,b,g.seed,g.terrainVersion??0,step,.5);
      if(network.routes.size>=2048)network.routes.clear();network.routes.set(key,result);return result;
    }
    cost+=step(p,next);path.push(next);x=next.x;y=next.y;
  }
  const result={path,cost};if(network.routes.size>=2048)network.routes.clear();network.routes.set(key,result);return result;
}
