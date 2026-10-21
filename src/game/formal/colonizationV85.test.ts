import {digest} from './canonical';
import {FORMAL_SAVE_FORMAT} from './versions';
import {route} from './routing';
import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {make,rich,build,commit,order} from './developmentTestSupport';
import {advanceFormal,submitFormalOrder} from './reducer';
import {colonizationUnits,readyColonizationUnit} from './settlement';
import {buildable,terrainAt} from './terrain';
import {spatial} from './spatial';
import {armyUpkeep} from './military';
import {OLD_CAMPAIGN_MESSAGE,encodeSave,decodeSave} from './saveCodec';
import {validateFormalWorld} from './schema';
import {FormalPersistence} from '../persistence';
const setup=()=>{const w=make(),c=rich(w);w.factions[0].age=2;build(c,'castle',1);c.population=2000;c.military!.units={spearman:40};return w;};
const target=(w:ReturnType<typeof make>)=>{const c=w.cities[0];for(let d=1;d<30;d++)for(let dy=-d;dy<=d;dy++)for(let dx=-d;dx<=d;dx++){const x=c.x+dx,y=c.y+dy;if(x<0||y<0||x>=384||y>=384)continue;if(buildable(terrainAt(w,x,y))&&!spatial(w).at(x,y).city&&!spatial(w).at(x,y).site){try{route(w,c,{x,y});return {x,y};}catch{}}}throw Error('No target');};
it('castle produces one separate civilian unit; launch consumes availability; founding consumes entity and transfers guards',async()=>{
 let w=setup();const id=w.cities[0].id,upkeep=armyUpkeep(w,w.cities[0]);
 const noUnit=order(w,{type:'settlement.dispatch',cityId:id,...target(w),name:'新城',escort:{spearman:20}});expect(submitFormalOrder(w,noUnit).ack?.status).toBe('rejected');
 w=commit(w,{type:'settlement.prepare',cityId:id});expect(w.cities[0].population).toBe(1600);expect(colonizationUnits(w,id)).toHaveLength(0);expect(w.cities[0].military!.queue).toHaveLength(0);expect(w.cities[0].economy!.construction).toHaveLength(0);
 const project=w.settlements![0];w=advanceFormal(w,project.startedAt+project.prepDurationMs).world;expect(readyColonizationUnit(w,id)).toMatchObject({quantity:1,kind:'colonization',population:400});expect(armyUpkeep(w,w.cities[0])).toBe(upkeep);
 w=(await decodeSave(await encodeSave(w))).world;const cmd=order(w,{type:'settlement.dispatch',cityId:id,...target(w),name:'新城',escort:{spearman:20}});w=submitFormalOrder(w,cmd).world;expect(readyColonizationUnit(w,id)).toBeUndefined();expect(colonizationUnits(w,id)[0].phase).toBe('travelling');expect(submitFormalOrder(w,cmd).ack?.status).toBe('duplicate');
 w=(await decodeSave(await encodeSave(w))).world;w=advanceFormal(w,w.settlements![0].arrivalAt!).world;expect(colonizationUnits(w,id)).toHaveLength(0);expect(w.cities[100].population).toBe(400);expect(w.cities[100].military!.units).toEqual({spearman:20});expect(w.cities[0].military!.units).toEqual({spearman:20});expect((await decodeSave(await encodeSave(w))).world).toEqual(w);
});
it('cancel before completion refunds all 400 people and 80 percent resources, with no unit',()=>{let w=setup();const id=w.cities[0].id;w=commit(w,{type:'settlement.prepare',cityId:id});w=commit(w,{type:'settlement.cancel',cityId:id});expect(w.cities[0].population).toBe(2000);expect(w.cities[0].stock).toEqual({food:98800,wood:98400,stone:97600,gold:99200});expect(w.colonizationUnits).toEqual([]);});
it('ready flag without entity and duplicate/mismatched entity are rejected by strict v85 contract',()=>{let w=setup();w=commit(w,{type:'settlement.prepare',cityId:w.cities[0].id});w=advanceFormal(w,14400000).world;const absent=structuredClone(w);absent.colonizationUnits=[];expect(()=>validateFormalWorld(absent)).toThrow();w.colonizationUnits!.push({...w.colonizationUnits![0]});expect(()=>validateFormalWorld(w)).toThrow();});
it('checksummed old ready unit is blocked without changing population, guards or Recovery',async()=>{
 let w=setup();w=commit(w,{type:'settlement.prepare',cityId:w.cities[0].id});w=advanceFormal(w,14400000).world;
 w.metadata={...w.metadata,schemaVersion:2,terrainVersion:2,contentVersion:'lieguo-formal-b4.1',rulesetVersion:'v84-b4.1'} as typeof w.metadata;delete w.combat;for(const site of w.worldLayer!.wildSites){for(const key of ['phase','defenders','initialDefenders','loot','style','budget','respawnAt','respawnEventId'] as const)delete site[key];}delete w.colonizationUnits;
 const before=structuredClone(w),envelope={format:FORMAL_SAVE_FORMAT,metadata:w.metadata,checksum:await digest(w),snapshot:structuredClone(w)};
 await expect(encodeSave(w)).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);await expect(decodeSave(envelope)).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);
 const p=new FormalPersistence({suffix:'v85-'+crypto.randomUUID()});try{await expect(p.importSave(JSON.stringify(envelope))).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);expect(await p.db.saves.count()).toBe(0);expect(await p.db.backups.count()).toBe(0);expect(w).toEqual(before);}finally{await p.db.delete();}
});

it('old preparing and travelling saves are rejected without touching population, escort or reservations',async()=>{
 for(const phase of ['preparing','travelling'] as const){
  let w=setup();w=commit(w,{type:'settlement.prepare',cityId:w.cities[0].id});
  if(phase==='travelling'){w=advanceFormal(w,14400000).world;w=commit(w,{type:'settlement.dispatch',cityId:w.cities[0].id,...target(w),name:'遷移城',escort:{spearman:20}});}
  const population=w.cities[0].population,guards={...w.cities[0].military!.units},project=structuredClone(w.settlements![0]);
  w.metadata={...w.metadata,schemaVersion:2,terrainVersion:2,contentVersion:'lieguo-formal-b4.1',rulesetVersion:'v84-b4.1'} as typeof w.metadata;delete w.combat;for(const site of w.worldLayer!.wildSites){for(const key of ['phase','defenders','initialDefenders','loot','style','budget','respawnAt','respawnEventId'] as const)delete site[key];}delete w.colonizationUnits;
  const before=structuredClone(w),envelope={format:FORMAL_SAVE_FORMAT,metadata:w.metadata,checksum:await digest(w),snapshot:structuredClone(w)};
  await expect(decodeSave(envelope)).rejects.toThrow(OLD_CAMPAIGN_MESSAGE);expect(w).toEqual(before);expect(w.cities[0].population).toBe(population);expect(w.cities[0].military!.units).toEqual(guards);expect(w.settlements![0]).toEqual(project);
 }
});
it('cancellation never discards migrants when housing is insufficient; ready production cannot be refunded or duplicated',()=>{
 let w=setup();w=commit(w,{type:'settlement.prepare',cityId:w.cities[0].id});w.cities[0].housing=1700;const rejected=submitFormalOrder(w,order(w,{type:'settlement.cancel',cityId:w.cities[0].id}));expect(rejected.ack?.status).toBe('rejected');expect(rejected.ack?.reason).toContain('400名移民');expect(w.cities[0].population).toBe(1600);w.cities[0].housing=2000;w=commit(w,{type:'settlement.cancel',cityId:w.cities[0].id});expect(w.cities[0].population).toBe(2000);
 w=setup();w=commit(w,{type:'settlement.prepare',cityId:w.cities[0].id});w=advanceFormal(w,14400000).world;
 for(const type of ['settlement.prepare','settlement.cancel'] as const)expect(submitFormalOrder(w,order(w,{type,cityId:w.cities[0].id})).ack?.status).toBe('rejected');
 expect(colonizationUnits(w,w.cities[0].id)).toHaveLength(1);
});
