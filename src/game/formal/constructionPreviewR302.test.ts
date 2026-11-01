import {expect,it} from 'vitest';
import {make,rich,build,order,commit,ownSecond} from './developmentTestSupport';
import {craftWorld} from './gateDeltaTestSupport';
import {submitFormalOrder,advanceFormal} from './reducer';
import type {FormalWorld} from './model';
import {constructionPreviewContext} from '../constructionPreviewContext';
import {calculateConstructionPreview} from '../constructionPreviewCompute';
import {previewPayload,type PreviewTarget} from '../constructionPreviewProtocol';
import {canonicalJSON} from './canonical';
import {validateFormalWorld} from './schema';
import {citySnapshot,HOUR} from './economy';
import {encodeSave,decodeSave} from './saveCodec';
function compare(w:FormalWorld,t:PreviewTarget,city=w.cities[0]){
 const before=canonicalJSON(w),p='craftsmanId' in t?{type:'craftsman.castle' as const,cityId:city.id,craftsmanId:t.craftsmanId}:previewPayload(city.id,t);
 const preview=calculateConstructionPreview(constructionPreviewContext(w,city.id),t),o=order(w,p),actual=submitFormalOrder(w,o);
 expect(canonicalJSON(w)).toBe(before);
 expect(preview.status).toBe(actual.ack?.status==='committed'?'ready':'invalid');
 if(preview.status==='ready'){
  const j=actual.world.cities.find(c=>c.id===city.id)!.economy!.construction.find(j=>j.commandId===o.commandId)!;
  const {allocatedSlot,...quote}=preview.quote;expect(j).toMatchObject(quote);
  if(allocatedSlot!==undefined&&p.type==='building.upgrade')expect(actual.world.cities.find(c=>c.id===city.id)!.economy!.slots[p.key]).toBe(allocatedSlot);
 }else if(preview.status==='invalid')expect(preview.reason).toBe(actual.ack?.reason);
 return actual;
}
it('Lv1 candidates, all building kinds and explicit occupied/free slots match full Formal admission',()=>{
 const w=make(),c=rich(w);build(c,'center',15);build(c,'townhall',15);build(c,'barracks',15);w.factions[0].age=3;c.fields!.forEach(f=>f.level=15);
 for(const key of ['residence','warehouse.1','bunker.0','market','embassy','monastery','mill','lumbermill','masonry','mint','archery','stable','workshop','castle','academy','blacksmith','wall'])compare(w,{key});
 compare(w,{key:'bunker.0',slot:14});compare(w,{key:'bunker.0',slot:0});compare(w,{key:'wall',slot:1});
});
it('consecutive levels, same-city distinct targets, five-job capacity, second lane and cancellation',()=>{
 let w=make();rich(w);w=compare(w,{field:0}).world;w=compare(w,{field:0}).world;w=compare(w,{field:1}).world;
 w.cities[0].economy!.milestones.push(15000);w=compare(w,{field:2}).world;w=compare(w,{key:'wall'}).world;
 expect(w.cities[0].economy!.construction).toHaveLength(5);compare(w,{field:3});
 const id=w.cities[0].economy!.construction[0].commandId;w=commit(w,{type:'construction.cancel',cityId:w.cities[0].id,constructionCommandId:id});compare(w,{field:0});compare(w,{field:3,lane:1});
});
it.each(Array.from({length:15},(_,i)=>i+1))('resource field to Lv%i matches exact cost/duration and permanent qualifications',level=>{
 const w=make(),c=rich(w);c.cityPromotionCompleted=true;c.economy!.milestones=[10000,15000];c.fields![0].level=level-1;compare(w,{field:0});
});
it.each(['stock','age','field','highField','lane','max','demolish','owner'] as const)('invalid %s matches the authoritative reason',kind=>{
 let w=make();const c=rich(w);let target:PreviewTarget={key:'castle'};
 if(kind==='stock'){c.stock={food:0,wood:0,stone:0,gold:0};target={field:0};}
 if(kind==='age')w.factions[0].age=0;
 if(kind==='field'){c.fields=c.fields!.filter(f=>f.slot!==0);target={field:0};}
 if(kind==='highField'){c.fields![0].level=10;target={field:0};}
 if(kind==='lane')target={field:0,lane:1};
 if(kind==='max'){c.wallLevel=15;target={key:'wall'};}
 if(kind==='demolish'){build(c,'barracks',1);w=commit(w,{type:'building.demolish',cityId:c.id,key:'barracks'});target={key:'barracks'};}
 if(kind==='owner')c.ownerFactionId=w.factions[1].id;
 compare(w,target);
});
it('cross-city administration, economy technology, upkeep and population settlement are exact',()=>{
 let w=make();const c=rich(w),other=ownSecond(w);build(other,'townhall',1);build(c,'monastery',3);c.population=14999;c.integrationWorkHours=12;
 w.factions[0].techIds.push('economy.food.1','economy.food.2','logistics.rations');c.military!.units={militia:10};
 // Use a real catalogue unit for cross-city upkeep.
 c.military!.units={militia:10};w=advanceFormal(w,HOUR/2).world;validateFormalWorld(w);compare(w,{field:0});
 expect(citySnapshot(w,c.id)!.economy!.lastSettledAt).toBe(w.time);
});
it('craftsman free payment, foreign civilization, capacity and eligibility match Formal',()=>{
 let w=craftWorld(false);const t={craftsmanId:w.extinction!.craftsmen[0].id};w.cities[0].stock={food:0,wood:0,stone:0,gold:0};compare(w,t);
 w.factions[0].age=0;compare(w,t);w=craftWorld(false);build(w.cities[0],'castle',1);compare(w,{craftsmanId:w.extinction!.craftsmen[0].id});compare(w,{craftsmanId:'missing'});
});
it('save/recovery snapshot and frozen/ended campaign never invent build success',async()=>{
 let w=make();rich(w);w=compare(w,{field:0}).world;w=(await decodeSave(await encodeSave(w))).world;compare(w,{key:'wall'});
 w.extinction={sites:[],craftsmen:[],extinct:[w.playerFactionId],rebirths:0,cancelledResearch:[],defeat:{at:w.time,ended:false}};compare(w,{field:1});w.extinction.defeat!.ended=true;compare(w,{field:1});
});
it('history size cannot enter the context; batched targets are independent',()=>{
 const w=make();rich(w);const before=constructionPreviewContext(w,w.cities[0].id);
 for(let i=0;i<60000;i++)w.commandReceipts.push({commandId:order(w,{type:'field.upgrade',cityId:w.cities[0].id,slot:0}).commandId,issuerId:w.playerFactionId,fingerprint:'synthetic',committedRevision:0,disposition:'applied'});
 expect(constructionPreviewContext(w,w.cities[0].id)).toEqual(before);expect(JSON.stringify(before)).not.toContain('commandReceipts');
});
