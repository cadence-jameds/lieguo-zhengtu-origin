import {expect,it} from 'vitest';
import {fixtureProjection} from './formal/projectionTestSupport';
import {battlefield} from './formal/combatTestSupport';
import {build} from './formal/developmentTestSupport';
import {storageCapacity} from './formal/catalogB3';
import {ADMIN_COORDINATION,TERRITORY_REGISTER,batchGovernancePlan,runGovernanceBatch,registerAlerts,GOVERNANCE_BATCH_LIMIT} from './administration';
import {commandId} from './formal/ids';
import {governanceIntentBase} from './governanceAdmission';
import type {PresentationWorld} from './presentationModel';
const template={name:'軍事準備',policy:'military',budget:8500,reserve:500} as const;
function fixture(){
 const w=battlefield(),f=w.factions.find(f=>f.id===w.playerFactionId)!;
 f.techIds=[ADMIN_COORDINATION,TERRITORY_REGISTER];
 for(const c of w.cities.slice(0,2)){c.ownerFactionId=w.playerFactionId;build(c,'townhall',1);}
 return w;
}
function project(w:ReturnType<typeof fixture>,branch=0):PresentationWorld{
 const p=fixtureProjection(w,{protocolVersion:2,campaignId:w.campaignId,branch,writerEpoch:1,sessionId:'admin-tests',projectionSequence:w.revision+1,revision:w.revision});
 p.derived.governance=Object.fromEntries(w.cities.map(c=>[c.id,governanceIntentBase(w,c.id,null).fingerprint]));
 return p;
}
it('plans only selected qualified own cities after research, bounds batch and preserves disabled state',()=>{
 const w=fixture(),[a,b,other]=w.cities,p=project(w);
 expect(batchGovernancePlan(p,[a.id,b.id],template).targets.map(t=>t.payload)).toEqual(
 [a,b].map(c=>({type:'governance.set',cityId:c.id,enabled:false,policy:'military',budget:8500,reserve:500})));
 expect(()=>batchGovernancePlan(p,[other.id],template)).toThrow();
 expect(()=>batchGovernancePlan(p,[a.id,a.id],template)).toThrow();
 expect(()=>batchGovernancePlan(p,Array(GOVERNANCE_BATCH_LIMIT+1).fill(a.id),template)).toThrow();
 build(w.cities[1],'townhall',0);
 expect(()=>batchGovernancePlan(project(w),[b.id],template)).toThrow();
 w.factions[0].techIds=[];
 expect(()=>batchGovernancePlan(project(w),[a.id],template)).toThrow();
});
it('stops on uncertain outcome or branch switch and does not issue a second identity',async()=>{
 const w=fixture(),[a,b]=w.cities,plan=batchGovernancePlan(project(w),[a.id,b.id],template),sent:string[]=[];
 const results=await runGovernanceBatch(plan,{world:()=>project(w),send:async p=>{sent.push(p.cityId);return undefined;},waitProjection:async()=>false});
 expect(sent).toEqual([a.id]);expect(results.map(r=>r.status)).toEqual(['uncertain','unsent']);
 let branch=0;
 const next=await runGovernanceBatch(plan,{world:()=>project(w,branch),send:async()=>({commandId:commandId('ok'),status:'committed',revision:1}),waitProjection:async()=>{branch++;return true;}});
 expect(next.map(r=>r.status)).toEqual(['applied','unsent']);
});
it('advances while verified projection matches the new revision, but skips a changed second city',async()=>{
 const w=fixture(),[a,b]=w.cities,plan=batchGovernancePlan(project(w),[a.id,b.id],template),sent:string[]=[];
 const results=await runGovernanceBatch(plan,{world:()=>project(w),send:async(p,base)=>{sent.push(p.cityId);expect(base.revision).toBe(w.revision);return {commandId:commandId('ok'),status:'committed',revision:w.revision+1};},waitProjection:async revision=>{w.revision=revision;build(w.cities[1],'townhall',2);return true;}});
 expect(sent).toEqual([a.id]);expect(results.map(r=>r.status)).toEqual(['applied','changed']);
});
it('territory alerts are owned-city-only, read-only, and account for reserved incoming storage',()=>{
 const w=fixture(),[a,b,c]=w.cities;
 a.stock={food:10,wood:storageCapacity(a)-300,stone:580,gold:580};a.economy!.reservedIncoming.wood=280;
 a.population=Math.ceil(a.housing*.91);a.economy!.construction=[];a.military!.queue=[];
 const saved=JSON.stringify(w),rows=registerAlerts(w,250);
 expect(rows.map(r=>r.cityId)).toContain(a.id);expect(rows.map(r=>r.cityId)).toContain(b.id);expect(rows.map(r=>r.cityId)).not.toContain(c.id);
 expect(rows.find(r=>r.cityId===a.id)).toMatchObject({minimum:250,low:['food'],full:['wood'],idle:['建造','訓練'],housing:true});
 expect(JSON.stringify(w)).toBe(saved);
 w.factions[0].techIds=[ADMIN_COORDINATION];expect(registerAlerts(w,250)).toEqual([]);
});
