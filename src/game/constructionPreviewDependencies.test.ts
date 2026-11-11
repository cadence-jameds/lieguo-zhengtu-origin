import {expect,it} from 'vitest';
import {constructionDependencyKey} from './constructionPreviewDependencies';
import {constructionPreviewContext} from './constructionPreviewContext';
import {createFormalWorld} from './formal/generator';
import {calculateConstructionPreview} from './constructionPreviewCompute';
import {resourceKeys} from './formal/model';
import {ConstructionPreviewController} from './constructionPreviewController';
import {calculatePreviewRequest} from './constructionPreviewCompute';
import type {PreviewRequest} from './constructionPreviewProtocol';
const w=createFormalWorld({campaign:'preview-dependencies',seed:90217});
const context=()=>constructionPreviewContext(w,w.cities[0].id),target=[{field:0}];
it('revision-only/time/settlement bookkeeping and training queue do not masquerade as construction rule changes',()=>{
 const a=context(),b=context();b.time+=25000;b.city.population++;b.city.economy!.lastSettledAt+=1000;
 b.city.military={...w.cities[0].military!,queue:[{commandId:'command:training'} as never]};
 expect(constructionDependencyKey(a,target,true)).toBe(constructionDependencyKey(b,target,true));
 b.city.stock.stone--;expect(constructionDependencyKey(a,target,true)).not.toBe(constructionDependencyKey(b,target,true));
});
it.each(['stock','queue','schedule','level','center','age','housing','milestone','promotion','slots','owner','pause','craft'] as const)('actual %s dependency invalidates the checked snapshot',kind=>{
 const a=context(),b=context();
 if(kind==='stock')b.city.stock.stone--;
 if(kind==='queue'||kind==='schedule'){b.city.economy!.construction.push({startsAt:1000,durationMs:1000} as never);if(kind==='schedule')b.time++;}
 if(kind==='level')b.city.fields![0].level++;
 if(kind==='center')b.city.buildings.center++;
 if(kind==='age')b.age++;
 if(kind==='housing')b.city.housing++;
 if(kind==='milestone')b.city.economy!.milestones.push(10000);
 if(kind==='promotion')b.city.cityPromotionCompleted=true;
 if(kind==='slots')b.city.economy!.slots['warehouse.1']=14;
 if(kind==='owner')b.city.ownerFactionId=w.factions[1].id;
 if(kind==='pause')b.paused=true;
 if(kind==='craft')b.crafts['craft:1']=true;
 expect(constructionDependencyKey(a,target,true)).not.toBe(constructionDependencyKey(b,target,true));
});
it('non-empty construction schedules include time even when only revision-independent time advances',()=>{
 const a=context();a.city.economy!.construction.push({startsAt:1000,durationMs:1000} as never);const b=structuredClone(a);b.time++;
 expect(constructionDependencyKey(a,target)).not.toBe(constructionDependencyKey(b,target));
});
it('exact stock boundary is display metadata only, never turns an invalid quote into Ready or changes the city',()=>{
 for(const t of [...[...new Set(w.cities[0].fields!.map(f=>f.resource))].map(resource=>({field:w.cities[0].fields!.find(f=>f.resource===resource)!.slot})),{key:'wall'},{key:'warehouse.1',slot:14}]){
  const c=context();c.city.stock={food:0,wood:0,stone:0,gold:0};const before=structuredClone(c),r=calculateConstructionPreview(c,t);
  expect(r.status).toBe('invalid');if(r.status==='ready')throw Error('must remain invalid');expect(r.reason).toBe('城市實際庫存不足。');expect(r.requiredResources).toBeDefined();expect(c).toEqual(before);
  const funded=structuredClone(c);funded.city.stock={...r.requiredResources!};const ready=calculateConstructionPreview(funded,t);expect(ready.status).toBe('ready');if(ready.status!=='ready')throw Error('exact payment must admit');expect(ready.quote.paidResources).toEqual(r.requiredResources);
 }
});
it('increasing insufficient stocks reuse the exact boundary; crossing any missing payment revalidates, then depletion invalidates Ready',()=>{
 const ports:PreviewRequest[]=[],done:ReturnType<typeof calculatePreviewRequest>[]=[],port={postMessage:(r:PreviewRequest)=>ports.push(r),terminate:()=>{},onmessage:null as Worker['onmessage'],onerror:null,onmessageerror:null},controller=new ConstructionPreviewController(()=>port as unknown as Worker),poor=context();poor.city.stock={food:0,wood:0,stone:0,gold:0};
 const req=(n:number,c=poor):PreviewRequest=>({protocolVersion:1,campaignId:w.campaignId,branch:'one',cityId:c.city.id,revision:n,requestId:n,generation:n,targets:target,context:c});
 const send=(r:PreviewRequest)=>controller.request(1,r,response=>done.push(response),e=>{throw e;});const reply=()=>port.onmessage?.call(port as unknown as Worker,{data:calculatePreviewRequest(ports.at(-1)!)} as MessageEvent);
 try{send(req(1));reply();const result=done[0].results[0];if(result.status==='ready'||!result.requiredResources)throw Error('expected exact boundary');
 for(let n=2;n<32;n++){const c=structuredClone(poor);c.time=n*25000;for(const k of resourceKeys)c.city.stock[k]=Math.min(n,result.requiredResources[k]);c.city.stock.stone=0;send(req(n,c));expect(done.at(-1)!.results[0].status).toBe('invalid');}
 expect(ports).toHaveLength(1);expect(controller.metrics.cacheHits).toBe(30);
 const funded=structuredClone(poor);funded.city.stock={...result.requiredResources};send(req(32,funded));expect(ports).toHaveLength(2);expect(done).toHaveLength(31);reply();expect(done.at(-1)!.results[0].status).toBe('ready');
 funded.city.stock.stone--;send(req(33,funded));expect(ports).toHaveLength(3);reply();expect(done.at(-1)!.results[0].status).toBe('invalid');
 }finally{controller.dispose();}
});
