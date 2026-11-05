import {describe,it,expect} from 'vitest';
import {acceptCommandIdentity,createReplayFence,intakeEpoch,nextIntakeEpoch,playerCommandId,validateReplayFence,RetiredCommand,RECENT_OUTCOME_LIMIT} from './replayFence';
const initial=()=>nextIntakeEpoch(createReplayFence('1234567890abcdef1234567890abcdef'),1,0);
describe('bounded command intake replay fence',()=>{
 it('accepts 150k cumulative unique identities with constant-size state and rejects every retired identity',()=>{
  let fence=initial();const epoch=intakeEpoch(fence),bytes=JSON.stringify(fence).length;
  for(let i=1;i<=150_000;i++)fence=acceptCommandIdentity(fence,playerCommandId(epoch,i));
  expect(fence.acceptedThrough).toBe(150_000);expect(JSON.stringify(fence).length-bytes).toBeLessThan(10);
  for(const i of [1,1024,10_000,60_000,149_999,150_000])expect(()=>acceptCommandIdentity(fence,playerCommandId(epoch,i))).toThrow(RetiredCommand);
  expect(RECENT_OUTCOME_LIMIT).toBe(1024);
 });
 it('does not reuse gaps or mutate the caller before T1 commits',()=>{
  const fence=initial(),epoch=intakeEpoch(fence),prepared=acceptCommandIdentity(fence,playerCommandId(epoch,50));
  expect(fence.acceptedThrough).toBe(0);expect(prepared.acceptedThrough).toBe(50);
  expect(()=>acceptCommandIdentity(prepared,playerCommandId(epoch,49))).toThrow(RetiredCommand);
  expect(acceptCommandIdentity(fence,playerCommandId(epoch,50))).toEqual(prepared);
 });
 it('closes old writer and recovery branch epochs regardless of sequence magnitude',()=>{
  const f=initial(),id=playerCommandId(intakeEpoch(f),Number.MAX_SAFE_INTEGER);
  const restarted=nextIntakeEpoch(f,2,0),restored=nextIntakeEpoch(restarted,2,1);
  expect(()=>acceptCommandIdentity(restarted,id)).toThrow(RetiredCommand);
  expect(()=>acceptCommandIdentity(restored,playerCommandId(intakeEpoch(restarted),1))).toThrow(RetiredCommand);
  expect(acceptCommandIdentity(restored,playerCommandId(intakeEpoch(restored),1)).acceptedThrough).toBe(1);
 });
 it('rejects source-device packets after an import into another database',()=>{
  const source=initial(),recipient=nextIntakeEpoch(createReplayFence('abcdef1234567890abcdef1234567890'),1,0);
  expect(()=>acceptCommandIdentity(recipient,playerCommandId(intakeEpoch(source),1))).toThrow(RetiredCommand);
 });
 it('rejects malformed, aliased, overflow and unversioned ids without advancing watermarks',()=>{
  const f=initial(),prefix=`command:p.${intakeEpoch(f)}.`;
  for(const id of ['command:old',prefix+'01',prefix+'0',prefix+'-1',prefix+'1.1',prefix+'zzzzzzzzzzzzzzzz',prefix+'A'])expect(()=>acceptCommandIdentity(f,id)).toThrow(RetiredCommand);
  expect(f.acceptedThrough).toBe(0);
 });
 it('fails closed on corrupt state and decreasing or reused epochs',()=>{
  const f=initial();expect(()=>validateReplayFence({...f,acceptedThrough:NaN})).toThrow();
  expect(()=>validateReplayFence({...f,extra:true} as typeof f)).toThrow();
  for(const [writer,branch]of [[0,0],[1,0],[1,-1],[2,-1]])expect(()=>nextIntakeEpoch(f,writer,branch)).toThrow();
 });
});
