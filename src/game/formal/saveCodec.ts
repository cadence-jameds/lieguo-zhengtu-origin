import {reconcileExileSites} from './extinction';
import {sanitizeScoutReport} from './reportScope';
import {migrateBattleProgress} from './battleProgress';
import {migrateMountains} from './mountains';
import {z} from 'zod';
import {digest} from './canonical';
import type {FormalReport,FormalWorld} from './model';
import {metadataSchema,reportSchema,validateFormalWorld} from './schema';
import {FORMAL_SAVE_FORMAT} from './versions';
import {migrateColonizationUnits} from './settlement';
import {migrateCombatB5} from './migrationB5';
export type FormalEnvelope={format:typeof FORMAL_SAVE_FORMAT;metadata:FormalWorld['metadata'];checksum:string;snapshot:FormalWorld;reports?:FormalReport[];reportChecksum?:string};
const envelopeShape=z.object({format:z.literal(FORMAL_SAVE_FORMAT),metadata:metadataSchema,checksum:z.string().regex(/^[0-9a-f]{64}$/),snapshot:z.unknown(),reports:z.array(reportSchema).optional(),reportChecksum:z.string().regex(/^[0-9a-f]{64}$/).optional()}).strict();
export async function encodeSave(world:FormalWorld,reports?:readonly FormalReport[]):Promise<FormalEnvelope>{
 const snapshot=validateFormalWorld(world),metadata={...snapshot.metadata};
 const e:FormalEnvelope={format:FORMAL_SAVE_FORMAT,metadata,checksum:await digest(snapshot),snapshot};
 if(reports!==undefined){e.reports=reports.map(r=>reportSchema.parse(r));validateReportHistory(snapshot,e.reports);e.reportChecksum=await digest(e.reports);}
 return e;
}
export function validateReportHistory(w:FormalWorld,reports:readonly FormalReport[]){
 const ids=new Set<string>(),sequences=new Set<number>();
 for(const r of reports){if(r.battle&&(!w.combat?.receipts.some(x=>x.battleId===r.battle!.battleId&&x.resolutionId===r.battle!.resolutionId&&x.kind!=='round')||r.battle.resolvedAt>r.at||r.battle.intel&&r.battle.intel.observedAt>r.at))throw new Error('戰報缺少對應戰鬥結算收據。');if(ids.has(r.id)||sequences.has(r.sequence)||r.campaignId!==w.campaignId||r.sequence>=w.sequences.report||r.at>w.time||!w.factions.some(f=>f.id===r.ownerFactionId))throw new Error('戰報與世界快照不一致。');ids.add(r.id);sequences.add(r.sequence);}
}
export async function decodeSave(value:unknown):Promise<{world:FormalWorld;reports:FormalReport[]|undefined}>{
 // Reject DEMO before checksums or access to any database; never invoke legacy validators.
 const p=envelopeShape.safeParse(value);if(!p.success)throw new Error('只接受正式版存檔；DEMO 或不相容格式不會被載入。');
 const e=p.data,w=validateFormalWorld(e.snapshot);
 if(JSON.stringify(e.metadata)!==JSON.stringify(w.metadata)){
  for(const key of Object.keys(w.metadata) as (keyof typeof w.metadata)[])if(e.metadata[key]!==w.metadata[key])throw new Error('存檔版本 metadata 不一致。');
 }
 if(await digest(w)!==e.checksum)throw new Error('正式存檔檢查碼不符。');
 if(e.reports===undefined){if(e.reportChecksum!==undefined)throw new Error('缺少完整備份戰報。');}
 else{if(await digest(e.reports)!==e.reportChecksum)throw new Error('戰報檢查碼不符。');validateReportHistory(w,e.reports);}
 return{world:validateFormalWorld(reconcileExileSites(migrateBattleProgress(migrateMountains(migrateCombatB5(migrateColonizationUnits(w)))))),reports:e.reports?.map(r=>sanitizeScoutReport(w,r))};
}
