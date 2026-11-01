/** Synthetic transaction laboratory ONLY. Not a FormalPersistence adapter. */
import Dexie from 'dexie';
import {canonical,emptyLedger,verifyLedger} from './command-ledger-candidate.mjs';
const prefix='synthetic-ledger-r303-';
export function candidateDatabase(name){if(!name.startsWith(prefix))throw Error('BLOCKED: candidate store cannot open a production database');const db=new Dexie(name);db.version(1).stores({heads:'campaignId',versions:'[campaignId+ledgerVersion]',segments:'[campaignId+sequence]',identity:'[campaignId+commandId],campaignId',markers:'campaignId'});return db;}
async function rows(tx,campaignId){const head=await tx.table('heads').get(campaignId);if(!head)return {head,segments:[],identity:[],marker:undefined};return {head,segments:head.segmentCount?await tx.table('segments').where('[campaignId+sequence]').between([campaignId,1],[campaignId,head.segmentCount],true,true).toArray():[],identity:await tx.table('identity').where('campaignId').equals(campaignId).toArray(),marker:await tx.table('markers').get(campaignId)};}
async function verified(data,campaignId){if(!data.head)return emptyLedger(campaignId);const snapshot=await verifyLedger({manifest:data.head,segments:data.segments});if(data.identity.length!==data.head.recordCount||data.identity.some(r=>canonical(snapshot.lookup(campaignId,r.commandId))!==canonical(r.receipt)))throw Error('Identity index diverged');if(data.marker?.ledgerChecksum!==data.head.checksum||data.marker.revision!==data.head.worldRevision||data.marker.kind!=='synthetic-test-marker-not-a-world')throw Error('Synthetic marker diverged');return snapshot;}
export async function readCandidate(db,campaignId){return verified(await db.transaction('r',db.tables,tx=>rows(tx,campaignId)),campaignId);}
/** Crypto is outside IDB. Exact preverified source bytes are compared again under
 * the write lock. Full-prefix comparison is deliberate prototype overhead.
 * These synthetic markers are NOT Formal worlds or proof of Formal T2 wiring. */
export async function publishCandidate(db,candidate,expectedRoot,{fault=()=>{}}={}){
 if(!db.name.startsWith(prefix))throw Error('BLOCKED: production activation unavailable');
 const target=await verifyLedger(candidate.archive()),m=target.manifest;
 const priorData=await db.transaction('r',db.tables,tx=>rows(tx,m.campaignId)),prior=await verified(priorData,m.campaignId);
 return db.transaction('rw',db.tables,async tx=>{
  const locked=await rows(tx,m.campaignId);
  if(canonical(locked)!==canonical(priorData))throw Error('Ledger source changed during prepare');
  if(prior.manifest.checksum===m.checksum)return {duplicate:true,manifest:m};
  if(prior.manifest.checksum!==expectedRoot||m.ledgerVersion!==prior.manifest.ledgerVersion+1||m.writerEpoch<prior.manifest.writerEpoch)throw Error('Ledger CAS/writer conflict');
  const delta=target.segments.slice(prior.manifest.segmentCount);
  for(const segment of delta){await tx.table('segments').add(segment);fault('segment-write');}
  for(const receipt of delta.flatMap(s=>s.events.map(e=>e.receipt))){await tx.table('identity').put({campaignId:m.campaignId,commandId:receipt.commandId,receipt});fault('index-write');}
  await tx.table('versions').add(m);fault('manifest-write');
  await tx.table('markers').put({campaignId:m.campaignId,revision:m.worldRevision,ledgerChecksum:m.checksum,kind:'synthetic-test-marker-not-a-world'});fault('marker-write');
  await tx.table('heads').put(m);fault('head-write');return {duplicate:false,manifest:m};
 });
}

export async function readHistoricalCandidate(db,campaignId,ledgerVersion){
 const data=await db.transaction('r',db.tables,async tx=>{const manifest=await tx.table('versions').get([campaignId,ledgerVersion]);if(!manifest)throw Error('Unknown ledger version');const segments=manifest.segmentCount?await tx.table('segments').where('[campaignId+sequence]').between([campaignId,1],[campaignId,manifest.segmentCount],true,true).toArray():[];return {manifest,segments};});
 // A historic root must not use today's mutable identity projection or marker.
 return verifyLedger(data);
}
