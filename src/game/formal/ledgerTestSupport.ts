import type {FormalWorld} from './model';
import {projectWorld} from './commandLedger';
import {anchor,commandHistory} from './commandLedger';
import {validateFormalWorld} from './schema';
import {expect} from 'vitest';
/** Compare all gameplay fields, reports/Acks and the ordered
 * recent receipt history across representations AFTER checking the full schema and explicit
 * version proof. commandFacts is separately verified authority/admission metadata,
 * excluded only from gameplay layout comparisons. This must never hide an invalid/missing ledger binding. */
export function scenarioWorld(world:FormalWorld):FormalWorld{
 const checked=validateFormalWorld(world);
 if(world.ledger){
  const proof=worldLedger(world),rows=commandHistory(world);
  expect(checked.ledger).toEqual(world.ledger);
  expect(world.ledger.anchor).toEqual(anchor(proof));
  expect(rows.length).toBe(proof.count+world.ledger.pending.length);
  expect(new Set(rows.map(r=>r.commandId)).size).toBe(rows.length);
  for(let i=0;i<proof.count;i++){
   const receipt=proof.at(i)!,original=proof.result(receipt.commandId)!;
   expect(rows[i]).toEqual(receipt);
   expect(original).toMatchObject({commandId:receipt.commandId,issuerId:receipt.issuerId,fingerprint:receipt.fingerprint,state:'committed',ack:{status:'committed',revision:receipt.committedRevision}});
  }
  for(const segment of proof.results)for(const original of segment.records){
   expect(proof.result(original.commandId)).toEqual(original);
   if(original.state!=='committed')expect(proof.receipt(original.commandId)).toBeUndefined();
  }
 }
 const gameplay=projectWorld(checked);delete gameplay.commandFacts;
 // Only the new bounded transport window is compared across raw engineering
 // fixtures and committed snapshots. All domain fields and source validation
 // above remain exact; the retirement/fence contract has its own T1/T2 tests.
 const rows=gameplay.commandReceipts,internal=(id:string)=>/^command:(?:ai-|auto-)/.test(id),keep=new Set([...rows.filter(r=>!internal(r.commandId)).slice(-1024),...rows.filter(r=>internal(r.commandId)).slice(-1024)].map(r=>r.commandId));gameplay.commandReceipts=rows.filter(r=>keep.has(r.commandId));return gameplay;
}
export function gameTransition<T extends {world:FormalWorld}>(value:T):T{return {...value,world:scenarioWorld(value.world)};}

import {encodeSave} from './saveCodec';
import {worldLedger,pendingHistory,prepareVerifiedLedger,bindLedger} from './commandLedger';
import {resultFromReceipt} from '../ledgerStore';
import {cloneWorldDraft} from './worldDraft';
/** Pure scenario lab only: seal the complete in-memory draft before exercising
 * the new portable codec. This is not a DB commit, migration or Runtime path;
 * production acceptance tests call real encodeSave/FormalPersistence directly. */
export async function encodeScenario(...[world,reports,portable=true]:Parameters<typeof encodeSave>):ReturnType<typeof encodeSave>{
 if(!world.ledger||world.ledger.anchor.worldRevision===world.revision&&!world.ledger.pending.length&&!world.ledger.outcomes?.length)return encodeSave(world,reports,portable);
 const base=worldLedger(world),rows=pendingHistory(world),proof=await prepareVerifiedLedger(base,rows,[...(world.ledger.outcomes??[]),...rows.map(resultFromReceipt)],world.revision,base.manifest.branch,base.manifest.writerEpoch),copy=cloneWorldDraft(world);bindLedger(copy,proof);return encodeSave(copy,reports,portable);
}

import {emptyVerifiedLedger} from './commandLedger';
/** Build only the ledger binding for an intentionally malformed GAME fixture,
 * so decoder tests can still reach (and reject) its exact game-rule violation. */
export async function scenarioBinding(world:FormalWorld){
 const base=world.ledger?worldLedger(world):await emptyVerifiedLedger(world.campaignId),rows=world.ledger?pendingHistory(world):world.commandReceipts,proof=await prepareVerifiedLedger(base,rows,[...(world.ledger?.outcomes??[]),...rows.filter(r=>!base.result(r.commandId)).map(resultFromReceipt)],world.revision,base.manifest.branch,base.manifest.writerEpoch);return bindLedger(cloneWorldDraft(world),proof);
}
