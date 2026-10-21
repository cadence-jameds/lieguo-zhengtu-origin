import {FormalPersistence} from '../persistence';
import {createFormalWorld} from '../formal/generator';
import {validateFormalWorld} from '../formal/schema';
import {advanceFormal,submitFormalOrder} from '../formal/reducer';
import {commandId} from '../formal/ids';
import type {FormalWorld,FormalCity,FormalCommand} from '../formal/model';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {HOUSING} from '../formal/catalogB3';
import {B5_LAB_SUFFIX,labConfigSchema,labUnitsSchema as units,labTarget,labNextEvent,type LabConfig} from './b5LabConfig';
export * from './b5LabConfig';
const positive=(u:Record<string,number>)=>Object.fromEntries(Object.entries(u).filter(([,n])=>n>0));
function checkUnits(w:FormalWorld,c:FormalCity,u:Record<string,number>){const civ=w.factions.find(f=>f.id===c.ownerFactionId)!.civilizationId;for(const id of Object.keys(positive(u)))if(UNIT_CATALOG[id].civilizationId&&UNIT_CATALOG[id].civilizationId!==civ)throw Error('測試兵種的來源文明與城市不符。');}
function prepareCity(w:FormalWorld,c:FormalCity,u:Record<string,number>,wall:number,resources:LabConfig['enemyStock']){
 checkUnits(w,c,u);c.buildings={center:5,residence:15,barracks:5,archery:5,stable:5,workshop:5};for(let i=0;i<10;i++)c.buildings['warehouse.'+i]=15;
 c.economy!.slots=Object.fromEntries(Object.keys(c.buildings).filter(k=>k!=='center').map((key,i)=>[key,i]));c.population=15000;c.housing=400+HOUSING[15];c.wallLevel=wall;c.stock={...resources};c.fields!.forEach(f=>f.level=5);c.military!.units=positive(u);w.factions.find(f=>f.id===c.ownerFactionId)!.age=3;
}
/** Explicit test fixture creation only. Never imported by normal Formal commands. */
export function makeLabWorld(value:unknown){
 const cfg=labConfigSchema.parse(value),w=createFormalWorld({campaign:'b5lab-'+crypto.randomUUID(),seed:cfg.seed,civilizationId:cfg.civilizationId,name:'B5 測試玩家',speed:25,offlineHours:0}),target=labTarget(w,cfg.targetCityId);
 if(!target||target.ownerFactionId===w.playerFactionId)throw Error('請指定一座 AI 城市。');
 w.campaignId=('campaign:b5lab-'+target.id.slice(5)+'-'+crypto.randomUUID()) as FormalWorld['campaignId'];
 prepareCity(w,w.cities[0],cfg.playerUnits,cfg.playerWallLevel,{food:1000000,wood:1000000,stone:1000000,gold:1000000});prepareCity(w,target,cfg.enemyUnits,cfg.wallLevel,cfg.enemyStock);
 // Test resources remain finite, so raid/cargo can be observed without refilling.
 w.developer={enabled:true,speed:cfg.speed};return validateFormalWorld(w);
}
export function assertLab(w:FormalWorld){if(!w.campaignId.startsWith('campaign:b5lab-')||!w.developer?.enabled||w.fixture)throw Error('只允許獨立 B5 測試戰役。');}
/** An isolated persistence owner. Formal resolver/scheduler/report transaction unchanged. */
export class B5LabSession {
 readonly store:FormalPersistence;
 world:FormalWorld|null=null;
 constructor(suffix=B5_LAB_SUFFIX,fault?:NonNullable<ConstructorParameters<typeof FormalPersistence>[0]>['fault']){if(!suffix.startsWith(B5_LAB_SUFFIX))throw Error('測試存檔必須隔離。');this.store=new FormalPersistence({suffix,fault});}
 async open(cfg:LabConfig){const saved=await this.store.loadSave();if(saved.game){assertLab(saved.game);this.world=saved.game;}else await this.reset(cfg);return this.world!;}
 async reset(cfg:LabConfig){const draft=makeLabWorld(cfg),saved=await this.store.start(draft);this.world=saved;return saved;}
 private current(){if(!this.world)throw Error('尚未建立測試情境。');assertLab(this.world);return this.world;}
 async order(payload:FormalCommand,issuer=this.current().playerFactionId){const w=this.current();if(!['army.dispatch','army.recall'].includes(payload.type)||issuer!==w.playerFactionId)throw Error('測試操作僅接受玩家正式軍令。');if(payload.type==='army.dispatch')units.parse(payload.units);return this.submit(w,payload,issuer,w.revision);}
 private async submit(draft:FormalWorld,payload:FormalCommand,issuer:FormalWorld['playerFactionId'],expectedRevision:number,id:string=crypto.randomUUID()){
  const t=submitFormalOrder(draft,{campaignId:draft.campaignId,commandId:commandId(id),issuerId:issuer,issuedWorldTime:draft.time,expectedRevision:draft.revision,payload});
  if(t.ack?.status!=='committed')throw Error(t.ack?.reason??'正式軍令拒絕');const saved=await this.store.save(t.world,t.reports,expectedRevision);this.world=saved;return{world:saved,ack:t.ack};
 }
 async incoming(targetId:string,mission:'raid'|'conquest',value:Record<string,number>){
  if(mission!=='raid'&&mission!=='conquest')throw Error('來襲任務只接受掠奪或征服。');const w=this.current();if(w.commandReceipts.some(r=>r.commandId.startsWith('command:b5lab-incoming-')))throw Error('此情境已模擬一次來襲；請重置後再測。');
  if(w.armies.length||w.combat?.battles.length)throw Error('請先完成在途任務或重置情境。');
  const draft=structuredClone(w),enemy=labTarget(draft,targetId),home=draft.cities[0];if(!enemy||enemy.ownerFactionId===draft.playerFactionId||home.ownerFactionId!==draft.playerFactionId)throw Error('請選擇仍由敵方控制的測試城市。');
  const selected=positive(units.parse(value));checkUnits(draft,enemy,selected);enemy.military!.units=selected;
  return this.submit(draft,{type:'army.dispatch',cityId:enemy.id,mission,target:{kind:'city',cityId:home.id},units:selected},enemy.ownerFactionId,w.revision,'b5lab-incoming-'+crypto.randomUUID());
 }
 async advance(worldMs?:number){const w=this.current(),at=worldMs===undefined?labNextEvent(w)?.at:w.time+worldMs;if(at===undefined)throw Error('目前沒有行軍或戰鬥事件。');if(!Number.isSafeInteger(at)||at<w.time||at-w.time>86400000)throw Error('每次最多推進 24 世界小時。');const t=advanceFormal(w,at),saved=await this.store.save(t.world,t.reports,w.revision);this.world=saved;return saved;}
 async reload(){const loaded=await this.store.loadSave();if(!loaded.game)throw Error('測試存檔不存在。');assertLab(loaded.game);this.world=loaded.game;return loaded.game;}
 async export(){this.current();return JSON.stringify({kind:'b5-combat-lab',version:1,envelope:JSON.parse(await this.store.exportStoredSave('full'))});}
 async import(text:string){const file=JSON.parse(text);if(file.kind!=='b5-combat-lab'||file.version!==1)throw Error('只接受 B5 測試台完整備份。');const {decodeSave}=await import('../formal/saveCodec');const encoded=JSON.stringify(file.envelope),decoded=await decodeSave(file.envelope);assertLab(decoded.world);const saved=await this.store.importSave(encoded);this.world=saved;return saved;}
 close(){this.store.db.close();}
}
