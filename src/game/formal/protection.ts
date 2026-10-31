import type {FormalWorld,FormalReport} from './model';
import type {FactionId} from './ids';
import {reportId,sequenceKey} from './ids';
export const PROTECTION_DURATION=48*3600000;
/** Called only on an isolated, legal command draft. Rejection discards the draft. */
export function endProtection(w:FormalWorld,id:FactionId,reason:string){
 const f=w.factions.find(f=>f.id===id)!;
 if((f.protectionUntil??0)>w.time){f.protectionUntil=w.time;f.protectionEnded={at:w.time,reason};}
 // Developer shield has its own lifetime and is never a way to restore beginner protection.
 if(id===w.playerFactionId&&w.developer?.shieldUntil!==undefined)w.developer.shieldUntil=Math.min(w.developer.shieldUntil,w.time);
}
export function protectionNotice(before:FormalWorld,after:FormalWorld,id:FactionId):FormalReport[]{
 const old=before.factions.find(f=>f.id===id),f=after.factions.find(f=>f.id===id);
 if(!f?.protectionEnded||old?.protectionEnded?.at===f.protectionEnded.at&&old?.protectionEnded?.reason===f.protectionEnded.reason)return[];
 const sequence=after.sequences.report++;
 return[{id:reportId(sequenceKey(sequence)),sequence,campaignId:after.campaignId,ownerFactionId:id,at:after.time,category:'system',title:(f.protectionKind==='rebirth'?'復國':'新手')+'保護提前解除',text:f.protectionEnded.reason+'。撤軍、取消或重新載入不會恢復保護。'}];
}
