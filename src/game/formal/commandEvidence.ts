import type {CommandId,FactionId} from './ids';
import type {CommandReceipt,FormalCommand,FormalWorld} from './model';
import {canonicalJSON} from './canonical';
import {exactDataEqual} from './jsonDataEqual';
import {findReceipt,receiptIndex} from './commandLedger';
/** Domain provenance is NOT an outcome archive. Only evidence referenced by the
 * current domain graph is retained. No original Ack, order envelope or fingerprint
 * is stored here. Governance stamps and evacuation origins are bounded by cities
 * and factions; claims/payments are bounded by their actual domain records. */
export type CommandEvidence={commandId:CommandId;issuerId:FactionId;committedRevision:number;payload:Record<string,unknown>};
export type ReplayReservation={receipt?:CommandReceipt;result?:import('./commandLedger').OriginalResult};
export type CommandFacts={replayReservations?:Record<string,ReplayReservation>;format:1;effects:number;foregroundRevision:number;governance:Record<string,[CommandId,number]>;minimumGovernance:Record<string,[CommandId,number]>;origins:Record<string,CommandId>;minimumOrigins:Record<string,CommandId>;minimumFallback?:CommandId;fallback?:CommandId;evidence:Record<string,CommandEvidence>};
const fields=['type','cityId','hostCityId','projectId','craftsmanId','taskId','rewardVersion','expectedResources','resources'] as const;
function evidence(receipt:CommandReceipt):CommandEvidence|undefined{
 if(receipt.disposition!=='applied')return;
 try{const parsed=JSON.parse(receipt.fingerprint);if(parsed.issuerId!==receipt.issuerId||!parsed.payload||typeof parsed.payload.type!=='string')return;
  const payload:Record<string,unknown>={};for(const field of fields)if(Object.hasOwn(parsed.payload,field))payload[field]=structuredClone(parsed.payload[field]);
  return {commandId:receipt.commandId,issuerId:receipt.issuerId,committedRevision:receipt.committedRevision,payload};
 }catch{return;}
}
export function ensureCommandFacts(w:FormalWorld):CommandFacts{
 if(w.commandFacts)return w.commandFacts;
 const facts:CommandFacts={format:1,effects:0,foregroundRevision:0,governance:{},minimumGovernance:{},origins:{},minimumOrigins:{},evidence:{}};
 w.commandFacts=facts;for(const receipt of w.commandReceipts??[])observeCommandEvidence(w,receipt);return facts;
}
export function observeCommandEvidence(w:FormalWorld,receipt:CommandReceipt){
 const facts=w.commandFacts??ensureCommandFacts(w),fact=evidence(receipt);if(!fact)return;
 if(!facts.evidence[fact.commandId]){facts.effects++;if(!Number.isSafeInteger(facts.effects))throw Error('正式效果計數超出安全範圍。');}
 facts.evidence[fact.commandId]=fact;
 facts.origins[fact.issuerId]??=fact.commandId;facts.fallback??=fact.commandId;
 if(!facts.minimumOrigins[fact.issuerId]||fact.commandId<facts.minimumOrigins[fact.issuerId])facts.minimumOrigins[fact.issuerId]=fact.commandId;
 if(!facts.minimumFallback||fact.commandId<facts.minimumFallback)facts.minimumFallback=fact.commandId;
 if(fact.issuerId===w.playerFactionId)facts.foregroundRevision=Math.max(facts.foregroundRevision,fact.committedRevision);
 if(fact.payload.type==='governance.set'&&typeof fact.payload.cityId==='string'){
  const city=fact.payload.cityId,previous=facts.governance[city],minimum=facts.minimumGovernance[city];if(!previous||previous[1]<fact.committedRevision)facts.governance[city]=[fact.commandId,fact.committedRevision];if(!minimum||minimum[1]<fact.committedRevision||minimum[1]===fact.committedRevision&&fact.commandId<minimum[0])facts.minimumGovernance[city]=[fact.commandId,fact.committedRevision];
 }
}
export function domainEvidence(w:FormalWorld,id:string):CommandEvidence|undefined{
 const recent=findReceipt(w,id);return recent?evidence(recent):w.commandFacts?.evidence[id];
}
/** Compatibility of domain validators' *local* evidence shape, not a history
 * reader. The reconstructed canonical string has only the explicitly retained
 * domain fields, and is never used for transport identity/deduplication. */
export function domainReceipt(w:FormalWorld,id:string):CommandReceipt|undefined{
 const recent=findReceipt(w,id);if(recent)return recent;
 const fact=w.commandFacts?.evidence[id];if(!fact)return;
 return evidenceReceipt(w.campaignId,fact);
}
export function domainReceiptIndex(w:FormalWorld){
 // One exact index per validation pass, matching the original receiptIndex.
 // Repeated linear .find calls turn large project validation into quadratic work.
 const recent=receiptIndex(w),get=(id:string)=>w.commandFacts?.replayReservations?.[id]?.receipt??recent.get(id)??(w.commandFacts?.evidence[id]?evidenceReceipt(w.campaignId,w.commandFacts.evidence[id]):undefined);
 return {get,has:(id:string)=>!!get(id)};
}
export function commandEffectCount(w:FormalWorld){return ensureCommandFacts(w).effects;}
export function pruneCommandEvidence(w:FormalWorld,persist=false){
 const facts=ensureCommandFacts(w);if(facts.replayReservations){const events=new Set(w.events.map(e=>e.id.slice(6)));for(const id of Object.keys(facts.replayReservations)){const event=/^command:ai-(.+)-[0-9]+$/.exec(id)?.[1];if(!event||!events.has(event))delete facts.replayReservations[id];}if(!Object.keys(facts.replayReservations).length)delete facts.replayReservations;}
 const stableSources=[...Object.values(facts.governance).map(stamp=>stamp[0]),...Object.values(facts.minimumGovernance).map(stamp=>stamp[0]),...Object.values(facts.origins),...Object.values(facts.minimumOrigins),...(facts.fallback?[facts.fallback]:[]),...(facts.minimumFallback?[facts.minimumFallback]:[])];
 const needed=new Set<string>(stableSources);
 const visit=(v:unknown)=>{if(typeof v==='string'){if(v.startsWith('command:'))needed.add(v);}else if(Array.isArray(v)){for(const x of v)visit(x);}else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v))if(!['ledger','commandReceipts','commandFacts'].includes(k))visit(x);};visit(w);
 // Raw engineering worlds still hold every receipt. Avoid mirroring thousands
 // of live domain proofs twice during pure reducer replay. Persistence captures
 // all referenced proofs BEFORE the bounded transport window replaces history.
 const selected=persist||w.ledger?needed:new Set(stableSources),raw=persist&&!w.ledger?new Map<string,CommandReceipt>(w.commandReceipts.map(r=>[r.commandId,r])):undefined;
 const retained:Record<string,CommandEvidence>={};for(const id of selected){const fact=facts.evidence[id]??((persist||w.ledger)?(()=>{const r=raw?.get(id)??findReceipt(w,id);return r&&evidence(r);})():undefined);if(fact)retained[id]=fact;}facts.evidence=retained;
 const cities=new Set(w.cities.map(c=>c.id));for(const city of Object.keys(facts.governance))if(!cities.has(city as typeof w.cities[number]['id'])){delete facts.governance[city];delete facts.minimumGovernance[city];}
}
export function evidencePayloadMatches(w:FormalWorld,id:string,issuerId:FactionId,payload:FormalCommand){
 const r=domainEvidence(w,id),expected=Object.fromEntries(fields.filter(k=>Object.hasOwn(payload,k)).map(k=>[k,(payload as unknown as Record<string,unknown>)[k]]));
 return !!r&&r.issuerId===issuerId&&canonicalJSON(r.payload)===canonicalJSON(expected);
}
/** Match the existing reducer's one-revision replay boundary, including its
 * first-at-highest-revision governance evidence tie rule. Never rewrite an
 * original outcome or a checkpoint's future replay reservation. */
export function normalizeCommandEvidence(w:FormalWorld,receipts:readonly CommandReceipt[]){
 const facts=w.commandFacts;if(!facts)return;
 facts.foregroundRevision=Math.min(facts.foregroundRevision,w.revision);
 for(const fact of Object.values(facts.evidence))fact.committedRevision=Math.min(fact.committedRevision,w.revision);
 const writes=new Map<string,[CommandId,number]>(),minimums=new Map<string,[CommandId,number]>();
 for(const r of receipts){if(r.disposition!=='applied')continue;const fact=facts.evidence[r.commandId]??evidence(r);if(fact?.payload.type!=='governance.set'||typeof fact.payload.cityId!=='string')continue;const city=fact.payload.cityId,previous=writes.get(city);if(!previous||previous[1]<r.committedRevision)writes.set(city,[r.commandId,r.committedRevision]);const minimum=minimums.get(city);if(!minimum||minimum[1]<r.committedRevision||minimum[1]===r.committedRevision&&r.commandId<minimum[0])minimums.set(city,[r.commandId,r.committedRevision]);}
 for(const [city,write]of writes){const previous=facts.governance[city];if(!previous||previous[1]>=w.revision||previous[1]<write[1]){facts.governance[city]=write;facts.minimumGovernance[city]=minimums.get(city)!;}}
}

// Derivation cache only: every lookup compares the entire actual domain fact.
// It proves no authority, outcome or history. Owned frozen inputs prevent caller
// mutation from turning a cached canonical representation into false evidence.
const receiptCache=new Map<string,{fact:CommandEvidence;receipt:CommandReceipt}>();
function freezeEvidence<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freezeEvidence);Object.freeze(v);}return v;}
export function evidenceReceipt(campaignId:string,fact:CommandEvidence):CommandReceipt{
 const key=campaignId+'/'+fact.commandId,known=receiptCache.get(key);
 if(known&&exactDataEqual(known.fact,fact))return known.receipt;
 const owned=freezeEvidence(structuredClone(fact)),receipt=Object.freeze({commandId:owned.commandId,issuerId:owned.issuerId,committedRevision:owned.committedRevision,disposition:'applied' as const,fingerprint:canonicalJSON({campaignId,issuerId:owned.issuerId,payload:owned.payload})});
 receiptCache.delete(key);receiptCache.set(key,{fact:owned,receipt});while(receiptCache.size>4096)receiptCache.delete(receiptCache.keys().next().value!);return receipt;
}
/** Ordinary T2 may retire unused evidence, never silently erase a live source or
 * an ABA stamp. Branch replacement has its own explicit reconciliation boundary. */
export function assertCommandFactsTransition(previous:FormalWorld,next:FormalWorld,receipts:readonly CommandReceipt[]){
 const old=previous.commandFacts,facts=next.commandFacts;if(!old)return;if(!facts||facts.effects<old.effects||facts.foregroundRevision<old.foregroundRevision)throw Error('正式領域命令前提不得倒退。');
 for(const [issuer,id]of Object.entries(old.origins))if(facts.origins[issuer]!==id)throw Error('正式撤退來源不得改寫。');
 if(old.fallback&&facts.fallback!==old.fallback)throw Error('正式撤退來源不得改寫。');
 for(const [id,fact]of Object.entries(old.evidence))if(facts.evidence[id]&&canonicalJSON(facts.evidence[id])!==canonicalJSON(fact))throw Error('仍有效的領域來源不得改寫。');
 const touched=new Set<string>();for(const receipt of receipts){const fact=evidence(receipt);if(fact?.payload.type==='governance.set'&&typeof fact.payload.cityId==='string')touched.add(fact.payload.cityId);}
 const cities=new Set<string>(next.cities.map(c=>c.id));
 for(const [city,stamp]of Object.entries(old.governance))if(cities.has(city)&&!touched.has(city)&&(canonicalJSON(facts.governance[city])!==canonicalJSON(stamp)||canonicalJSON(facts.minimumGovernance[city])!==canonicalJSON(old.minimumGovernance[city])))throw Error('治理 ABA 來源不得遺失或改寫。');
}
