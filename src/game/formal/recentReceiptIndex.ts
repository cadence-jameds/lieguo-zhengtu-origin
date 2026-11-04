import type {CommandReceipt} from './model';
import {digest} from './canonical';
import {exactDataEqual} from './jsonDataEqual';
/** A bounded recent receipt index. Unlike the retired immutable command ledger,
 * each version is a complete small window, never a chain of all past commands. */
const FORMAT='formal-recent-receipts-v1',ZERO='0'.repeat(64),LIMIT=2048;
type Manifest={format:typeof FORMAT;campaignId:string;ledgerVersion:number;worldRevision:number;branch:number;writerEpoch:number;recordCount:number;eventCount:number;segmentCount:number;lastSegmentHash:string;checksum:string};
type Segment={format:typeof FORMAT;campaignId:string;sequence:number;firstOrdinal:number;count:number;previousHash:string;events:{kind:'identity';receipt:CommandReceipt}[];checksum:string};
export type ReceiptArchive={manifest:Manifest;segments:Segment[]};
const proofKey=Symbol('verified-recent-receipts');
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function receipt(value:CommandReceipt,revision:number){if(!value||Object.getOwnPropertySymbols(value).length||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null||Object.keys(value).sort().join(',')!=='commandId,committedRevision,disposition,fingerprint,issuerId'||!/^command:[A-Za-z0-9_.-]{1,100}$/.test(value.commandId)||!/^faction:[A-Za-z0-9_.-]{1,100}$/.test(value.issuerId)||!value.fingerprint||!Number.isSafeInteger(value.committedRevision)||value.committedRevision<0||value.committedRevision>revision||!['applied','rolled-back'].includes(value.disposition))throw Error('近期命令收據損毀。');return freeze({...value});}
export class LedgerCandidate{
 #index:Map<string,CommandReceipt>;
 constructor(token:unknown,readonly manifest:Manifest,readonly segments:Segment[],records:CommandReceipt[]){if(token!==proofKey)throw Error('近期結果索引尚未驗證。');this.#index=new Map(records.map(r=>[r.commandId,r]));freeze(manifest);freeze(segments);Object.freeze(this);}
 lookup(campaignId:string,id:string){if(campaignId!==this.manifest.campaignId)throw Error('戰役身份不一致。');return this.#index.get(id);}
 archive():ReceiptArchive{return structuredClone({manifest:this.manifest,segments:this.segments});}
}
export async function emptyLedger(campaignId:string){return build(campaignId,[],0,0,0,0);}
async function build(campaignId:string,records:CommandReceipt[],worldRevision:number,branch:number,writerEpoch:number,version:number){
 if(!/^campaign:[A-Za-z0-9_.-]{1,100}$/.test(campaignId)||![worldRevision,branch,writerEpoch,version].every(n=>Number.isSafeInteger(n)&&n>=0)||records.length>LIMIT)throw Error('近期結果版本或容量無效。');
 const seen=new Set<string>(),owned=records.map(r=>{const out=receipt(r,worldRevision);if(seen.has(r.commandId))throw Error('近期收據身份重複。');seen.add(r.commandId);return out;}),segments:Segment[]=[];let previousHash=ZERO;
 for(let i=0;i<owned.length;i+=128){const events=owned.slice(i,i+128).map(receipt=>({kind:'identity' as const,receipt})),body={format:FORMAT as typeof FORMAT,campaignId,sequence:segments.length+1,firstOrdinal:i+1,count:events.length,previousHash,events},s={...body,checksum:await digest(body)};segments.push(s);previousHash=s.checksum;}
 const body={format:FORMAT as typeof FORMAT,campaignId,ledgerVersion:version,worldRevision,branch,writerEpoch,recordCount:owned.length,eventCount:owned.length,segmentCount:segments.length,lastSegmentHash:previousHash},manifest={...body,checksum:await digest(body)};return new LedgerCandidate(proofKey,manifest,segments,owned);
}
export async function prepareLedger(base:LedgerCandidate,rows:readonly CommandReceipt[],options:{worldRevision:number;branch:number;writerEpoch:number;recovery?:boolean}){
 if(rows.length>LIMIT)throw Error('近期結果窗口超出容量。');return build(base.manifest.campaignId,[...rows],options.worldRevision,options.branch,options.writerEpoch,base.manifest.ledgerVersion+1);
}
export async function verifyLedger(value:ReceiptArchive){
 if(!value||Object.keys(value).sort().join(',')!=='manifest,segments'||!value.manifest||!Array.isArray(value.segments)||value.segments.length>16)throw Error('近期收據封裝無效。');
 const m=value.manifest,rows=value.segments.flatMap(s=>s.events?.map((e:Segment['events'][number])=>{if(e.kind!=='identity'||Object.keys(e).sort().join(',')!=='kind,receipt')throw Error('近期收據事件無效。');return e.receipt;})??[]);
 const rebuilt=await build(m.campaignId,rows,m.worldRevision,m.branch,m.writerEpoch,m.ledgerVersion);
 if(!exactDataEqual(rebuilt.archive(),value))throw Error('近期收據區段或 Manifest 檢查碼不符。');return rebuilt;
}
