import 'fake-indexeddb/auto';
import {it,expect,vi} from 'vitest';
import {FormalDatabase} from '../persistence';
import {B5_LAB_SUFFIX,defaultLabConfig,labActiveTarget} from './B5Lab';
import type {FormalWorld} from '../formal/model';
it('real lab Worker queues requests, uses isolated persistence, recovers after rejected commands and reads only its own report/intel campaign',async()=>{
 const db=new FormalDatabase(B5_LAB_SUFFIX);await db.delete();const messages:any[]=[],port={onmessage:null as null|((e:{data:any})=>void),postMessage:(r:unknown)=>messages.push(structuredClone(r))};vi.stubGlobal('self',port);vi.resetModules();await import('./b5Lab.worker');
 const send=async(request:unknown)=>{const requestId=crypto.randomUUID();port.onmessage!({data:{...request as object,requestId}});await vi.waitFor(()=>expect(messages.some(m=>m.type==='done'&&m.requestId===requestId)).toBe(true),{timeout:10000});return requestId;};
 const world=()=>messages.filter(m=>m.type==='state').at(-1)!.world as FormalWorld;
 try{
  await send({type:'open',config:defaultLabConfig(4321,'civ_zhongguo')});expect(world().campaignId).toMatch(/^campaign:b5lab-/);await db.open();expect(await db.saves.count()).toBe(2);const original=world();await send({type:'start'});expect(messages.at(-2).text).toContain('不支援');expect(world()).toEqual(original);
  await send({type:'order',payload:{type:'army.dispatch',cityId:original.cities[0].id,mission:'scout',target:{kind:'city',cityId:labActiveTarget(original)!.id},units:{scout:10}}});expect(world().armies).toHaveLength(1);await send({type:'advance'});expect(world().armies[0].pendingIntel).toBeDefined();await send({type:'reload'});await send({type:'advance'});await send({type:'reportPage',page:0,filter:'all'});expect(messages.filter(m=>m.type==='reportPage').at(-1)!.data.count).toBe(1);
  const w=world();await send({type:'cityIntel',queryId:'lab-read',cityId:labActiveTarget(w)!.id,campaignId:w.campaignId,reportCursor:w.sequences.report,time:w.time});expect(messages.filter(m=>m.type==='cityIntel').at(-1)!.data.army.intel.resources).toBeDefined();await send({type:'cityIntel',queryId:'wrong-read',cityId:labActiveTarget(w)!.id,campaignId:'campaign:normal',reportCursor:w.sequences.report,time:w.time});expect(messages.at(-2)).toMatchObject({type:'error',queryId:'wrong-read'});await send({type:'export'});expect(JSON.parse(messages.at(-2).text).kind).toBe('b5-combat-lab');expect(await db.BattleReports.count()).toBe(1);
 }finally{await db.delete();vi.unstubAllGlobals();}
});
