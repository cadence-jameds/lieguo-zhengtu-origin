import {bindLedger,emptyVerifiedLedger,prepareVerifiedLedger,resolveLedger,verifyLedgerArchive,commandHistory,useLedgerProof,VerifiedLedger,type LedgerArchive} from './commandLedger';
import {resultFromReceipt,archiveFromBundle,type LedgerBundle} from '../ledgerStore';
import type {InboxCommand} from '../durableCommands';
import {reconcileExileSites,worldPaused} from './extinction';
import {sanitizeSharedKnowledge,sanitizeScoutReport} from './reportScope';
import {z} from 'zod';
import {digest} from './canonical';
import type {FormalReport,FormalWorld} from './model';
import {metadataSchema,reportSchema,validateFormalWorld} from './schema';
import {FORMAL_SAVE_FORMAT,FORMAL_CONTENT_VERSION,NATIVE_CONTENT_VERSION,NATIVE_RULESET_VERSION,NATIVE_TERRAIN_VERSION} from './versions';
export const OLD_CAMPAIGN_MESSAGE='只接受新版正式命令帳本；舊版測試存檔（含 DEMO）不相容，請重新建立戰役。原資料保留，不會自動轉換或覆寫。';
export function assertCampaignCompatibility(value:unknown){
 if(value&&typeof value==='object'){const e=value as {format?:unknown;metadata?:{contentVersion?:unknown;rulesetVersion?:unknown;terrainVersion?:unknown}};if(typeof e.format==='string'&&e.format!==FORMAL_SAVE_FORMAT||e.format===FORMAL_SAVE_FORMAT&&e.metadata&&typeof e.metadata.contentVersion==='string'&&![FORMAL_CONTENT_VERSION,NATIVE_CONTENT_VERSION].includes(e.metadata.contentVersion as typeof FORMAL_CONTENT_VERSION)||e.format===FORMAL_SAVE_FORMAT&&e.metadata?.contentVersion===NATIVE_CONTENT_VERSION&&(e.metadata.rulesetVersion!==NATIVE_RULESET_VERSION||e.metadata.terrainVersion!==NATIVE_TERRAIN_VERSION))throw new Error(OLD_CAMPAIGN_MESSAGE);}
}

export type FormalSnapshotEnvelope={format:typeof FORMAL_SAVE_FORMAT;metadata:FormalWorld['metadata'];checksum:string;snapshot:FormalWorld;reports?:FormalReport[];reportChecksum?:string;ledger?:LedgerArchive;bundle?:LedgerBundle;transportChecksum?:string};
export type FormalEnvelope=FormalSnapshotEnvelope&{inbox?:InboxCommand[];recovery?:{at:number;label:string;data:FormalSnapshotEnvelope}[];growthAuthority?:{campaignId:string;growthTasks?:import('./growthTasks').GrowthTaskState}[]};
const envelopeShape=z.object({format:z.literal(FORMAL_SAVE_FORMAT),metadata:metadataSchema,checksum:z.string().regex(/^[0-9a-f]{64}$/),snapshot:z.unknown(),reports:z.array(reportSchema).optional(),reportChecksum:z.string().regex(/^[0-9a-f]{64}$/).optional(),ledger:z.unknown().optional(),bundle:z.unknown().optional(),inbox:z.array(z.unknown()).optional(),recovery:z.array(z.object({at:z.number().int().nonnegative(),label:z.string(),data:z.unknown()}).strict()).max(2).optional(),growthAuthority:z.array(z.unknown()).optional(),transportChecksum:z.string().optional()}).strict();
export async function encodeSave(world:FormalWorld,reports?:readonly FormalReport[],portable=true):Promise<FormalEnvelope>{
 assertCampaignCompatibility({format:FORMAL_SAVE_FORMAT,metadata:world.metadata});
 if(world.clockMode==='offline'&&!worldPaused(world))throw new Error('離線推進尚未完成，不可保存草稿。');
 // A validated extinction barrier is a completed replay, not an in-flight offline draft.
 let snapshot=validateFormalWorld(world);if(!snapshot.ledger){const rows=Array.from(commandHistory(snapshot)),base=await emptyVerifiedLedger(snapshot.campaignId);snapshot=bindLedger(snapshot,await prepareVerifiedLedger(base,rows,rows.map(resultFromReceipt),snapshot.revision,0,0));}if(snapshot.ledger!.anchor.worldRevision!==snapshot.revision||snapshot.ledger!.pending.length||snapshot.ledger!.outcomes?.length)throw Error('不可匯出尚未提交的帳本草稿。');const metadata={...snapshot.metadata};
 const e:FormalEnvelope={format:FORMAL_SAVE_FORMAT,metadata,checksum:await digest(snapshot),snapshot};
 if(reports!==undefined){e.reports=reports.map(r=>reportSchema.parse(r));validateReportHistory(snapshot,e.reports);e.reportChecksum=await digest(e.reports);}
 if(portable){e.ledger=resolveLedger(snapshot.ledger!).archive();await sealTransport(e);}
 return e;
}
export function validateReportHistory(w:FormalWorld,reports:readonly FormalReport[]){
 const ids=new Set<string>(),sequences=new Set<number>();
 for(const r of reports){if(r.battle&&(!w.combat?.receipts.some(x=>x.battleId===r.battle!.battleId&&x.resolutionId===r.battle!.resolutionId&&x.kind!=='round')||r.battle.resolvedAt>r.at||r.battle.intel&&r.battle.intel.observedAt>r.at))throw new Error('戰報缺少對應戰鬥結算收據。');if(ids.has(r.id)||sequences.has(r.sequence)||r.campaignId!==w.campaignId||r.sequence>=w.sequences.report||r.at>w.time||!w.factions.some(f=>f.id===r.ownerFactionId))throw new Error('戰報與世界快照不一致。');ids.add(r.id);sequences.add(r.sequence);}
}
export async function decodeSave(value:unknown,external?:LedgerArchive|VerifiedLedger):Promise<{world:FormalWorld;reports:FormalReport[]|undefined;envelope:FormalEnvelope;proof:VerifiedLedger}>{
 assertCampaignCompatibility(value);
 // Reject DEMO before checksums or access to any database; never invoke legacy validators.
 const p=envelopeShape.safeParse(value);if(!p.success)throw new Error('只接受正式版存檔；DEMO 或不相容格式不會被載入。');
 const e=p.data as FormalEnvelope;if(e.ledger!==undefined||e.bundle!==undefined){if(await digest(transport(e))!==e.transportChecksum)throw Error('完整帳本與收件匣檢查碼不符。');}else if(!external)throw Error('新版存檔缺少完整命令帳本。');const portable=e.bundle?archiveFromBundle(e.bundle,(e.snapshot as FormalWorld).campaignId,(e.snapshot as FormalWorld).ledger!.anchor.root):e.ledger;let ledger:VerifiedLedger;if(portable!==undefined){ledger=await verifyLedgerArchive(portable);}else if(external instanceof VerifiedLedger){useLedgerProof(external);ledger=external;}else ledger=await verifyLedgerArchive(external!);const w=validateFormalWorld(e.snapshot,ledger);if(!w.ledger||w.ledger.anchor.root!==ledger.manifest.checksum||w.ledger.pending.length||w.ledger.outcomes?.length||w.ledger.anchor.worldRevision!==w.revision)throw Error('存檔與帳本版本綁定不符。');
 if(w.clockMode==='offline'&&!worldPaused(w))throw new Error('離線推進草稿不能作為正式存檔載入。');
 if(JSON.stringify(e.metadata)!==JSON.stringify(w.metadata)){
  for(const key of Object.keys(w.metadata) as (keyof typeof w.metadata)[])if(e.metadata[key]!==w.metadata[key])throw new Error('存檔版本 metadata 不一致。');
 }
 if(await digest(w)!==e.checksum)throw new Error('正式存檔檢查碼不符。');
 if(e.reports===undefined){if(e.reportChecksum!==undefined)throw new Error('缺少完整備份戰報。');}
 else{if(await digest(e.reports)!==e.reportChecksum)throw new Error('戰報檢查碼不符。');validateReportHistory(w,e.reports);}
 return{world:validateFormalWorld(sanitizeSharedKnowledge(reconcileExileSites(w))),reports:e.reports?.map(r=>sanitizeScoutReport(w,r)),envelope:e,proof:ledger};
}

function transport(e:FormalEnvelope){return {ledger:e.ledger,bundle:e.bundle,inbox:e.inbox,recovery:e.recovery,growthAuthority:e.growthAuthority};}
export async function sealTransport(e:FormalEnvelope){e.transportChecksum=await digest(transport(e));return e;}
