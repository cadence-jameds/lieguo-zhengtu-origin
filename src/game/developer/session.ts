import {FormalPersistence} from '../persistence';
import {advanceFormal,submitFormalOrder} from '../formal/reducer';
import type {FormalCommand,FormalWorld} from '../formal/model';
import {developerWorld,developerOrder,type DeveloperConfig} from './scenarios';
import {citySnapshot} from '../formal/economy';
import {createTrialWorld,type TrialRequest,type TrialInfo} from './specTrials';
export type DeveloperLog={sequence:number;action:string;at:number;revision:number;result:string;before:unknown;after:unknown;command?:FormalCommand};
export const inspectWorld=(w:FormalWorld)=>({campaign:w.campaignId,revision:w.revision,time:w.time,speed:w.speed,ruleset:w.metadata.rulesetVersion,cities:w.cities.length,player:w.playerFactionId,playerFaction:w.factions.find(f=>f.id===w.playerFactionId),owned:w.cities.filter(c=>c.ownerFactionId===w.playerFactionId).map(c=>{const n=citySnapshot(w,c.id)!;return {id:n.id,population:n.population,housing:n.housing,stock:n.stock,buildings:n.buildings,fields:n.fields,wallLevel:n.wallLevel,cityPromotionCompleted:n.cityPromotionCompleted,milestones:n.economy?.milestones,construction:n.economy?.construction,promotion:n.economy?.promotion,military:n.military,reservedIncoming:n.economy?.reservedIncoming};}),events:w.events.filter(e=>e.type!=='economy.settle'),research:w.researchProjects,settlements:w.settlements,colonizationUnits:w.colonizationUnits,logistics:w.logistics,receipts:w.commandReceipts});
/** Uses the real persistence/reducer APIs, always a mandatory developer suffix.
 * The normal worker/store is never addressed by this session. */
export class DeveloperSession{
 readonly persistence:FormalPersistence;world:FormalWorld|null=null;config:DeveloperConfig|null=null;logs:DeveloperLog[]=[];private serial=0;
 constructor(suffix='developer-session'){if(!/^developer-[A-Za-z0-9_.-]+$/.test(suffix))throw new Error('必須使用獨立開發者存檔。');this.persistence=new FormalPersistence({suffix});}
 private record(action:string,result:string,before:unknown){const w=this.world!;this.logs.push({sequence:++this.serial,action,at:w.time,revision:w.revision,result,before,after:inspectWorld(w)});if(this.logs.length>100)this.logs.shift();}
 async start(config:DeveloperConfig){const candidate=developerWorld(config);const committed=await this.persistence.start(candidate);this.world=committed;this.config=config;this.logs=[];this.serial=0;this.record('建立 '+config.scenario+' 測試情境','已保存',null);return committed;}
 async startTrial(request:TrialRequest):Promise<TrialInfo>{const candidate=createTrialWorld(request);this.world=await this.persistence.start(candidate.world);this.config={...request.config,scenario:request.kind==='building'||request.kind==='production'?'economy':'military',civilizationId:this.world.factions[0].civilizationId};this.logs=[];this.serial=0;this.record('v85 單項試玩：'+candidate.info.name,'測試資格已保存；後續使用正式命令',request);return candidate.info;}
 async command(payload:FormalCommand){if(!this.world)throw new Error('請先建立測試戰役。');const w=this.world,before=inspectWorld(w),r=submitFormalOrder(w,developerOrder(w,payload));if(r.ack?.status==='committed')this.world=await this.persistence.save(r.world,r.reports,w.revision);this.record(payload.type,r.ack?.reason??r.ack?.status??'未執行',before);this.logs[this.logs.length-1].command=payload;return r.ack;}
 async advance(realMs:number,next=false){if(!this.world)throw new Error('請先建立測試戰役。');const w=this.world;
  if(!Number.isFinite(realMs)||realMs<0||realMs>86400000*30)throw new Error('推進時間超出測試範圍。');
  const completion=w.events.filter(e=>e.type!=='economy.settle').sort((a,b)=>a.at-b.at)[0];if(next&&!completion)throw new Error('目前沒有建設、研究、訓練、拓殖或物流完成事件。');
  const target=next?completion!.at:w.time+Math.floor(realMs*w.speed),before=inspectWorld(w),r=advanceFormal(w,target);this.world=await this.persistence.save(r.world,r.reports,w.revision);this.record(next?'下一完成事件':'推進現實 '+realMs/1000+' 秒','已原子保存',before);return this.world;
 }
 async reload(){const before=this.world?inspectWorld(this.world):null,loaded=await this.persistence.loadSave();if(!loaded.game)throw new Error('沒有測試存檔。');this.world=loaded.game;this.record('重讀測試存檔','讀回成功',before);return this.world;}
 async restore(){const points=await this.persistence.backupList(),previous=points.at(-1);if(!previous)throw new Error('沒有測試回復點。');const before=this.world?inspectWorld(this.world):null;this.world=await this.persistence.restore(previous.id);this.record('測試 Recovery','回復成功',before);return this.world;}
 async dispose(){await this.persistence.db.delete();this.world=null;}
}
