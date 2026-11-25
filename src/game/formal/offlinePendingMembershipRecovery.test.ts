import {expect,it} from 'vitest';
import {adoptReplayPendingMembership,beginReplayPendingMembership,bindLedger,commandHistory,copyHistory,emptyVerifiedLedger,findReceipt,pendingHistory} from './commandLedger';
import {createFormalFixture} from './fixture';
import {commandId} from './ids';
import type {CommandReceipt,FormalWorld} from './model';

const receipt=(w:FormalWorld,name:string):CommandReceipt=>({commandId:commandId(name),issuerId:w.playerFactionId,fingerprint:'fixture:'+name,committedRevision:w.revision,disposition:'applied'});

it('only committed append becomes visible to the replay owner; stale siblings retain their own suffix',async()=>{
 const initial=createFormalFixture(),first=receipt(initial,'first'),accepted=receipt(initial,'accepted'),discarded=receipt(initial,'discarded');
 const owner=bindLedger(initial,await emptyVerifiedLedger(initial.campaignId),[first]);beginReplayPendingMembership(owner);
 const left=copyHistory(owner,{...owner},true),right=copyHistory(owner,{...owner},true);
 commandHistory(left).push(accepted);commandHistory(right).push(discarded);
 expect(findReceipt(owner,accepted.commandId)).toBeUndefined();expect(findReceipt(left,discarded.commandId)).toBeUndefined();
 expect(()=>commandHistory(left).push(first)).toThrow('Duplicate ledger receipt');
 adoptReplayPendingMembership(owner,left);Object.assign(owner,left);
 expect(pendingHistory(owner)).toEqual([first,accepted]);
 expect(findReceipt(owner,accepted.commandId)).toBe(accepted);
 expect(findReceipt(right,accepted.commandId)).toBeUndefined();
 expect(findReceipt(right,discarded.commandId)).toBe(discarded);
 expect(findReceipt(owner,discarded.commandId)).toBeUndefined();
});

it('changed tail identity drops the lease and reads the current original array order',async()=>{
 const initial=createFormalFixture(),first=receipt(initial,'first');
 const owner=bindLedger(initial,await emptyVerifiedLedger(initial.campaignId),[first]);beginReplayPendingMembership(owner);
 const replacement={...first,fingerprint:'replacement'};
 owner.ledger!.pending=[replacement];
 expect(findReceipt(owner,first.commandId)).toBe(replacement);
 expect(()=>commandHistory(owner).push(first)).toThrow('Duplicate ledger receipt');
});
