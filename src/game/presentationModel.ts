import type {ResolutionReceipt} from './formal/combatModel';
import type {FormalWorld} from './formal/model';
/** Presentation is a read model, never a reducer/persistence input. No authority
 * history, scheduler events, AI state, completion log or writable ledger crosses. */
export type ProjectionIdentity={protocolVersion:2;campaignId:string;branch:number;writerEpoch:number;sessionId:string;projectionSequence:number;revision:number};
export type PresentationWorld=Omit<FormalWorld,'kind'|'ledger'|'commandReceipts'|'completionReceipts'|'events'|'autonomy'|'fixture'|'combat'|'politics'|'growthTasks'>&{
 kind:'presentation';presentationVersion:2;projection:ProjectionIdentity;
 nextEventAt:number|null;
 combat?:Omit<NonNullable<FormalWorld['combat']>,'receipts'>;
 politics?:Omit<NonNullable<FormalWorld['politics']>,'randomCounter'>;
 growthTasks?:Omit<NonNullable<FormalWorld['growthTasks']>,'settledCities'|'autoShipments'>;
 battleEffects:{cursor:number;recent:ResolutionReceipt[]};
 derived:{staticMapDigest:string;castleSources:Record<string,string>;governance:Record<string,string>};
};
/** Shared pure read functions accept either an authoritative model or a view.
 * The union deliberately prevents accessing authority-only fields without proof. */
export type WorldRead=FormalWorld|PresentationWorld;
export const isPresentation=(w:WorldRead):w is PresentationWorld=>w.kind==='presentation';

/** Pixels-only map worker input; no cities, gameplay authority or dynamic sites. */
export type TerrainRead={seed:number;dimensions:FormalWorld['dimensions'];worldLayer?:Pick<NonNullable<FormalWorld['worldLayer']>,'regionSize'|'terrain'|'mountains'>};

/** Branch-scoped display caches cannot carry entities/effects across Recovery. */
export function presentationScopeKey(w:WorldRead){return w.kind==='presentation'?`${w.campaignId}:${w.projection.branch}:${w.projection.writerEpoch}`:w.ledger?`${w.campaignId}:${w.ledger.anchor.branch}:${w.ledger.anchor.writerEpoch}`:w.campaignId;}
