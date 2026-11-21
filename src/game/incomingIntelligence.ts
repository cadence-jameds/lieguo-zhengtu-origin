import { incomingAlerts } from './formal/aiKnowledge';
import { isMissionArmy, type MissionArmy } from './formal/combatModel';
import type { ArmyId, CityId, FactionId } from './formal/ids';
import type { FormalWorld } from './formal/model';
import { UNIT_CATALOG } from './formal/unitCatalog';
import type { WorldRead } from './presentationModel';

export const incomingSizes = ['small', 'medium', 'large', 'very-large'] as const;
export const incomingTendencies = ['infantry', 'ranged', 'cavalry'] as const;
export type IncomingHints = {
 size?: typeof incomingSizes[number];
 tendency?: typeof incomingTendencies[number];
 possibleSiege?: true;
 possibleJoint?: true;
};
export type PlayerIncomingAlert = IncomingHints & {
 armyId: ArmyId; cityId: CityId; ownerFactionId: FactionId; arrivalAt: number; composition?: string[];
};

// Proposed working values, not locked by v97 §8 or the C7 supplement.
// Use battlefield population (combat and siege), never raw counts in the projection.
const sizeCutoffs = [100, 500, 2000] as const;

export function projectPlayerIncoming(w: FormalWorld): PlayerIncomingAlert[] {
 const observer = w.factions.find(f => f.id === w.playerFactionId);
 const alerts = incomingAlerts(w, w.playerFactionId);
 if (!observer || !alerts.length) return [];
 const armies = new Map(w.armies.filter(isMissionArmy).map(a => [a.id, a]));
 const visible = new Set(alerts.map(a => a.armyId));
 const joints = new Map((w.politics?.joints ?? []).map(j => [j.id, j]));
 const factionTech = new Map(w.factions.map(f => [f.id, new Set(f.techIds)]));
 const observerTech = factionTech.get(observer.id)!;

 function looksJoint(a: MissionArmy, target: CityId): boolean {
  if (!a.jointId) return false;
  const joint = joints.get(a.jointId);
  if (!joint || joint.targetCityId !== target || joint.arrivalAt !== a.arrivalAt || !joint.armyIds.includes(a.id)) return false;
  return joint.armyIds.some(id => {
   if (id === a.id || !visible.has(id)) return false;
   const other = armies.get(id);
   return !!other && other.jointId === a.jointId && other.ownerFactionId !== a.ownerFactionId &&
    other.status === 'outbound' && other.arrivalAt === a.arrivalAt &&
    other.target.kind === 'city' && other.target.cityId === target;
  });
 }

 return alerts.map(({ armyId, cityId, ownerFactionId, arrivalAt, composition }) => {
  const own = ownerFactionId === observer.id;
  const row: PlayerIncomingAlert = { armyId, cityId, ownerFactionId, arrivalAt, ...(own && composition?.length ? { composition } : {}) };
  const researched = (id: string) => observerTech.has(id) && (own || factionTech.get(ownerFactionId)?.has(id) === true);
  const size = researched('intel.watch'), patrol = researched('intel.patrol'), analysis = researched('intel.analysis');
  if (!(size || patrol || analysis || researched('intel.network'))) return row;
  const army = armies.get(armyId);
  if (!army) return row;
  const classes = { infantry: 0, ranged: 0, cavalry: 0 };
  let population = 0, siege = false;
  if (size || patrol || analysis) for (const [id, count] of Object.entries(army.units)) {
   if (count <= 0) continue;
   const unit = UNIT_CATALOG[id];
   if (!unit) continue;
   const weight = unit.population * count;
   switch (unit.combatClass) {
    case 'infantry': classes.infantry += weight; break;
    case 'ranged': classes.ranged += weight; break;
    case 'cavalry': case 'mounted-ranged': classes.cavalry += weight; break;
    case 'siege': siege = true; break;
    default: continue; // Scouts and logistics do not count towards combat size/tendency.
   }
   population += weight;
  }
  if (size && population > 0) {
   const band = sizeCutoffs.findIndex(max => population < max);
   row.size = incomingSizes[band < 0 ? incomingSizes.length - 1 : band];
  }
  if (patrol) {
   const sorted = [...incomingTendencies].sort((a, b) => classes[b] - classes[a]);
   if (classes[sorted[0]] > classes[sorted[1]]) row.tendency = sorted[0];
  }
  if (analysis && siege) row.possibleSiege = true;
  if (researched('intel.network') && looksJoint(army, cityId)) row.possibleJoint = true;
  return row;
 });
}

/** Production views consume the committed, observer-specific result only. */
export const playerIncoming = (w: WorldRead): readonly PlayerIncomingAlert[] =>
 w.kind === 'presentation' ? w.derived.incomingAlerts ?? [] : projectPlayerIncoming(w);
