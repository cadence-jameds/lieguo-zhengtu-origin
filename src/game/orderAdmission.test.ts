import {expect,it} from 'vitest';
import {createFormalFixture,fixtureIds} from './formal/fixture';
import {order} from './formal/testSupport';
import {submitFormalOrder} from './formal/reducer';
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
