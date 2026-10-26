import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {modernFundingFixture} from './modernFundingTestSupport';
import {resourceKeys,zeroResources,type FormalWorld,type Resources} from './model';
import {submitFormalOrder,advanceFormal,completeResearch} from './reducer';
import {order} from './developmentTestSupport';
import {encodeSave,decodeSave} from './saveCodec';
import {advanceOfflineCooperative} from './offline';
import {FormalPersistence} from '../persistence';
import {combatStats} from './combatModifiers';

const stock=(w:FormalWorld)=>w.cities.slice(0,3).map(c=>({...c.stock}));
const view=(w:FormalWorld)=>({stocks:stock(w),projects:w.researchProjects,faction:w.factions[0],events:w.events.filter(e=>e.type==='research.complete'),receipts:w.commandReceipts,completionReceipts:w.completionReceipts});
function start(){const x=modernFundingFixture();const cmd=order(x.world,{type:'research.start',cityId:x.cityIds[0],techId:x.techId},'abc-start');const t=submitFormalOrder(x.world,cmd);expect(t.ack?.status,t.ack?.reason).toBe('committed');return {...x,world:t.world,startCommand:cmd};}
function contribute(w:FormalWorld,cityId:FormalWorld['cities'][number]['id'],resources:Resources,key:string){const cmd=order(w,{type:'research.contribute',cityId,projectId:w.researchProjects[0].projectId,resources},key),t=submitFormalOrder(w,cmd);expect(t.ack?.status,t.ack?.reason).toBe('committed');return {world:t.world,cmd,reports:t.reports};}
async function checkpoint(w:FormalWorld){
 const expected=view(w),decoded=(await decodeSave(await encodeSave(w))).world;expect(view(decoded)).toEqual(expected);
 const db=new FormalPersistence({suffix:'abc-checkpoint-'+crypto.randomUUID()});
 try{
  const stored=await db.start(w),loaded=(await db.loadSave()).game!;expect(view(loaded)).toEqual(view(stored));
  const text=await db.exportStoredSave('full');expect(view((await decodeSave(JSON.parse(text))).world)).toEqual(view(stored));
  const backup=(await db.backupList())[0];await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);
  const recovered=await db.loadSave();expect(recovered.recovered).toBe(true);expect(view(recovered.game!)).toEqual(view(stored));
  expect(view(await db.restore(backup.id))).toEqual({...view(stored),receipts:stored.commandReceipts});
 }finally{await db.db.delete();}
 return decoded;
}

it('A/B/C fund a real project exactly once, save/recover every phase, complete through the scheduler and retain the actual effect',async()=>{
 const fixture=modernFundingFixture(),before=stock(fixture.world),trace:unknown[]=[];
 for(const c of fixture.world.cities.slice(0,3))expect(resourceKeys.some(r=>c.stock[r]<fixture.cost[r])).toBe(true);
 for(const r of resourceKeys)expect(before.reduce((n,s)=>n+s[r],0)).toBe(fixture.cost[r]);
 let {world:w,cityIds,parts,startCommand}=start();let p=w.researchProjects[0];
 expect(stock(w)).toEqual(before);expect(p).toMatchObject({phase:'funding',paymentMode:'same-faction-direct',contributedResources:zeroResources(),completionEventId:null});expect(p.startedAt).toBeUndefined();expect(w.events.some(e=>e.type==='research.complete')).toBe(false);expect(w.factions[0].researchQueue).toBe(p.projectId);
 const snapshot=structuredClone(p.durationSnapshot);trace.push({stage:'created',...view(w)});
 for(const i of [0,1,2]){
  const previous=stock(w),out=contribute(w,cityIds[i],parts[i],'abc-city-'+i);w=out.world;p=w.researchProjects[0];
  for(const [j,c] of w.cities.slice(0,3).entries())for(const r of resourceKeys)expect(c.stock[r]).toBe(previous[j][r]-(j===i?parts[i][r]:0));
  expect(p.contributedResources).toEqual(Object.fromEntries(resourceKeys.map(r=>[r,parts.slice(0,i+1).reduce((n,s)=>n+s[r],0)])));
  expect(p.contributions.map(c=>c.sourceCityId)).toEqual(cityIds.slice(0,i+1));
  if(i===0)for(const r of resourceKeys)expect(p.contributedResources[r]*2).toBe(fixture.cost[r]);
  const duplicate=submitFormalOrder(w,out.cmd);expect(duplicate.ack?.status).toBe('duplicate');expect(view(duplicate.world)).toEqual(view(w));
  expect(p.phase).toBe(i===2?'researching':'funding');expect(w.events.filter(e=>e.type==='research.complete')).toHaveLength(i===2?1:0);
  if(i<2){expect(p.startedAt).toBeUndefined();expect(p.completionEventId).toBeNull();}else{expect(p.startedAt).toBe(w.time);expect(p.fundingTransitionCommandId).toBe(out.cmd.commandId);}
  expect(p.durationSnapshot).toEqual(snapshot);trace.push({stage:'after-'+['A','B','C'][i],contribution:parts[i],before:previous,...view(w)});
  w=await checkpoint(w);
 }
 p=w.researchProjects[0];expect(p.contributedResources).toEqual(fixture.cost);expect(w.logistics??[]).toEqual([]);expect(stock(w)).toEqual([zeroResources(),zeroResources(),zeroResources()]);
 expect(submitFormalOrder(w,startCommand).ack?.status).toBe('duplicate');
 const end=p.startedAt!+snapshot.durationMs,event=w.events.find(e=>e.type==='research.complete')!;expect(event.at).toBe(end);
 const beforeAttack=combatStats('modern.militia',w.factions[0]).attack;
 expect(advanceFormal(w,end-1).world.factions[0].techIds).not.toContain(fixture.techId);
 const online=advanceFormal(w,end),offline=await advanceOfflineCooperative(w,0,(end-w.time)/w.speed);expect(view(offline.world)).toEqual(view(online.world));
 w=online.world;expect(w.factions[0].techIds.filter(id=>id===fixture.techId)).toHaveLength(1);expect(w.factions[0].researchQueue).toBeNull();expect(w.researchProjects[0].phase).toBe('completed');expect(combatStats('modern.militia',w.factions[0]).attack).toBeCloseTo(beforeAttack*1.08);expect(w.completionReceipts.filter(r=>r.projectId===p.projectId)).toHaveLength(1);
 const completed=view(w);expect(event.type).toBe('research.complete');if(event.type==='research.complete')expect(completeResearch(w,event)).toEqual([]);expect(view(w)).toEqual(completed);
 await checkpoint(w);const repeat=submitFormalOrder(w,order(w,{type:'research.start',cityId:cityIds[0],techId:fixture.techId},'abc-repeat'));expect(repeat.ack?.status).toBe('rejected');expect(view(repeat.world)).toEqual(completed);trace.push({stage:'completed',...view(w)});
 const evidence=process.env.RESEARCH_FUNDING_EVIDENCE;if(evidence){mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,'engine-ledger.json'),JSON.stringify({source:'synthetic fixture; official commands, scheduler, IndexedDB, codec and Recovery',cost:fixture.cost,parts,trace},null,2));}
},30000);

for(const [name,kind] of [['foreign city','foreign-city'],['foreign faction','foreign-faction'],['over stock','stock'],['over remaining','remaining'],['negative','negative'],['fractional','fraction'],['NaN','nan'],['Infinity','infinity'],['unsafe integer','unsafe']] as const)it('rejects '+name+' without stock, project, queue or receipt mutation',()=>{
 const x=start();let w=x.world,issuer=w.playerFactionId,cityId=x.cityIds[0],resources={food:1,wood:0,stone:0,gold:0};
 if(kind==='foreign-city')cityId=w.cities[3].id;
 if(kind==='foreign-faction'){issuer=w.cities[3].ownerFactionId;cityId=w.cities[3].id;}
 if(kind==='stock')resources.food=w.cities[0].stock.food+1;
 if(kind==='remaining'){w=contribute(w,x.cityIds[0],x.parts[0],'abc-part-a').world;w=contribute(w,x.cityIds[1],x.parts[1],'abc-part-b').world;cityId=x.cityIds[2];w.cities[2].stock.food+=10;resources.food=w.researchProjects[0].requiredResources.food-w.researchProjects[0].contributedResources.food+1;}
 if(kind==='negative')resources.food=-1;if(kind==='fraction')resources.food=.5;if(kind==='nan')resources.food=NaN;if(kind==='infinity')resources.food=Infinity;if(kind==='unsafe')resources.food=Number.MAX_SAFE_INTEGER+1;
 const before=JSON.stringify(w),cmd=order(w,{type:'research.contribute',cityId,projectId:w.researchProjects[0].projectId,resources},'abc-invalid-'+kind,issuer);
 if(new Set(['negative','fraction','nan','infinity','unsafe']).has(kind))expect(()=>submitFormalOrder(w,cmd)).toThrow('命令格式無效');
 else{const t=submitFormalOrder(w,cmd);expect(t.ack?.status).toBe('rejected');expect(JSON.stringify(t.world)).toBe(before);}
 expect(JSON.stringify(w)).toBe(before);
});
it('funding holds the sole faction queue and full funding cannot be applied twice',()=>{
 let x=start(),w=x.world;const t=submitFormalOrder(w,order(w,{type:'research.start',cityId:x.cityIds[0],techId:'modern.personal-protection'},'abc-second'));expect(t.ack?.status).toBe('rejected');expect(t.world.researchProjects).toHaveLength(1);
 for(const i of [0,1,2])w=contribute(w,x.cityIds[i],x.parts[i],'abc-fund-'+i).world;
 const before=JSON.stringify(w),extra=submitFormalOrder(w,order(w,{type:'research.contribute',cityId:x.cityIds[0],projectId:w.researchProjects[0].projectId,resources:{food:1,wood:0,stone:0,gold:0}},'abc-extra'));expect(extra.ack?.status).toBe('rejected');expect(JSON.stringify(extra.world)).toBe(before);expect(w.events.filter(e=>e.type==='research.complete')).toHaveLength(1);
});
