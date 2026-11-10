import type {CommandReceipt} from '../src/game/formal/model';
export interface Manifest {format:string;campaignId:string;ledgerVersion:number;worldRevision:number;branch:number;writerEpoch:number;recordCount:number;eventCount:number;segmentCount:number;lastSegmentHash:string;checksum:string}
export class LedgerCandidate {readonly manifest:Readonly<Manifest>;readonly segments:readonly any[];readonly touched:readonly CommandReceipt[];lookup(campaignId:string,commandId:string):Readonly<CommandReceipt>|undefined;archive():any}
export function emptyLedger(campaignId:string):Promise<LedgerCandidate>;
export function prepareLedger(base:LedgerCandidate,receipts:readonly CommandReceipt[],options:{worldRevision:number;branch?:number;writerEpoch?:number;expectedRoot?:string;recovery?:boolean}):Promise<LedgerCandidate>;
export function verifyLedger(value:unknown):Promise<LedgerCandidate>;
export function hash(value:unknown):Promise<string>;
export function canonical(value:unknown):string;
export function assertFormalActivationSupported():never;
export const FORMAL_ACTIVATION_BLOCKED:string;
export const candidateLimits:Readonly<{recordsPerSegment:number;targetBytesPerSegment:number;oversizedRecord:string;activation:string}>;
