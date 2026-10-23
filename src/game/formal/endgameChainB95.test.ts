import {advanceOfflineCooperative} from './offline';
import {expect,it} from 'vitest';
import {endgameWorld,nativeEndgameWorld,act} from './endgameTestSupport';
import {cityId} from './ids';
import {enqueue} from './economy';
import {EventScheduler} from './scheduler';
import {spatial,invalidateSpatial} from './spatial';
import {advanceFormal,advanceFormalCooperative,submitFormalOrder} from './reducer';
import {order} from './developmentTestSupport';
import {isMissionArmy} from './combatModel';
import {encodeSave,decodeSave} from './saveCodec';
import {validateFormalWorld} from './schema';
import {enableAutonomy} from './autonomy';
import {addIntel} from './aiKnowledge';
import {buildable,terrainAt} from './terrain';
import {HOUR} from './time';
function world(){let w=endgameWorld(true);const s=new EventScheduler(w.events),host=w.cities[2];for(let i=1;i<=3;i++){const c=structuredClone(host);c.id=cityId('chain-'+i);c.x=host.x+i;c.military!.units={militia:1};c.economy!.settlementEventId=enqueue(w,s,{type:'economy.settle',cityId:c.id,at:w.time+HOUR});w.cities.push(c);}w.events=s.snapshot();invalidateSpatial(w);w.factions[0].modernQualification='full';w.cities[0].military!.units={'modern.knight':100,'modern.baggage':10};w=act(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'conquest',target:{kind:'city',cityId:host.id},units:{'modern.knight':100,'modern.baggage':10}});return advanceFormal(w,w.armies.filter(isMissionArmy)[0].arrivalAt).world;}
it('B9-5 formal continuous conquest preserves the army, original dispatch snapshot and three-city limit across Save/Load',async()=>{
 let w=world(),army=w.armies.filter(isMissionArmy)[0],id=army.id,initial=structuredClone(army.initialUnits),origin=army.originCityId;expect(army.chain!.conquests).toBe(1);
 for(let i=1;i<=2;i++){const current=army.target.kind==='city'?army.target.cityId:null;if(!current)throw Error('City target missing');const command=order(w,{type:'army.advance',cityId:current,armyId:id,targetCityId:cityId('chain-'+i)},'chain-command-'+i),t=submitFormalOrder(w,command);expect(t.ack?.status,t.ack?.reason).toBe('committed');w=t.world;const before=structuredClone(w);expect(submitFormalOrder(w,command).ack?.status).toBe('duplicate');expect(w).toEqual(before);army=w.armies.filter(isMissionArmy).find(a=>a.id===id)!;
  const loaded=(await decodeSave(await encodeSave(w))).world,result=advanceFormal(w,army.arrivalAt);expect(advanceFormal(loaded,army.arrivalAt)).toEqual(result);w=result.world;army=w.armies.filter(isMissionArmy).find(a=>a.id===id)!;expect(army.id).toBe(id);expect(army.originCityId).toBe(origin);expect(army.initialUnits).toEqual(initial);expect(army.chain!.conquests).toBe(i+1);
 }
 const p={type:'army.advance' as const,cityId:army.target.kind==='city'?army.target.cityId:w.cities[0].id,armyId:id,targetCityId:cityId('chain-3')};expect(submitFormalOrder(w,order(w,p)).ack?.status).toBe('rejected');expect(army.chain!.battles).toHaveLength(3);expect(w.combat!.receipts.filter(r=>r.kind==='final'&&r.outcome==='conquered')).toHaveLength(3);validateFormalWorld(w);
});
it.each(['force','food','late','distance','qualification'] as const)('B9-5 formal advance rejects insufficient or illegal %s',kind=>{
 let w=world(),a=w.armies.filter(isMissionArmy)[0];if(kind==='qualification')w.factions[0].modernQualification='none';if(kind==='force')a.units['modern.knight']=1;if(kind==='food'){w.cities[0].stock.food=0;w.cities[0].economy!.lastSettledAt=w.time;}if(kind==='late'){w=advanceFormal(w,w.time+1).world;a=w.armies.filter(isMissionArmy)[0];}if(kind==='distance'){w.dimensions={width:384,height:384};w.cities[3].x=383;w.cities[3].y=383;invalidateSpatial(w);}
 const p={type:'army.advance' as const,cityId:a.target.kind==='city'?a.target.cityId:w.cities[0].id,armyId:a.id,targetCityId:cityId('chain-1')};
 const t=submitFormalOrder(w,order(w,p));expect(t.ack?.status,t.ack?.reason).toBe('rejected');
});
it('B9-5 native AI actually submits bounded follow-up military orders, with Save/Load/offline-equivalent continuation',async()=>{
 let w=nativeEndgameWorld();enableAutonomy(w);for(const a of w.autonomy!.agents){a.nextAt=w.time+100*HOUR;w.events.find(e=>e.id===a.eventId)!.at=a.nextAt;}
 const issuer=w.factions[1].id,origin=w.cities[1],agent=w.autonomy!.agents.find(a=>a.factionId===issuer)!;agent.active=true;w.factions[1].modernQualification='full';origin.military!.units={'modern.knight':100};const used=spatial(w);let moved=0;
 for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){if(moved===4)break;const x=origin.x+dx,y=origin.y+dy;if(buildable(terrainAt(w,x,y))&&!used.at(x,y).city&&!used.at(x,y).site){const c=w.cities[30+moved++];c.x=x;c.y=y;c.military!.units={militia:1};addIntel(w,agent,{cityId:c.id,ownerFactionId:c.ownerFactionId,at:w.time,source:'scout',units:{militia:1},coarse:'personnel'});}}
 expect(moved).toBe(4);invalidateSpatial(w);w=act(w,{type:'army.dispatch',cityId:origin.id,mission:'conquest',target:{kind:'city',cityId:w.cities[30].id},units:{'modern.knight':100}},issuer);const original=w.armies.filter(isMissionArmy)[0],id=original.id;w=advanceFormal(w,original.arrivalAt).world;let a=w.armies.filter(isMissionArmy).find(a=>a.id===id)!;expect(a.status).toBe('outbound');expect(a.chain!.conquests).toBe(1);const restored=(await decodeSave(await encodeSave(w))).world,until=w.time+3*HOUR,result=advanceFormal(w,until);expect(await advanceFormalCooperative(restored,until)).toEqual(result);const offline=await advanceOfflineCooperative(restored,0,3*HOUR);expect(offline.world.armies).toEqual(result.world.armies);expect(offline.world.commandReceipts).toEqual(result.world.commandReceipts);expect(offline.world.largeProjects).toEqual(result.world.largeProjects);w=result.world;
 const receipts=w.commandReceipts.filter(r=>JSON.parse(r.fingerprint).payload.type==='army.advance');expect(receipts).toHaveLength(2);expect(w.combat!.receipts.filter(r=>r.kind==='final'&&r.outcome==='conquered')).toHaveLength(3);expect(w.cities.filter(c=>c.ownerFactionId===issuer)).toHaveLength(4);expect(w.cities.slice(30,34).filter(c=>c.ownerFactionId!==issuer)).toHaveLength(1);validateFormalWorld(w);
},30000);
it('B9-5 legal empire joints share physical catapult capability but cannot create a free cross-empire coalition',()=>{
 let w=nativeEndgameWorld();w.cities[1].military!.units={militia:100,catapult:10};w.cities[2].military!.units={militia:100};w.cities[40].military!.units={militia:100};w=act(w,{type:'joint.create',cityId:w.cities[1].id,mission:'wonder-destruction',targetCityId:w.cities[30].id,units:{militia:30,catapult:10},arrivalAt:w.time+2*HOUR},w.factions[1].id);const joint=w.politics!.joints[0];
 w=act(w,{type:'joint.join',cityId:w.cities[2].id,jointId:joint.id,units:{militia:30}},w.factions[2].id);expect(w.armies.filter(isMissionArmy).every(a=>a.mission==='wonder-destruction')).toBe(true);expect(w.cities[2].military!.units.militia).toBe(70);const before=structuredClone(w),t=submitFormalOrder(w,order(w,{type:'joint.join',cityId:w.cities[40].id,jointId:joint.id,units:{militia:30}},undefined,w.factions[40].id));expect(t.ack?.status).toBe('rejected');expect(w).toEqual(before);validateFormalWorld(w);
});
