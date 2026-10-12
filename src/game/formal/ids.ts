/** IDs are opaque at compile time and validated at IO boundaries. No implicit cross-entity cast. */
declare const identity: unique symbol;
export type Id<K extends string> = string & { readonly [identity]: K };
export type FactionId = Id<'Faction'>;
export type CityId = Id<'City'>;
export type ArmyId = Id<'Army'>;
export type BattleId = Id<'Battle'>;
export type ResolutionId = Id<'Resolution'>;
export type EventId = Id<'Event'>;
export type CommandId = Id<'Command'>;
export type ProjectId = Id<'Project'>;
export type ResearchProjectId = Id<'ResearchProject'>;
export type ReportId = Id<'Report'>;
export type CampaignId = Id<'Campaign'>;
export type EmpireId = Id<'Empire'>;
export type ShipmentId = Id<'Shipment'>;
function make<K extends string>(prefix: string, value: string): Id<K> {
  const text = `${prefix}:${value}`;
  if (!/^[a-z]+:[A-Za-z0-9_.-]{1,100}$/.test(text)) throw new Error('Invalid typed ID');
  return text as Id<K>;
}
export const factionId = (v: string) => make<'Faction'>('faction', v);
export const cityId = (v: string) => make<'City'>('city', v);
export const armyId = (v: string) => make<'Army'>('army', v);
export const battleId = (v: string) => make<'Battle'>('battle', v);
export const resolutionId = (v: string) => make<'Resolution'>('resolution', v);
export const eventId = (v: string) => make<'Event'>('event', v);
export const commandId = (v: string) => make<'Command'>('command', v);
export const projectId = (v: string) => make<'Project'>('project', v);
export const researchProjectId = (v: string) => make<'ResearchProject'>('research', v);
export const reportId = (v: string) => make<'Report'>('report', v);
export const campaignId = (v: string) => make<'Campaign'>('campaign', v);
export const empireId = (v: string) => make<'Empire'>('empire', v);
export const shipmentId = (v: string) => make<'Shipment'>('shipment', v);
export const sequenceKey = (n: number): string => {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('ID sequence exhausted');
  return String(n).padStart(16, '0');
};

export type WildSiteId = Id<'WildSite'>;
export const wildSiteId = (v:string) => make<'WildSite'>('wild',v);
