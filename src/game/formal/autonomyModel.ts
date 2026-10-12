import type {CityId,EventId,FactionId} from './ids';
import type {FormalCommand,Resources} from './model';
export const TRAITS=['military','economy','expansion','diplomacy','risk','revenge','loyalty','raiding','defense','activity','reaction'] as const;
export type Traits=Record<typeof TRAITS[number],number>;
export type RelationshipMemory={factionId:FactionId;trust:number;hatred:number;threat:number;at:number};
export type Intelligence={cityId:CityId;ownerFactionId:FactionId;at:number;source:'scout'|'battle'|'shared';units:Record<string,number>;coarse:'personnel'|'armor'|'siege'};
export type Agent={factionId:FactionId;traits:Traits;decisions:number;nextAt:number;eventId:EventId|null;active:boolean;budgetPercent:number;lastWarAt:number;memory:RelationshipMemory[];intel:Intelligence[]};
export type Autonomy={version:1;agents:Agent[];accepted:number;rejected:number};
export type Choice={command:FormalCommand;cost:Resources;score:number;category:'economy'|'population'|'military'|'research'};
/** Stateless seeded stream: restored event/decision identities reproduce each draw. */
export function aiRandom(seed:number,id:string,n:number){let h=seed>>>0;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);h=Math.imul(h^(n+1),2246822507);h^=h>>>13;h=Math.imul(h,3266489909);return((h^(h>>>16))>>>0)/4294967296;}
export const traitsFor=(seed:number,id:FactionId):Traits=>Object.fromEntries(TRAITS.map((k,i)=>[k,aiRandom(seed,id,i)])) as Traits;
