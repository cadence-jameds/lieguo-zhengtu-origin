import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {createFormalWorld} from './generator';
import {order} from './testSupport';
import {submitFormalOrder} from './reducer';
import {resourceKeys,type FormalCommand,type FormalWorld} from './model';
import {encodeSave,decodeSave} from './saveCodec';
import {FormalPersistence} from '../persistence';
const base=createFormalWorld({campaign:'refund-v86',seed:90217});let serial=0;
function make(){const w=structuredClone(base),c=w.cities[0];c.buildings.center=2;c.buildings['warehouse.0']=15;c.economy!.slots['warehouse.0']=0;c.stock={food:90000,wood:90000,stone:90000,gold:90000};return w;}
function commit(w:FormalWorld,p:FormalCommand){const t=submitFormalOrder(w,order(w,'refund-'+ ++serial,p));expect(t.ack?.status,t.ack?.reason).toBe('committed');return t.world;}
for(const kind of ['building','field','wall'])for(const queued of [false,true])it(`v86 ${kind} ${queued?'queued100':'active50'}: independent paid snapshot and dependency cancellation`,()=>{
 let w=make(),id=w.cities[0].id;
 if(queued)w=commit(w,{type:'building.upgrade',cityId:id,key:'center'});
 const p:FormalCommand=kind==='field'?{type:'field.upgrade',cityId:id,slot:0}:{type:'building.upgrade',cityId:id,key:kind==='wall'?'wall':'residence'};
 w=commit(w,p);w=commit(w,p);const c=w.cities[0],jobs=c.economy!.construction.slice(queued?1:0),stock={...c.stock};
 const cancel=order(w,'cancel-'+ ++serial,{type:'construction.cancel',cityId:id,constructionCommandId:jobs[0].commandId});
 const t=submitFormalOrder(w,cancel);expect(t.ack?.status).toBe('committed');
 for(const r of resourceKeys)expect(t.world.cities[0].stock[r]).toBe(stock[r]+Math.floor(jobs[0].paidResources![r]*(queued?1:.5))+jobs[1].paidResources![r]);
 expect(t.world.events.some(e=>jobs.some(j=>j.eventId===e.id))).toBe(false);
 expect(submitFormalOrder(t.world,cancel).ack?.status).toBe('duplicate');
 expect(submitFormalOrder(t.world,{...cancel,commandId:order(w,'stale-'+ ++serial,p).commandId}).ack?.status).toBe('rejected');
 expect(submitFormalOrder(t.world,cancel).world).toBe(t.world);
});
it('v86 refund survives save/load and Recovery without repeated refunds',async()=>{
 const s=new FormalPersistence({suffix:'refund-v86-'+crypto.randomUUID()});
 try{let w=await s.start(make());w=commit(w,{type:'building.upgrade',cityId:w.cities[0].id,key:'wall'});w=await s.save(w,[],w.revision-1);const checkpoint=(await s.backupList())[0].id,j=w.cities[0].economy!.construction[0],cmd=order(w,'refund-durable',{type:'construction.cancel',cityId:w.cities[0].id,constructionCommandId:j.commandId});
 const t=submitFormalOrder(w,cmd),saved=await s.save(t.world,t.reports,w.revision);expect((await decodeSave(await encodeSave(saved))).world).toEqual(saved);expect((await s.loadSave()).game).toEqual(saved);
 expect(submitFormalOrder(saved,cmd).ack?.status).toBe('duplicate');const recovered=await s.restore(checkpoint);expect(submitFormalOrder(recovered,cmd).ack?.status).toBe('rolled-back');expect(recovered.cities[0].economy!.construction).toHaveLength(1);
 }finally{await s.db.delete();}
});
