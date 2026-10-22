import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {catchupWorld,act,fundCatchup,withModernHistory} from './catchupTestSupport';
import {make,rich,build,order,reject} from './developmentTestSupport';
import {TRANSFER_COST,TRANSFER_DURATION,transferEligibility,handleCatchupEvent} from './modernCatchup';
import {resourceKeys,zeroResources,type FormalWorld} from './model';
import {advanceFormal,submitFormalOrder} from './reducer';
import {encodeSave,decodeSave} from './saveCodec';
import {EventScheduler} from './scheduler';
import {advanceOfflineCooperative} from './offline';
export function modernEmpire(w=catchupWorld()){
 const id=w.largeProjects[1].owner.kind==='empire'?w.largeProjects[1].owner.empireId:never(),[me,other]=w.factions;
 w.politics={legions:[{id:'legion:original',name:'原軍團',description:'',leader:other.id,members:[other.id],empireId:id},{id:'legion:newcomer',name:'後加入',description:'',leader:me.id,members:[me.id],empireId:id}],empires:[{id,name:'現代帝國',leader:other.id,legions:['legion:original','legion:newcomer'],color:'red'}],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};for(const f of w.factions){f.empireId=id;f.age=2;}return w;
}
function never():never{throw Error('Fixture requires historical empire');}
function start(){const w=modernEmpire();return act(w,{type:'modern.transfer.start',cityId:w.cities[0].id});}
let funding:FormalWorld|undefined;function funded(){if(!funding){const w=start();funding=fundCatchup(w,w.largeProjects.at(-1)!.projectId);}return structuredClone(funding);}
it('B9-4C only non-qualified later joiners of completed modern empire can apply; one personal project and no free inheritance',()=>{
 let w=catchupWorld();reject(w,{type:'modern.transfer.start',cityId:w.cities[0].id});w=modernEmpire(w);expect(w.factions[0].modernQualification).toBe('none');expect(transferEligibility(w,w.playerFactionId)).toBeNull();w=act(w,{type:'modern.transfer.start',cityId:w.cities[0].id});expect(w.largeProjects.at(-1)!.poolResources).toEqual(zeroResources());expect(w.factions[0].modernQualification).toBe('none');reject(w,{type:'modern.transfer.start',cityId:w.cities[0].id});expect(transferEligibility(w,w.factions[1].id)).toContain('已取得');
});
it('B9-4C exact 25.2M formula and 72h; only applicant pays, stock and arrived ledger survive Save/Load',async()=>{
 let w=start(),p=w.largeProjects.at(-1)!;expect(TRANSFER_COST).toEqual({food:5700000,wood:6600000,stone:5700000,gold:7200000});expect(p.durationMs).toBe(72*3600000);
 const cargo={food:100,wood:200,stone:300,gold:400};const foreign=submitFormalOrder(w,order(w,{type:'modern.project.ship',cityId:w.cities[2].id,projectId:p.projectId,resources:cargo},'empire-cannot-pay',w.factions[1].id));expect(foreign.ack?.status).toBe('rejected');expect(foreign.world).toBe(w);
 const before={...w.cities[0].stock},cmd=order(w,{type:'modern.project.ship',cityId:w.cities[0].id,projectId:p.projectId,resources:cargo},'transfer-paid');w=submitFormalOrder(w,cmd).world;for(const r of resourceKeys)expect(w.cities[0].stock[r]).toBe(before[r]-cargo[r]);expect(w.largeProjects.at(-1)!.poolResources).toEqual(zeroResources());const t=w.logistics!.at(-1)!,loaded=(await decodeSave(await encodeSave(w))).world;expect(advanceFormal(loaded,t.arrivalAt)).toEqual(advanceFormal(w,t.arrivalAt));w=advanceFormal(w,t.arrivalAt).world;expect(w.largeProjects.at(-1)!.poolResources).toEqual(cargo);expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');
});
it.each(['legion-leave','empire-leave','legion-dissolve'] as const)('B9-4C voluntary %s rejects atomically during funding and construction',action=>{
 for(const w of [start(),funded()])reject(w,{type:'politics',cityId:w.cities[0].id,action});
});
it.each(['empire-kick','empire-dissolve'] as const)('B9-4C forced %s cancels immediately, forfeits pool and removes completion; inbound cargo returns once',async action=>{
 let w=funded(),p=w.largeProjects.at(-1)!,end=p.catchup!.startedAt!+p.durationMs,invested={...p.poolResources},stocks=w.cities.map(c=>({...c.stock}));
 w=act(w,{type:'politics',cityId:w.cities[2].id,action,...(action==='empire-kick'?{target:w.playerFactionId}:{})},w.factions[1].id);p=w.largeProjects.at(-1)!;expect(p.catchup!.phase).toBe('cancelled');expect(p.poolResources).toEqual(invested);expect(w.events.some(e=>e.type==='modern.project.complete')).toBe(false);expect(w.cities.map(c=>c.stock)).toEqual(stocks);w=(await decodeSave(await encodeSave(w))).world;expect(advanceFormal(w,end).world.factions[0].modernQualification).toBe('none');
 let inbound=start();const id=inbound.largeProjects.at(-1)!.projectId,resources={food:100,wood:0,stone:0,gold:0};inbound=act(inbound,{type:'modern.project.ship',cityId:inbound.cities[0].id,projectId:id,resources});const shipment=inbound.logistics!.at(-1)!;inbound=act(inbound,{type:'politics',cityId:inbound.cities[2].id,action,...(action==='empire-kick'?{target:inbound.playerFactionId}:{})},inbound.factions[1].id);const before=inbound.cities[0].stock.food;inbound=advanceFormal(inbound,shipment.returnAt).world;expect(inbound.largeProjects.at(-1)!.poolResources).toEqual(zeroResources());expect(inbound.largeProjects.at(-1)!.shipments[0].phase).toBe('returned');expect(inbound.cities[0].stock.food).toBeGreaterThanOrEqual(before+100);expect((await decodeSave(await encodeSave(inbound))).world).toEqual(inbound);
});
it('B9-4C 840 paid shipments start exact 72h, qualification belongs only to applicant and survives later departure',async()=>{
 let w=funded(),p=w.largeProjects.at(-1)!,end=p.catchup!.startedAt!+TRANSFER_DURATION;expect(p.shipments).toHaveLength(840);expect(p.poolResources).toEqual(TRANSFER_COST);expect(advanceFormal(w,end-1).world.factions[0].modernQualification).toBe('none');
 const loaded=(await decodeSave(await encodeSave(w))).world,direct=advanceFormal(w,end);expect(advanceFormal(loaded,end)).toEqual(direct);w=direct.world;p=w.largeProjects.at(-1)!;expect(p.catchup!.qualifiedFactionIds).toEqual([w.playerFactionId]);expect(w.factions[0].modernQualification).toBe('full');const before=structuredClone(w);handleCatchupEvent(w,{id:p.catchup!.completionEventId!,type:'modern.project.complete',projectId:p.projectId,at:end},new EventScheduler(w.events));expect(w).toEqual(before);w=act(w,{type:'politics',cityId:w.cities[0].id,action:'empire-leave'});expect(w.factions[0].modernQualification).toBe('full');
});
it('B9-4C six legal offline chunks reach 72h and Recovery preserves cancellation and no refund',async()=>{
 const w=funded(),end=w.largeProjects.at(-1)!.catchup!.startedAt!+TRANSFER_DURATION;let offline={...w,offlineHours:12 as const};for(let i=0;i<6;i++)offline=(await advanceOfflineCooperative(offline,0,(Math.min(end-offline.time,12*3600000))/offline.speed)).world as typeof offline;expect(offline.largeProjects.at(-1)!.catchup!.phase).toBe('completed');
 const {FormalPersistence}=await import('../persistence'),db=new FormalPersistence({suffix:'transfer-'+crypto.randomUUID()});try{let saved=await db.start(funded());const cancelled=act(saved,{type:'politics',cityId:saved.cities[2].id,action:'empire-kick',target:saved.playerFactionId},saved.factions[1].id);saved=await db.save(cancelled,[],saved.revision);const backup=(await db.backupList())[0];await db.restore(backup.id);await db.db.saves.put({id:'current',kind:'world',data:{broken:true}} as never);const recovered=await db.loadSave();expect(recovered.recovered).toBe(true);expect(recovered.game!.largeProjects.at(-1)!.catchup!.phase).toBe('cancelled');expect(recovered.game!.largeProjects.at(-1)!.poolResources).toEqual(TRANSFER_COST);expect(advanceFormal(recovered.game!,end).world.factions[0].modernQualification).toBe('none');}finally{await db.db.delete();}
});

it('B9-4C all 99 AI later joiners use the same personal transfer application and real shipment payment',()=>{
 const base=withModernHistory(make()),player=base.playerFactionId;base.factions[0].modernQualification='full';base.factions[1].modernQualification='none';base.largeProjects[1].breakthrough!.qualifiedFactionIds=[player];
 for(const id of base.factions.filter(f=>f.role==='ai').map(f=>f.id)){
  let w=structuredClone(base);const me=w.factions.find(f=>f.id===id)!,leader=w.factions[0],source=w.cities.find(c=>c.ownerFactionId===id)!,head=w.cities[0],history=w.largeProjects[1].owner;if(history.kind!=='empire')throw Error('missing source');
  for(const c of [source,head]){rich(w,c,10000);build(c,'embassy',15);build(c,'market',15);}me.age=leader.age=2;me.empireId=leader.empireId=history.empireId;
  w.politics={legions:[{id:'legion:ai-transfer-source',name:'原軍團',description:'',leader:player,members:[player],empireId:history.empireId},{id:'legion:ai-transfer-new',name:'加入',description:'',leader:id,members:[id],empireId:history.empireId}],empires:[{id:history.empireId,name:'現代帝國',leader:player,legions:['legion:ai-transfer-source','legion:ai-transfer-new'],color:'red'}],requests:[],relations:[],joints:[],reserves:[],randomCounter:0};
  w=act(w,{type:'modern.transfer.start',cityId:source.id},id);const p=w.largeProjects.at(-1)!,resources={food:10,wood:20,stone:30,gold:40},cmd=order(w,{type:'modern.project.ship',cityId:source.id,projectId:p.projectId,resources},'ai-transfer-'+id.slice(8),id);w=submitFormalOrder(w,cmd).world;expect(w.largeProjects.at(-1)!.poolResources).toEqual(zeroResources());for(const r of resourceKeys)expect(w.cities.find(c=>c.id===source.id)!.stock[r]).toBe(10000-resources[r]);expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');expect(w.factions.find(f=>f.id===id)!.modernQualification).toBe('none');
 }
},30000);
