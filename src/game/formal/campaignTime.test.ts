import 'fake-indexeddb/auto';
import {afterEach,expect,it} from 'vitest';
import {createFormalWorld} from './generator';
import {createFormalFixture} from './fixture';
import {validateFormalWorld} from './schema';
import {commandId} from './ids';
import {submitFormalOrder,advanceFormal,advanceFormalCooperative} from './reducer';
import {advanceOffline} from './offline';
import {effectiveSpeed} from './playtest';
import {enableAutonomy} from './autonomy';
import {CAMPAIGN_SPEEDS,OFFLINE_HOURS} from './campaignTime';
import {encodeSave,decodeSave,OLD_CAMPAIGN_MESSAGE} from './saveCodec';
import {FormalDatabase,FormalPersistence,exportLegacyCampaign} from '../persistence';
import {LEGACY_FORMAL_DB_NAME} from './versions';
import type {FormalCommand,FormalWorld} from './model';
const stores:FormalPersistence[]=[];let serial=0;
const make=()=>createFormalWorld({campaign:'time2-'+(++serial),seed:90217});
const command=(w:FormalWorld,payload:FormalCommand,id='time-'+(++serial))=>({commandId:commandId(id),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload});
const configure=(w:FormalWorld,speed:typeof CAMPAIGN_SPEEDS[number],offlineHours:typeof OFFLINE_HOURS[number])=>submitFormalOrder(w,command(w,{type:'campaign.configure',cityId:w.cities[0].id,speed,offlineHours}));
afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();});
it('new campaign defaults and all 25 legal normal speed/offline combinations validate, roundtrip and dedupe',async()=>{
 const native=make();expect(native.speed).toBe(1);expect(native.offlineHours).toBe(12);let w=createFormalFixture({campaign:'time-combinations'});
 for(const speed of CAMPAIGN_SPEEDS)for(const offlineHours of OFFLINE_HOURS){const before=structuredClone(w),o=command(w,{type:'campaign.configure',cityId:w.cities[0].id,speed,offlineHours}),r=submitFormalOrder(w,o);expect(r.ack?.status).toBe('committed');expect(w).toEqual(before);expect(r.world).toMatchObject({speed,offlineHours});expect(r.world.cities).toEqual(w.cities);expect(submitFormalOrder(r.world,o).ack?.status).toBe('duplicate');w=r.world;}
 expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
});
it('legacy and intermediate values are rejected in generator, schema and command, with no mutation',()=>{
 const w=make(),before=JSON.stringify(w);for(const speed of [0,2,50,100,200]){expect(()=>createFormalWorld({campaign:'bad',seed:1,speed})).toThrow();expect(()=>validateFormalWorld({...w,speed})).toThrow();expect(()=>submitFormalOrder(w,command(w,{type:'campaign.configure',cityId:w.cities[0].id,speed,offlineHours:12} as FormalCommand))).toThrow();}
 for(const offlineHours of [2,6,24])expect(()=>validateFormalWorld({...w,offlineHours})).toThrow();expect(JSON.stringify(w)).toBe(before);
});
it('normal settings never grant dev stock/shield; dev50 and100 override but preserve normal setting and restore it',()=>{
 for(const speed of [50,100] as const){let w=configure(make(),25,4).world;const stock=structuredClone(w.cities),protection=w.factions[0].protectionUntil;expect(w.cities).toEqual(stock);expect(w.factions[0].protectionUntil).toBe(protection);w=submitFormalOrder(w,command(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed,shield:true})).world;w=configure(w,3,8).world;expect(effectiveSpeed(w)).toBe(speed);expect(w.cities[0].developerResources).toBe(true);expect(w.factions[0].protectionUntil).toBeGreaterThan(w.time);w=submitFormalOrder(w,command(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:false,speed})).world;expect(effectiveSpeed(w)).toBe(3);}
});
it('offline always uses normal speed, caps real time, retains developer stock/shield and restores foreground mode',()=>{
 for(const cap of OFFLINE_HOURS){let w=configure(make(),3,cap).world;w=submitFormalOrder(w,command(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed:100,shield:true})).world;const before=structuredClone(w),r=advanceOffline(w,0,13*3600000);expect(r.summary.advancedWorldMs).toBe(cap*3*3600000);expect(r.world.developer).toEqual(w.developer);expect(effectiveSpeed(r.world)).toBe(100);expect(r.world.clockMode).toBe('foreground');expect(w).toEqual(before);}
});
for(const point of ['backup-write','world-write','authority-write'] as const)it(`setting ${point} fault rolls back all stores and retry applies exactly once`,async()=>{
 let armed=false;const p=new FormalPersistence({suffix:'time2-'+crypto.randomUUID(),fault:x=>{if(armed&&x===point)throw Error('injected');}});stores.push(p);let w=await p.start(make());const initial=await p.db.transaction('r',p.db.saves,p.db.backups,p.db.BattleReports,async()=>[await p.db.saves.toArray(),await p.db.backups.toArray(),await p.db.BattleReports.toArray()]);const o=command(w,{type:'campaign.configure',cityId:w.cities[0].id,speed:25,offlineHours:0}),r=submitFormalOrder(w,o);armed=true;await expect(p.save(r.world,[],w.revision)).rejects.toThrow('injected');expect(await p.db.saves.toArray()).toEqual(initial[0]);expect(await p.db.backups.toArray()).toEqual(initial[1]);armed=false;w=await p.save(r.world,[],w.revision);expect(submitFormalOrder(w,o).ack?.status).toBe('duplicate');expect((await p.loadSave()).game!.speed).toBe(25);await expect(p.save(r.world,[],w.revision-1)).rejects.toThrow('衝突');const id=(await p.backupList())[0].id;expect((await p.restore(id)).speed).toBe(25);
});
it('old envelopes are blocked before migration and old database rows/backups/reports stay byte-identical through export and new start',async()=>{
 const legacy=new FormalDatabase('',LEGACY_FORMAL_DB_NAME);try{const envelope=await encodeSave(make());envelope.metadata={...envelope.metadata,contentVersion:'lieguo-formal-b5.1'} as unknown as typeof envelope.metadata;envelope.snapshot.metadata={...envelope.metadata};await expect(decodeSave(envelope)).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);await legacy.saves.put({id:'current',kind:'world',at:123,data:envelope});await legacy.backups.add({at:123,label:'舊回復點',campaignId:envelope.snapshot.campaignId,gameTime:0,reportCursor:1,data:envelope});const before=JSON.stringify([await legacy.saves.toArray(),await legacy.backups.toArray(),await legacy.BattleReports.toArray()]);const archive=JSON.parse(await exportLegacyCampaign());expect(archive.saves[0].data).toEqual(envelope);const p=new FormalPersistence({suffix:'old-block-'+crypto.randomUUID()});stores.push(p);await expect(p.loadSave()).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);const fresh=await p.start(make());expect(fresh.campaignId).not.toBe(envelope.snapshot.campaignId);expect(fresh.commandReceipts).toHaveLength(0);expect((await p.loadSave()).game!.campaignId).toBe(fresh.campaignId);expect(JSON.stringify([await legacy.saves.toArray(),await legacy.backups.toArray(),await legacy.BattleReports.toArray()])).toBe(before);}finally{await legacy.delete();}
});
for(const speed of [1,25,100])it(`99 AI ${speed}X clock retains complete deterministic event replay`,async()=>{
 let w=make();w.speed=speed===1?1:25;if(speed===100)w=submitFormalOrder(w,command(w,{type:'developer.configure',cityId:w.cities[0].id,enabled:true,speed:100})).world;enableAutonomy(w);expect(w.autonomy!.agents).toHaveLength(99);const target=3600000;const a=advanceFormal(w,target),b=await advanceFormalCooperative(w,target);expect(a).toEqual(b);expect(b.world.commandReceipts.length).toBeGreaterThan(w.commandReceipts.length);expect(b.world.events.map(e=>e.id).length).toBe(new Set(b.world.events.map(e=>e.id)).size);validateFormalWorld(b.world);
});
it('intermediate offline drafts cannot be published as a durable save',async()=>{const w=make();w.clockMode='offline';await expect(encodeSave(w)).rejects.toThrow('草稿');});

import {battlefield,dispatch,arrive} from './combatTestSupport';
import {researchCity,build,commit} from './developmentTestSupport';
import {tacticalRoundWorldMs} from './battles';
it('switching normal speeds preserves construction/training/research/marches/AI event identities and the existing combat cadence',()=>{
 let w=battlefield();const c=researchCity(w);w.factions[0].age=2;build(c,'center',10);c.military!.units={militia:500};w.cities[1].military!.units={militia:500};
 w=dispatch(w,'conquest',{militia:500},1,0).world;w=arrive(w).world;const id=w.cities[0].id;w=commit(w,{type:'field.upgrade',cityId:id,slot:0});w=commit(w,{type:'military.recruit',cityId:id,unitId:'militia',count:10});w=commit(w,{type:'research.start',cityId:id,techId:'blacksmith.melee.1'});w=dispatch(w,'raid',{militia:10},0,2).world;enableAutonomy(w);
 for(const type of ['construction.complete','military.train','research.complete','army.arrive','ai.decide','combat.round'])expect(w.events.some(e=>e.type===type),type).toBe(true);
 const stable=w.events.filter(e=>e.type!=='combat.round'),battleId=w.combat!.battles[0].id,roundEventId=w.combat!.battles[0].roundEventId;
 for(const speed of CAMPAIGN_SPEEDS){const before=w.combat!.battles[0].nextRoundAt-w.time,old=effectiveSpeed(w);w=configure(w,speed,4).world;expect(w.events.filter(e=>e.type!=='combat.round')).toEqual(stable);expect(w.combat!.battles[0]).toMatchObject({id:battleId,roundEventId,nextRoundAt:w.time+Math.ceil(before*tacticalRoundWorldMs(speed)/tacticalRoundWorldMs(old))});}
});
it('a larger offline cap never retroactively awards previously capped absence',async()=>{
 const p=new FormalPersistence({suffix:'future-cap-'+crypto.randomUUID()});stores.push(p);let w=configure(make(),1,1).world;await p.start(w);await p.db.saves.update('current',r=>{if(r.kind==='world')r.at=1000;});const now=1000+2*3600000;w=(await p.loadWithOffline(now)).game!;expect(w.time).toBe(3600000);const change=configure(w,1,12).world;
 await p.save(change,[],w.revision);await p.db.saves.update('current',r=>{if(r.kind==='world')r.at=now;});const again=await p.loadWithOffline(now);expect(again.summary!.advancedWorldMs).toBe(0);expect(again.game!.time).toBe(3600000);
});
