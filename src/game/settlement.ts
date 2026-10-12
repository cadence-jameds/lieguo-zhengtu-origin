import {SETTLEMENT_MIN_POPULATION} from '../config/realm';
import {resourceLayout} from './resourceFields';
import { buildingIds, emptyStock, emptyTroops, type Game, type Node, type Point, type Troops, unitIds, countTroops } from './legacyTypes';
import { defaultGovernor, makePlots } from './city';
import { uniqueCityName } from './cityNames';
import { SIZE, terrainAt } from './legacyWorld';

export const settlementCost = {food:350,wood:300,stone:650,gold:350};
export function tileReason(g: Game, p: Point) {
  if(!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.y)||p.x<0||p.y<0||p.x>=SIZE||p.y>=SIZE)return '這一格位於世界邊界外。';
  if(terrainAt(p.x,p.y,g.seed,g.terrainVersion)==='water')return '水域無法建城，請選擇陸地。';
  if(terrainAt(p.x,p.y,g.seed,g.terrainVersion)==='mountain')return '山脈無法通行，也無法建城。';
  const nodes=g.nodes.filter(n=>n.x===p.x&&n.y===p.y);
  if(nodes.some(n=>!n.respawnAt&&n.kind!=='ruins'))return '這一格已有城市或野外據點。';
  if(nodes.some(n=>g.marches.some(m=>m.to===n.id&&m.kind==='settle'&&m.status==='outbound')))return '已有拓殖隊前往這一格。';
  if(nodes.some(n=>g.factions.some(f=>f.exile?.refuge===n.id)))return '這一格已供流亡政府安置。';
  if(g.nodes.length>=4096&&!nodes.some(n=>n.kind==='ruins'&&!n.owner))return '本戰役已達城市與據點容量上限。';
  return '';
}
export function settleReason(g: Game, from: Node, p: Point, owner=g.player) {
  const terrain=tileReason(g,p);if(terrain)return terrain;
  if((g.factions.find(f=>f.id===owner)?.era??0)<2)return '城堡時代才能派遣拓殖隊建城。';
  if(from.owner!==owner||!['capital','village'].includes(from.kind))return '請從自己的城市派遣居民。';
  if(from.population<SETTLEMENT_MIN_POPULATION)return '出發城市需至少 600 人，建城將移出 400 名居民、保留至少 200 人。';
  if(Object.entries(settlementCost).some(([r,v])=>from.stock[r as keyof typeof settlementCost]<v))return '建城資源不足。';
  return '';
}
export function makeSettlement(g: Game, p: Point): Node {
  const existing=g.nodes.find(n=>n.x===p.x&&n.y===p.y&&n.kind==='ruins'&&!n.owner);
  if(existing)return existing;
  const buildings=Object.fromEntries(buildingIds.map(b=>[b,0])) as Node['buildings'];
  return {...p,id:`founded_${g.next++}`,name:uniqueCityName(g),kind:'ruins',owner:null,stock:emptyStock(),population:0,integration:100,stability:100,buildings,troops:emptyTroops(),build:[],train:[],policy:'balanced',plots:makePlots(buildings,resourceLayout(g.seed,p)),governor:defaultGovernor()};
}

export const MIN_SETTLEMENT_ESCORT=10;
export function escortReason(from:Node,troops:Troops){
 if(unitIds.some(u=>!Number.isSafeInteger(troops[u])||troops[u]<0||troops[u]>from.troops[u]))return '護送兵力超過駐軍或數量無效。';
 if(troops.scout>0)return '斥候只能偵察，不能護送建城。';
 return countTroops(troops)<MIN_SETTLEMENT_ESCORT?'建城至少需要 10 名戰鬥兵護送。':'';
}
export function settlementEscort(from:Node):Troops {
 const troops=emptyTroops();let remaining=MIN_SETTLEMENT_ESCORT;
 for(const u of unitIds.filter(u=>u!=='scout')){troops[u]=Math.min(remaining,from.troops[u]);remaining-=troops[u];}
 return troops;
}
