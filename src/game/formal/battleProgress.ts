import type {BattleState,BattleProgress,BattleLogEntry,ConquestReason} from './combatModel';
import {effectiveUnit} from './combatModifiers';
import {NATIVE_RULESET_VERSION} from './versions';
import type {FormalWorld} from './model';
export const SIEGE_ROUND_LIMIT=12;
export const BATTLE_HISTORY_LIMIT=64;
export const CONQUEST_REASON_LABELS:Record<ConquestReason,string>={'wonder-destroyed':'奇觀破壞成功','no-catapult':'奇觀破壞失敗｜無存活投石機','wonder-timeout':'奇觀破壞失敗｜轟擊回合已用盡',conquered:'征服成功','attacker-defeated':'守軍未擊敗／攻方敗退','no-occupiers':'攻方無有效占領兵','mutual-destruction':'雙方有效戰鬥兵全滅','siege-timeout':'征服未成｜攻城期限已到（城牆未破）','protected-target':'征服未成｜目標受保護'};
/** Checksum is verified before this additive native-Formal compatibility step.
 * Old active battles never ran a siege batch: finishBattle removed them immediately.
 * Preserve all old IDs, pools, combat rounds, receipts and the scheduled deadline. */
export function ensureBattleProgress(b:BattleState,wallLevel:number):BattleState&BattleProgress{
 if(b.phase===undefined)Object.assign(b,{phase:'combat',siegeRound:0,wallDamage:0,wallDamageLevel:wallLevel,catapultBatchDone:false,developmentLost:0,siegeChanges:[],siegeHistory:[],history:[],historyOmitted:0} satisfies BattleProgress);
 return b as BattleState&BattleProgress;
}
export function migrateBattleProgress(w:FormalWorld){if(!w.fixture&&w.metadata.schemaVersion===3)w.metadata.rulesetVersion=NATIVE_RULESET_VERSION;for(const b of w.combat?.battles??[])ensureBattleProgress(b,w.cities.find(c=>c.id===b.cityId)?.wallLevel??0);return w;}
export function battleLog(b:BattleState&BattleProgress,entry:Omit<BattleLogEntry,'combatRound'|'siegeRound'>){
 const forces=entry.kind==='combat-summary'||entry.kind==='siege-summary'?[...new Set(b.participants.map(p=>p.ownerFactionId).filter((id):id is NonNullable<typeof id>=>id!==null))].map(ownerFactionId=>{const initial=b.participants.filter(p=>p.ownerFactionId===ownerFactionId).reduce((n,p)=>n+Object.entries(p.before).reduce((s,[id,c])=>s+(effectiveUnit(id)?c:0),0),0),alive=[...b.attackers,...b.defenders].filter(p=>p.ownerFactionId===ownerFactionId&&effectiveUnit(p.unitId)).reduce((n,p)=>n+p.count,0),departed=b.participants.filter(p=>p.ownerFactionId===ownerFactionId&&p.departedAt!==undefined).reduce((n,p)=>n+Object.entries(p.after).reduce((s,[id,c])=>s+(effectiveUnit(id)?c:0),0),0);return{ownerFactionId,initial,alive,casualties:Math.max(0,initial-alive-departed)};}):undefined;
 b.history.push({...entry,...(forces?{forces}:{}),combatRound:b.round,siegeRound:b.siegeRound});
 if(b.history.length>BATTLE_HISTORY_LIMIT){b.history.shift();b.historyOmitted++;}
}
