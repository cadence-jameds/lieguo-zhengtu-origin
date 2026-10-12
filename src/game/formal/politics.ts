import type {FormalWorld,FormalCity,FormalOrder} from './model';
import type {FactionId,CityId,EmpireId} from './ids';
import {empireId,sequenceKey} from './ids';
import {buildingLevel} from './catalogB3';
import {requireRule,HOUR,enqueue} from './economy';
import type {EventScheduler} from './scheduler';
export type Legion={id:string;name:string;description:string;leader:FactionId;members:FactionId[];empireId:EmpireId|null};
export type Empire={id:EmpireId;name:string;leader:FactionId;legions:string[];color:string};
export type PoliticalRequest={id:string;kind:'application'|'invitation'|'empire'|'friendly';from:FactionId;to:FactionId;legionId?:string;name?:string};
export type Diplomacy={a:string;b:string;state:'friendly'|'war';endsAt?:number;eventId?:import('./ids').EventId};
export type JointArmy={id:string;initiator:FactionId;targetCityId:CityId;arrivalAt:number;armyIds:import('./ids').ArmyId[];scope:string};
export type DefenseReserve={cityId:CityId;units:Record<string,number>;keep:number;enabled:boolean};
export type Politics={legions:Legion[];empires:Empire[];requests:PoliticalRequest[];relations:Diplomacy[];joints:JointArmy[];reserves:DefenseReserve[];randomCounter:number};
export const initialPolitics=():Politics=>({legions:[],empires:[],requests:[],relations:[],joints:[],reserves:[],randomCounter:0});
export type PoliticalCommand={type:'politics';cityId:CityId;action:'legion-create'|'legion-apply'|'legion-invite'|'request-accept'|'request-reject'|'legion-leave'|'legion-kick'|'legion-transfer'|'legion-edit'|'legion-dissolve'|'empire-propose'|'empire-leave'|'empire-kick'|'empire-transfer'|'empire-dissolve'|'friendly-propose'|'friendly-end'|'war'|'peace';target?:FactionId;requestId?:string;name?:string;description?:string};
export type CooperationCommand={type:'defense.set';cityId:CityId;units:Record<string,number>;keep:number;enabled:boolean}|{type:'defense.dispatch';cityId:CityId;targetCityId:CityId}|{type:'joint.create';cityId:CityId;targetCityId:CityId;units:Record<string,number>;arrivalAt:number}|{type:'joint.join';cityId:CityId;jointId:string;units:Record<string,number>};
export const embassy=(w:FormalWorld,id:FactionId)=>Math.max(0,...w.cities.filter(c=>c.ownerFactionId===id).map(c=>buildingLevel(c,'embassy')));
export const legionOf=(w:FormalWorld,id:FactionId)=>w.politics?.legions.find(l=>l.members.includes(id));
export const empireOf=(w:FormalWorld,id:FactionId)=>{const l=legionOf(w,id);return w.politics?.empires.find(e=>e.id===l?.empireId);};
export const politicalScope=(w:FormalWorld,id:FactionId)=>empireOf(w,id)?.id??legionOf(w,id)?.id??id;
export function diplomaticRelation(w:FormalWorld,a:FactionId,b:FactionId):'own'|'friendly'|'war'|'neutral'{
 if(a===b)return'own';const sa=politicalScope(w,a),sb=politicalScope(w,b);if(sa===sb)return'friendly';
 const r=w.politics?.relations.find(r=>r.a===sa&&r.b===sb||r.a===sb&&r.b===sa);return r?.state??'neutral';
}
export function politicalLeader(w:FormalWorld,id:FactionId){return empireOf(w,id)?.leader??legionOf(w,id)?.leader??id;}
export function canCoordinate(w:FormalWorld,a:FactionId,b:FactionId,level:13|14){
 const l=legionOf(w,a),m=legionOf(w,b);if(!l||!m)return false;
 return l===m?embassy(w,l.leader)>=level:!!l.empireId&&l.empireId===m.empireId&&embassy(w,empireOf(w,a)!.leader)>=15;
}
/** Deterministic seeded draw, durable counter; no Date/random dependency. */
export function politicalDraw(w:FormalWorld,ids:FactionId[]){const p=w.politics??=initialPolitics();let x=(w.seed+Math.imul(++p.randomCounter,2654435761))>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return [...ids].sort()[(x>>>0)%ids.length];}
const successor=(w:FormalWorld,ids:FactionId[])=>{const max=Math.max(...ids.map(id=>embassy(w,id)));return politicalDraw(w,ids.filter(id=>embassy(w,id)===max));};
function syncEmpires(w:FormalWorld){const p=w.politics!;for(const e of [...p.empires]){e.legions=e.legions.filter(id=>p.legions.some(l=>l.id===id&&l.empireId===e.id));if(!e.legions.length){p.empires=p.empires.filter(x=>x!==e);continue;}const leaders=e.legions.map(id=>p.legions.find(l=>l.id===id)!.leader);if(!leaders.includes(e.leader))e.leader=successor(w,leaders);}for(const f of w.factions)f.empireId=legionOf(w,f.id)?.empireId??null;cleanScopes(w);}
function cleanScopes(w:FormalWorld){const p=w.politics!;const scopes=new Set([...w.factions.map(f=>politicalScope(w,f.id))]);p.relations=p.relations.filter(r=>scopes.has(r.a)&&scopes.has(r.b)&&r.a!==r.b);p.requests=p.requests.filter(r=>w.cities.some(c=>c.ownerFactionId===r.from)&&w.cities.some(c=>c.ownerFactionId===r.to)&&(!r.legionId||p.legions.some(l=>l.id===r.legionId)));}
function detachLegion(w:FormalWorld,l:Legion){l.empireId=null;syncEmpires(w);}
export function removePoliticalMember(w:FormalWorld,id:FactionId){const p=w.politics;if(!p)return;const l=legionOf(w,id);if(l){l.members=l.members.filter(m=>m!==id);if(!l.members.length)p.legions=p.legions.filter(x=>x!==l);else if(l.leader===id)l.leader=successor(w,l.members);}p.requests=p.requests.filter(r=>r.from!==id&&r.to!==id);p.reserves=p.reserves.filter(r=>w.cities.find(c=>c.id===r.cityId)?.ownerFactionId!==id);syncEmpires(w);}
export function reconcilePolitics(w:FormalWorld){if(!w.politics)return;for(const l of w.politics.legions){if(embassy(w,l.leader)<1){const eligible=l.members.filter(id=>embassy(w,id)>0&&w.cities.some(c=>c.ownerFactionId===id));if(eligible.length)l.leader=successor(w,eligible);}}syncEmpires(w);}
function validMember(w:FormalWorld,id:FactionId){const f=w.factions.find(f=>f.id===id);requireRule(f&&w.cities.some(c=>c.ownerFactionId===id),'領主已滅國。');requireRule((f.age??0)>=1&&embassy(w,id)>=1,'需要封建時代與使館 Lv1。');}
export function applyPolitics(w:FormalWorld,_c:FormalCity,o:FormalOrder,q:PoliticalCommand,s:EventScheduler){
 const p=w.politics??=initialPolitics(),me=o.issuerId,l=legionOf(w,me),other=q.target&&legionOf(w,q.target),e=empireOf(w,me);
 requireRule(w.cities.some(c=>c.ownerFactionId===me),'領主已滅國。');
 if(['legion-create','legion-apply','legion-invite','empire-propose'].includes(q.action))validMember(w,me);
 const name=()=>{requireRule(q.name&&q.name.trim().length>0,'請輸入名稱。');return q.name.trim();};
 const lead=()=>requireRule(l&&l.leader===me,'僅軍團長可執行。');
 const imperial=()=>requireRule(e&&e.leader===me,'僅帝國領袖可執行。');
 const request=(kind:PoliticalRequest['kind'],to:FactionId,extra:Partial<PoliticalRequest>={})=>{requireRule(to!==me&&w.cities.some(c=>c.ownerFactionId===to),'對象不可用。');requireRule(!p.requests.some(r=>r.kind===kind&&r.from===me&&r.to===to),'同類請求已存在。');p.requests.push({id:'political-request:'+sequenceKey(w.sequences.project++),kind,from:me,to,...extra});};
 if(q.action==='legion-create'){requireRule(!l,'已加入軍團。');p.legions.push({id:'legion:'+sequenceKey(w.sequences.project++),name:name(),description:q.description??'',leader:me,members:[me],empireId:null});}
 else if(q.action==='legion-apply'){requireRule(!l&&other,'必須是獨立領主並指定軍團。');request('application',other.leader,{legionId:other.id});}
 else if(q.action==='legion-invite'){lead();requireRule(q.target&&!other,'對方已有軍團。');request('invitation',q.target,{legionId:l!.id});}
 else if(q.action==='request-accept'||q.action==='request-reject'){
  const r=p.requests.find(r=>r.id===q.requestId);requireRule(r&&r.to===me,'只有收件人可回覆請求。');
  if(q.action==='request-accept'){
   if(r.kind==='application'||r.kind==='invitation'){const group=p.legions.find(l=>l.id===r.legionId),member=r.kind==='application'?r.from:me;requireRule(group&&group.leader===(r.kind==='application'?me:r.from)&&!legionOf(w,member),'軍團或申請狀態已變更。');validMember(w,member);requireRule(group.members.length<Math.min(10,embassy(w,group.leader)),'軍團名額已滿或超額。');group.members.push(member);}
   if(r.kind==='friendly'){requireRule(politicalLeader(w,r.from)===r.from&&politicalLeader(w,me)===me,'外交權限已變更。');const a=politicalScope(w,r.from),b=politicalScope(w,me);requireRule(a!==b,'已屬同一政治共同體。');p.relations=p.relations.filter(x=>!(x.a===a&&x.b===b||x.a===b&&x.b===a));p.relations.push({a,b,state:'friendly'});}
   if(r.kind==='empire'){const source=legionOf(w,r.from),dest=legionOf(w,me);requireRule(source&&dest&&dest.leader===me&&!dest.empireId&&source.leader===r.from,'軍團／帝國請求已失效。');requireRule((w.factions.find(f=>f.id===me)!.age??0)>=2,'加入帝國需要城堡時代。');const current=empireOf(w,r.from);if(current){requireRule(current.leader===r.from&&current.legions.length<3,'帝國權限或容量不足。');current.legions.push(dest.id);dest.empireId=current.id;}else{requireRule(embassy(w,r.from)>=11&&(w.factions.find(f=>f.id===r.from)!.age??0)>=2,'成立帝國需要城堡時代、使館 Lv11。');const id=empireId(sequenceKey(w.sequences.project++));source.empireId=dest.empireId=id;p.empires.push({id,name:r.name??'新帝國',leader:r.from,legions:[source.id,dest.id],color:`hsl(${(p.randomCounter++*137+w.seed)%360} 58% 57%)`});}}
  }
  p.requests=p.requests.filter(x=>x!==r);
 }
 else if(q.action==='legion-leave'){requireRule(l,'尚未加入軍團。');removePoliticalMember(w,me);}
 else if(q.action==='legion-kick'){lead();requireRule(q.target&&q.target!==me&&l!.members.includes(q.target),'無法踢除此成員。');removePoliticalMember(w,q.target);}
 else if(q.action==='legion-transfer'){lead();requireRule(q.target&&l!.members.includes(q.target)&&embassy(w,q.target)>=1,'繼任者資格不足。');l!.leader=q.target;}
 else if(q.action==='legion-edit'){lead();if(q.name)l!.name=name();if(q.description!==undefined)l!.description=q.description;}
 else if(q.action==='legion-dissolve'){lead();p.legions=p.legions.filter(x=>x!==l);}
 else if(q.action==='empire-propose'){lead();requireRule(q.target&&other&&other!==l&&!other.empireId,'必須指定另一個獨立軍團。');if(e)imperial();else requireRule(embassy(w,me)>=11&&(w.factions.find(f=>f.id===me)!.age??0)>=2,'成立帝國需要城堡時代與使館 Lv11。');request('empire',other.leader,{name:q.name??e?.name??name()});}
 else if(q.action==='empire-leave'){lead();requireRule(e,'尚未加入帝國。');detachLegion(w,l!);}
 else if(q.action==='empire-kick'){imperial();requireRule(other&&other!==l&&other.empireId===e!.id,'只能移除其他所屬軍團。');detachLegion(w,other);}
 else if(q.action==='empire-transfer'){imperial();requireRule(q.target&&other?.empireId===e!.id&&other.leader===q.target,'繼任者必須是帝國軍團長。');e!.leader=q.target;}
 else if(q.action==='empire-dissolve'){imperial();for(const group of p.legions)if(group.empireId===e!.id)group.empireId=null;p.empires=p.empires.filter(x=>x!==e);}
 else{requireRule(q.target&&politicalLeader(w,me)===me&&politicalLeader(w,q.target)===q.target,'外交由軍團長／帝國領袖統一管理。');const a=politicalScope(w,me),b=politicalScope(w,q.target);requireRule(a!==b,'同共同體不得互相敵對。');const old=p.relations.find(r=>r.a===a&&r.b===b||r.a===b&&r.b===a);
  if(q.action==='friendly-propose')request('friendly',q.target);
  if(q.action==='friendly-end'){requireRule(old?.state==='friendly'&&!old.endsAt,'沒有可解除的友好。');old.endsAt=w.time+6*HOUR;old.eventId=enqueue(w,s,{type:'politics.end-friendly',a:old.a,b:old.b,at:old.endsAt});}
  if(q.action==='war'||q.action==='peace'){requireRule(old?.state!=='friendly','友好及六小時解除期間禁止敵對。');p.relations=p.relations.filter(r=>r!==old);if(q.action==='war')p.relations.push({a,b,state:'war'});}
 }
 syncEmpires(w);
}
export function conquestOwner(w:FormalWorld,initiator:FactionId,armies:import('./combatModel').MissionArmy[]){const scores=new Map<FactionId,number>();for(const a of armies){let n=0;for(const [id,count] of Object.entries(a.units))if(!['scout','baggage','ram','catapult'].includes(id))n+=count;scores.set(a.ownerFactionId,(scores.get(a.ownerFactionId)??0)+n);}if((scores.get(initiator)??0)>0)return initiator;const max=Math.max(...scores.values());return politicalDraw(w,[...scores].filter(([,n])=>n===max&&n>0).map(([id])=>id));}

/** Close stale metadata without undoing troops already committed to a battle. */
export function reconcilePoliticalEvents(w:FormalWorld,s:EventScheduler){
 const p=w.politics;if(!p)return;
 const ids=new Set(w.armies.map(a=>a.id));for(const j of p.joints)j.armyIds=j.armyIds.filter(id=>ids.has(id));
 p.joints=p.joints.filter(j=>j.armyIds.length||w.combat?.battles.some(b=>b.jointId===j.id));
 const events=s.snapshot().filter(e=>e.type!=='politics.end-friendly'||p.relations.some(r=>r.eventId===e.id));
 while(s.pop()){};for(const e of events)s.push(e);
}
