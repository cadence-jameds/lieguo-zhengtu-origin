import { emptyTroops, type Game, type Node, type Stock } from './types';

export const isWildSite = (n: Node) => ['camp', 'iron', 'horses'].includes(n.kind);
export const siteLevel = (n: Node) => Math.max(1, Math.min(10, Math.floor(n.npcLevel ?? 1)));
export function siteName(n: Node) {
  const base = n.npcResource ? {food:'沃野農莊',wood:'山林木寨',stone:'採石場',gold:'黃金礦脈'}[n.npcResource]
    : n.kind === 'iron' ? '採石場' : n.kind === 'horses' ? '沃野農莊' : '盜賊營地';
  return `${base} Lv.${siteLevel(n)}`;
}
export function siteStock(n: Node): Stock {
  const scale = [1,1.35,1.8,2.4,3.1,4,5.1,6.4,7.9,9.6][siteLevel(n)-1];
  const resource=n.npcResource??(n.kind==='iron'?'stone':n.kind==='horses'?'food':undefined);
  const base:Stock=resource?{food:0,wood:0,stone:0,gold:0,[resource]:450}:{food:133,wood:132,stone:132,gold:132};
  return Object.fromEntries(Object.entries(base).map(([r,v]) => [r,Math.round(v*scale)])) as Stock;
}
export function siteTroops(n: Node) {
  const l = siteLevel(n);
  const troops={...emptyTroops(),militia:4+3*l*(l-1),spear:Math.max(0,l-2)*6,archer:Math.max(0,l-4)*5,cavalry:Math.max(0,l-6)*3};
  if(!n.npcResource&&n.kind==='camp')for(const u of Object.keys(troops) as (keyof typeof troops)[])troops[u]=Math.ceil(troops[u]*1.25);
  return troops;
}
export function resetSite(n: Node, level: number) {
  n.npcLevel = Math.max(1,Math.min(10,Math.floor(level)));
  n.name = siteName(n); n.stock = siteStock(n); n.troops = siteTroops(n);
}
// Easy camps remain within reach of every starting lord; distant camps span all ten levels.
export function rollSiteLevel(g: Game, n: Node, roll: number) {
  const near = g.factions.some(f => {const c=g.nodes.find(a=>a.id===f.capital);return c&&Math.abs(c.x-n.x)+Math.abs(c.y-n.y)<=18;});
  return 1 + roll % (near ? 3 : 10);
}
export const siteArtIndex = (n: Node) => n.npcResource ? {food:0,wood:1,stone:2,gold:3}[n.npcResource] : n.kind==='iron'?2:n.kind==='horses'?0:6;
