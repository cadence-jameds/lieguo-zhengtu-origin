import type {FormalFaction,FormalWorld} from './model';
import type {FactionId} from './ids';
import {UNIT_CATALOG,isScoutUnit,isSupplyUnit} from './unitCatalog';
import {baseUnit,combatStats} from './combatModifiers';
import {politicalScope} from './politics';
const cache=new WeakMap<FormalWorld,{factions:Map<FactionId,bigint>;scopes:Map<string,bigint>;ranks:Map<string,number>;uniqueFirst:string|null}>();
export function invalidateMilitaryPower(w:FormalWorld){cache.delete(w);}
/** Immutable derived records may be shared across drafts until a military/political event invalidates them. */
export function inheritMilitaryPower(from:FormalWorld,to:FormalWorld){const found=cache.get(from);if(found)cache.set(to,found);else cache.delete(to);}
export function unitMilitaryPower(id:string,f?:FormalFaction){
 if(!UNIT_CATALOG[id]||isScoutUnit(id)||isSupplyUnit(id))return 0;const s=combatStats(id,f);if(s.hp<=0||s.attack<=0||s.interval<=0)return 0;
 return Math.round(100*s.hp*(s.attack/s.interval*(baseUnit(id)==='ram'?.25:1)+(s.meleeDefense+s.rangedDefense)/20));
}
export function militaryRanking(w:FormalWorld){
 let found=cache.get(w);if(found)return found;
 const factions=new Map<FactionId,bigint>(),owners=new Map(w.factions.map(f=>[f.id,f])),extinct=new Set(w.extinction?.extinct??[]);
 const add=(owner:FactionId,units:Record<string,number>)=>{if(extinct.has(owner))return;const f=owners.get(owner);let n=factions.get(owner)??0n;for(const [id,count] of Object.entries(units))if(count>0)n+=BigInt(count)*BigInt(unitMilitaryPower(id,f));factions.set(owner,n);};
 for(const c of w.cities)add(c.ownerFactionId,c.military?.units??{});for(const a of w.armies)if(!a.extinctionPending)add(a.ownerFactionId,a.units??{});for(const p of w.settlements??[])if(p.phase==='travelling')add(p.ownerFactionId,p.escort??{});
 const scopes=new Map<string,bigint>();for(const f of w.factions){const scope=politicalScope(w,f.id);scopes.set(scope,(scopes.get(scope)??0n)+(factions.get(f.id)??0n));}
 const ordered=[...scopes].sort(([a,n],[b,m])=>n===m?a.localeCompare(b):n>m?-1:1),ranks=new Map<string,number>();let rank=0;
 for(let i=0;i<ordered.length;i++){if(i===0||ordered[i][1]!==ordered[i-1][1])rank=i+1;ranks.set(ordered[i][0],rank);}
 const uniqueFirst=ordered[0]?.[1]>0n&&(ordered.length===1||ordered[0][1]>ordered[1][1])?ordered[0][0]:null;
 found={factions,scopes,ranks,uniqueFirst};cache.set(w,found);return found;
}
/** Public rank only. AI callers must never receive private owner totals or unit data. */
export function publicMilitaryRank(w:FormalWorld,scope:string){return militaryRanking(w).ranks.get(scope);}
