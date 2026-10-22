import {applyCatchupCommand,handleCatchupEvent,reconcileCatchup} from './modernCatchup';
import {selectReverseEngineering} from './modernAwareness';
import {diplomacySnapshot,diplomacyChanges} from './diplomacyReports';
import {cloneWorldDraft} from './worldDraft';
import {handleGovernance,applyGovernance,retireGovernors} from './governance';
import {politicalMemory} from './aiKnowledge';
import {handleAutonomy,retireAutonomy,type Submit} from './autonomy';
import {applyBreakthroughCommand,handleBreakthroughEvent,reconcileBreakthroughs} from './breakthrough';
import {applyWonderCommand,handleWonderEvent} from './wonder';
import {reconcileExileSites,applyExtinctionCommand,resolveExtinctions,handleCraftsmanEvent} from './extinction';
import {applyPolitics,reconcilePolitics,reconcilePoliticalEvents} from './politics';
import {applyCooperation} from './cooperation';
import {configureCampaign} from './campaignTime';
import {configureDeveloper} from './developerCommand';
import {canonicalJSON} from './canonical';
import {eventId,reportId,sequenceKey,type CommandId,type FactionId} from './ids';
import type {CommandAck,CommandReceipt,FormalOrder,FormalReport,FormalTransition,FormalWorld,ResearchProject} from './model';
import {resourceKeys} from './model';
import {orderSchema,validateFormalWorld} from './schema';
import {EventScheduler} from './scheduler';
import {applyEconomyCommand,handleEconomyEvent,settleCity,settleFaction,promoteCityQueues,RuleViolation} from './economy';
import {spatial} from './spatial';
import {startResearch,startAge,completeAge} from './research';
import {applyMilitaryCommand,handleMilitaryEvent} from './military';
import {applySettlementCommand,handleSettlementEvent} from './settlement';
import {runAutoLogistics,setAutoLogistics} from './autoLogistics';
import {applyArmyCommand} from './armies';
import {handleCombatEvent,refreshBattleDefense} from './battles';
export function orderFingerprint(order:FormalOrder):string {
 return canonicalJSON({campaignId:order.campaignId,issuerId:order.issuerId,payload:order.payload});
}
function report(w:FormalWorld,title:string,text:string,owner:FactionId=w.playerFactionId):FormalReport {
 const sequence=w.sequences.report++;return{id:reportId(sequenceKey(sequence)),sequence,campaignId:w.campaignId,ownerFactionId:owner,at:w.time,category:'research',title,text};
}
type ReplayAdmission={receipts:Map<CommandId,CommandReceipt>;indexedReceipts:number;shareAutonomy:boolean;shareCityDraft:boolean;fullCommandClone:boolean};
/** Scan once after the outer clone. Engine writers add fresh snapshots/records and IDs, never cross-domain objects. */
function replayClonePolicy(current:FormalWorld):Pick<ReplayAdmission,'shareAutonomy'|'shareCityDraft'|'fullCommandClone'> {
 const readonly=1,autonomy=2,mutable=4,ownership=new WeakMap<object,number>(),owners=new WeakMap<object,number>();
 let fullCommandClone=false,shareAutonomy=!!current.autonomy,shareCityDraft=true,nextOwner=0;
 const collect=(roots:unknown[],domain:number,descend=true)=>{
  for(const root of roots){
   const owner=++nextOwner,pending=[root];
   while(pending.length){
    const value=pending.pop();if(value===null||typeof value!=='object')continue;
    const priorOwner=owners.get(value);if(priorOwner!==undefined&&priorOwner!==owner)shareCityDraft=false;else owners.set(value,owner);
    const previous=ownership.get(value)??0;if(previous&domain)continue;
    const owned=previous|domain;ownership.set(value,owned);
    if(owned&readonly&&owned&(autonomy|mutable))fullCommandClone=true;
    if(owned&autonomy&&owned&mutable)shareAutonomy=false;
    if(descend)for(const child of Object.values(value))pending.push(child);
   }
  }
 };
 collect([current.worldLayer,current.commandReceipts,current.completionReceipts,current.combat?.receipts],readonly);
 collect([current.autonomy],autonomy);
 // Register containers separately so each city has its own owner; combat receipt rows keep their readonly domain.
 collect([current.cities,current.combat],mutable,false);
 const body={...current,cities:undefined,worldLayer:undefined,commandReceipts:undefined,completionReceipts:undefined,autonomy:undefined,combat:current.combat?{...current.combat,receipts:undefined}:current.combat};
 collect(Object.values(body),mutable);
 collect(current.cities,mutable);
 return{fullCommandClone,shareAutonomy:shareAutonomy&&!fullCommandClone,shareCityDraft:shareCityDraft&&!fullCommandClone};
}
/** Only the isolated replay uses this draft. Commands never mutate worldLayer or existing receipt rows. */
function cloneReplayCommandDraft(current:FormalWorld,shareAutonomy:boolean):FormalWorld {
 const body={...current,commandReceipts:[],completionReceipts:[]};
 if(Object.hasOwn(current,'worldLayer'))body.worldLayer=undefined;
 if(shareAutonomy)body.autonomy=undefined;
 if(current.combat)body.combat={...current.combat,receipts:[]};
 const w=structuredClone(body) as FormalWorld;
 w.commandReceipts=current.commandReceipts.slice();w.completionReceipts=current.completionReceipts.slice();
 if(Object.hasOwn(current,'worldLayer'))w.worldLayer=current.worldLayer;
 if(shareAutonomy)w.autonomy=current.autonomy;
 if(current.combat)w.combat!.receipts=current.combat.receipts.slice();
 return w;
}
/** These three handlers, lazy settlement and queue promotion write only this city, sequences and political cleanup. */
function cloneReplayCityDraft(current:FormalWorld,index:number):FormalWorld {
 const draft=structuredClone({city:current.cities[index],sequences:current.sequences,politics:current.politics});
 const w={...current,cities:current.cities.slice(),sequences:draft.sequences,commandReceipts:current.commandReceipts.slice(),completionReceipts:current.completionReceipts.slice()};
 w.cities[index]=draft.city;if(Object.hasOwn(current,'politics'))w.politics=draft.politics;
 return w;
}
function cloneOrderDraft(current:FormalWorld,order:FormalOrder,replay?:ReplayAdmission):FormalWorld {
 if(!replay)return cloneWorldDraft(current);
 if(replay.fullCommandClone)return structuredClone(current);
 const type=order.payload.type;
 if(replay.shareCityDraft&&(type==='field.upgrade'||type==='building.upgrade'||type==='military.recruit')){
  const index=current.cities.findIndex(city=>city.id===order.payload.cityId);
  if(index>=0)return cloneReplayCityDraft(current,index);
 }
 return cloneReplayCommandDraft(current,replay.shareAutonomy&&type!=='politics');
}
function replayReceipt(current:FormalWorld,admission:ReplayAdmission,id:CommandId){
 // Every replay writer appends history. Object.assign may replace the array with a copied prefix.
 for(;admission.indexedReceipts<current.commandReceipts.length;admission.indexedReceipts++){
  const receipt=current.commandReceipts[admission.indexedReceipts];
  if(!admission.receipts.has(receipt.commandId))admission.receipts.set(receipt.commandId,receipt);
 }
 return admission.receipts.get(id);
}
function replaySubmit(current:FormalWorld):Submit {
 const admission:ReplayAdmission={receipts:new Map(),indexedReceipts:0,...replayClonePolicy(current)};
 return(current,value)=>submitOrderDraft(current,value,admission);
}
/** Pure transition; only persistence may expose the draft as committed world. */
export function submitFormalOrder(current:FormalWorld,value:unknown):FormalTransition {
 return submitOrderDraft(current,value);
}
function submitOrderDraft(current:FormalWorld,value:unknown,replay?:ReplayAdmission):FormalTransition {
 const parsed=orderSchema.safeParse(value);
 if(!parsed.success)throw new Error('命令格式無效。');
 const order=parsed.data;
 const reject=(reason:string):FormalTransition=>({world:current,reports:[],ack:{commandId:order.commandId,status:'rejected',revision:current.revision,reason}});
 if(order.campaignId!==current.campaignId||!current.factions.some(f=>f.id===order.issuerId))return reject('命令不屬於目前戰役。');
 const fingerprint=orderFingerprint(order),receipt=replay?replayReceipt(current,replay,order.commandId):current.commandReceipts.find(r=>r.commandId===order.commandId);
 if(receipt){
  if(receipt.issuerId!==order.issuerId||receipt.fingerprint!==fingerprint)return reject('CommandId 已用於不同命令。');
  return{world:current,reports:[],ack:{commandId:order.commandId,status:receipt.disposition==='applied'?'duplicate':'rolled-back',revision:current.revision,originalRevision:receipt.committedRevision,reason:receipt.disposition==='rolled-back'?'此命令已由回復點撤銷；如需重新操作，請建立新的命令。':undefined}};
 }
 if(order.expectedRevision!==current.revision)return reject('世界版本已更新，請重新確認狀態。');
 if(order.issuedWorldTime>current.time)return reject('命令時間超前於世界。');
 const w=cloneOrderDraft(current,order,replay),reports:FormalReport[]=[];
 const p=order.payload;
 const city=spatial(w).cities.get(p.cityId);
 if(p.type!=='player.rebirth'&&p.type!=='campaign.configure'&&(!city||city.ownerFactionId!==order.issuerId))return reject('只能操作自己實際控制的城市。');
 if(city&&p.type!=='campaign.configure')settleCity(w,city);
 if(p.type==='player.rebirth'){try{const scheduler=replay?EventScheduler.forReplay(w.events):new EventScheduler(w.events);applyExtinctionCommand(w,city,order,p,scheduler);w.events=scheduler.snapshot();w.revision++;w.commandReceipts.push({commandId:order.commandId,issuerId:order.issuerId,fingerprint,committedRevision:w.revision,disposition:'applied'});if(!replay)validateFormalWorld(w);return{world:w,reports,ack:{commandId:order.commandId,status:'committed',revision:w.revision}};}catch(error){if(error instanceof RuleViolation)return reject(error.message);throw error;}}
 if(!city)return reject('城市不存在。');
 if(p.type==='campaign.configure'){try{configureCampaign(w,order.issuerId,p);}catch(error){if(error instanceof RuleViolation)return reject(error.message);throw error;}}
 else if(p.type==='developer.configure'){try{configureDeveloper(w,city,p);}catch(error){if(error instanceof RuleViolation)return reject(error.message);throw error;}}
 else if(p.type==='city.rename')city.name=p.name;
 else if(p.type==='research.contribute'){
  const project=w.researchProjects.find(x=>x.projectId===p.projectId);
  if(!project||project.ownerFactionId!==order.issuerId||project.phase!=='funding')return reject('此科研專案不可投入。');
  if(project.paymentMode==='single-city'&&project.initiatingCityId!==city.id)return reject('此科技只允許發起城市付款。');
  if(!resourceKeys.some(r=>p.resources[r]>0))return reject('請選擇投入資源。');
  if(resourceKeys.some(r=>p.resources[r]>city.stock[r]||p.resources[r]>project.requiredResources[r]-project.contributedResources[r]))return reject('投入量超過庫存或專案需求。');
  for(const r of resourceKeys){city.stock[r]-=p.resources[r];project.contributedResources[r]+=p.resources[r];}
  project.contributions.push({commandId:order.commandId,sourceFactionId:order.issuerId,sourceCityId:city.id,resources:{...p.resources},at:w.time});
  if(resourceKeys.every(r=>project.contributedResources[r]===project.requiredResources[r])){
   const completionEventId=eventId(sequenceKey(w.sequences.event++));
   const running:ResearchProject={...project,phase:'researching',startedAt:w.time,fundingTransitionCommandId:order.commandId,completionEventId};
   w.researchProjects[w.researchProjects.indexOf(project)]=running;
   const scheduler=replay?EventScheduler.forReplay(w.events):new EventScheduler(w.events);scheduler.push({id:completionEventId,at:w.time+running.durationSnapshot.durationMs,type:'research.complete',projectId:running.projectId});w.events=scheduler.snapshot();
   reports.push(report(w,'科研開始','四資源投入完成，依建立時工期快照開始倒數。',project.ownerFactionId));
  }
 }
 else {
  try{const scheduler=replay?EventScheduler.forReplay(w.events):new EventScheduler(w.events);
   if(p.type!=='construction.cancel'&&p.type!=='military.cancel')promoteCityQueues(w,city,scheduler);
   if(p.type==='modern.transfer.start'||p.type==='modern.emergency.start'||p.type==='modern.project.ship')applyCatchupCommand(w,city,order,p,scheduler);
   else if(p.type==='craftsman.move'||p.type==='craftsman.castle')applyExtinctionCommand(w,city,order,p,scheduler);
   else if(p.type==='breakthrough.start'||p.type==='breakthrough.ship')applyBreakthroughCommand(w,city,order,p,scheduler);
   else if(p.type==='modern.reverse')selectReverseEngineering(w,order.issuerId,p.unitId);
   else if(p.type==='wonder.start'||p.type==='wonder.ship')applyWonderCommand(w,city,order,p,scheduler);
   else if(p.type==='governance.set')applyGovernance(w,city,order,p,scheduler);
   else if(p.type==='politics'){politicalMemory(w,order.issuerId,p);applyPolitics(w,city,order,p,scheduler);}
   else if(p.type==='defense.set'||p.type==='defense.dispatch'||p.type==='joint.create'||p.type==='joint.join')applyCooperation(w,city,order,p,scheduler);
   else if(p.type==='research.start')startResearch(w,city,order,p.techId,scheduler);
   else if(p.type==='age.start')startAge(w,city,order,scheduler);
   else if(p.type==='military.modernize'||p.type==='military.recruit'||p.type==='military.cancel'||p.type==='military.disband')applyMilitaryCommand(w,city,order,p,scheduler);
   else if(p.type==='settlement.prepare'||p.type==='settlement.cancel'||p.type==='settlement.dispatch')applySettlementCommand(w,city,order,p,scheduler);
   else if(p.type==='logistics.auto.set')setAutoLogistics(w,city,p.rules);
   else if(p.type==='army.dispatch'||p.type==='army.recall')applyArmyCommand(w,city,order,p,scheduler);
   else applyEconomyCommand(w,city,order,p,scheduler);
   promoteCityQueues(w,city,scheduler);reconcileBreakthroughs(w,scheduler);reconcileCatchup(w,scheduler);reconcilePoliticalEvents(w,scheduler);w.events=scheduler.snapshot();}catch(error){if(error instanceof RuleViolation)return reject(error.message);throw error;}
 }
 reports.push(...diplomacyChanges(w,diplomacySnapshot(current)));
 w.revision++;
 w.commandReceipts.push({commandId:order.commandId,issuerId:order.issuerId,fingerprint,committedRevision:w.revision,disposition:'applied'});
 // Replay admissions still use every command rule; the whole private draft is validated at its boundary.
 if(!replay)validateFormalWorld(w);
 const ack:CommandAck={commandId:order.commandId,status:'committed',revision:w.revision};
 return{world:w,reports,ack};
}
/** Event replay and repeated completions are no-ops; owner and duration never re-evaluate city. */
export function completeResearch(w:FormalWorld,event:Extract<import('./model').FormalEvent,{type:'research.complete'}>):FormalReport[] {
 if(w.completionReceipts.some(r=>r.eventId===event.id))return[];
 const p=w.researchProjects.find(p=>p.projectId===event.projectId);
 if(!p||p.phase==='completed')return[];
 if(p.phase!=='researching'||p.completionEventId!==event.id||event.at!==p.startedAt+p.durationSnapshot.durationMs)throw new Error('Research completion contract mismatch');
 const f=w.factions.find(f=>f.id===p.ownerFactionId);if(!f)throw new Error('Research owner missing');
 settleFaction(w,f.id);
 w.researchProjects[w.researchProjects.indexOf(p)]={...p,phase:'completed',completedAt:event.at};
 if(!f.techIds.includes(p.techId))f.techIds.push(p.techId);
 if(p.techId==='research.cooperation')f.researchCooperation=true;
 if(f.researchQueue===p.projectId)f.researchQueue=null;
 w.completionReceipts.push({eventId:event.id,projectId:p.projectId,at:event.at});
 return[report(w,'科研完成','科技研究完成，成果屬於原勢力。',p.ownerFactionId)];
}
/** One scheduler event. Both ordinary and cooperative replays use this exact reducer. */
function advanceOneEvent(w:FormalWorld,scheduler:EventScheduler,reports:FormalReport[],submit:Submit){
  const beforePolitics=diplomacySnapshot(w);
  const e=scheduler.pop()!;w.time=e.at;
  const returningSource=e.type==='logistics.return'?w.logistics?.find(t=>t.shipmentId===e.shipmentId)?.sourceCityId:undefined;
  const governanceReports=handleGovernance(w,e,scheduler,submit);
  const aiReports=governanceReports??handleAutonomy(w,e,scheduler,submit);
  const combatReports=aiReports===null?handleCombatEvent(w,e,scheduler):null;
  if(aiReports!==null)reports.push(...aiReports);
  else
  if(combatReports!==null)reports.push(...combatReports);
  else if(handleCraftsmanEvent(w,e,scheduler)){}
  else if(e.type==='politics.end-friendly'){if(w.politics)w.politics.relations=w.politics.relations.filter(r=>r.eventId!==e.id);}
  else if(e.type==='research.complete')reports.push(...completeResearch(w,e));
  else if(e.type==='age.complete')completeAge(w,e);
  else if(e.type==='military.train'){handleMilitaryEvent(w,e,scheduler);const city=spatial(w).cities.get(e.cityId);if(city)refreshBattleDefense(w,city);}
  else if(e.type==='settlement.ready'||e.type==='settlement.arrive')handleSettlementEvent(w,e,scheduler);
  else if(handleCatchupEvent(w,e,scheduler)){}
  else if(handleBreakthroughEvent(w,e,scheduler,reports)){}
  else if(handleWonderEvent(w,e,scheduler,reports)){}
  else if(handleEconomyEvent(w,e,scheduler)){
   if(e.type==='economy.settle'){const c=spatial(w).cities.get(e.cityId);if(c)runAutoLogistics(w,c,scheduler);}
   if(e.type==='logistics.return'){const c=returningSource&&spatial(w).cities.get(returningSource);if(c)runAutoLogistics(w,c,scheduler);}
  }
  else if(e.type!=='fixture.marker')throw new Error('Unhandled formal event');
  resolveExtinctions(w,scheduler);reconcileBreakthroughs(w,scheduler);reconcileCatchup(w,scheduler);retireAutonomy(w,scheduler);retireGovernors(w,scheduler);
  if(aiReports===null)reports.push(...diplomacyChanges(w,beforePolitics));
  if('cityId' in e){const c=spatial(w).cities.get(e.cityId);if(c)promoteCityQueues(w,c,scheduler);}
}
function finishFormalAdvance(current:FormalWorld,w:FormalWorld,scheduler:EventScheduler,reports:FormalReport[],target:number):FormalTransition {
  const beforeReconcile=diplomacySnapshot(w);reconcilePolitics(w);reports.push(...diplomacyChanges(w,beforeReconcile));reconcilePoliticalEvents(w,scheduler);w.time=target;w.events=scheduler.snapshot();w.revision=current.revision+1;
 for(const r of w.commandReceipts)if(r.committedRevision>w.revision)r.committedRevision=w.revision;
 validateFormalWorld(w);return{world:w,reports};
}
export function advanceFormal(current:FormalWorld,target:number):FormalTransition {
 if(!Number.isSafeInteger(target)||target<current.time)throw new Error('世界時間無效。');
 if(target===current.time&&(!current.events.length||current.events.every(e=>e.at>target)))return{world:current,reports:[]};
 const w=reconcileExileSites(cloneWorldDraft(current)),scheduler=EventScheduler.forReplay(w.events),reports:FormalReport[]=[],submit=replaySubmit(w);
 while(scheduler.peek()&&scheduler.peek()!.at<=target)advanceOneEvent(w,scheduler,reports,submit);
 return finishFormalAdvance(current,w,scheduler,reports,target);
}
/** Yield between completed events, never between an event's mutations or during an IDB transaction. */
export type CooperativeAdvanceOptions={yieldIntervalMs?:number};
export async function advanceFormalCooperative(current:FormalWorld,target:number,onProgress?:(time:number,target:number,processed:number)=>void,options:CooperativeAdvanceOptions={}):Promise<FormalTransition> {
 if(!Number.isSafeInteger(target)||target<current.time)throw new Error('世界時間無效。');
 const yieldIntervalMs=options.yieldIntervalMs??50;
 if(!Number.isFinite(yieldIntervalMs)||yieldIntervalMs<0)throw new Error('世界推進讓出間隔無效。');
 if(target===current.time&&(!current.events.length||current.events.every(e=>e.at>target)))return{world:current,reports:[]};
 const w=reconcileExileSites(cloneWorldDraft(current)),scheduler=EventScheduler.forReplay(w.events),reports:FormalReport[]=[],submit=replaySubmit(w);
 let processed=0,lastYield=performance.now();
 while(scheduler.peek()&&scheduler.peek()!.at<=target){
  advanceOneEvent(w,scheduler,reports,submit);processed++;
  if((options.yieldIntervalMs!==undefined||processed%16===0)&&performance.now()-lastYield>=yieldIntervalMs){
   onProgress?.(w.time,target,processed);
   await new Promise<void>(resolve=>setTimeout(resolve,0));
   lastYield=performance.now();
  }
 }
 onProgress?.(target,target,processed);
 return finishFormalAdvance(current,w,scheduler,reports,target);
}
