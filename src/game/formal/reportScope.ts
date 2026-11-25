import type {WorldRead} from '../presentationModel';
import type {FormalReport,FormalWorld} from './model';
import type {BattleReportPayload} from './combatModel';
import type {FactionId} from './ids';

/** Interpret the stored outcome (which is always attacker-relative) for its own participant. */
export function counterScoutSucceeded(p:BattleReportPayload,viewer:FactionId){
 return p.mission==='scout'&&p.outcome==='scout-failed'&&!p.attackers.some(a=>a.ownerFactionId===viewer)&&p.defenders.some(a=>a.ownerFactionId===viewer);
}
/** Intel delivery is personal; political membership is not an intelligence-sharing grant. */
export function sanitizeScoutReport(_w:WorldRead,r:FormalReport):FormalReport{
 const p=r.battle;if(!p||p.mission!=='scout')return r;
 const attacker=p.attackers.some(a=>a.ownerFactionId===r.ownerFactionId);
 if(p.intel&&!attacker){const {battle:_battle,...record}=r;return {...record,category:'system',title:'遭到偵察',text:'敵方斥候曾觀測本方城市。舊版誤寄的攻方專屬情報已移除。'};}
 if(counterScoutSucceeded(p,r.ownerFactionId)){
  const title='反偵察成功｜'+p.targetName;
  if(r.title!==title)return {...r,title};
 }
 return r;
}
export const scoutReportAuthorized=(r:FormalReport)=>!r.battle?.intel||r.battle.mission!=='scout'||r.battle.attackers.some(a=>a.ownerFactionId===r.ownerFactionId);

/** Embassy sharing grants alarms, not precise historical enemy garrisons. */
export function sanitizeSharedKnowledge(w:FormalWorld){for(const a of w.autonomy?.agents??[])if(a.intel.some(i=>i.source==='shared'))a.intel=a.intel.filter(i=>i.source!=='shared');return w;}
