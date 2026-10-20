import type {FormalWorld} from '../formal/model';
import type {FactionId} from '../formal/ids';
type Totals={cities:number;population:number};
function publicTotals(w:FormalWorld,members:Iterable<FactionId>):Totals {
 const owners=new Set(members),seen=new Set<string>();let cities=0,population=0;
 for(const c of w.cities)if(owners.has(c.ownerFactionId)&&!seen.has(c.id)){seen.add(c.id);cities++;population+=Math.floor(c.population);}
 return {cities,population};
}
function ranked<T extends {id:string}&Totals>(rows:T[]){
 let rank=0;
 return rows.sort((a,b)=>b.cities-a.cities||b.population-a.population||a.id.localeCompare(b.id,'en')).map((r,i,all)=>{
  if(i===0||r.cities!==all[i-1].cities||r.population!==all[i-1].population)rank=i+1;
  return {...r,rank};
 });
}
/** Public ownership and population only. Membership and cities are counted once. */
export function legionRankings(w:FormalWorld){return ranked((w.politics?.legions??[]).map(legion=>({id:legion.id,legion,...publicTotals(w,legion.members)})));}
export function empireRankings(w:FormalWorld){
 const groups=new Map((w.politics?.legions??[]).map(g=>[g.id,g]));
 return ranked((w.politics?.empires??[]).map(empire=>({id:empire.id,empire,...publicTotals(w,empire.legions.flatMap(id=>groups.get(id)?.members??[]))})));
}
/** Only public city ownership/population; never inspect military, resources or intelligence. */
export function lordRankings(w:FormalWorld){const counts=new Map<string,{cities:number;population:number}>();for(const c of w.cities){const v=counts.get(c.ownerFactionId)??{cities:0,population:0};v.cities++;v.population+=Math.floor(c.population);counts.set(c.ownerFactionId,v);}let rank=0;return w.factions.map(f=>({faction:f,...(counts.get(f.id)??{cities:0,population:0})})).sort((a,b)=>b.cities-a.cities||b.population-a.population||a.faction.id.localeCompare(b.faction.id,'en')).map((r,i,rows)=>{if(i===0||r.cities!==rows[i-1].cities||r.population!==rows[i-1].population)rank=i+1;return {...r,rank};});}
