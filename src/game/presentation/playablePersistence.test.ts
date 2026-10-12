import 'fake-indexeddb/auto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {afterEach,expect,it} from 'vitest';
import {FormalPersistence} from '../persistence';
import {createFormalWorld} from '../formal/generator';
import {commandId} from '../formal/ids';
import {submitFormalOrder,advanceFormal} from '../formal/reducer';
import {changeCityOwner} from '../formal/economy';
import {validateFormalWorld} from '../formal/schema';
import {encodeSave,decodeSave} from '../formal/saveCodec';
import {build} from '../formal/developmentTestSupport';
import type {FormalCommand,FormalWorld} from '../formal/model';
const stores:FormalPersistence[]=[];
const storage=()=>{const s=new FormalPersistence({suffix:'art-playable-'+crypto.randomUUID()});stores.push(s);return s;};
afterEach(async()=>{for(const s of stores.splice(0))await s.db.delete();});
const order=(w:FormalWorld,payload:FormalCommand)=>({commandId:commandId(crypto.randomUUID()),campaignId:w.campaignId,issuerId:w.playerFactionId,issuedWorldTime:w.time,expectedRevision:w.revision,payload});
it('Playable native new game: durable field/building commands, export, reload and Recovery',async()=>{
 const s=storage();let w=await s.start(createFormalWorld({campaign:'playable-native-'+crypto.randomUUID(),seed:90217,civilizationId:'civ_byzantium',speed:50}));
 for(const payload of [{type:'field.upgrade',cityId:w.cities[0].id,slot:0},{type:'building.upgrade',cityId:w.cities[0].id,key:'center'}] satisfies FormalCommand[]){const t=submitFormalOrder(w,order(w,payload));expect(t.ack?.status).toBe('committed');w=await s.save(t.world,t.reports,w.revision);}
 const t=advanceFormal(w,40*60000);w=await s.save(t.world,t.reports,w.revision);expect(w.cities[0].buildings.center).toBe(2);expect(w.cities[0].fields![0].level).toBe(1);
 const exported=await s.exportStoredSave('full');expect((await decodeSave(JSON.parse(exported))).world).toEqual(w);expect((await s.loadSave()).game).toEqual(w);
 const current=await s.db.saves.get('current');if(current?.kind!=='world')throw new Error('missing save');current.data.checksum='0'.repeat(64);await s.db.saves.put(current);const recovered=await s.loadSave();expect(recovered.recovered).toBe(true);expect(recovered.game?.dimensions).toEqual({width:384,height:384});expect(recovered.game!.cities[0].ownerFactionId).toBe(w.playerFactionId);
});
it('Advanced inspection save validates and B4 commands persist through native storage',async()=>{
 const w=createFormalWorld({campaign:'playable-b4-inspection',seed:90217,speed:50,name:'B4 檢查用世界'}),c=w.cities[0];
 const keys=['residence','warehouse.0','barracks','archery','stable','blacksmith','academy','workshop','castle','townhall','market','embassy','mill','lumbermill','mint'];
 for(const k of keys)build(c,k,['mill','lumbermill','mint'].includes(k)?8:15);build(c,'center',10);c.population=15000;c.stock={food:100000,wood:100000,stone:100000,gold:100000};c.economy!.milestones=[10000,15000];c.military!.units={spearman:25};w.factions[0].age=2;
 const second=w.cities[1];changeCityOwner(w,second,w.playerFactionId,'receive');build(second,'warehouse.0',15);build(second,'residence',15);second.stock={food:50000,wood:50000,stone:50000,gold:50000};second.population=12000;second.integrationWorkHours=12;
 validateFormalWorld(w);mkdirSync('docs/playable',{recursive:true});writeFileSync('docs/playable/B4_manual_inspection.realm-save',JSON.stringify(await encodeSave(w)));
 const s=storage();let g=await s.importSave(JSON.stringify(await encodeSave(w)));
 for(const payload of [{type:'research.start',cityId:c.id,techId:'blacksmith.melee.1'},{type:'military.recruit',cityId:c.id,unitId:'militia',count:3},{type:'settlement.prepare',cityId:c.id},{type:'logistics.dispatch',cityId:c.id,destinationCityId:second.id,resources:{food:100,wood:100,stone:100,gold:100}},{type:'age.start',cityId:c.id}] satisfies FormalCommand[]){const t=submitFormalOrder(g,order(g,payload));expect(t.ack?.status,t.ack?.reason).toBe('committed');g=await s.save(t.world,t.reports,g.revision);}
 expect(g.researchProjects[0].phase).toBe('researching');expect(g.cities[0].military!.queue).toHaveLength(1);expect(g.settlements![0].phase).toBe('preparing');expect(g.logistics).toHaveLength(1);expect(g.factions[0].ageQueue).toBeTruthy();expect((await s.loadSave()).game).toEqual(g);
 const t=advanceFormal(g,17*3600000);g=await s.save(t.world,t.reports,g.revision);expect(g.factions[0].age).toBe(3);expect(g.factions[0].techIds).toContain('blacksmith.melee.1');expect(g.settlements![0].phase).toBe('ready');expect(g.cities[0].military!.units.militia).toBe(3);expect(g.logistics).toEqual([]);
});
