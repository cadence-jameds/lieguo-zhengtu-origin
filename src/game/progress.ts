import { BALANCE_VERSION } from './balance';
import { countTroops, type Game, type Report } from './legacyTypes';
import { isWildSite, resetSite, rollSiteLevel, siteName } from './npc';

export function rememberObjectives(g: Game, scanReports=false) {
  const f=g.factions.find(f=>f.id===g.player);if(!f)return;
  const done=new Set(f.objectives??[]);if(done.size===4)return;
  if(!done.has(0)||!done.has(3)){
    const cities=g.nodes.filter(n=>n.owner===f.id&&['capital','village'].includes(n.kind));
    if(cities.some(n=>n.buildings.farm>=2))done.add(0);
    if(cities.length>=2)done.add(3);
  }
  if(!done.has(1)){
    const army=g.nodes.filter(n=>n.owner===f.id).reduce((a,n)=>a+countTroops(n.troops),0)+g.marches.filter(m=>m.owner===f.id).reduce((a,m)=>a+countTroops(m.troops),0);
    if(army>=35)done.add(1);
  }
  if(scanReports&&!done.has(2)&&g.reports.some(r=>r.owner===f.id&&r.kind==='scout'&&!!r.enemyAfter))done.add(2);
  if(!f.objectives||done.size!==f.objectives.length)f.objectives=Array.from(done).sort();
}
export function upgradeBatch(g: Game) {
  // Existing lords never receive retroactive invulnerability. New campaigns set all deadlines explicitly.
  for(const f of g.factions)if(f.protectionUntil===undefined)f.protectionUntil=f.id===g.player?g.protectionUntil:0;
  for(const n of g.nodes)if(isWildSite(n)){
    if(n.kind==='iron'){n.npcResource='stone';n.kind='camp';}
    if(n.kind==='horses'){n.npcResource='food';n.kind='camp';}
    n.name=siteName(n);
  }
  g.balanceVersion=BALANCE_VERSION;
  for (const [i,n] of g.nodes.entries()) if (isWildSite(n) && n.npcLevel === undefined) {
    const level=rollSiteLevel(g,n,((Math.imul(i+1,2654435761)^g.seed)>>>0));
    // A saved battle or marching army keeps the encounter it originally set out for.
    if (n.owner || n.respawnAt || g.marches.some(m=>m.to===n.id&&m.status!=='returning')) n.npcLevel=1;
    else resetSite(n,level);
    n.name=siteName(n);
  }
  for (const r of g.reports) if (r.read === undefined) r.read=true;
  const player=g.factions.find(f=>f.id===g.player);
  if(player&&player.objectives===undefined&&Object.keys(player.intel).length)player.objectives=[2];
  rememberObjectives(g,true);
}
export type ReportTab = 'all' | 'battle' | 'diplomacy' | 'chronicle';
export const reportTabs: {id:ReportTab;name:string}[] = [{id:'all',name:'全部'},{id:'battle',name:'戰鬥'},{id:'diplomacy',name:'外交'},{id:'chronicle',name:'建設・記事'}];
export const reportCategory = (r: Report): ReportTab => ['battle','scout'].includes(r.kind)?'battle':r.kind==='diplomacy'?'diplomacy':'chronicle';
export const unreadCount = (g: Game) => g.reportUnread??g.reports.filter(r=>r.owner===g.player&&r.read===false).length;
