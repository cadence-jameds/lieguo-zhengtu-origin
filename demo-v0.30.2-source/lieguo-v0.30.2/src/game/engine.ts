import {configureMountains} from './mountainRules';
import {relocateWildSite,wildCooldown,pruneRetiredWildSites} from './wildSpawns';
import {MIN_CIVILIAN_POPULATION,TOWN_POPULATION,SETTLER_POPULATION,SETTLEMENT_MIN_POPULATION,RECRUIT_POPULATION_PER_UNIT,MARKET_GOLD_PER_LEVEL,GOVERNOR_GARRISON,GOVERNOR_FOOD_BUFFER,GOVERNOR_TRAIN_BATCH,GOVERNOR_THREAT_REINFORCEMENT,GOVERNOR_RESERVE_SLOTS,GOVERNOR_UNIT_WEIGHTS} from '../config/realm';
import {appendMessage,importantMessage,reportRealAt} from './messages';
import {mapColors,mapRelationOwner} from './mapRelations';
import {resourceLayout} from './resourceFields';
import {battleTempo,traits,inheritPolicy,updateLeaderboard,runTrade,validRoute,transportUsed} from './realmSystems';
import { BASE_PRODUCTION, RESOURCE_OUTPUT, LEVEL_OUTPUT, BUILD_COST_GROWTH, buildSeconds, SOLDIER_UPKEEP, POPULATION_BASE_GROWTH, POPULATION_HALL_GROWTH, HOUSING_PER_LEVEL } from './balance';
import { travelRoute, pathCost, secondsPerTile } from './travel';
import { rememberObjectives } from './progress';
import { siteStock, siteTroops } from './npc';
import { makeSettlement, settlementCost, settleReason, tileReason, escortReason, settlementEscort } from './settlement';
import {lordName} from '../content/lordNames';
import { repeatableBuilding, buildingLevels, totalBuildingLevel, refreshBuildingLevel, plotLevel, foundationReason, resourceBuildings, constructionPlot, plotAccepts, policies, makePlots } from './city';
import { cultureId } from '../content/civilizations';
import {organizationName,suggestOrganization,nameReason,empireFor} from './organizations';
import {empireUiColor} from './empirePalette';
import {CELLAR_PROTECTION,CARAVAN_CAPACITY} from './balance';
import { technologyRequirements, resourceNames, buildings, units, unitStats, signatureStats, research, HEGEMONY_HOLD } from './content';
import { distance, terrainAt, addStock, hash } from './world';
import { HOUR, MINUTE, resources, unitIds, emptyStock, emptyTroops, countTroops, type Game, type Faction, type CommandEnvelope, type Node, type Troops, type Stock, type Command, type Building, type Unit, type Research, type Event, type March, type Report } from './types';

// Entity IDs are stable; rebuilding only on array replacement or membership changes
// avoids nested full-world scans during population, supply and AI catch-up.
const nodesByGame=new WeakMap<Game,{array:Node[];size:number;index:Map<string,Node>}>();
const factionsByGame=new WeakMap<Game,{array:Faction[];size:number;index:Map<string,Faction>}>();
export function node(g:Game,id:string){let entry=nodesByGame.get(g);if(!entry||entry.array!==g.nodes||entry.size!==g.nodes.length){entry={array:g.nodes,size:g.nodes.length,index:new Map(g.nodes.map(n=>[n.id,n]))};nodesByGame.set(g,entry);}return entry.index.get(id)!;}
export function faction(g:Game,id:string){let entry=factionsByGame.get(g);if(!entry||entry.array!==g.factions||entry.size!==g.factions.length){entry={array:g.factions,size:g.factions.length,index:new Map(g.factions.map(f=>[f.id,f]))};factionsByGame.set(g,entry);}return entry.index.get(id)!;}
export const owned = (g: Game, id: string) => g.nodes.filter(n => n.owner === id && (n.kind === 'capital' || n.kind === 'village'));
export const factionName = (g:Game,id:string|null) => {if(!id)return '中立';const f=faction(g,id);return f?.name&&(id===g.player||!/^領主\s*\d+$/.test(f.name))?f.name:lordName(id,g.seed);};
export const armyTotal = (g: Game, id: string) => g.nodes.filter(n => n.owner === id).reduce((s,n) => s + countTroops(n.troops),0) + g.marches.filter(m => m.owner === id).reduce((s,m) => s + countTroops(m.troops),0);
export const protectionLimit=(n:Node)=>buildingLevels(n,'cellar').reduce((s,l)=>s+(CELLAR_PROTECTION[l]??0),0);
export const protectedStock=(n:Node,r:keyof Stock)=>['capital','village'].includes(n.kind)?Math.min(n.stock[r],protectionLimit(n)):0;
export const capacity = (n: Node) => 2500 + totalBuildingLevel(n,'warehouse') * 2500;
export const housing = (n: Node) => TOWN_POPULATION + totalBuildingLevel(n,'house') * HOUSING_PER_LEVEL;
export const cityLevel = (n: Node) => n.population >= 1600 ? '城市' : n.population >= 800 ? '城鎮' : n.population >= 450 ? '村莊' : '聚落';
export const canPay = (n: Node, cost: Stock) => resources.every(r => n.stock[r] >= cost[r]);
const pay = (n: Node, cost: Stock) => addStock(n.stock, cost, -1);
export const buildCost = (n: Node, b: Building, plot?:number): Stock => Object.fromEntries(resources.map(r => [r, Math.ceil(buildings[b].cost[r] * BUILD_COST_GROWTH ** plotLevel(n,b,plot??constructionPlot(n,b)?.id))])) as Stock;
export const buildDuration=(n:Node,b:Building,plot?:number)=>buildSeconds(b)[Math.min(4,plotLevel(n,b,plot??constructionPlot(n,b)?.id))]*1000;
export const recruitablePopulation=(n:Node)=>Math.max(0,Math.floor((n.population-MIN_CIVILIAN_POPULATION)/RECRUIT_POPULATION_PER_UNIT));
export const trainDuration=(n:Node,u:Unit,count:number)=>Math.ceil(units[u].minutes*MINUTE*count/(1+n.buildings[units[u].building]*.15)*(cultureId(n.owner)==='civ_japan'?.9:1));
export function trainCost(_g: Game, n: Node, u: Unit, count: number): Stock {
  return Object.fromEntries(resources.map(r => [r, Math.ceil(unitStats(u,n.owner!).cost[r] * count)])) as Stock;
}
function marchingFood(g:Game){
  const totals=new Map<string,number>();
  for(const m of g.marches){const supplied=m.supplyCity??(m.status==='returning'?m.to:m.from),home=node(g,supplied)?.owner===m.owner?supplied:faction(g,m.owner).capital;totals.set(home,(totals.get(home)??0)+countTroops(m.troops));}
  for(const n of g.nodes)if(n.owner&&!['capital','village'].includes(n.kind)){const home=faction(g,n.owner).capital;totals.set(home,(totals.get(home)??0)+countTroops(n.troops));}
  return totals;
}
export function productionDetail(g:Game,n:Node,r:keyof Stock,foodLedger?:Map<string,number>){
  const rows:{label:string;value:number}[]=BASE_PRODUCTION[r]?[{label:'基礎收入',value:BASE_PRODUCTION[r]}]:[];
  const building=({food:'farm',wood:'lumber',stone:'quarry',gold:'mine'} as const)[r];
  for(const p of n.plots.filter(p=>p.building===building)){const level=plotLevel(n,building,p.id);rows.push({label:buildings[building].name+' Lv.'+level+' · 城郊 '+(p.id-16),value:LEVEL_OUTPUT[Math.min(5,level)]*RESOURCE_OUTPUT[r]});}
  if(r==='gold')for(const p of n.plots.filter(p=>p.building==='market'))rows.push({label:'市場 '+p.id+' · Lv.'+plotLevel(n,'market',p.id),value:plotLevel(n,'market',p.id)*MARKET_GOLD_PER_LEVEL});
  let total=rows.reduce((s,row)=>s+row.value,0);
  const factor=(label:string,m:number)=>{if(m!==1){const value=total*(m-1);rows.push({label,value});total*=m;}};
  factor('統治初定',Math.max(.35,n.integration/100));
  factor('中國文明 +5%',cultureId(n.owner)==='civ_zhongguo'?1.05:1);
  factor('城市方針',n.policy==='food'?(r==='food'?1.3:.9):n.policy==='industry'?(r!=='food'?1.2:.8):1);
  factor('法蘭克文明 +12%',cultureId(n.owner)==='civ_frankia'&&r==='food'?1.12:1);
  const tech=n.owner?faction(g,n.owner).tech:[];
  factor('農業科技',r==='food'?1+(tech.includes('agriculture')?.1:0)+(tech.includes('irrigation')?.15:0):1);
  factor('木工技術 +10%',r==='wood'&&tech.includes('carpentry')?1.1:1);
  if(r==='food'){const local=countTroops(n.troops),external=(foodLedger??marchingFood(g)).get(n.id)??0;rows.push({label:'本城駐軍 '+local+' 名',value:-local*SOLDIER_UPKEEP},{label:'出征與外駐部隊 '+external+' 名',value:-external*SOLDIER_UPKEEP});total-=(local+external)*SOLDIER_UPKEEP;}
  return {rows,total};
}
// The minute pulse needs totals only. Keep the detailed ledger for the UI, but
// avoid allocating four lists of display rows and repeatedly searching plots
// for every city on every world minute.
const resourceFromBuilding:Partial<Record<Building,keyof Stock>>={farm:'food',lumber:'wood',quarry:'stone',mine:'gold'};
export function production(g:Game,n:Node,foodLedger?:Map<string,number>):Stock{
  const ledger=foodLedger??marchingFood(g);
  const totals:Stock={...BASE_PRODUCTION};
  for(const p of n.plots){
    const r=resourceFromBuilding[p.building as Building];
    if(r){const level=p.level??n.buildings[p.building as Building];totals[r]+=LEVEL_OUTPUT[Math.min(5,level)]*RESOURCE_OUTPUT[r];}
    else if(p.building==='market')totals.gold+=(p.level??n.buildings.market)*MARKET_GOLD_PER_LEVEL;
  }
  const civ=cultureId(n.owner),tech=n.owner?faction(g,n.owner).tech:[];
  const integration=Math.max(.35,n.integration/100);
  for(const r of resources){
    let value=totals[r]*integration;
    if(civ==='civ_zhongguo')value*=1.05;
    if(n.policy==='food')value*=r==='food'?1.3:.9;
    else if(n.policy==='industry')value*=r!=='food'?1.2:.8;
    if(civ==='civ_frankia'&&r==='food')value*=1.12;
    if(r==='food')value*=1+(tech.includes('agriculture')?.1:0)+(tech.includes('irrigation')?.15:0);
    if(r==='wood'&&tech.includes('carpentry'))value*=1.1;
    totals[r]=value;
  }
  totals.food-=(countTroops(n.troops)+(ledger.get(n.id)??0))*SOLDIER_UPKEEP;
  return totals;
}
export function rankings(g: Game) {
  const ranks=g.factions.map(f=>({id:f.id,cities:0,population:0,military:0,economy:0})),byOwner=new Map(ranks.map(r=>[r.id,r])),food=marchingFood(g);
  for(const n of g.nodes){const rank=n.owner?byOwner.get(n.owner):undefined;if(!rank)continue;rank.military+=countTroops(n.troops);if(['capital','village'].includes(n.kind)){rank.cities++;rank.population+=Math.floor(n.population);rank.economy+=Object.values(production(g,n,food)).reduce((a,b)=>a+b,0);}}
  for(const m of g.marches){const rank=byOwner.get(m.owner);if(rank)rank.military+=countTroops(m.troops);}
  return ranks;
}
export function overlord(g: Game, id: string) {
  let current=id;const seen=new Set<string>();
  while(!seen.has(current)){seen.add(current);const parent=faction(g,current)?.vassal;if(!parent)return current;current=parent;}
  return id;
}
export function diplomaticStrength(g: Game, id: string) {
  const ranks=rankings(g),base=ranks.find(r=>r.id===id)!;
  // Autonomous subjects contribute political backing, not free units or direct-rule credit.
  const subjects=ranks.filter(r=>r.id!==id&&overlord(g,r.id)===id);
  return {military:base.military+subjects.reduce((s,r)=>s+r.military*.5,0),population:base.population+subjects.reduce((s,r)=>s+r.population*.5,0)};
}
export function diplomacyLeader(g:Game,id:string):string|null{const f=faction(g,id);if(!f)return null;const top=overlord(g,id),emperor=empireFor(g,top);if(emperor)return emperor;return faction(g,top)?.league??(f.empire?id:null);}
export const canDiplomacy=(g:Game,id:string)=>diplomacyLeader(g,id)===id;
export function sharedLeagueOrEmpire(g:Game,a:string,b:string){const left=faction(g,a),right=faction(g,b),emperor=empireFor(g,a);return !!(left?.league&&left.league===right?.league||emperor&&emperor===empireFor(g,b));}
export function relation(g: Game, a: string, b: string) {
  if (a === b) return 'own';
  if(faction(g,a)?.league&&faction(g,a).league===faction(g,b)?.league)return 'alliance';
  if(overlord(g,a)===overlord(g,b))return 'vassal';
  const aa=diplomacyLeader(g,a)??a,bb=diplomacyLeader(g,b)??b;
  if(aa===bb)return 'alliance';
  const t = g.treaties.find(t => t.until>g.time&&((t.a === aa && t.b === bb) || (t.a === bb && t.b === aa)))??g.treaties.find(t=>t.until>g.time&&((t.a===a&&t.b===b)||(t.a===b&&t.b===a)));
  return t && t.until > g.time ? t.kind : 'peace';
}
export const protectedFaction = (g: Game, id: string) => g.time < (id===g.player?g.protectionUntil:faction(g,id)?.protectionUntil??0);
function schedule(g: Game, type: Event['type'], at: number, ref: Event['ref']) { const e = { id: g.next++, type, at, ref }; g.events.push(e); return e.id; }
function report(g: Game, r: Omit<Report,'id'|'at'>) {
  appendMessage(g,r);
  if(r.owner===g.player&&r.kind==='scout'&&r.enemyAfter)rememberObjectives(g,true);
}
function intel(g: Game, owner: string, n: Node, scouted=false) { faction(g,owner).intel[n.id] = { generation:n.generation??0,era:n.owner?faction(g,n.owner).era:0,scouted,at:g.time,...(scouted?{realAt:reportRealAt(g)}:{}),troops: Object.fromEntries(unitIds.map(u=>[u,n.troops[u]+g.marches.filter(m=>m.stationed&&m.kind==='reinforce'&&m.to===n.id).reduce((sum,m)=>sum+m.troops[u],0)])) as Troops, wall: n.buildings.wall, owner: n.owner, stock:{...n.stock},tech:n.owner?[...faction(g,n.owner).tech]:[],stability:n.stability,supplied:n.stock.food>0 }; }
function random(g: Game) { g.rng ^= g.rng << 13; g.rng ^= g.rng >>> 17; g.rng ^= g.rng << 5; g.rng >>>= 0; return g.rng / 4294967296; }
function treaty(g: Game, a: string, b: string, kind: 'war'|'truce'|'alliance', until: number) { g.treaties = g.treaties.filter(t => !((t.a === a && t.b === b) || (t.a === b && t.b === a))); g.treaties.push({a,b,kind,until}); }
function endProtection(g: Game, a: string) {
  const protectedBefore=protectedFaction(g,a),attacker=faction(g,a);attacker.protectionUntil=Math.min(attacker.protectionUntil??0,g.time);
  if (a === g.player) {g.protectionUntil=Math.min(g.protectionUntil,g.time);if(protectedBefore)report(g,{owner:a,kind:'system',title:'新手保護已解除',text:'你已對其他領主發出敵對命令（包含偵察），新手保護立即且永久結束；撤回部隊不會恢復。敵軍仍需正常集結與行軍。'});}
}
function declareWar(g: Game, a: string, b: string) {
  treaty(g,diplomacyLeader(g,a)??a,diplomacyLeader(g,b)??b,'war',Number.MAX_SAFE_INTEGER);
  endProtection(g,a);
}
export function trainReason(g: Game, n: Node, u: Unit) {
  if (!n.owner) return '不是己方城市';
  if (faction(g,n.owner).era < units[u].era) return '需要' + ['黑暗','封建','城堡'][units[u].era] + '時代';
  if (!n.buildings[units[u].building]) return '需要' + buildings[units[u].building].name;
  if (u === 'siege' && n.buildings.workshop < 2) return '需要二級攻城工坊';
  return '';
}
export function researchReason(g: Game, n: Node, key: Research) {
  const f = faction(g,n.owner!);
  const isEra=key==='feudal'||key==='castle';
  if(isEra?f.eraUpgrade:f.research)return isEra?'已有時代晉升進行中':'已有科技研究進行中';
  if (f.tech.includes(key)) return '已完成';
  if ((key==='feudal'||key==='castle')&&!n.buildings.academy) return '需要學院 1';
  if(key!=='feudal'&&key!=='castle'){const need=technologyRequirements[key];if(f.era<need.era)return '需要'+['黑暗','封建','城堡'][need.era]+'時代';if(n.buildings[need.building]<need.level)return '需要'+buildings[need.building].name+' '+need.level;if(need.previous&&!f.tech.includes(need.previous))return '需先研發'+research[need.previous].name;}
  if(n.stability<50||n.stock.food<=0||housing(n)<n.population)return '需要穩定至少 50、存糧與足夠住房';
  if (key === 'feudal' && (n.buildings.hall < 2 || n.population < 450)) return '需要城市中心 2、人口 450';
  if (key === 'castle' && (f.era < 1 || n.buildings.hall < 3 || n.population < 800 || n.buildings.barracks < 2)) return '需要封建時代、城市中心 3、人口 800、兵營 2';
  if ((key === 'logistics' || key === 'steel') && f.era < 1) return '需要封建時代';
  if (key === 'steel' && n.buildings.barracks < 2) return '需要兵營 2';
  return '';
}
export function marchTimeForCost(g: Game, cost: number, troops: Troops, kind: string, owner:string) {
  const speed = Math.min(...unitIds.filter(u => troops[u] > 0).map(u => unitStats(u,owner).speed), kind === 'transport' ? 1.2 : Infinity);
  const f = faction(g,owner);
  let time = cost * secondsPerTile() * 1000 / (Number.isFinite(speed) ? speed : 1);
  time *= cultureId(f.id) === 'civ_mongol' ? .85 : cultureId(f.id) === 'civ_britannia' && kind === 'scout' ? .8 : 1;
  if (f.tech.includes('logistics')) time *= .85;
  return Math.ceil(time);
}
export const marchDuration=(g:Game,from:Node,to:Node,troops:Troops,kind:string,owner=from.owner!)=>marchTimeForCost(g,travelRoute(g,from,to).cost,troops,kind,owner);
function validTroops(t: Troops) { return unitIds.every(u => Number.isSafeInteger(t[u]) && t[u] >= 0); }
function finishReturn(g: Game, m: March) {
  const homes = owned(g,m.owner);
  let dest = node(g,m.from);
  if (dest.owner !== m.owner) dest = homes.sort((a,b) => distance(a,node(g,m.to)) - distance(b,node(g,m.to)))[0];
  if (!dest) { const ex=faction(g,m.owner).exile;if(ex){for(const u of unitIds)ex.troops[u]+=m.troops[u];addStock(ex.stock,m.cargo);}
    report(g,{ owner:m.owner,kind:'system',title:'部隊撤離戰區',text:'已無可接收部隊的城市。殘軍隨流亡政權退出本次戰役。'}); g.marches = g.marches.filter(x => x.id !== m.id); return; }
  const start = {...node(g,m.to),...(m.path.at(-1)??{})};
  m.from = start.id; m.to = dest.id; m.started = g.time; m.at = g.time + marchDuration(g,start,dest,m.troops,'return',m.owner);
  m.path = travelRoute(g,start,dest).path; m.status = 'returning'; delete m.retreatAt;delete m.stationed;
  schedule(g,'arrive',m.at,m.id);
}
export function command(g: Game, c: Command, owner = g.player): string {
 configureMountains(g);
  if(g.defeat&&!['restore_realm','end_realm','reports','rename','tile_favorite'].includes(c.type))return '已被擊敗，世界時間停止。請選擇復國或結束本局。';
  if (g.result && !g.sandbox && c.type !== 'continue' && c.type !== 'rename' && c.type !== 'reports' && c.type!=='restore_realm' && c.type!=='end_realm' && c.type!=='tile_favorite') return '戰役已結束，請選擇繼續經營或開始新戰役。';
  const f = faction(g,owner);
  if (!f) return '未知的文明';
  const fail = (s: string) => s;
  if(c.type==='tile_favorite'){
    const at=c.at;if(owner!==g.player||!at||![at.x,at.y].every(v=>Number.isSafeInteger(v)&&v>=0&&v<256))return fail('無效的收藏地塊。');
    const current=g.favoriteTiles??[],exists=current.some(p=>p.x===at.x&&p.y===at.y);
    if(c.action==='add'){if(exists)return fail('這塊地已在我的最愛。');if(current.length>=5)return fail('最多收藏五組地塊，請先移除一組。');const reason=tileReason(g,at);if(reason)return fail(reason);g.favoriteTiles=[...current,{...at}];}
    else if(c.action==='remove'){if(!exists)return fail('找不到收藏的地塊。');g.favoriteTiles=current.filter(p=>p.x!==at.x||p.y!==at.y);}
    else return fail('無效的收藏操作。');
  } else if(c.type==='governor_default'){
    const d=c.settings;if(!d||!policies.includes(d.policy)||![d.budget,d.reserve].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=10000))return fail('無效的帝國預設');for(const n of owned(g,owner))if(n.policyOverride===undefined&&(n.governor.enabled||n.policy!=='balanced'))n.policyOverride=true;f.governorDefaults={...d};for(const n of owned(g,owner))inheritPolicy(g,n);
  } else if(c.type==='governor_inherit'){
    if(!c.cities.length||c.cities.some(id=>node(g,id)?.owner!==owner))return fail('請選擇自己的城市');for(const id of c.cities){node(g,id).policyOverride=false;inheritPolicy(g,node(g,id));}
  } else if(c.type==='trade_route'){
    if(!validRoute(g,c.route,owner)||(!c.id&&(g.routes?.length??0)>=200))return fail('請檢查運輸城市、數量與目標庫存');if(c.id){const r=g.routes?.find(r=>r.id===c.id&&r.owner===owner);if(!r)return fail('找不到運輸路線');Object.assign(r,structuredClone(c.route));r.status='設定已更新，下趟生效';runTrade(g,r);g.log.push({at:g.time,type:c.type,owner});if(g.log.length>200)g.log.shift();return '';}const r={...structuredClone(c.route),id:g.next++,owner,status:'等待運輸'};(g.routes??=[]).push(r);runTrade(g,r);
  } else if(c.type==='trade_toggle'){
    const r=g.routes?.find(r=>r.id===c.id&&r.owner===owner);if(!r)return fail('找不到運輸路線');r.enabled=c.enabled;r.status=c.enabled?'等待運輸':'已停止';if(r.enabled)runTrade(g,r);
  } else if(c.type==='end_realm'){
    if(!g.defeat)return fail('目前並未滅國');g.defeat.ended=true;
  } else if(c.type==='reports'){
    if(owner!==g.player||!Array.isArray(c.ids)||c.ids.length>g.reports.length||!c.ids.every(id=>Number.isSafeInteger(id)&&id>=0)||!['read','clear'].includes(c.action))return fail('無效的消息操作。');
    rememberObjectives(g,true);
    const ids=new Set(c.ids);
    const affected=g.reports.filter(r=>r.owner===owner&&ids.has(r.id)&&r.read===false);
    g.reportUnread=Math.max(0,(g.reportUnread??affected.length)-affected.length);
    g.reportAlerts=Math.max(0,(g.reportAlerts??affected.length)-affected.filter(r=>importantMessage(r)||['battle','scout','diplomacy'].includes(r.kind)||/敵軍|來襲|警報/.test(r.title)).length);
    if(c.action==='read')for(const r of g.reports){if(r.owner===owner&&ids.has(r.id))r.read=true;}
    else g.reports=g.reports.filter(r=>r.owner!==owner||!ids.has(r.id));
    return '';
  } else if(c.type==='settle_at'){
    const from=node(g,c.from);if(!from||!c.at)return fail('請選擇出發城市與地圖位置。');
    const troops=c.troops??emptyTroops();const reason=settleReason(g,from,c.at,owner)||escortReason(from,troops);if(reason)return fail(reason);
    if(c.name!==undefined&&(!c.name.trim()||c.name.trim().length>24||/[\x00-\x1f\x7f]/.test(c.name)))return fail('城名需為 1～24 字。');
    const target=makeSettlement(g,c.at);if(c.name){target.name=c.name.trim();target.customName=owner===g.player;}if(!g.nodes.includes(target))g.nodes.push(target);
    return command(g,{type:'march',from:from.id,to:target.id,kind:'settle',troops},owner);
  } else if(c.type==='rename_city'){
    const city=node(g,c.city),name=typeof c.name==='string'?c.name.trim():'';if(!city||city.owner!==owner||!['capital','village'].includes(city.kind))return fail('只能修改自己的城市。');if(!name||name.length>24||/[\x00-\x1f\x7f]/.test(name))return fail('城名需為 1～24 字。');city.name=name;city.customName=owner===g.player;
  } else if(c.type==='rename'){
    if(owner!==g.player)return fail('只能修改自己的名字。');
    const name=typeof c.name==='string'?c.name.trim():'';
    if(!name||name.length>24||/[\x00-\x1f\x7f]/.test(name))return fail('請輸入 1～24 字的名字，不可包含換行。');
    f.name=name;
  } else if (c.type === 'build' || c.type === 'cancel_build' || c.type === 'train' || c.type === 'research' || c.type === 'policy' || c.type === 'demolish') {
    const n = node(g,c.city);
    if (!n || n.owner !== owner || !['capital','village'].includes(n.kind)) return fail('只能在自己的城市下令。');
    if (c.type === 'cancel_build') {
      const index=n.build.findIndex(j=>j.id===c.job);
      if(index<0)return fail('找不到這筆工程。');
      const job=n.build[index];
      if(index===0||job.started===undefined||job.started<=g.time)return fail('施工中的工程無法取消。');
      if(job.action!=='demolish')addStock(n.stock,buildCost(n,job.item as Building,job.plot));
      n.build.splice(index,1);
      g.events=g.events.filter(e=>e.id!==job.id);
      let at=index? n.build[index-1].at:g.time;
      for(const later of n.build.slice(index)){
        const span=later.at-(later.started??at);
        later.started=at;later.at=at+span;at=later.at;
        const event=g.events.find(e=>e.id===later.id);if(event)event.at=later.at;
      }
      report(g,{owner,kind:'system',node:n.id,title:'取消工程 · '+n.name,text:buildings[job.item as Building].name+'已從排隊工程取消，建材退回城市庫存。'});
    } else if (c.type === 'policy') {
      if (!policies.includes(c.policy)) return fail('未知政策');
      n.policy = c.policy; n.policyOverride=true;
    } else if(c.type==='demolish'){
      const plot=n.plots.find(p=>p.id===c.plot), b=plot?.building;
      if(!plot||!b||!n.buildings[b])return fail('這裡沒有可拆除的建築。');
      if(['hall','farm','lumber','quarry','mine'].includes(b))return fail('城市中心與天然資源據點不可拆除。');
      if(n.build.length>=3||n.build.some(j=>j.plot===plot.id))return fail('請先等候建造工程完成。');
      if(n.train.some(j=>units[j.item as Unit].building===b))return fail('請先等候這座建築的訓練完成。');
      if(b==='academy'&&(f.research||f.eraUpgrade))return fail('請先等候研究完成。');
      const at=Math.max(g.time,n.build.at(-1)?.at??0)+plotLevel(n,b,plot.id)*15*MINUTE;
      const id=schedule(g,'build',at,n.id);n.build.push({started:at-plotLevel(n,b,plot.id)*15*MINUTE,id,item:b,quantity:1,at,owner,plot:plot.id,action:'demolish'});
    } else if (c.type === 'build') {
      const gate=foundationReason(n,c.building);if(gate)return fail(gate);
      if (!buildings[c.building]) return fail('未知建築');
      const plot=constructionPlot(n,c.building,c.plot);
      if(!plot||!plotAccepts(plot,c.building)||(plot.building&&plot.building!==c.building))return fail('這塊地無法建造此建築。');
      if(!repeatableBuilding(c.building)&&n.plots.some(p=>p.id!==plot.id&&p.building===c.building))return fail('每座城市同類建築一座；可升級增加效益。');
      if(n.build.some(j=>j.plot===plot.id))return fail('這塊地已有工程。');
      const b = buildings[c.building], cost = buildCost(n,c.building,plot.id);
      if (f.era < b.era) return fail('尚未到達所需時代。');
      if (plotLevel(n,c.building,plot.id) >= 5) return fail('測試版最高五級。');
      if (n.build.length >= 3) return fail('建造佇列已滿。');
      if (!repeatableBuilding(c.building)&&n.build.some(j => j.item === c.building)) return fail('此建築已在佇列中。');
      if (!canPay(n,cost)) return fail('這座城市的資源不足。');
      for(const p of n.plots)if(p.building&&p.level===undefined)p.level=n.buildings[p.building];
      pay(n,cost); const at = Math.max(g.time,n.build.at(-1)?.at ?? 0) + buildDuration(n,c.building,plot.id);
      const id = schedule(g,'build',at,n.id); n.build.push({started:at-buildDuration(n,c.building,plot.id),id,item:c.building,quantity:1,at,owner,plot:plot.id,action:'build'});
    } else if (c.type === 'train') {
      const gate=foundationReason(n);if(gate)return fail(gate);
      if (!units[c.unit] || !Number.isSafeInteger(c.count) || c.count < 1 || c.count > 500) return fail('每批招募 1～500 名。');
      const reason = trainReason(g,n,c.unit); if (reason) return fail(reason);
      if (n.train.length >= 3) return fail('訓練佇列已滿。');
      if(c.count>recruitablePopulation(n))return fail('人口不足：徵兵後需保留 '+MIN_CIVILIAN_POPULATION+' 名居民，目前最多可募 '+recruitablePopulation(n)+' 名。');
      const cost = trainCost(g,n,c.unit,c.count); if (!canPay(n,cost)) return fail('這座城市的資源不足。');
      pay(n,cost);n.population-=c.count*RECRUIT_POPULATION_PER_UNIT; const at = Math.max(g.time,n.train.at(-1)?.at ?? 0) + trainDuration(n,c.unit,c.count);
      const id = schedule(g,'train',at,n.id); n.train.push({id,item:c.unit,quantity:c.count,at,owner});
    } else {
      const gate=foundationReason(n);if(gate)return fail(gate);
      if (!research[c.research]) return fail('未知研究');
      const reason = researchReason(g,n,c.research); if (reason) return fail(reason);
      if (!canPay(n,research[c.research].cost)) return fail('這座城市的資源不足。');
      pay(n,research[c.research].cost); const at = g.time + research[c.research].duration;
      const id = schedule(g,'research',at,n.id); f[c.research==='feudal'||c.research==='castle'?'eraUpgrade':'research'] = {id,item:c.research,quantity:1,at,owner};
    }
  } else if (c.type === 'march') {
    const a = node(g,c.from), b = node(g,c.to);
    if (!a || !b || a.owner !== owner || a === b) return fail('請選擇不同的出發城市與目標。');
    if (!['scout','raid','occupy','reinforce','transport','settle'].includes(c.kind)) return fail('未知行軍命令。');
    if (!validTroops(c.troops) || unitIds.some(u => c.troops[u] > a.troops[u])) return fail('出征兵力超過駐軍或數量無效。');
    if(c.kind!=='scout'&&c.troops.scout>0)return fail('斥候只能執行偵察任務。');
    const cargo = c.cargo ?? emptyStock();
    if (resources.some(r => !Number.isFinite(cargo[r]) || cargo[r] < 0)) return fail('無效的運輸數量。');
    if(b.respawnAt||b.retiring)return fail('此據點已被清除，請選擇其他目標。');
    if (c.kind !== 'transport' && resources.some(r => cargo[r] !== 0)) return fail('只有商隊能攜帶資源。');
    if (!['transport','settle'].includes(c.kind) && !countTroops(c.troops)) return fail('請編入出征部隊。');
    if (c.kind === 'scout' && (c.troops.scout < 1 || countTroops(c.troops) !== c.troops.scout)) return fail('偵察隊只能編入斥候。');
    if (c.kind === 'occupy' && countTroops(c.troops)-c.troops.scout < 12) return fail('佔領至少需要 12 名戰鬥兵。');
    if(c.kind==='settle'){
      if(b.kind!=='ruins'||b.owner)return fail('請在未佔用的陸地建立新城。');
      const reason=settleReason(g,a,b,owner)||escortReason(a,c.troops);if(reason)return fail(reason);
      pay(a,settlementCost);a.population-=SETTLER_POPULATION;
    }else if (['reinforce','transport'].includes(c.kind)) {
      if (b.owner!==owner&&!(c.kind==='reinforce'&&b.owner&&sharedLeagueOrEmpire(g,owner,b.owner)))return fail('只能運送至己方城市，或派部隊支援軍團成員。');
      if (c.kind === 'transport') {
        if (!a.buildings.market) return fail('出發城市需要市場。');
        if (Object.values(cargo).reduce((s,v) => s+v,0) <= 0 || Object.values(cargo).reduce((s,v) => s+v,0) > totalBuildingLevel(a,'market')*2500) return fail('運量須在 1 至市場等級 × 2,500 之間。');
        const inUse=transportUsed(g,a.id);
        if(inUse+Math.ceil(Object.values(cargo).reduce((s,v)=>s+v,0)/CARAVAN_CAPACITY)*CARAVAN_CAPACITY>totalBuildingLevel(a,'market')*2500)return fail('市場運輸容量已被在途商隊使用，請等待返程。');
        if (!canPay(a,cargo)) return fail('出發城市庫存不足。');
      }
    } else {
      if (b.owner === owner) return fail('不能攻擊自己的城市。');
      if(b.kind==='ruins')return fail('此處是空地，請選擇建立新城。');
      if (b.owner && protectedFaction(g,b.owner)) return fail('目標仍在新手保護中。');
      if (b.owner && ['truce','vassal','alliance'].includes(relation(g,owner,b.owner))) return fail('現有停戰或附庸關係禁止敵對行動。');
      if (b.owner) declareWar(g,owner,b.owner);
    }
    if(c.kind==='occupy'&&b.kind==='ruins')return fail('遺址沒有城市，請使用建立聚落。');
    const at = g.time + marchDuration(g,a,b,c.troops,c.kind);
    for (const u of unitIds) a.troops[u] -= c.troops[u];
    pay(a,cargo);
    const id = g.next++; g.marches.push({id,...(c.kind==='transport'?{transportLoad:Math.ceil(resources.reduce((s,r)=>s+cargo[r],0)/CARAVAN_CAPACITY)*CARAVAN_CAPACITY}:{}),supplyCity:a.id,targetGeneration:b.generation??0,owner,from:a.id,to:b.id,kind:c.kind,troops:{...c.troops},cargo:{...cargo},started:g.time,at,status:'outbound',path:travelRoute(g,a,b).path,supply:180,...(c.kind==='settle'?{settlers:SETTLER_POPULATION}:{})});
    schedule(g,'arrive',at,id);
    if (b.owner && b.owner !== owner && ['raid','occupy'].includes(c.kind)) report(g,{ owner:b.owner,kind:'system',node:b.id,title:'敵軍接近 ' + b.name,text:factionName(g,owner)+' 的軍隊正向城市行軍，預計於戰役第 '+(at/HOUR).toFixed(1)+' 小時抵達。兵力仍需偵察確認。'});
  } else if(c.type==='rename_organization'){
    if(c.organization==='empire'?!f.empire:f.league!==owner)return fail('只有君主或團長可以改名。');const reason=nameReason(g,owner,c.organization,c.name);if(reason)return fail(reason);const old=organizationName(g,owner,c.organization);if(c.organization==='empire')f.empireName=c.name.trim();else f.leagueName=c.name.trim();report(g,{owner:g.player,kind:'diplomacy',title:old+' 更名',text:'更名為 '+c.name.trim()+'。'});
  } else if(c.type==='league'){
    if(f.vassal)return fail('附庸須先處理宗主關係。');
    const target=c.target?faction(g,c.target):undefined;
    if(c.action==='create'){if(f.era<1)return fail('封建時代才能成立軍團。');if(f.league||f.empire)return fail('已加入軍團或建立帝國');const name=c.name?.trim()||suggestOrganization(g,owner,'league');const reason=nameReason(g,owner,'league',name);if(reason)return fail(reason);f.league=owner;f.leagueName=name;}
    else if(c.action==='leave'||c.action==='disband'){
      const leader=f.league;if(!leader)return fail('尚未加入軍團');
      if(c.action==='disband'&&leader!==owner)return fail('只有團長可以解散軍團。');
      if(leader===owner&&f.empire)return fail('請先解散帝國，再退出或解散創始軍團。');
      if(c.action==='disband'){for(const member of g.factions)if(member.league===owner)member.league=null;f.empireId=null;f.leagueName=undefined;}
      else if(leader!==owner)f.league=null;
      else{const next=g.factions.find(a=>a.id!==owner&&a.league===owner&&owned(g,a.id).length);if(!next)return fail('軍團只剩團長或沒有可接任的領主，請使用解散軍團。');next.leagueName=f.leagueName;next.empireId=f.empireId??null;for(const member of g.factions)if(member.league===owner)member.league=next.id;f.league=null;f.leagueName=undefined;f.empireId=null;}
    }
    else if(c.action==='join'){if(f.league||!target?.league||target.vassal||relation(g,owner,target.id)==='war')return fail('無法加入此軍團；請先議和或退出原軍團。');const members=g.factions.filter(a=>a.league===target.league);if(members.some(a=>relation(g,owner,a.id)==='war'))return fail('仍與軍團成員交戰。');f.league=target.league;}
    else if(c.action==='invite'){if(f.league!==owner||!target||target.id===owner||target.id===g.player||target.league||target.vassal||!owned(g,target.id).length)return fail('只有團長能邀請獨立 AI 領主。');if(g.factions.some(a=>a.league===owner&&relation(g,a.id,target.id)==='war'))return fail('對方仍與軍團交戰。');if(distance(node(g,f.capital),node(g,target.capital))>90)return fail('對方希望先與鄰近領主合作。');target.league=owner;}
    else if(c.action==='aid'){if(f.lastAid!==undefined&&g.time-f.lastAid<6*HOUR)return fail('軍團每六世界小時可受理一次支援請求。');if(!f.league)return fail('先加入軍團');const own=owned(g,owner).sort((a,b)=>countTroops(a.troops)-countTroops(b.troops))[0];if(!own)return fail('尚無可接收增援的城鎮');let sent=false;for(const member of g.factions.filter(a=>a.league===f.league&&a.id!==owner&&a.id!==g.player)){const donor=owned(g,member.id).find(n=>countTroops(n.troops)>35&&!g.marches.some(m=>m.from===n.id&&m.kind==='reinforce'));if(!donor)continue;const troops=emptyTroops();for(const u of unitIds)if(u!=='scout')troops[u]=Math.floor(donor.troops[u]*Math.min(.5,traits(g,member.id).aid+(member.gratitude?.[owner]!==undefined?.1:0)));if(!command(g,{type:'march',from:donor.id,to:own.id,kind:'reinforce',troops},member.id))sent=true;}if(!sent)return fail('盟友目前沒有可調動部隊。');f.lastAid=g.time;}
    else return fail('未知軍團命令');
    if(c.action!=='aid'){g.leaderboard=undefined;updateLeaderboard(g);}
    if(!['join','invite'].includes(c.action)||owner===g.player||(!!f.league&&faction(g,g.player).league===f.league))report(g,{owner:g.player,kind:'diplomacy',title:'軍團消息 · '+(f.league?organizationName(g,f.league,'league'):factionName(g,owner)),text:({create:'成立軍團；成員保留自己的城市與軍隊。',leave:'退出原軍團；若原為團長，團長職務移交給其他成員。',disband:'軍團解散；成員保留城市與軍隊。',join:'加入 '+factionName(g,f.league??null)+' 的軍團。',invite:'邀請 '+factionName(g,target?.id??null)+' 加入軍團。',aid:'軍團盟友派出真實部隊增援，仍需行軍抵達。'}[c.action])});
  } else if(c.type==='empire'){
    if('action' in c){
      if(c.action==='join'){
        const emperor=faction(g,c.target);
        if(f.league!==owner||f.vassal||f.empireId||f.empire||!emperor?.empire||emperor.league!==emperor.id)return fail('只有未加入帝國的軍團團長可申請加入現有帝國。');
        const incoming=g.factions.filter(a=>a.league===owner),existing=g.factions.filter(a=>empireFor(g,a.id)===emperor.id);
        if(incoming.some(a=>existing.some(b=>relation(g,a.id,b.id)==='war')))return fail('請先與帝國成員議和。');
        f.empireId=emperor.id;report(g,{owner:g.player,kind:'diplomacy',title:'軍團加入 '+organizationName(g,emperor.id,'empire'),text:organizationName(g,owner,'league')+' 已加入帝國；軍團及其城市仍由原團長與領主管理。'});
      }else if(c.action==='leave'){
        if(f.league!==owner||!f.empireId)return fail('只有帝國成員軍團的團長可以退出。');
        if(f.empire)return fail('創始軍團須先解散帝國。');
        const name=organizationName(g,f.empireId,'empire');f.empireId=null;report(g,{owner:g.player,kind:'diplomacy',title:'軍團退出 '+name,text:organizationName(g,owner,'league')+' 保留自己的領主、城市與軍隊。'});
      }else if(c.action==='dissolve'){
        if(!f.empire||f.league!==owner)return fail('只有帝國領袖可以解散帝國。');
        const name=organizationName(g,owner,'empire');for(const member of g.factions)if(member.empireId===owner)member.empireId=null;f.empire=null;f.empireName=undefined;
        report(g,{important:true,owner:g.player,kind:'diplomacy',title:name+' 解散',text:'各軍團恢復獨立，領主、城市與軍隊仍由原成員持有。'});
      }
    }else{
      if(!['direct','vassal','federal'].includes(c.mode))return fail('帝國模式無效');
      if(f.empire||f.vassal||f.era<2||f.league!==owner||empireFor(g,owner))return fail('須達城堡時代且擔任獨立軍團團長，才能建立帝國。');
      const leagueMembers=g.factions.filter(a=>a.league===owner),members=c.mode==='vassal'?g.factions.filter(a=>a.league===owner||a.vassal===owner):leagueMembers;
      if(c.mode==='federal'&&leagueMembers.length<3)return fail('自治帝國需至少三位軍團成員。');
      if(c.mode==='vassal'&&!g.factions.some(a=>a.vassal===owner))return fail('宗主帝國需要至少一位附庸。');
      if(members.reduce((s,a)=>s+owned(g,a.id).length,0)<8)return fail('建立帝國需要至少八座所屬城鎮。');
      const name=c.name?.trim()||suggestOrganization(g,owner,'empire'),reason=nameReason(g,owner,'empire',name);if(reason)return fail(reason);f.empireName=name;f.empire=c.mode;f.empireId=owner;
      report(g,{important:true,owner:g.player,kind:'diplomacy',title:organizationName(g,owner,'empire')+' 建立',text:'以 '+organizationName(g,owner,'league')+' 為創始軍團。其他軍團可加入帝國，並保留各自的城市與軍隊。'});
    }
    g.leaderboard=undefined;updateLeaderboard(g);
  } else if(c.type==='governor'){
    if(!policies.includes(c.policy)||!Number.isSafeInteger(c.budget)||c.budget<0||c.budget>10000||!Number.isSafeInteger(c.reserve)||c.reserve<0||c.reserve>10000||!c.cities.length||c.cities.some(id=>node(g,id)?.owner!==owner||!['capital','village'].includes(node(g,id).kind)))return fail('無效的總督設定。');
    for(const id of new Set(c.cities)){const n=node(g,id);n.policy=c.policy;n.policyOverride=true;Object.assign(n.governor,{enabled:c.enabled,budget:c.budget,reserve:c.reserve,autoNew:c.autoNew??n.governor.autoNew,blocked:c.enabled?'等待下一次建設評估':'由玩家手動建設'});if(c.enabled)governorStep(g,n);}
  } else if(c.type==='restore_realm'){
    if(!g.defeat||g.defeat.ended||owned(g,owner).length)return fail('目前不能復國。');
    let point=c.at;
    if(!point){for(let k=0;k<65536;k++){const q={x:(hash(k,83,g.seed)%256),y:hash(k,101,g.seed)%256};if(!tileReason(g,q)&&!g.nodes.some(n=>n.owner&&distance(n,q)<12)){point=q;break;}}}
    if(!point)return fail('目前沒有適合復國的空地。');const reason=tileReason(g,point);if(reason)return fail(reason);
    const refuge=makeSettlement(g,point);if(!g.nodes.includes(refuge))g.nodes.push(refuge);
    refuge.kind='village';refuge.owner=owner;refuge.population=TOWN_POPULATION;refuge.stock={food:600,wood:600,stone:400,gold:300};refuge.troops={...emptyTroops(),militia:10};refuge.buildings.hall=1;refuge.plots=makePlots(refuge.buildings,resourceLayout(g.seed,refuge));refuge.integration=100;refuge.stability=100;f.capital=refuge.id;f.exile=null;f.vassal=null;inheritPolicy(g,refuge);
    const shield=g.time+6*HOUR;f.protectionUntil=shield;g.protectionUntil=shield;g.restorations=(g.restorations??0)+1;delete g.defeat;g.result=null;g.savedAt=Date.now();delete g.offlineSince;
    if(!g.events.some(e=>e.type==='pulse'))schedule(g,'pulse',g.time+MINUTE,'');
    for(const ai of g.factions)if(ai.id!==owner&&!g.events.some(e=>e.type==='ai'&&e.ref===ai.id))schedule(g,'ai',g.time+traits(g,ai.id).interval,ai.id);
    report(g,{owner,kind:'system',node:refuge.id,title:'流亡復國 · '+refuge.name,text:'保留文明與科技，以 400 名居民、10 名民兵及基本物資重建。六世界小時保護；主動敵對仍立即解除。世界時間已恢復。'});
  } else if(c.type==='redirect'){
    const m=g.marches.find(m=>m.id===c.march&&m.owner===owner),to=node(g,c.to);
    if(!m||m.status==='returning'||m.redirect||m.retreatAt||!['raid','occupy','scout'].includes(m.kind)||!to||to.id===m.to)return fail('這支部隊目前不能更改目標。');
    if(to.retiring||to.owner===owner||(to.owner&&['truce','vassal','alliance'].includes(relation(g,owner,to.owner)))||(!f.intel[to.id]&&m.kind!=='scout')||to.kind==='ruins')return fail('請選擇已有情報且可敵對的目標。');
    if(to.owner&&protectedFaction(g,to.owner))return fail('目標受新手保護。');
    if(to.owner)declareWar(g,owner,to.owner);m.redirect={to:to.id,at:g.time+30_000};schedule(g,'redirect',m.redirect.at,m.id);
  } else if (c.type === 'retreat') {
    const m = g.marches.find(m => m.id === c.march && m.owner === owner);
    if (!m || m.status === 'returning' || m.retreatAt) return fail('此部隊無法再次撤退。');
    m.retreatAt = g.time + 30_000; schedule(g,'retreat',m.retreatAt,m.id);
  } else if (c.type === 'diplomacy') {
    if(!canDiplomacy(g,owner))return fail('外交策略僅限帝國領袖或軍團團長。');
    const target = faction(g,diplomacyLeader(g,c.target)??'');
    if (!target || target.id === owner) return fail('無效的外交目標。');
    if (f.vassal || target.vassal) return fail('附庸關係已確立。');
    if (c.action === 'war') {
      if ((f.league&&f.league===target.league)||relation(g,owner,target.id) === 'truce') return fail('同軍團或停戰期間不能宣戰。');
      declareWar(g,owner,target.id);
    } else if (c.action === 'truce') {
      const n = owned(g,owner).find(n => n.stock.gold >= 180);
      if (!n) return fail('需要一座城市支付 180 黃金。');
      n.stock.gold -= 180; node(g,target.capital).stock.gold += 180; treaty(g,owner,target.id,'truce',g.time+6*HOUR);
    } else if(c.action==='alliance'){
      if(relation(g,owner,target.id)==='war')return fail('先議和，才能締結盟約。');
      const city=owned(g,owner).find(n=>n.stock.gold>=240);if(!city)return fail('締結六小時互不侵犯盟約需支付 240 黃金。');
      city.stock.gold-=240;node(g,target.capital).stock.gold+=240;treaty(g,owner,target.id,'alliance',g.time+6*HOUR);
    } else if (c.action === 'vassal') {
      if(target.id===g.player)return fail('玩家政府不會自動接受臣服；仍可議和或繼續抵抗。');
      if(target.empire)return fail('帝國領袖須先解散帝國，才能臣服。');
      if(protectedFaction(g,target.id))return fail('目標仍受新手保護，不能要求臣服。');
      const a=diplomaticStrength(g,owner),b=diplomaticStrength(g,target.id);
      if (f.era < 2 || a.military < b.military*1.8 || a.population < b.population*1.5) return fail('對方拒絕：需要城堡時代、陣營軍力 1.8 倍及人口 1.5 倍。附庸國力以 50% 計入外交影響力。');
      endProtection(g,owner);
      if(target.league){const reason=command(g,{type:'league',action:'leave'},target.id);if(reason)return fail(reason);}
      target.vassal = owner;
      standDown(g,target.id);
      g.leaderboard=undefined;updateLeaderboard(g);
    } else return fail('未知的外交命令。');
    report(g,{owner,kind:'diplomacy',title:factionName(g,target.id)+'：'+({war:'戰爭開始',truce:'停戰六小時',vassal:'接受臣服',alliance:'六小時互不侵犯盟約'}[c.action]),text:c.action === 'truce' ? '使節送出 180 黃金。停戰期間雙方不能發出敵對命令，已在途的攻擊抵達時也會撤回。' : '外交關係已更新。附庸保有自己的城市，不計入直接統治聚落。'});
    if(owner!==g.player)report(g,{owner:g.player,kind:'diplomacy',title:'世界消息 · '+factionName(g,owner),text:factionName(g,owner)+' 與 '+factionName(g,target.id)+'：'+({war:'開始交戰',truce:'簽署停戰',vassal:'確立附庸關係',alliance:'締結盟約'}[c.action])+'。這是公開外交消息。'});
    checkVictory(g);
  } else if (c.type === 'regent') f.regent = !!c.enabled;
  else if (c.type === 'continue') {
    g.sandbox = true; g.result = null;
    if (!g.events.some(e => e.type === 'pulse')) schedule(g,'pulse',g.time+MINUTE,'');
    for (const ai of g.factions) if (ai.id !== g.player && !ai.vassal && !g.events.some(e => e.type === 'ai' && e.ref === ai.id)) schedule(g,'ai',g.time+20*MINUTE,ai.id);
  } else return fail('未知命令。');
  if(owner===g.player)rememberObjectives(g);
  g.log.push({at:g.time,type:c.type,owner}); if (g.log.length > 200) g.log.shift();
  return '';
}
function standDown(g: Game, owner: string) {
  for (const m of [...g.marches]) if (m.owner === owner && m.status !== 'returning') {
    g.events = g.events.filter(e => !(['arrive','retreat'].includes(e.type) && e.ref === m.id));
    g.battles = g.battles.filter(b => b.march !== m.id); finishReturn(g,m);
  }
}
function power(g: Game, t: Troops, enemy: Troops, owner: string | null, defense: boolean, n: Node, opponent: string|null, knowledge?:{tech?:string[];supplied?:boolean}) {
  const total = Math.max(1,countTroops(enemy));
  let p = 0;
  for (const u of unitIds) {
    const cavalry=enemy.cavalry+(opponent&&signatureStats[cultureId(opponent)]?.family==='cavalry'?enemy.signature:0);
    let bonus = u === 'spear' ? .8*cavalry/total : u === 'archer' ? .5*(enemy.militia+enemy.spear)/total : u === 'cavalry' ? .7*enemy.archer/total : 0;
    if (cultureId(owner) === 'civ_japan' && ['militia','spear','signature'].includes(u)) bonus += .1;
    if (cultureId(owner) === 'civ_frankia' && u === 'cavalry') bonus += .1;
    if (cultureId(owner) === 'civ_britannia' && u === 'archer') bonus += .12;
    if (cultureId(owner) === 'civ_mongol' && u === 'cavalry') bonus += .08;
    if(u==='signature'&&owner){const family=signatureStats[cultureId(owner)]?.family;bonus+=family==='ranged'?.5*(enemy.militia+enemy.spear)/total:family==='cavalry'?.5*enemy.archer/total:.2*enemy.militia/total;}
    const stats=owner?unitStats(u,owner):units[u];p += t[u]*(defense ? stats.defense : stats.power)*(1+bonus);
  }
  if (owner && (knowledge?.tech??faction(g,owner).tech).includes('forging')) p *= 1.05;
  if (owner && (knowledge?.tech??faction(g,owner).tech).includes('steel')) p *= 1.12;
  if (owner && (knowledge?knowledge.supplied===false:owned(g,owner).every(c => c.stock.food <= 0))) p *= .7;
  if (defense) {
    p *= 1 + n.buildings.wall*.18*(cultureId(owner) === 'civ_byzantion' ? 1.2 : 1);
    if (cultureId(owner) === 'civ_byzantion') p *= 1.08;
    if (['hill','forest'].includes(terrainAt(n.x,n.y,g.seed,g.terrainVersion))) p *= 1.1;
  }
  return Math.max(.1,p);
}
function losses(t: Troops, ratio: number) { for (const u of unitIds) t[u] = Math.max(0,t[u]-Math.min(t[u],Math.floor(t[u]*ratio + (t[u] ? .7 : 0)))); }
function battleReport(g: Game, m: March, n: Node, before: Troops, enemyBefore: Troops, text: string, loot?: Stock) {
  const party=(id:string|null)=>{const lord=factionName(g,id);if(!id)return {lord};const leader=faction(g,id),top=overlord(g,id),empire=empireFor(g,top)??(faction(g,top)?.empire?top:null);return {lord,league:leader.league?organizationName(g,leader.league,'league'):undefined,leagueColor:leader.league?mapColors[mapRelationOwner(g,id)]:undefined,empire:empire?organizationName(g,empire,'empire'):undefined,empireColor:empire?empireUiColor(g,empire):undefined};};
  const r = { art:reportArt(n),kind:'battle' as const,node:n.id,location:{x:n.x,y:n.y},title:n.name+' · '+text,battleSides:{attacker:party(m.owner),defender:party(n.owner)},before,after:{...m.troops},enemyBefore,enemyAfter:{...n.troops},text:factionName(g,m.owner)+' 攻擊 '+factionName(g,n.owner)+'。地形：'+({grass:'草原',forest:'森林',hill:'丘陵',field:'平原',water:'水域',mountain:'山脈'}[terrainAt(n.x,n.y,g.seed,g.terrainVersion)])+'；城牆 '+n.buildings.wall+' 級；攻方補給 '+(m.supply>0?'充足':'斷糧，戰力 −35%')+'；鍛鋼 '+(faction(g,m.owner).tech.includes('steel')?'已採用 +12%':'未採用')+'；士氣：攻 '+Math.round(70+m.supply/6)+' / 守 '+Math.round(n.stability)+'（補給／城市穩定）。攻方損失 '+(countTroops(before)-countTroops(m.troops))+' 套編制裝備，守方損失 '+(countTroops(enemyBefore)-countTroops(n.troops))+' 套，已隨傷亡扣除。尚存部隊依戰果駐防或返城。',loot };
  report(g,{...r,owner:m.owner}); if (n.owner && n.owner !== m.owner) report(g,{...r,owner:n.owner,text:'守方戰報。'+r.text});
}
function conclude(g: Game, m: March, n: Node, won: boolean) {
  g.battles = g.battles.filter(b => b.march !== m.id);
  if (won && m.kind === 'occupy' && countTroops(m.troops)-m.troops.scout >= 8 && !(!n.owner&&['camp','iron','horses'].includes(n.kind))) {
    const old = n.owner;
    (g.battleStatistics??={})[m.owner]??={wins:0,losses:0,casualties:0,conquests:0};g.battleStatistics[m.owner].conquests++;
    if(old){const last=[...g.reports].reverse().find(r=>r.owner===old&&r.node===n.id&&r.kind==='battle'&&r.at===g.time);if(last)last.important=true;report(g,{important:true,owner:old,kind:'system',node:n.id,title:n.name+' 失守',art:reportArt(n),text:factionName(g,m.owner)+' 佔領本城。戰鬥經過與損失請查看同一時間的戰報。'});}
    n.owner = m.owner; n.governor.enabled=false;
    n.policyOverride=false;const template=node(g,faction(g,m.owner).capital)?.governor; if(template?.autoNew){n.governor={...structuredClone(template),spent:emptyStock(),period:Math.floor(g.time/HOUR)};}
    inheritPolicy(g,n);n.integration = 35; n.stability = 65; n.build = []; n.train = []; n.troops = {...m.troops};
    if(old)for(const slot of ['research','eraUpgrade'] as const)if(g.events.some(e=>e.type==='research'&&e.ref===n.id&&e.id===faction(g,old)[slot]?.id))faction(g,old)[slot]=null;
    g.marches = g.marches.filter(x => x.id !== m.id);
    report(g,{owner:m.owner,kind:'system',node:n.id,title:'取得 '+n.name,text:'部隊已轉為駐軍。整合度會逐步恢復，城市以自己的庫存繼續發展。'});
    if (old && n.id === faction(g,old).capital) {
      if (old === g.player) {
        const remains=owned(g,old);if(remains.length)faction(g,old).capital=remains.sort((a,b)=>b.population-a.population)[0].id;
        if(remains.length)report(g,{owner:old,kind:'system',title:'首都失守，政府轉移',text:'政府已轉移至殘存城市；部隊與庫存保持原狀。'});
      } else { faction(g,old).vassal = m.owner; standDown(g,old); }
    }
    if(old){const f=faction(g,old);(f.grudges??={})[m.owner]=g.time;if(old===g.player)detectDefeat(g,n,m.owner);}
    intel(g,m.owner,n); checkVictory(g); return;
  }
  if (won && countTroops(m.troops)) {
    const available=Object.fromEntries(resources.map(r=>[r,Math.max(0,n.stock[r]-protectedStock(n,r))])) as Stock;
    const total=Math.max(1,Object.values(available).reduce((a,b)=>a+b,0)),amount=Math.min(countTroops(m.troops)*20,total),taken=emptyStock();
    for(const r of resources){const q=Math.min(available[r],Math.floor(amount*available[r]/total));n.stock[r]-=q;m.cargo[r]+=q;taken[r]=q;}
    const defense=[...g.reports].reverse().find(r=>r.owner===n.owner&&r.node===n.id&&r.kind==='battle'&&r.at===g.time);if(defense){defense.loot=taken;defense.text+=' 被掠奪物資如下。';}
    const victory=[...g.reports].reverse().find(r=>r.owner===m.owner&&r.node===n.id&&r.kind==='battle'&&r.at===g.time);
    if(victory){victory.title=n.name+' · 攻方勝利';victory.loot={...m.cargo};victory.text+=' 戰利品隨部隊返城後入庫；超過倉庫容量的部分無法保存。';}
    if(!n.owner&&['camp','iron','horses'].includes(n.kind)){n.respawnAt=g.time+wildCooldown(n);n.stock=emptyStock();n.troops=emptyTroops();for(const f of g.factions)delete f.intel[n.id];}

  }
  if (countTroops(m.troops)) finishReturn(g,m); else g.marches = g.marches.filter(x => x.id !== m.id);
  if(!n.respawnAt)intel(g,m.owner,n);
}
function fight(g:Game,m:March,n:Node,round:number,_large:boolean){
  if(n.owner===m.owner){finishReturn(g,m);g.battles=g.battles.filter(b=>b.march!==m.id);return;}
  const allies=g.marches.filter(x=>x.id!==m.id&&x.stationed&&x.to===n.id&&x.kind==='occupy'&&['own','alliance','vassal'].includes(relation(g,m.owner,x.owner)));
  const defenders=g.marches.filter(x=>x.stationed&&x.to===n.id&&x.kind==='reinforce'&&n.owner&&['own','alliance','vassal'].includes(relation(g,n.owner,x.owner)));
  const attackers=[m,...allies],sum=(parts:Troops[])=>Object.fromEntries(unitIds.map(u=>[u,parts.reduce((s,t)=>s+t[u],0)])) as Troops;
  const attackTroops=()=>sum(attackers.map(x=>x.troops)),defenseTroops=()=>sum([n.troops,...defenders.map(x=>x.troops)]),before=attackTroops(),enemyBefore=defenseTroops();
  if(n.owner)(faction(g,n.owner).grudges??={})[m.owner]=g.time;
  if(before.siege>=3&&n.buildings.wall){n.buildings.wall=Math.max(0,n.buildings.wall-Math.max(1,Math.floor(before.siege/12)));const p=n.plots.find(p=>p.kind==='wall');if(p){p.level=n.buildings.wall;p.building=p.level?'wall':null;}}
  const a=attackers.reduce((s,x)=>s+power(g,x.troops,enemyBefore,x.owner,false,n,n.owner)*(x.supply>0?1:.65)*(.85+(70+x.supply/6)*.0015),0);
  const d=(power(g,n.troops,before,n.owner,true,n,m.owner)+defenders.reduce((s,x)=>s+power(g,x.troops,before,x.owner,true,n,m.owner)*(x.supply>0?1:.65),0))*(.85+n.stability*.0015);
  const ratio=Math.max(a,d)/Math.max(.1,Math.min(a,d)),tempo=battleTempo(ratio),battle=g.battles.find(b=>b.march===m.id),started=battle?.started??Math.max(0,g.time-(round-1)*5*MINUTE);
  const finish=m.kind==='raid'||round>=tempo.rounds||g.time-started>=25*MINUTE||!countTroops(before)||!countTroops(enemyBefore);
  const hurtAttack=(ratio:number)=>attackers.forEach(x=>losses(x.troops,ratio));
  const hurtDefense=(ratio:number)=>{losses(n.troops,ratio);defenders.forEach(x=>losses(x.troops,ratio));};
  let won=false;
  if(finish){won=a*(.95+random(g)*.1)>=d&&countTroops(before)>0;if(won){hurtAttack(Math.min(.8,.42*d/Math.max(.1,a)));n.troops=emptyTroops();defenders.forEach(x=>x.troops=emptyTroops());}else{hurtDefense(Math.min(.8,.42*a/Math.max(.1,d)));attackers.forEach(x=>x.troops=emptyTroops());}}
  else{hurtAttack(Math.min(.65,.18*Math.sqrt(d/Math.max(.1,a))));hurtDefense(Math.min(.65,.18*Math.sqrt(a/Math.max(.1,d))));}
  const ownTroops=m.troops,cityTroops=n.troops;m.troops=attackTroops();n.troops=defenseTroops();battleReport(g,m,n,before,enemyBefore,finish?(won?'攻方勝利':'守方勝利'):'第 '+round+' 回合');m.troops=ownTroops;n.troops=cityTroops;
  const stats=g.battleStatistics??={};const attacking=stats[m.owner]??={wins:0,losses:0,casualties:0,conquests:0};attacking.casualties+=Math.max(0,countTroops(before)-countTroops(attackTroops()));if(n.owner){const defending=stats[n.owner]??={wins:0,losses:0,casualties:0,conquests:0};defending.casualties+=Math.max(0,countTroops(enemyBefore)-countTroops(defenseTroops()));}
  for(const x of defenders)if(!countTroops(x.troops))g.marches=g.marches.filter(z=>z.id!==x.id);
  const stop=finish||!countTroops(attackTroops())||!countTroops(defenseTroops())||(faction(g,m.owner).regent&&a<d*.35);
  if(stop){const success=finish?won:countTroops(attackTroops())>0&&!countTroops(defenseTroops());if(success)attacking.wins++;else attacking.losses++;if(n.owner){const defending=stats[n.owner];if(success)defending.losses++;else defending.wins++;}conclude(g,m,n,success);for(const x of allies){if(!countTroops(x.troops)){g.marches=g.marches.filter(z=>z.id!==x.id);continue;}if(n.owner===m.owner){x.kind='reinforce';x.stationed=true;x.status='battle';}else{delete x.stationed;finishReturn(g,x);}}return;}
  const at=Math.min(started+25*MINUTE,g.time+tempo.interval);let b=battle;if(!b){b={id:g.next++,march:m.id,target:n.id,round:round+1,at,started};g.battles.push(b);}else{b.round=round+1;b.at=at;b.started=started;}m.status='battle';m.at=at;schedule(g,'round',at,b.id);
}

function arrive(g: Game, m: March) {
  const n=node(g,m.to);
  if((n.respawnAt||(m.targetGeneration??0)!==(n.generation??0))&&m.status!=='returning'){finishReturn(g,m);return;}
  if(m.kind==='settle'&&m.status==='outbound'){
    if(n.kind!=='ruins'||n.owner){finishReturn(g,m);return;}n.kind='village';n.owner=m.owner;n.population=m.settlers??SETTLER_POPULATION;n.integration=100;n.stability=100;n.buildings.hall=1;n.plots[0].level=1;n.troops={...m.troops};
    const origin=node(g,m.from),gov=origin.governor;if(gov.autoNew){n.policy=origin.policy;n.governor={...structuredClone(gov),spent:emptyStock(),period:Math.floor(g.time/HOUR)};}inheritPolicy(g,n);g.marches=g.marches.filter(x=>x.id!==m.id);report(g,{owner:m.owner,kind:'system',node:n.id,title:'建立 '+n.name,text:'居民完成遷入。點選空地安排新城，或委任總督。'});return;
  }
  if(m.kind==='transport'&&m.status==='outbound'){
    if(n.owner!==m.owner){finishReturn(g,m);return;}const delivered=emptyStock();for(const r of resources){delivered[r]=Math.max(0,Math.min(m.cargo[r],capacity(n)-n.stock[r]));n.stock[r]+=delivered[r];m.cargo[r]-=delivered[r];}
    const overflow=resources.filter(r=>m.cargo[r]>0).map(r=>resourceNames[r]+' '+m.cargo[r].toLocaleString()).join('、');
    report(g,{owner:m.owner,kind:'economy',node:n.id,title:'商隊抵達 '+n.name,text:'由 '+node(g,m.from).name+' 送達；'+(overflow?'倉庫滿載，'+overflow+' 隨商隊返程。':'物資已入庫。')+'市場運量於回城後釋放。',loot:delivered});finishReturn(g,m);return;
  }
  if (m.status==='returning' || m.kind==='reinforce') {
    if (n.owner!==m.owner&&!(m.kind==='reinforce'&&n.owner&&sharedLeagueOrEmpire(g,m.owner,n.owner))){finishReturn(g,m);return;}
    if(n.owner!==m.owner&&n.owner){(faction(g,n.owner).gratitude??={})[m.owner]=g.time;m.stationed=true;m.status='battle';m.at=g.time;report(g,{owner:n.owner,kind:'diplomacy',node:n.id,title:'軍團支援抵達',text:factionName(g,m.owner)+' 的 '+countTroops(m.troops)+' 名支援兵已抵達，下一回合投入防守，保留原領主歸屬。'});return;}
    n.population+=m.settlers??0;
    for (const u of unitIds) n.troops[u]+=m.troops[u];
    const delivered=emptyStock(),discarded=emptyStock();for (const r of resources){delivered[r]=Math.max(0,Math.min(m.cargo[r],capacity(n)-n.stock[r]));discarded[r]=m.cargo[r]-delivered[r];n.stock[r]+=delivered[r];}
    if (m.kind === 'transport') report(g,{owner:m.owner,kind:'economy',node:n.id,title:'商隊抵達 '+n.name,text:'由 '+node(g,m.from).name+' 返抵；'+(resources.some(r=>discarded[r]>0)?'倉庫不足，未能入庫：'+resources.filter(r=>discarded[r]>0).map(r=>resourceNames[r]+' '+discarded[r]).join('、')+'。':'剩餘物資已入庫。'),loot:delivered});
    g.marches=g.marches.filter(x=>x.id!==m.id); return;
  }
  if (n.owner === m.owner || (n.owner && (protectedFaction(g,n.owner)||['truce','vassal','alliance'].includes(relation(g,m.owner,n.owner))))) { finishReturn(g,m); return; }
  if (m.kind==='scout') {
    intel(g,m.owner,n,true);
    if(n.owner)report(g,{owner:n.owner,kind:'scout',node:n.id,title:n.name+' · 遭敵方偵察',text:factionName(g,m.owner)+' 的斥候已完成偵察，取得本城駐軍與城防情報。'});
    report(g,{owner:m.owner,kind:'scout',node:n.id,title:n.name+' · 偵察完成',scoutIntel:structuredClone(faction(g,m.owner).intel[n.id]),text:'發現 '+factionName(g,n.owner)+' 駐軍及援軍 '+countTroops(faction(g,m.owner).intel[n.id].troops)+' 名，城牆 '+n.buildings.wall+' 級。情報以偵察當時為準。',enemyAfter:{...faction(g,m.owner).intel[n.id].troops}});
    if (countTroops(m.troops)) finishReturn(g,m); else g.marches=g.marches.filter(x=>x.id!==m.id); return;
  }
  const existing=m.kind==='occupy'?g.battles.find(b=>b.target===n.id):undefined;
  if (existing) {
    const other=g.marches.find(x=>x.id===existing.march)!;
    if(other.owner===m.owner)for(const u of unitIds)other.troops[u]+=m.troops[u];
    else if(['alliance','vassal'].includes(relation(g,other.owner,m.owner))){m.stationed=true;m.status='battle';return;}
    else {finishReturn(g,m);return;}
    g.marches=g.marches.filter(x=>x.id!==m.id); return;
  }
  fight(g,m,n,1,true);
}
export function checkVictory(g: Game) {
  if(detectDefeat(g))return;
  if (g.sandbox || g.result) return;
  const ranks=rankings(g);
  for (const f of g.factions) {
    if (f.vassal) continue;
    if (g.factions.filter(other=>other.id!==f.id).every(other=>overlord(g,other.id)===f.id||(owned(g,other.id).length===0&&!other.exile))) {
      g.result={kind:f.id===g.player?'conquest':'defeat',winner:f.id,text:factionName(g,f.id)+' 完成區域征服，其他領主已臣服或失去全部城市。'}; report(g,{important:true,owner:g.player,kind:'system',title:'戰役結束 · 區域征服',text:g.result.text});return;
    }
  }
  const leader = g.factions.find(f => !f.vassal && owned(g,f.id).filter(n=>n.integration>=70&&n.buildings.hall>0&&n.stock.food>0).length>=30 && ['population','military','economy'].every(key => { const k=key as 'population'|'military'|'economy'; const r=ranks.find(x=>x.id===f.id)!; return ranks.every(x=>x.id===f.id||r[k]>x[k]); }));
  if (!leader) g.hegemony=null;
  else if (g.hegemony?.owner !== leader.id){g.hegemony={owner:leader.id,since:g.time};for(const viewer of g.factions)report(g,{owner:viewer.id,kind:'system',title:'世界警報 · '+factionName(g,leader.id)+' 開始霸權倒數',text:'三十座有效聚落與三項國力第一已成立。若持續四小時四十八分，將取得霸權勝利；奪取其城市或改變國力排行可中斷倒數。'});}
  else if (g.time-g.hegemony.since>=HEGEMONY_HOLD) g.result={kind:leader.id===g.player?'hegemony':'defeat',winner:leader.id,text:factionName(g,leader.id)+' 持續 4 小時 48 分鐘統治三十座有效聚落，並維持三項國力第一，建立區域帝國霸權。'};
  if(g.result)report(g,{important:true,owner:g.player,kind:'system',title:'戰役結束 · '+(g.result.kind==='hegemony'?'霸權勝利':'戰役結算'),text:g.result.text});
}
// Wild-site caps change only when a site is rerolled, not every minute.
// Cache the immutable limits separately from mutable stock and defenders.
const wildLimits=new WeakMap<Node,{level:number;resource:Node['npcResource'];kind:Node['kind'];cap:Stock;guard:Troops}>();
function siteLimits(n:Node){
 let limits=wildLimits.get(n);
 if(!limits||limits.level!==(n.npcLevel??1)||limits.resource!==n.npcResource||limits.kind!==n.kind){
  limits={level:n.npcLevel??1,resource:n.npcResource,kind:n.kind,cap:siteStock(n),guard:siteTroops(n)};
  wildLimits.set(n,limits);
 }
 return limits;
}
function pulse(g: Game) {
  pruneRetiredWildSites(g);
  updateLeaderboard(g);for(const route of g.routes??[])runTrade(g,route);
  for(const m of g.marches){if(m.stationed&&m.kind==='occupy'&&!g.battles.some(b=>b.target===m.to)){delete m.stationed;finishReturn(g,m);continue;}if(m.stationed&&m.kind==='reinforce'&&(!node(g,m.to).owner||!['own','alliance','vassal'].includes(relation(g,m.owner,node(g,m.to).owner!)))){delete m.stationed;finishReturn(g,m);continue;}const home=node(g,m.supplyCity??(m.status==='returning'?m.to:m.from)),blocked=supplyBlocked(g,m);m.supply=home.owner===m.owner&&home.stock.food>0&&!blocked?180:Math.max(0,m.supply-1);if(m.supply===0&&m.status==='battle'&&faction(g,m.owner).regent&&!m.retreatAt)command(g,{type:'retreat',march:m.id},m.owner);}
  // Raidable stockpiles recover continuously, with caps. No login or daily reset gate.
  for (const n of g.nodes) if (!n.owner && !n.retiring && ['camp','iron','horses'].includes(n.kind)) {
    if(n.respawnAt){
      if(g.time<n.respawnAt)continue;
      if(!relocateWildSite(g,n))continue;
    }

    const {cap,guard}=siteLimits(n);
    for(const r of resources)n.stock[r]=Math.min(cap[r],n.stock[r]+cap[r]/360);
    if(g.time%(6*HOUR)===0)for(const u of unitIds)n.troops[u]=Math.min(guard[u],n.troops[u]+Math.ceil(guard[u]/3));
  }
  const foodLedger=marchingFood(g);
  for (const n of g.nodes) if(n.owner&&['capital','village'].includes(n.kind)) {
    const f=faction(g,n.owner),p=production(g,n,foodLedger);
    for (const r of resources) n.stock[r]=Math.round(Math.max(0,Math.min(capacity(n),n.stock[r]+p[r]/60))*1e6)/1e6;
    if(n.stock.food>0&&n.stability>=50&&n.population<housing(n))n.population=Math.min(housing(n),n.population+(POPULATION_BASE_GROWTH+n.buildings.hall*POPULATION_HALL_GROWTH)*(cultureId(f.id) === 'civ_zhongguo'?1.15:1)/60);
    n.integration=Math.min(100,n.integration+.2);
    n.stability=Math.max(20,Math.min(100,n.stability+(n.stock.food>0?.05:-.2)));
  }
  for(const city of g.nodes)if(city.owner&&city.governor.enabled&&['capital','village'].includes(city.kind))governorStep(g,city);
  if (Math.floor(g.time/MINUTE)%10===0) {

    for (const f of g.factions) if (f.regent&&!f.vassal) for (const n of owned(g,f.id)) {
      const danger=g.marches.some(m=>m.to===n.id&&m.owner!==f.id&&['raid','occupy'].includes(m.kind)&&m.status==='outbound');
      if (!danger) continue;
      if (countTroops(n.troops)<35&&!n.train.length) command(g,{type:'train',city:n.id,unit:'spear',count:8},f.id);
      const donor=owned(g,f.id).filter(x=>x.id!==n.id&&countTroops(x.troops)>45&&!g.marches.some(m=>m.from===x.id&&m.kind==='reinforce')).sort((a,b)=>distance(a,n)-distance(b,n))[0];
      if (donor) { const troops=emptyTroops(); for(const u of unitIds) if(u!=='scout')troops[u]=Math.floor(donor.troops[u]*.4); command(g,{type:'march',from:donor.id,to:n.id,kind:'reinforce',troops},f.id); }
    }
    checkVictory(g);
  }
  rememberObjectives(g);
  if (!g.result || g.sandbox) schedule(g,'pulse',g.time+MINUTE,'');
}
export function aiStep(g: Game, id: string) {
  const f=faction(g,id); if (f.vassal || !owned(g,id).length) return;
  if(node(g,f.capital)?.owner!==id)f.capital=owned(g,id).sort((a,b)=>b.population-a.population)[0].id;
  const cap=node(g,f.capital),style=traits(g,id);f.personality=style.kind;f.intent=['拓殖與開疆','內政與科技','偵察與掠奪','軍備與征服','城防與守勢','結盟與互助'][style.kind];
  // Aggressive lords can choose to end protection through a real declaration, just like the player.
  if(id!==g.player&&g.campaign.startsWith('lords-')&&f.era>=1&&g.time>=4*HOUR&&protectedFaction(g,id)&&[0,2,3].includes(style.kind)){
    const rival=g.factions.filter(a=>a.id!==id&&!a.vassal&&owned(g,a.id).length&&relation(g,id,a.id)==='peace').sort((a,b)=>distance(cap,node(g,a.capital))-distance(cap,node(g,b.capital)))[0];
    if(rival)command(g,{type:'diplomacy',target:rival.id,action:'war'},id);
  }
  if(id!==g.player&&g.campaign.startsWith('lords-')&&g.time>=8*HOUR&&f.era>=1&&!f.league&&(style.kind===5||hash(id.length,Number(id.split('~')[1])||0,g.seed)%5===0)){const near=g.factions.filter(a=>a.id!==id&&a.id!==g.player&&!a.vassal&&owned(g,a.id).length&&distance(cap,node(g,a.capital))<65&&relation(g,id,a.id)!=='war').sort((a,b)=>distance(cap,node(g,a.capital))-distance(cap,node(g,b.capital)))[0];if(near?.league&&g.factions.filter(a=>a.league===near.league).length<3)command(g,{type:'league',action:'join',target:near.id},id);else if(near){command(g,{type:'league',action:'create'},id);command(g,{type:'league',action:'invite',target:near.id},id);}}
  if(g.campaign.startsWith('lords-')&&f.league===id&&!f.empire&&f.era>=2)command(g,{type:'empire',mode:'federal'},id);
  if(g.hegemony&&g.hegemony.owner!==id&&g.hegemony.owner!==f.vassal){f.intent='阻止 '+factionName(g,g.hegemony.owner)+' 建立霸權';if(relation(g,id,g.hegemony.owner)==='peace')command(g,{type:'diplomacy',target:g.hegemony.owner,action:'war'},id);}
  for (const n of owned(g,id)) {
    if (n.id===cap.id) for (const key of (style.kind===1?['agriculture','carpentry','feudal','irrigation','castle','forging','steel','logistics']:style.kind===2?['feudal','logistics','forging','castle','steel','agriculture','carpentry','irrigation']:style.kind===4?['forging','feudal','steel','agriculture','castle','carpentry','irrigation','logistics']:['feudal','castle','agriculture','carpentry','forging','logistics','irrigation','steel']) as Research[]) if (!researchReason(g,n,key)) { command(g,{type:'research',city:n.id,research:key},id); }
    const saving=n.id===cap.id&&!f.eraUpgrade&&(['feudal','castle'] as Research[]).some(key=>!researchReason(g,n,key)&&!canPay(n,research[key].cost));
    if (!n.build.length&&!saving) {
      const missing=resourceBuildings.find(b=>n.plots.filter(p=>p.kind==='resource'&&p.building===b).every(p=>(p.level??0)===0));
      const wanted: Building = missing?missing:!n.buildings.house?'house':g.campaign.startsWith('lords-')&&!n.buildings.barracks?'barracks':f.era>=1&&n.id===cap.id&&n.buildings.hall<3?'hall':f.era>=1&&n.id===cap.id&&n.buildings.barracks<2?'barracks':production(g,n).food<80&&!!constructionPlot(n,'farm') ? 'farm' : n.population>=housing(n)-100 ? 'house' : n.buildings.farm<2 ? 'farm' : n.buildings.lumber<2 ? 'lumber' : n.buildings.hall<2 ? 'hall' : n.buildings.academy<1 ? 'academy' : f.era>=1&&n.buildings.hall<3 ? 'hall' : f.era>=1&&n.buildings.barracks<2 ? 'barracks' : f.era>=2&&!n.buildings.castle ? 'castle' : !n.buildings.cellar ? 'cellar' : n.buildings.warehouse<2 ? 'warehouse' : f.era>=1&&!n.buildings.market ? 'market' : f.era>=1&&!n.buildings.range ? 'range' : f.era>=1&&!n.buildings.stable ? 'stable' : (['farm','lumber','quarry','mine'] as Building[])[Math.floor(g.time/(20*MINUTE)+n.x)%4];
      const preferred:Building[]=[['market','house','lumber'],['academy','farm','mine'],['stable','range','barracks'],['barracks','workshop','stable'],['wall','warehouse','barracks'],['market','farm','wall']][style.kind] as Building[];
      const specialty=f.era>=1&&!missing&&n.buildings.house&&n.buildings.academy&&n.buildings.hall>=2&&production(g,n).food>80?preferred.find(b=>n.buildings[b]<Math.min(3,f.era+1)&&buildings[b].era<=f.era):undefined;
      if(command(g,{type:'build',city:n.id,building:specialty??wanted},id)&&specialty)command(g,{type:'build',city:n.id,building:wanted},id);
    }
    const danger=g.marches.some(m=>m.to===n.id&&m.owner!==id&&m.status==='outbound'&&m.kind==='occupy');
    if(danger&&f.league&&id!==g.player)command(g,{type:'league',action:'aid'},id);
    const max=n.id===cap.id?(f.era<2?130:280)*([.85,.7,1.2,1.4,.9,.85][style.kind]):danger?60:style.kind===4?35:16;
    if(!saving&&!n.train.length&&countTroops(n.troops)<max&&production(g,n).food>30){const pool:Unit[][]=[['cavalry','spear','signature'],['spear','archer','signature'],['cavalry','archer','signature'],['signature','siege','cavalry','spear'],['spear','archer','signature'],['archer','spear','signature']];const choices=pool[style.kind],offset=hash(n.x,Math.floor(g.time/MINUTE),g.seed)%choices.length;const unit=[...choices.slice(offset),...choices.slice(0,offset),'spear' as Unit].find(u=>!trainReason(g,n,u)&&canPay(n,trainCost(g,n,u,12)));if(unit)command(g,{type:'train',city:n.id,unit,count:12},id);}

    const gathering=countTroops(cap.troops)+g.marches.filter(m=>m.to===cap.id&&m.kind==='reinforce').reduce((s,m)=>s+countTroops(m.troops),0);
    if (n.id!==cap.id && gathering<(f.era<2?70:220) && countTroops(n.troops)>45 && !g.marches.some(m=>m.from===n.id&&m.status==='outbound')) {
      const troops=emptyTroops(); for(const u of unitIds) if(u!=='scout')troops[u]=Math.floor(n.troops[u]*.5);
      command(g,{type:'march',from:n.id,to:cap.id,kind:'reinforce',troops},id);
    }
  }

  if(id!==g.player&&f.era>=2){for(const other of g.factions)if(other.id!==id&&!other.vassal&&other.id!==g.player&&owned(g,other.id).length<=3&&relation(g,id,other.id)==='war')command(g,{type:'diplomacy',target:other.id,action:'vassal'},id);}
  if(id!==g.player&&countTroops(cap.troops)<20){const enemy=g.factions.find(other=>other.id!==id&&relation(g,id,other.id)==='war');if(enemy&&!f.intent.startsWith('阻止 '))command(g,{type:'diplomacy',target:enemy.id,action:'truce'},id);}
  if (cap.owner!==id || g.marches.some(m=>m.owner===id&&m.from===cap.id&&m.status!=='returning'&&m.kind!=='scout')) return;
  if(g.campaign.startsWith('lords-')&&f.era>=2&&owned(g,id).length+g.marches.filter(m=>m.owner===id&&m.kind==='settle'&&m.status==='outbound').length<(style.kind===0?8:style.kind===1?6:4)&&cap.population>=SETTLEMENT_MIN_POPULATION){
    for(let k=0;k<32;k++){const salt=hash(k,owned(g,id).length,g.seed+g.factions.indexOf(f)),p={x:cap.x+(salt%41)-20,y:cap.y+((salt>>>8)%41)-20};if(distance(cap,p)<8||g.nodes.some(n=>n.kind!=='ruins'&&!n.respawnAt&&distance(n,p)<4)||tileReason(g,p))continue;if(!command(g,{type:'settle_at',from:cap.id,at:p,troops:settlementEscort(cap)},id))return;break;}
  }
  const threatened=owned(g,id).find(n=>g.marches.some(m=>m.to===n.id&&m.owner!==id&&['raid','occupy'].includes(m.kind)&&['outbound','battle'].includes(m.status)));
  if(threatened){f.intent='優先防守與增援';if(f.league)command(g,{type:'league',action:'aid'},id);if(threatened.id!==cap.id){const t=emptyTroops();for(const u of unitIds)if(u!=='scout')t[u]=Math.floor(cap.troops[u]*.35);command(g,{type:'march',from:cap.id,to:threatened.id,kind:'reinforce',troops:t},id);}return;}
  const eligible=(n:Node)=>!n.retiring&&!n.respawnAt&&n.kind!=='ruins'&&n.owner!==id&&(!n.owner||(!protectedFaction(g,n.owner)&&!['truce','vassal','alliance'].includes(relation(g,id,n.owner))));
  const fresh=(n:Node)=>f.intel[n.id]&&(f.intel[n.id].generation??0)===(n.generation??0)&&g.time-f.intel[n.id].at<2*HOUR&&f.intel[n.id].owner===n.owner;
  const troops=emptyTroops();for(const u of unitIds)if(u!=='scout')troops[u]=Math.floor(cap.troops[u]*style.commit);
  const evaluations=g.nodes.filter(n=>eligible(n)&&fresh(n)).map(n=>{const i=f.intel[n.id],known={...n,stock:i.stock??emptyStock(),troops:i.troops,stability:i.stability??100,buildings:{...n.buildings,wall:i.wall}};
    const attack=power(g,troops,i.troops,id,false,known,n.owner),defense=power(g,i.troops,troops,n.owner,true,known,id,{tech:i.tech??[],supplied:i.supplied??true})*(.85+(i.stability??100)*.0015),ratio=attack/defense;
    const loot=resources.reduce((s,r)=>s+(i.stock?.[r]??0),0),grudge=n.owner&&f.grudges?.[n.owner]!==undefined?Math.max(0,1-(g.time-f.grudges[n.owner])/(12*HOUR))*30:0;
    return {n,ratio,score:ratio*12-distance(n,cap)*.5+Math.min(40,loot/250)+(n.owner?(style.kind===3?35:16):0)+grudge+(g.hegemony?.owner===n.owner?50:0)};}).filter(x=>x.ratio>=style.risk&&countTroops(troops)>=12).sort((a,b)=>b.score-a.score);
  const target=evaluations[0]?.n;
  if(target&&!(style.kind===4&&target.owner&&!f.grudges?.[target.owner]&&relation(g,id,target.owner)!=='war')){const kind=!target.owner||f.era<1||style.kind===2?'raid':'occupy';if(!command(g,{type:'march',from:cap.id,to:target.id,kind,troops},id))return;}
  const scoutPriority=(n:Node)=>distance(n,cap)-(n.owner&&relation(g,id,n.owner)==='war'&&distance(n,cap)<55?32:0);
  const unknown=g.nodes.filter(n=>eligible(n)&&!fresh(n)).sort((a,b)=>scoutPriority(a)-scoutPriority(b))[0];
  if(cap.troops.scout===0&&!cap.train.some(j=>j.item==='scout'))command(g,{type:'train',city:cap.id,unit:'scout',count:2},id);
  if(unknown&&cap.troops.scout>0&&!g.marches.some(m=>m.owner===id&&m.kind==='scout'))command(g,{type:'march',from:cap.id,to:unknown.id,kind:'scout',troops:{...emptyTroops(),scout:1}},id);

}
export function advance(g: Game, target: number) {
 configureMountains(g);
  detectDefeat(g);updateLeaderboard(g);
  if(!g.defeat)for(const b of g.battles){if(b.started!==undefined)continue;const m=g.marches.find(m=>m.id===b.march);if(!m)continue;b.started=Math.max(0,g.time-Math.min(25,(b.round-1)*5)*MINUTE);b.at=Math.min(b.at,m.kind==='raid'?g.time:Math.max(g.time,Math.min(g.time+5*MINUTE,b.started+25*MINUTE)));m.at=b.at;for(const e of g.events)if(e.type==='round'&&e.ref===b.id)e.at=b.at;}

  if(g.defeat)return g;
  if (!Number.isFinite(target)||target<g.time) throw new Error('世界時間無效。');
  let steps=0;
  while (!g.defeat&&(!g.result||g.sandbox)&&g.events.length) {
    g.events.sort((a,b)=>a.at-b.at||eventPriority[a.type]-eventPriority[b.type]||a.id-b.id);
    const e=g.events[0]; if(e.at>target)break;
    if(++steps>200000)throw new Error('事件量超過安全範圍，原存檔未覆寫。');
    g.events.shift();g.time=e.at;
    if(e.type==='pulse')pulse(g);
    else if(e.type==='ai'){ aiStep(g,String(e.ref)); if(!g.result||g.sandbox)schedule(g,'ai',g.time+traits(g,String(e.ref)).interval,e.ref); }
    else if(e.type==='build'||e.type==='train'){
      const n=node(g,String(e.ref)); const jobs=e.type==='build'?n.build:n.train;const j=jobs.find(j=>j.id===e.id);
      if(j){if(j.owner===n.owner){report(g,{owner:j.owner,kind:'system',node:n.id,title:(e.type==='build'?'工程完成 · ':'募兵完成 · ')+n.name,text:e.type==='build'?buildings[j.item as Building].name+(j.action==='demolish'?'已拆除':'已完成 '+(plotLevel(n,j.item as Building,j.plot)+1)+' 級'):units[j.item as Unit].name+' '+j.quantity+' 名加入駐軍。'});if(e.type==='build'){const b=j.item as Building,p=n.plots.find(p=>p.id===j.plot);if(j.action==='demolish'){if(p){p.building=null;p.level=0;}refreshBuildingLevel(n,b);}else{if(p){const level=plotLevel(n,b,p.id)+1;p.building=b;p.level=level;}n.buildings[b]=Math.max(...n.plots.filter(p=>p.building===b).map(p=>p.level??n.buildings[b]),0);}}else n.troops[j.item as Unit]+=j.quantity;} if(e.type==='build')n.build=n.build.filter(j=>j.id!==e.id);else n.train=n.train.filter(j=>j.id!==e.id);if(n.governor.enabled)governorStep(g,n);}
    }else if(e.type==='research'){
      for(const f of g.factions)for(const slot of ['research','eraUpgrade'] as const)if(f[slot]?.id===e.id){const j=f[slot]!;f[slot]=null;if(node(g,String(e.ref)).owner===f.id){f.tech.push(j.item);if(j.item==='feudal')f.era=1;if(j.item==='castle')f.era=2;report(g,{owner:f.id,kind:'system',title:'完成 '+research[j.item as Research].name,text:research[j.item as Research].description});}}
    }else if(e.type==='arrive'){const m=g.marches.find(m=>m.id===e.ref);if(m&&m.at===e.at&&m.status!=='battle')arrive(g,m);}
    else if(e.type==='round'){const b=g.battles.find(b=>b.id===e.ref);if(b&&b.at===e.at){const m=g.marches.find(m=>m.id===b.march);if(m)fight(g,m,node(g,b.target),b.round,true);}}
    else if(e.type==='redirect'){
      const m=g.marches.find(m=>m.id===e.ref);if(m?.redirect&&m.redirect.at===e.at&&m.status!=='returning'){
        const to=node(g,m.redirect.to);if(to.retiring||to.respawnAt||to.owner===m.owner||(to.owner&&(protectedFaction(g,to.owner)||['truce','vassal','alliance'].includes(relation(g,m.owner,to.owner))))){delete m.redirect;continue;}
        const position=m.status==='battle'?node(g,m.to):m.path[Math.min(m.path.length-1,Math.floor((g.time-m.started)/Math.max(1,m.at-m.started)*(m.path.length-1)))];
        g.battles=g.battles.filter(b=>b.march!==m.id);g.events=g.events.filter(e=>!(e.type==='arrive'&&e.ref===m.id));m.path=travelRoute(g,position,to).path;m.to=to.id;m.targetGeneration=to.generation??0;m.started=g.time;m.at=g.time+marchDuration(g,{...node(g,m.from),...position},to,m.troops,m.kind,m.owner);m.status='outbound';delete m.redirect;schedule(g,'arrive',m.at,m.id);
        if(to.owner)report(g,{owner:to.owner,kind:'system',node:to.id,title:'敵軍轉向 '+to.name,text:'改令已傳達；部隊按目前位置、路線與速度抵達。'});
      }
    }
    else if(e.type==='retreat'){
      const m=g.marches.find(m=>m.id===e.ref);
      if(m&&m.retreatAt===e.at&&m.status!=='returning'){
        g.battles=g.battles.filter(b=>b.march!==m.id);g.events=g.events.filter(e=>!(e.type==='arrive'&&e.ref===m.id));
        if(m.status==='outbound'){
          const progress=Math.min(1,(g.time-m.started)/Math.max(1,m.at-m.started)), path=m.path.slice(0,Math.max(1,Math.ceil(m.path.length*progress))).reverse();
          const origin=m.from;m.from=m.to;m.to=origin;m.path=path;m.status='returning';m.started=g.time;m.at=g.time+marchTimeForCost(g,pathCost(g,path),m.troops,m.kind,m.owner);delete m.retreatAt;schedule(g,'arrive',m.at,m.id);
        }else finishReturn(g,m);
      }
    }
    detectDefeat(g);rememberObjectives(g);
  }
  if(!g.defeat&&(!g.result||g.sandbox))g.time=target;
  return g;
}

export function supplyBlocked(g: Game,m: March) {
  return g.nodes.some(n=>n.buildings.wall>0&&n.owner&&n.owner!==m.owner&&n.id!==m.to&&countTroops(n.troops)>=12&&relation(g,m.owner,n.owner)==='war'&&m.path.some(p=>distance(p,n)<=2));
}
export function governorRecruitment(g:Game,n:Node){
 const era=faction(g,n.owner!).era,threat=g.marches.some(m=>m.to===n.id&&m.owner!==n.owner&&m.status==='outbound'&&['raid','occupy'].includes(m.kind));
 const troops={...n.troops};for(const j of n.train)troops[j.item as Unit]+=j.quantity;
 for(const m of g.marches)if(m.owner===n.owner&&(m.supplyCity??m.from)===n.id)for(const u of unitIds)troops[u]+=m.troops[u];
 const target=GOVERNOR_GARRISON[n.policy][era]+(threat?GOVERNOR_THREAT_REINFORCEMENT:0),current=countTroops(troops)-troops.scout;
 if(current>=target)return {target,current,reason:'守軍已足夠（'+current+'/'+target+'），暫停募兵'};
 const count=Math.min(GOVERNOR_TRAIN_BATCH,target-current,recruitablePopulation(n));
 if(count<1)return {target,current,reason:'保留 200 名居民，等待人口成長'};
 if(production(g,n).food-(n.train.reduce((s,j)=>s+j.quantity,0)+count)*SOLDIER_UPKEEP<GOVERNOR_FOOD_BUFFER)return {target,current,reason:'等待糧食盈餘，避免新增軍隊造成斷糧'};
 const weights:Partial<Record<Unit,number>>=GOVERNOR_UNIT_WEIGHTS[n.policy==='military'?'military':'civilian'];
 const unit=unitIds.filter(u=>weights[u]&&!trainReason(g,n,u)).sort((a,b)=>troops[a]/weights[a]!-troops[b]/weights[b]!)[0];
 if(!unit)return {target,current,reason:'等待可募兵建築'};
 return {target,current,unit,count,reason:(threat?'敵軍接近，':'')+'補充'+units[unit].name+'（守軍 '+current+'/'+target+'）'};
}
export function governorStep(g: Game,n: Node) {
 const gov=n.governor;if(!gov.enabled||!n.owner)return;
 const period=Math.floor(g.time/HOUR);if(period!==gov.period){gov.period=period;gov.spent=emptyStock();}
 const f=faction(g,n.owner),rate=production(g,n),queued=(b:Building)=>n.build.filter(j=>j.item===b&&j.action!=='demolish').length;
 const researchGoal=n.policy==='research'&&!f.eraUpgrade?(f.era===0?'feudal':f.era===1?'castle':undefined):undefined;
 const reserveResearch=researchGoal&&!researchReason(g,n,researchGoal)?research[researchGoal].cost:emptyStock();
 const affordable=(cost:Stock)=>{if(resources.reduce((s,r)=>s+cost[r]+gov.spent[r],0)>gov.budget)return '本世界小時預算不足';const missing=resources.filter(r=>cost[r]>0&&n.stock[r]-cost[r]<Math.max(gov.reserve,reserveResearch[r]));return missing.length?(resources.some(r=>reserveResearch[r]>0)?'保留時代研究資源':'等待資源並保留最低庫存')+'：'+missing.map(r=>resourceNames[r]).join('、'):'';};
 let reason='目前建設需求已滿足',lastDecision='';
 for(let slot=n.build.length;slot<3;slot++){
  const options:{b:Building;plot:number;score:number;why:string}[]=[];
  const add=(b:Building,score:number,why:string)=>{
   if(buildings[b].era>f.era||(!repeatableBuilding(b)&&queued(b)))return;
   const plots=n.plots.filter(p=>!n.build.some(j=>j.plot===p.id)&&plotAccepts(p,b)&&(!p.building||p.building===b)&&plotLevel(n,b,p.id)<5&&(!p.building?repeatableBuilding(b)||!n.buildings[b]:true));
   const free=n.plots.filter(p=>p.kind==='urban'&&!p.building&&!n.build.some(j=>j.plot===p.id)).length;
   for(const p of plots){if(!p.building&&repeatableBuilding(b)&&n.buildings[b]&&free<=GOVERNOR_RESERVE_SLOTS)continue;const cost=buildCost(n,b,p.id),price=resources.reduce((s,r)=>s+cost[r],0),time=buildDuration(n,b,p.id)/MINUTE;
    const resource=({farm:'food',lumber:'wood',quarry:'stone',mine:'gold'} as const)[b as 'farm'|'lumber'|'quarry'|'mine'];
    const gain=resource?RESOURCE_OUTPUT[resource]*(LEVEL_OUTPUT[plotLevel(n,b,p.id)+1]-LEVEL_OUTPUT[plotLevel(n,b,p.id)]):1;
    options.push({b,plot:p.id,score:score+Math.min(20,gain/(price+time*2)*100),why});}
  };
  const futureHousing=housing(n)+queued('house')*HOUSING_PER_LEVEL,futureCapacity=capacity(n)+queued('warehouse')*2500;
  if(n.population+150>=futureHousing)add('house',100,'住房將滿，擴充民居');
  if(resources.some(r=>n.stock[r]+Math.max(0,rate[r])*2>futureCapacity*.85))add('warehouse',85,'庫存接近容量，擴充倉儲');
  const foodNeed=GOVERNOR_FOOD_BUFFER+n.train.reduce((s,j)=>s+j.quantity,0)*SOLDIER_UPKEEP;
  for(const b of resourceBuildings){const r=({farm:'food',lumber:'wood',quarry:'stone',mine:'gold'} as const)[b as 'farm'|'lumber'|'quarry'|'mine'];
   const scarce=Math.max(0,1-n.stock[r]/Math.max(500,Math.max(1,rate[r])*4)),focus=n.policy==='food'&&r==='food'||n.policy==='industry'&&r!=='food';
   add(b,r==='food'&&rate.food<foodNeed?120:25+scarce*35+(focus?15:0),'增加'+resourceNames[r]+'產能，比較單塊升級效益');}
  if(!n.buildings.house&&!queued('house'))add('house',95,'提供人口成長空間');
  if(!n.buildings.barracks)add('barracks',65,'建立基本守備招募能力');
  if(!n.buildings.cellar)add('cellar',40,'建立基本資源保護');
  if(!n.buildings.market)add('market',45,'提供本城商隊');
  if(n.policy==='research'){
   if(n.buildings.hall<(f.era===0?2:3))add('hall',90,'補齊時代升級前置');
   if(!n.buildings.academy)add('academy',90,'補齊研究前置');
   if(f.era===1&&n.buildings.barracks<2)add('barracks',90,'補齊城堡時代前置');
  }else{if(n.buildings.hall<Math.min(3,f.era+2))add('hall',50,'提升人口成長與時代前置');if(!n.buildings.academy)add('academy',45,'開放研究條件');}
  if(f.era>=1&&!n.buildings.range)add('range',n.policy==='military'?70:42,'增加守軍兵種選擇');
  if(n.policy==='military')for(const b of ['wall','barracks','range','stable','castle','workshop'] as Building[])if(n.buildings[b]<Math.min(3,f.era+1))add(b,55,'改善軍事設施');
  const choice=options.sort((a,b)=>b.score-a.score||buildCost(n,a.b,a.plot).wood-buildCost(n,b.b,b.plot).wood).find(o=>{reason=affordable(buildCost(n,o.b,o.plot));return !reason;});
  if(!choice)break;
  const cost=buildCost(n,choice.b,choice.plot),error=command(g,{type:'build',city:n.id,building:choice.b,plot:choice.plot},n.owner);if(error){reason=error;break;}
  addStock(gov.spent,cost);lastDecision=choice.why;report(g,{owner:n.owner,kind:'system',node:n.id,title:'總督安排 · '+n.name,text:choice.why+'：'+buildings[choice.b].name+' → '+(plotLevel(n,choice.b,choice.plot)+1)+' 級。'});
 }
 let training='';
 for(let slot=n.train.length;slot<3;slot++){
  const plan=governorRecruitment(g,n);training=plan.reason;if(!plan.unit||!plan.count)break;
  const cost=trainCost(g,n,plan.unit,plan.count),blocked=affordable(cost);if(blocked){training=blocked;break;}
  const error=command(g,{type:'train',city:n.id,unit:plan.unit,count:plan.count},n.owner);if(error){training=error;break;}
  addStock(gov.spent,cost);report(g,{owner:n.owner,kind:'system',node:n.id,title:'總督募兵 · '+n.name,text:plan.reason+'，招募 '+plan.count+' 名、扣除相同人口。'});
 }
 gov.blocked='建設 '+n.build.length+'/3：'+(lastDecision||reason||'工程進行中')+'；募兵 '+n.train.length+'/3：'+(training||'訓練佇列已滿');
}

export const eventPriority:Record<Event["type"],number>={pulse:0,build:10,train:10,research:10,retreat:20,redirect:20,arrive:30,round:40,ai:50};

export function submitOrder(g:Game,order:CommandEnvelope):string {
 if(!order||typeof order.commandId!=='string'||order.commandId.length>100||!order.commandId.length)return '命令識別碼無效。';
 if(order.campaignId!==g.campaign||order.issuerId!==g.player)return '此命令不屬於目前戰役。';
 if(g.acceptedCommands.includes(order.commandId))return '';
 if(order.expectedRevision!==g.revision||!Number.isSafeInteger(order.issuedWorldTime)||order.issuedWorldTime>g.time)return '世界已更新，請確認目前狀態後再次下令。';
 const error=command(g,order.payload,order.issuerId);if(error)return error;
 g.acceptedCommands.push(order.commandId);if(g.acceptedCommands.length>256)g.acceptedCommands.shift();return '';
}

export function reportArt(n:Node){return !n.owner&&['camp','iron','horses'].includes(n.kind)?'art/report-'+(n.npcResource??(n.kind==='camp'?'bandit':n.kind==='iron'?'stone':'food'))+'.webp':'art/siege-report.webp';}
export function detectDefeat(g:Game,lost?:Node,winner?:string){
 if(g.defeat)return true;if(owned(g,g.player).length)return false;
 const f=faction(g,g.player),old=lost??node(g,f.capital);g.defeat={at:g.time,city:old?.id,winner:winner??old?.owner??null,ended:false};g.result={kind:'defeat',winner:g.defeat.winner,text:'最後一座城市已失守。世界時間停止，等待你選擇復國或結束本局。'};
 f.exile=null;
 const last=[...g.reports].reverse().find(r=>r.owner===g.player&&r.kind==='battle'&&r.node===old?.id&&r.at===g.time);
 report(g,{owner:g.player,kind:'battle',node:old?.id,title:'國土盡失 · 已被擊敗',art:'art/report-defeat.webp',text:lost?factionName(g,winner??null)+' 攻陷最後一城「'+old.name+'」。世界已停止在失守當下。': '載入時已無所屬城市，原首都「'+(old?.name??'未知')+'」現由 '+factionName(g,old?.owner??null)+' 統治。缺少最後失守的完整紀錄，世界以此存檔時間凍結。',...(last?{before:last.before,after:last.after,enemyBefore:last.enemyBefore,enemyAfter:last.enemyAfter}:{})});return true;
}
