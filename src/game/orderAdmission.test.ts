import {expect,it} from 'vitest';
import {createFormalFixture,fixtureIds} from './formal/fixture';
import {order} from './formal/testSupport';
import {advanceFormal,submitFormalOrder} from './formal/reducer';
import {createFormalWorld} from './formal/generator';
import {isolatedAutonomyFixture} from './formal/autonomyTestSupport';
import {build} from './formal/developmentTestSupport';
import {playerOrderBase,playerOrderWithBase} from './orderAdmission';

it('unrelated AI city updates do not prevent the exact player rename order from committing',()=>{
 const before=createFormalFixture(),payload={type:'city.rename' as const,cityId:fixtureIds.home,name:'新城'};
 const issued=order(before,'rename-expected',payload),base=playerOrderBase(before,payload)!;
 const later=structuredClone(before);later.revision=8;later.time=60000;
 later.cities[2].population+=100;later.cities[2].name='AI別城';later.factions[1].name='AI新名稱';
 expect(submitFormalOrder(later,issued).ack?.status).toBe('rejected');
 const revalidated=playerOrderWithBase(later,issued,base);
 expect(revalidated.expectedRevision).toBe(8);
 expect(revalidated.commandId).toBe(issued.commandId);
 const result=submitFormalOrder(later,revalidated);
 expect(result.ack?.status).toBe('committed');
 expect(result.world.cities[0].name).toBe('新城');
 expect(result.world.cities[2].name).toBe('AI別城');
 expect(submitFormalOrder(result.world,revalidated).ack?.status).toBe('duplicate');
});

it('completion of another construction target frees capacity without changing the clicked upgrade',()=>{
 const initial=isolatedAutonomyFixture(createFormalWorld({campaign:'admission-completion',seed:90217})),city=initial.cities[0];
 const queued=submitFormalOrder(initial,order(initial,'other-field',{type:'field.upgrade',cityId:city.id,slot:0})).world;
 const payload={type:'building.upgrade' as const,cityId:city.id,key:'center'},issued=order(queued,'center-intent',payload),base=playerOrderBase(queued,payload);
 const job=queued.cities[0].economy!.construction[0],finished=advanceFormal(queued,job.startsAt+job.durationMs).world;
 const admitted=playerOrderWithBase(finished,issued,base);
 expect(admitted.expectedRevision).toBe(finished.revision);const tr=submitFormalOrder(finished,admitted);expect(tr.ack?.status).toBe('committed');
 expect(tr.world.cities[0].economy!.construction[0].target).toEqual({kind:'building',key:'center'});
 expect(tr.world.commandReceipts.filter(r=>r.commandId===issued.commandId)).toHaveLength(1);
});

it('same-target levels and pending job identities remain exact while current resource and capacity checks still reject',()=>{
 let w=isolatedAutonomyFixture(createFormalWorld({campaign:'admission-real-conflicts',seed:90217}));const city=w.cities[0];
 const payload={type:'building.upgrade' as const,cityId:city.id,key:'center'},issued=order(w,'center-intent',payload),base=playerOrderBase(w,payload);
 const stockChanged=structuredClone(w);stockChanged.revision++;stockChanged.cities[0].stock={food:0,wood:0,stone:0,gold:0};
 const resourceOrder=playerOrderWithBase(stockChanged,issued,base);expect(resourceOrder.expectedRevision).toBe(stockChanged.revision);
 const resourceReject=submitFormalOrder(stockChanged,resourceOrder);expect(resourceReject.ack?.reason).toBe('城市實際庫存不足。');expect(resourceReject.world).toBe(stockChanged);
 const targetChanged=structuredClone(w);targetChanged.revision++;targetChanged.cities[0].buildings.center=2;
 expect(playerOrderWithBase(targetChanged,issued,base)).toBe(issued);
 for(let i=0;i<5;i++)w=submitFormalOrder(w,order(w,'fill-'+i,{type:'field.upgrade',cityId:city.id,slot:i})).world;
 const fullBase=playerOrderBase(w,payload),fullIntent=order(w,'full',payload),clock={...w,time:w.time+1,revision:w.revision+1};
 const full=submitFormalOrder(clock,playerOrderWithBase(clock,fullIntent,fullBase));expect(full.ack?.reason).toContain('5 項上限');expect(full.world).toBe(clock);
 const pending=submitFormalOrder(clock,order(clock,'unused',{type:'building.upgrade',cityId:city.id,key:'center'}));expect(pending.ack?.status).toBe('rejected');
});

it('an explicit building slot and a replacement same-target pending job invalidate an old intent',()=>{
 const w=isolatedAutonomyFixture(createFormalWorld({campaign:'admission-slots',seed:90217})),city=w.cities[0];
 const payload={type:'building.upgrade' as const,cityId:city.id,key:'warehouse.0',slot:2},issued=order(w,'slot',payload),base=playerOrderBase(w,payload);
 const occupied=structuredClone(w);occupied.revision++;build(occupied.cities[0],'bunker.0',1);occupied.cities[0].economy!.slots['bunker.0']=2;
 expect(playerOrderWithBase(occupied,issued,base)).toBe(issued);
 const queued=submitFormalOrder(w,order(w,'first-center',{type:'building.upgrade',cityId:city.id,key:'center'})).world;
 const nextPayload={type:'building.upgrade' as const,cityId:city.id,key:'center'},nextIntent=order(queued,'second-center',nextPayload),nextBase=playerOrderBase(queued,nextPayload);
 const swapped=structuredClone(queued);swapped.revision++;swapped.cities[0].economy!.construction[0].commandId=order(swapped,'replacement',nextPayload).commandId;
 expect(playerOrderWithBase(swapped,nextIntent,nextBase)).toBe(nextIntent);
});

it('cancelling the same active job can cross unrelated completion but never crosses its queued-to-active refund phase',()=>{
 let w=isolatedAutonomyFixture(createFormalWorld({campaign:'admission-cancel',seed:90217}));const city=w.cities[0];
 w=submitFormalOrder(w,order(w,'field-first',{type:'field.upgrade',cityId:city.id,slot:0})).world;
 w=submitFormalOrder(w,order(w,'center-second',{type:'building.upgrade',cityId:city.id,key:'center'})).world;
 const queuedJob=w.cities[0].economy!.construction[1],payload={type:'construction.cancel' as const,cityId:city.id,constructionCommandId:queuedJob.commandId},intent=order(w,'cancel-queued',payload),base=playerOrderBase(w,payload);
 const first=w.cities[0].economy!.construction[0],started=advanceFormal(w,first.startsAt+first.durationMs).world;
 expect(playerOrderWithBase(started,intent,base)).toBe(intent);
 const activeIntent=order(started,'cancel-active',payload),activeBase=playerOrderBase(started,payload),clock={...started,time:started.time+1,revision:started.revision+1};
 const canceled=submitFormalOrder(clock,playerOrderWithBase(clock,activeIntent,activeBase));expect(canceled.ack?.status).toBe('committed');expect(canceled.world.cities[0].economy!.construction).toEqual([]);
 let parallel=isolatedAutonomyFixture(createFormalWorld({campaign:'admission-cancel-parallel',seed:90217}));parallel.cities[0].economy!.milestones.push(15000);
 parallel=submitFormalOrder(parallel,order(parallel,'long-center',{type:'building.upgrade',cityId:parallel.cities[0].id,key:'center',lane:0})).world;
 parallel=submitFormalOrder(parallel,order(parallel,'short-field',{type:'field.upgrade',cityId:parallel.cities[0].id,slot:0,lane:1})).world;
 const long=parallel.cities[0].economy!.construction[0],short=parallel.cities[0].economy!.construction[1];
 const cancelPayload={type:'construction.cancel' as const,cityId:parallel.cities[0].id,constructionCommandId:long.commandId},cancelIntent=order(parallel,'cancel-long',cancelPayload),cancelBase=playerOrderBase(parallel,cancelPayload);
 const otherFinished=advanceFormal(parallel,short.startsAt+short.durationMs).world;
 expect(submitFormalOrder(otherFinished,playerOrderWithBase(otherFinished,cancelIntent,cancelBase)).ack?.status).toBe('committed');
});

it('the trusted foreground fence distinguishes governor receipts and still prevents newer human/ABA overwrites',()=>{
 const w=createFormalFixture(),payload={type:'city.rename' as const,cityId:fixtureIds.home,name:'意圖'},intent=order(w,'intent',payload),base=playerOrderBase(w,payload);
 const governor=submitFormalOrder(w,order(w,'ai-governor',{type:'city.rename',cityId:fixtureIds.support,name:'無關總督'})).world;
 expect(playerOrderWithBase(governor,intent,base)).toBe(intent);
 expect(playerOrderWithBase(governor,intent,base,0,0).expectedRevision).toBe(governor.revision);
 // A foreground command with an AI-looking ID is still a hard fence. No
 // classification depends on the user-supplied command ID.
 expect(playerOrderWithBase(governor,intent,base,0,governor.revision)).toBe(intent);
 expect(playerOrderWithBase(governor,intent,base,governor.revision,0)).toBe(intent);
 expect(playerOrderWithBase(governor,intent,base,0,NaN)).toBe(intent);
});

it('never replays a changed or already-applied player intent',()=>{
 const before=createFormalFixture(),payload={type:'city.rename' as const,cityId:fixtureIds.home,name:'新城'};
 const issued=order(before,'old',payload),base=playerOrderBase(before,payload)!;
 const changed=structuredClone(before);changed.revision=1;changed.cities[0].name='新別名';
 expect(playerOrderWithBase(changed,issued,base)).toBe(issued);
 const transferred=structuredClone(before);transferred.revision=1;transferred.cities[0].ownerFactionId=fixtureIds.other;
 expect(playerOrderWithBase(transferred,issued,base)).toBe(issued);
 const otherCampaign=structuredClone(before);otherCampaign.revision=1;otherCampaign.campaignId=createFormalFixture({campaign:'switched'}).campaignId;
 expect(playerOrderWithBase(otherCampaign,issued,base)).toBe(issued);
 const applied=submitFormalOrder(before,issued).world;
 expect(playerOrderWithBase(applied,issued,base)).toBe(issued);
 expect(submitFormalOrder(applied,issued).ack?.status).toBe('duplicate');
});

it('never crosses a newer player command, edited payload or branch fence',()=>{
 const before=createFormalFixture(),payload={type:'city.rename' as const,cityId:fixtureIds.home,name:'新城'};
 const issued=order(before,'stale',payload),base=playerOrderBase(before,payload)!;
 const changed=submitFormalOrder(before,order(before,'other-player', {type:'city.rename',cityId:fixtureIds.support,name:'另一城'})).world;
 expect(changed.cities[0].name).toBe(before.cities[0].name);
 expect(playerOrderWithBase(changed,issued,base)).toBe(issued);
 const remote=structuredClone(before);remote.revision=1;
 expect(playerOrderWithBase(remote,{...issued,payload:{...payload,name:'偷偷替換'}},base)).toBeDefined();
 expect(playerOrderWithBase(remote,{...issued,payload:{...payload,name:'偷偷替換'}},base).expectedRevision).toBe(issued.expectedRevision);
 expect(playerOrderWithBase(remote,issued,base,remote.revision)).toBe(issued);
 expect(playerOrderWithBase(remote,issued)).toBe(issued);
});

it('keeps construction, training and research prerequisites tied to the original action',()=>{
 const w=createFormalFixture(),p={type:'building.upgrade' as const,cityId:fixtureIds.home,key:'center'};
 const base=playerOrderBase(w,p)!;
 const next=structuredClone(w);next.revision=2;next.cities[2].stock.food+=30;
 expect(playerOrderWithBase(next,order(w,'build',p),base).expectedRevision).toBe(2);
 next.cities[0].buildings.center=2;
 expect(playerOrderWithBase(next,order(w,'build',p),base).expectedRevision).toBe(0);
 const tech={type:'research.start' as const,cityId:fixtureIds.home,techId:'fake.technology'};
 const techBase=playerOrderBase(w,tech)!;
 const researchWorld=structuredClone(w);researchWorld.revision=1;researchWorld.factions[0].techIds=['a'];
 expect(playerOrderWithBase(researchWorld,order(w,'tech',tech),techBase).expectedRevision).toBe(0);
 expect(playerOrderBase(w,{type:'developer.configure',cityId:fixtureIds.home,enabled:true,speed:50})).toBeUndefined();
});

it('P0-C3 dispatch ignores unrelated AI revision but fences owned troops, destination generation/ownership, diplomacy and terrain',()=>{
 const w=isolatedAutonomyFixture(createFormalWorld({campaign:'dispatch-admission',seed:90217})),c=w.cities[0];c.military!.units={militia:20};const target=w.worldLayer!.wildSites.find(s=>s.phase==='active')!,payload={type:'army.dispatch' as const,cityId:c.id,mission:'raid' as const,target:{kind:'wild' as const,siteId:target.id,generation:target.generation},units:{militia:10}},issued=order(w,'dispatch',payload),base=playerOrderBase(w,payload);
 expect(base).toBeDefined();const ai=structuredClone(w);ai.revision++;ai.cities[1].stock.food+=1;const admitted=playerOrderWithBase(ai,issued,base);expect(admitted.expectedRevision).toBe(ai.revision);expect(submitFormalOrder(ai,admitted).ack?.status).toBe('committed');
 for(const mutate of [(n:typeof w)=>{n.cities[0].military!.units.militia=19;},(n:typeof w)=>{n.worldLayer!.wildSites.find(s=>s.id===target.id)!.generation++;},(n:typeof w)=>{n.worldLayer!.terrain=(n.worldLayer!.terrain[0]==='W'?'L':'W')+n.worldLayer!.terrain.slice(1);}]){const n=structuredClone(ai);mutate(n);expect(playerOrderWithBase(n,issued,base)).toBe(issued);}
 const cityPayload={...payload,target:{kind:'city' as const,cityId:w.cities[1].id}},cityIssued=order(w,'city-dispatch',cityPayload),cityBase=playerOrderBase(w,cityPayload);const changed=structuredClone(ai);changed.cities[1].ownerFactionId=w.factions[2].id;expect(playerOrderWithBase(changed,cityIssued,cityBase)).toBe(cityIssued);
 const diplomacy=structuredClone(ai);diplomacy.politics??=initialPolitics();diplomacy.politics.relations.push({a:w.playerFactionId,b:w.cities[1].ownerFactionId,state:'friendly'});expect(playerOrderWithBase(diplomacy,cityIssued,cityBase)).toBe(cityIssued);expect(playerOrderWithBase(ai,issued,base,ai.revision)).toBe(issued);
});
import {initialPolitics} from './formal/politics';
