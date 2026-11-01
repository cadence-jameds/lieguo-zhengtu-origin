import type Dexie from 'dexie';
import type {LedgerCandidate,Manifest} from './command-ledger-candidate.mjs';
export function candidateDatabase(name:string):Dexie;
export function readCandidate(db:Dexie,campaignId:string):Promise<LedgerCandidate>;
export function publishCandidate(db:Dexie,candidate:LedgerCandidate,expectedRoot:string,options?:{fault?:(point:string)=>void}):Promise<{duplicate:boolean;manifest:Readonly<Manifest>}>;
export function readHistoricalCandidate(db:Dexie,campaignId:string,ledgerVersion:number):Promise<LedgerCandidate>;
