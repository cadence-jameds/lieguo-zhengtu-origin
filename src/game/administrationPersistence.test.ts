import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {FormalPersistence} from './persistence';
import {captureIntent,revalidateInbox} from './durableCommands';
import {governanceBase} from './governanceAdmission';
import {battlefield} from './formal/combatTestSupport';
import {build} from './formal/developmentTestSupport';
import {fixtureProjection} from './formal/projectionTestSupport';
import {receiveDurableFixture} from './formal/durableIdentityTestSupport';
import {submitFormalOrder} from './formal/reducer';
import {order} from './formal/testSupport';
import {ADMIN_COORDINATION,batchGovernancePlan,runGovernanceBatch} from './administration';

it('a template batch uses ordinary orders, a restarted writer resumes an accepted city exactly once',async()=>{
 const suffix='admin-'+crypto.randomUUID(),prior=new FormalPersistence({suffix}),resumed=new FormalPersistence({suffix});
 try{
  const fixture=battlefield(),[a,b]=fixture.cities;
  const player=fixture.factions.find(f=>f.id===fixture.playerFactionId)!;
  player.techIds.push(ADMIN_COORDINATION);b.ownerFactionId=player.id;build(a,'townhall',1);build(b,'townhall',1);
  await prior.acquireWriter();
  let w=await prior.start(fixture);
  const view=()=>{const p=fixtureProjection(w,{protocolVersion:2,campaignId:w.campaignId,branch:0,writerEpoch:1,sessionId:'admin-batch',revision:w.revision,projectionSequence:w.revision+1});
   p.derived.governance=Object.fromEntries(w.cities.map(c=>[c.id,governanceBase(w,c.id).fingerprint]));return p;};
  const plan=batchGovernancePlan(view(),[a.id,b.id],{name:'保留',policy:'reserve',budget:0,reserve:755});
  const before=JSON.stringify(w.cities.map(c=>c.stock)),accepted:ReturnType<typeof order>[]=[];
  const result=await runGovernanceBatch(plan,{world:view,waitProjection:async r=>w.revision===r,send:async(payload,base)=>{
   const o=order(w,'admin-'+String(accepted.length),payload),intent=captureIntent(w,o);
   expect(intent.governanceBase).toEqual(base);accepted.push(o);
   const row=await receiveDurableFixture(prior,o,intent,(await prior.writerContext()).branch);
   if(accepted.length===2)return undefined; // Worker closes after T1 of second city.
   const tx=submitFormalOrder(w,o);expect(tx.ack?.status,tx.ack?.reason).toBe('committed');
   w=await prior.save(tx.world,tx.reports,w.revision,undefined,{row,ack:tx.ack!});return tx.ack;
  }});
  expect(result.map(r=>r.status)).toEqual(['applied','uncertain']);
  prior.db.close();await resumed.acquireWriter();w=(await resumed.loadSave()).game!;
  const pending=await resumed.pendingCommands();expect(pending.map(r=>r.order)).toEqual([accepted[1]]);
  const execution=revalidateInbox(w,pending[0])!,tx=submitFormalOrder(w,execution);
  expect(tx.ack?.status,tx.ack?.reason).toBe('committed');
  w=await resumed.save(tx.world,tx.reports,w.revision,undefined,{row:pending[0],ack:tx.ack!});
  expect(w.governors?.map(g=>[g.cityId,g.enabled,g.reserve])).toEqual([[a.id,false,755],[b.id,false,755]]);
  expect(w.events.some(e=>e.type==='governance.decide')).toBe(false);
  expect(JSON.stringify(w.cities.map(c=>c.stock))).toBe(before);
  expect((await resumed.commandStatus(accepted[1].campaignId,accepted[1].commandId))?.state).toBe('committed');
  expect((await resumed.pendingCommands())).toHaveLength(0);
 }finally{prior.db.close();await resumed.db.delete();}
});
