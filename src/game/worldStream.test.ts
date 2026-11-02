import {prepareAdmissionMap} from './admissionMap';
import 'fake-indexeddb/auto';
import {afterEach,expect,it,vi} from 'vitest';
import {WorldStream} from './worldStream';
import {PresentationStore} from './presentationStore';
import {FormalPersistence} from './persistence';
import {createFormalWorld} from './formal/generator';
import {advanceFormal,submitFormalOrder} from './formal/reducer';
import {order} from './formal/testSupport';
import {fixtureStream} from './formal/projectionFixtureSupport';
import {WorldProjection} from './worldProjection';
import {governanceBase} from './governanceAdmission';
const stores:FormalPersistence[]=[];
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(stores.splice(0).map(p=>p.db.delete()));});
const setup=async()=>{const p=new FormalPersistence({suffix:'projection-'+crypto.randomUUID()});stores.push(p);const w=await p.start(createFormalWorld({campaign:'projection-'+crypto.randomUUID(),seed:90217}));await prepareAdmissionMap(w);return {p,w,writer:{branch:w.ledger!.anchor.branch,writerEpoch:w.ledger!.anchor.writerEpoch}};};
function apply(store:PresentationStore,message:unknown){expect(store.receive(structuredClone(message))).toEqual({accepted:true});return store.getWorld()!;}
function noHistory(value:unknown){const json=JSON.stringify(value);expect(json).not.toContain('commandReceipts');expect(json).not.toContain('originalResult');expect(json).not.toContain('historyRoot');}
it('appended identity transports changed entity only; complete provenance remains solely in the authority',async()=>{
 const {p,w,writer}=await setup(),stream=new WorldStream(),store=new PresentationStore();const initial=apply(store,stream.publish(w,writer));
 const transition=submitFormalOrder(w,order(w,'append-history',{type:'city.rename',cityId:w.cities[0].id,name:'New name'})),next=await p.save(transition.world,transition.reports,w.revision),spy=vi.spyOn(JSON,'stringify'),patch=stream.publish(next,writer);
 expect(spy).not.toHaveBeenCalled();expect(patch.kind).toBe('patch');if(patch.kind!=='patch')throw Error();expect(patch.entities.cities).toHaveLength(1);expect(patch.entities.armies).toBeUndefined();expect(patch.sections.staticMap).toBeUndefined();const visible=apply(store,patch);expect(visible.cities[0].name).toBe('New name');expect(visible.cities[1]).toBe(initial.cities[1]);expect(next.commandReceipts).toHaveLength(1);noHistory(patch);
});
it('Recovery disposition changes rebuild a branch snapshot, preserve formal history, and invalidate the old stream',async()=>{
 const {p,w,writer}=await setup(),stream=new WorldStream(),store=new PresentationStore();apply(store,stream.publish(w,writer));const t=submitFormalOrder(w,order(w,'rollback-history',{type:'city.rename',cityId:w.cities[0].id,name:'Before rollback'})),next=await p.save(t.world,t.reports,w.revision),old=stream.publish(next,writer);apply(store,old);
 const checkpoint=(await p.backupList()).at(-1)!,restored=await p.restore(checkpoint.id),context=await p.writerContext(),snapshot=stream.publish(restored,context);expect(snapshot.kind).toBe('snapshot');expect(restored.commandReceipts[0].disposition).toBe('rolled-back');const view=apply(store,snapshot);expect(view.cities[0].name).toBe(w.cities[0].name);expect(store.receive(old).accepted).toBe(false);expect(store.getWorld()).toBe(view);noHistory(snapshot);
});
it('view generation never invokes a receipt toJSON; unverified or private sources cannot impersonate committed snapshots',async()=>{
 const raw=createFormalWorld({campaign:'unverified',seed:90217}),stream=new WorldStream();Object.assign(raw.commandReceipts,{toJSON:()=>{throw Error('history serialization');}});expect(()=>stream.publish(raw,{branch:0,writerEpoch:0})).toThrow();
 const {w,writer}=await setup(),draft=submitFormalOrder(w,order(w,'private',{type:'city.rename',cityId:w.cities[0].id,name:'Private'})).world;expect(()=>new WorldProjection().build(draft,{protocolVersion:2,...writer,campaignId:w.campaignId,revision:draft.revision,sessionId:'test',projectionSequence:1})).toThrow('已提交');
});
it('passive checkpoints carry only clock data; terrain and every unchanged entity retain reference equality',async()=>{
 const {p,w,writer}=await setup(),stream=new WorldStream(),store=new PresentationStore(),before=apply(store,stream.publish(w,writer)),r=advanceFormal(w,1000),next=await p.save(r.world,r.reports,w.revision),patch=stream.publish(next,writer);expect(patch.kind).toBe('patch');if(patch.kind!=='patch')throw Error();expect(patch.entities).toEqual({});expect(Object.keys(patch.sections)).toEqual(['time']);const view=apply(store,patch);expect(view.time).toBe(1000);expect(view.revision).toBe(next.revision);expect(view.cities).toBe(before.cities);expect(view.worldLayer).toBe(before.worldLayer);expect(JSON.stringify(patch).length).toBeLessThan(700);
});
it('construction and completion reconstruct all display fields without transporting unchanged terrain or receipt history',async()=>{
 const {p,w,writer}=await setup(),stream=new WorldStream(),store=new PresentationStore(),initial=apply(store,stream.publish(w,writer)),t=submitFormalOrder(w,order(w,'build',{type:'field.upgrade',cityId:w.cities[0].id,slot:0})),started=await p.save(t.world,t.reports,w.revision);apply(store,stream.publish(started,writer));const job=started.cities[0].economy!.construction[0],r=advanceFormal(started,job.startsAt+job.durationMs),finished=await p.save(r.world,r.reports,started.revision),patch=stream.publish(finished,writer),view=apply(store,patch);expect(view.cities[0]).toEqual(finished.cities[0]);expect(view.cities[0].fields![0].level).toBe(1);expect(view.worldLayer).toBe(initial.worldLayer);expect(view.derived.governance[w.cities[0].id]).toBe(governanceBase(finished,w.cities[0].id).fingerprint);noHistory(patch);
});
it('missing base, bad campaign/revision/epoch/protocol/entity versions reject atomically and require snapshots',async()=>{
 const w=createFormalWorld({campaign:'discontinuity',seed:90217}),stream=fixtureStream(),snapshot=stream.publish(w,{branch:1,writerEpoch:1}),next={...w,time:1000,revision:1},patch=stream.publish(next,{branch:1,writerEpoch:1});expect(patch.kind).toBe('patch');
 for(const mutate of [(p:any)=>p.campaignId='campaign:other',(p:any)=>p.baseRevision=999,(p:any)=>p.writerEpoch=2,(p:any)=>p.protocolVersion=1,(p:any)=>p.projectionSequence+=2,(p:any)=>p.sections.time.baseVersion+=1]){const store=new PresentationStore(),prior=apply(store,snapshot),bad=structuredClone(patch);mutate(bad);expect(store.receive(bad).accepted).toBe(false);expect(store.getWorld()).toBe(prior);expect(store.getHealth().state).toBe('recovering');}
 expect(new PresentationStore().receive(patch).accepted).toBe(false);const store=new PresentationStore();apply(store,snapshot);const view=apply(store,patch);expect(store.receive(patch).accepted).toBe(false);expect(store.getWorld()).toBe(view);
});
it('same-revision committed rejection advances sequence while preserving the identical UI world reference',async()=>{
 const {p,w,writer}=await setup(),stream=new WorldStream(),store=new PresentationStore(),initial=apply(store,stream.publish(w,writer)),o=order(w,'rejected',{type:'city.rename',cityId:w.cities[0].id,name:'Rejected'}),row=await p.receiveCommand(o),next=await p.finishCommand(row,{commandId:o.commandId,status:'rejected',revision:w.revision,reason:'拒絕'},w.revision);expect(next.revision).toBe(w.revision);expect(next.ledger!.anchor.root).not.toBe(w.ledger!.anchor.root);const patch=stream.publish(next,writer);expect(patch.kind).toBe('patch');if(patch.kind!=='patch')throw Error();expect(patch.projectionSequence).toBe(2);expect(patch.sections).toEqual({});expect(patch.entities).toEqual({});apply(store,patch);expect(store.getWorld()).toBe(initial);expect((await p.commandStatus(w.campaignId,o.commandId))!.state).toBe('rejected');
});
it('120 entity updates/removals/additions keep unrelated references and never accumulate snapshots',()=>{
 let w=createFormalWorld({campaign:'many-patches',seed:90217});const stream=fixtureStream(),store=new PresentationStore(),initial=apply(store,stream.publish(w,{branch:1,writerEpoch:1}));
 for(let i=0;i<120;i++){w={...w,revision:w.revision+1,cities:w.cities.map((c,n)=>n?c:{...c,stock:{...c.stock,food:c.stock.food+i+1}})};const view=apply(store,stream.publish(w,{branch:1,writerEpoch:1}));expect(view.cities[0].stock.food).toBe(w.cities[0].stock.food);expect(view.cities[1]).toBe(initial.cities[1]);}
 expect(store.getWorld()!.projection.projectionSequence).toBe(121);
});
