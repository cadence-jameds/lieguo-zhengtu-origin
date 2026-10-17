import { faction, relation } from './engine';
import type { Game, Node } from './types';
export function mapRelationOwner(g:Game,owner:string|null){
  if(owner===g.player)return 'own';
  if(!owner)return 'neutral';
  const a=faction(g,g.player),b=faction(g,owner);
  if(a.league&&a.league===b?.league)return 'league';
  const r=relation(g,g.player,owner);
  return r==='war'?'war':r==='alliance'||r==='vassal'?'alliance':'neutral';
}
export function mapRelation(g:Game,n:Node){
  return n.owner===g.player&&faction(g,g.player).capital===n.id?'capital':mapRelationOwner(g,n.owner);
}
export const mapColors={capital:'#edc55c',own:'#68a6fa',league:'#69cb7e',alliance:'#69cb7e',war:'#f0786d',neutral:'#bec1b7'};
export const relationship=(kind:ReturnType<typeof mapRelation>)=>kind==='war'?'敵對':kind==='neutral'?'中立':'友好';
export const relationshipColor=(kind:ReturnType<typeof mapRelation>)=>kind==='war'?mapColors.war:kind==='neutral'?mapColors.neutral:mapColors.league;

export const mapMarkerSize=(zoom:number)=>({width:28*zoom+8,height:14*zoom+4});
export const WILD_MAP_MIN_ZOOM=.22;
export const isMapCity=(n:Node)=>n.kind==='capital'||n.kind==='village';
export const mapNodeSize=(city:boolean,zoom:number)=>Math.max(7,Math.min(17,zoom*19))*(city?1:.70+.02*Math.max(0,Math.min(1,(zoom-.25)/.95)));
export const visibleMapNode=(n:Node,political:boolean,zoom=Infinity)=>!n.respawnAt&&n.kind!=='ruins'&&(isMapCity(n)||(!political&&zoom>WILD_MAP_MIN_ZOOM));
