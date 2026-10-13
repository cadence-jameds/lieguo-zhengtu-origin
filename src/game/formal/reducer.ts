import {diplomacySnapshot,diplomacyChanges} from './diplomacyReports';
import {handleGovernance,applyGovernance,retireGovernors} from './governance';
import {politicalMemory} from './aiKnowledge';
import {handleAutonomy,retireAutonomy} from './autonomy';
import {applyExtinctionCommand,resolveExtinctions,handleCraftsmanEvent} from './extinction';
import {applyPolitics,reconcilePolitics,reconcilePoliticalEvents} from './politics';
import {applyCooperation} from './cooperation';
import {configureDeveloper} from './developerCommand';
import {canonicalJSON} from './canonical';
import {eventId,reportId,sequenceKey,type FactionId} from './ids';
import type {CommandAck,FormalOrder,FormalReport,FormalTransition,FormalWorld,ResearchProject} from './model';
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
/** Pure transition; only persistence may expose the draft as committed world. */
export function submitFormalOrder(current:FormalWorld,value:unknown):FormalTransition {
 const parsed=orderSchema.safeParse(value);
 if(!parsed.success)throw new Error('命令格式無效。');
 const order=parsed.data;
 const reject=(reason:string):FormalTransition=>({world:current,reports:[],ack:{commandId:order.commandId,status:'rejected',revision:current.revision,reason}});
 if(order.campaignId!==current.campaignId||!current.factions.some(f=>f.id===order.issuerId))return reject('命令不屬於目前戰役。');
 const fingerprint=orderFingerprint(order),receipt=current.commandReceipts.find(r=>r.commandId===order.commandId);
 if(receipt){
  if(receipt.issuerId!==order.issuerId||receipt.fingerprint!==fingerprint)return reject('CommandId 已用於不同命令。');
  return{world:current,reports:[],ack:{commandId:order.commandId,status:receipt.disposition==='applied'?'duplicate':'rolled-back',revision:current.revision,originalRevision:receipt.committedRevision,reason:receipt.disposition==='rolled-back'?'此命令已由回復點撤銷；如需重新操作，請建立新的命令。':undefined}};
 }
 if(order.expectedRevision!==current.revision)return reject('世界版本已更新，請重新確認狀態。');
 if(order.issuedWorldTime>current.time)return reject('命令時間超前於世界。');
 const w=structuredClone(current),reports:FormalReport[]=[];
 const p=order.payload;
 const city=spatial(w).cities.get(p.cityId);
 if(p.type!=='player.rebirth'&&(!city||city.ownerFactionId!==order.issuerId))return reject('只能操作自己實際控制的城市。');
 if(city)settleCity(w,city);
 if(p.type==='player.rebirth'){try{const scheduler=new EventScheduler(w.events);applyExtinctionCommand(w,city,order,p,scheduler);w.events=scheduler.snapshot();w.revision++;w.commandReceipts.push({commandId:order.commandId,issuerId:order.issuerId,fingerprint,committedRevision:w.revision,disposition:'applied'});validateFormalWorld(w);return{world:w,reports,ack:{commandId:order.commandId,status:'committed',revision:w.revision}};}catch(error){if(error instanceof RuleViolation)return reject(error.message);throw error;}}
 if(!city)return reject('城市不存在。');
 if(p.type==='developer.configure'){try{configureDeveloper(w,city,p);}catch(error){if(error instanceof RuleViolation)return reject(error.message);throw error;}}
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
   const scheduler=new EventScheduler(w.events);scheduler.push({id:completionEventId,at:w.time+running.durationSnapshot.durationMs,type:'research.complete',projectId:running.projectId});w.events=scheduler.snapshot();
   reports.push(report(w,'科研開始','四資源投入完成，依建立時工期快照開始倒數。',project.ownerFactionId));
  }
 }
 else {
  try{const scheduler=new EventScheduler(w.events);
   if(p.type!=='construction.cancel'&&p.type!=='military.cancel')promoteCityQueues(w,city,scheduler);
   if(p.type==='craftsman.move'||p.type==='craftsman.castle')applyExtinctionCommand(w,city,order,p,scheduler);
   else if(p.type==='governance.set')applyGovernance(w,city,order,p,scheduler);
   else if(p.type==='politics'){politicalMemory(w,order.issuerId,p);applyPolitics(w,city,order,p,scheduler);}
   else if(p.type==='defense.set'||p.type==='defense.dispatch'||p.type==='joint.create'||p.type==='joint.join')applyCooperation(w,city,order,p,scheduler);
   else if(p.type==='research.start')startResearch(w,city,order,p.techId,scheduler);
   else if(p.type==='age.start')startAge(w,city,order,scheduler);
   else if(p.type==='military.recruit'||p.type==='military.cancel'||p.type==='military.disband')applyMilitaryCommand(w,city,order,p,scheduler);
   else if(p.type==='settlement.prepare'||p.type==='settlement.cancel'||p.type==='settlement.dispatch')applySettlementCommand(w,city,order,p,scheduler);
   else if(p.type==='logistics.auto.set')setAutoLogistics(w,city,p.rules);
   else if(p.type==='army.dispatch'||p.type==='army.recall')applyArmyCommand(w,city,order,p,scheduler);
   else applyEconomyCommand(w,city,order,p,scheduler);
   promoteCityQueues(w,city,scheduler);reconcilePoliticalEvents(w,scheduler);w.events=scheduler.snapshot();}catch(error){if(error instanceof RuleViolation)return reject(error.message);throw error;}
 }
 reports.push(...diplomacyChanges(w,diplomacySnapshot(current)));
 w.revision++;
 w.commandReceipts.push({commandId:order.commandId,issuerId:order.issuerId,fingerprint,committedRevision:w.revision,disposition:'applied'});
 validateFormalWorld(w);
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
export function advanceFormal(current:FormalWorld,target:number):FormalTransition {
 if(!Number.isSafeInteger(target)||target<current.time)throw new Error('世界時間無效。');
 if(target===current.time&&(!current.events.length||current.events.every(e=>e.at>target)))return{world:current,reports:[]};
 const w=structuredClone(current),scheduler=new EventScheduler(w.events),reports:FormalReport[]=[];
 while(scheduler.peek()&&scheduler.peek()!.at<=target){
  const beforePolitics=diplomacySnapshot(w);
  const e=scheduler.pop()!;w.time=e.at;
  const returningSource=e.type==='logistics.return'?w.logistics?.find(t=>t.shipmentId===e.shipmentId)?.sourceCityId:undefined;
  const governanceReports=handleGovernance(w,e,scheduler,submitFormalOrder);
  const aiReports=governanceReports??handleAutonomy(w,e,scheduler,submitFormalOrder);
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
  else if(handleEconomyEvent(w,e,scheduler)){
   if(e.type==='economy.settle'){const c=spatial(w).cities.get(e.cityId);if(c)runAutoLogistics(w,c,scheduler);}
   if(e.type==='logistics.return'){const c=returningSource&&spatial(w).cities.get(returningSource);if(c)runAutoLogistics(w,c,scheduler);}
  }
  else if(e.type!=='fixture.marker')throw new Error('Unhandled formal event');
  resolveExtinctions(w,scheduler);retireAutonomy(w,scheduler);retireGovernors(w,scheduler);
  if(aiReports===null)reports.push(...diplomacyChanges(w,beforePolitics));
  if('cityId' in e){const c=spatial(w).cities.get(e.cityId);if(c)promoteCityQueues(w,c,scheduler);}
 }
 const beforeReconcile=diplomacySnapshot(w);reconcilePolitics(w);reports.push(...diplomacyChanges(w,beforeReconcile));reconcilePoliticalEvents(w,scheduler);w.time=target;w.events=scheduler.snapshot();w.revision=current.revision+1;
 for(const r of w.commandReceipts)if(r.committedRevision>w.revision)r.committedRevision=w.revision;
 validateFormalWorld(w);return{world:w,reports};
}
