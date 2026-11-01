/** R3-03 inactive candidate. No Runtime, FormalDatabase, save migration or game authority imports. */
const FORMAT='command-ledger-candidate-v1', ZERO='0'.repeat(64), LIMIT=128, BYTES=256*1024;
const token=Symbol('verified-candidate'), roots=new WeakMap();
export const FORMAL_ACTIVATION_BLOCKED='BLOCKED: verified history binding, versioned outcomes/Recovery and portable Inbox evidence are not wired to Formal Runtime';
export function assertFormalActivationSupported(){throw new Error(FORMAL_ACTIVATION_BLOCKED);}
export function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
export async function hash(v){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(v))))].map(x=>x.toString(16).padStart(2,'0')).join('');}
const copy=v=>JSON.parse(JSON.stringify(v));
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const integer=v=>Number.isSafeInteger(v)&&v>=0;
function require(ok,message){if(!ok)throw Error(message);}
function identity(r){require(r&&/^command:[A-Za-z0-9_.-]{1,100}$/.test(r.commandId)&&/^faction:[A-Za-z0-9_.-]{1,100}$/.test(r.issuerId)&&typeof r.fingerprint==='string'&&r.fingerprint.length>0,'Invalid identity');require(integer(r.committedRevision)&&['applied','rolled-back'].includes(r.disposition),'Invalid receipt');require(Object.keys(r).sort().join(',')==='commandId,committedRevision,disposition,fingerprint,issuerId','Unknown receipt fields');return freeze(copy(r));}
// Persistent AVL: appending k identities copies O(k log n) index nodes, never rebuilds n entries.
const height=n=>n?.height??0;
function node(key,value,left=null,right=null){return {key,value,left,right,height:1+Math.max(height(left),height(right))};}
function rotateLeft(n){const r=n.right;return node(r.key,r.value,node(n.key,n.value,n.left,r.left),r.right);}
function rotateRight(n){const l=n.left;return node(l.key,l.value,l.left,node(n.key,n.value,l.right,n.right));}
function set(n,key,value){if(!n)return node(key,value);let r=key===n.key?node(key,value,n.left,n.right):key<n.key?node(n.key,n.value,set(n.left,key,value),n.right):node(n.key,n.value,n.left,set(n.right,key,value));const d=height(r.left)-height(r.right);if(d>1){if(key>r.left.key)r=node(r.key,r.value,rotateLeft(r.left),r.right);return rotateRight(r);}if(d< -1){if(key<r.right.key)r=node(r.key,r.value,r.left,rotateRight(r.right));return rotateLeft(r);}return r;}
function get(n,key){while(n){if(key===n.key)return n.value;n=key<n.key?n.left:n.right;}return undefined;}
function match(a,b){return a.issuerId===b.issuerId&&a.fingerprint===b.fingerprint&&a.committedRevision===b.committedRevision;}
export class LedgerCandidate{
 constructor(t,manifest,segments,index,touched){require(t===token,'Unverified ledger');this.manifest=freeze(manifest);this.segments=Object.freeze(segments);this.touched=Object.freeze(touched);roots.set(this,index);Object.freeze(this);}
 lookup(campaignId,commandId){require(campaignId===this.manifest.campaignId,'Campaign mismatch');return get(roots.get(this),commandId);}
 archive(){return {manifest:copy(this.manifest),segments:copy(this.segments)};}
}
export async function emptyLedger(campaignId){require(/^campaign:[A-Za-z0-9_.-]{1,100}$/.test(campaignId),'Invalid campaign');const m={format:FORMAT,campaignId,ledgerVersion:0,worldRevision:0,branch:0,writerEpoch:0,recordCount:0,eventCount:0,segmentCount:0,lastSegmentHash:ZERO};return new LedgerCandidate(token,{...m,checksum:await hash(m)},[],null,[]);}
/** Candidate only. Returned data is not committed and cannot enable the formal format. */
export async function prepareLedger(base,receipts,{worldRevision,branch=base.manifest.branch,writerEpoch=base.manifest.writerEpoch,expectedRoot=base.manifest.checksum,recovery=false}={}){
 require(base instanceof LedgerCandidate&&expectedRoot===base.manifest.checksum,'Ledger CAS conflict');require(integer(worldRevision)&&worldRevision>=base.manifest.worldRevision&&integer(branch)&&integer(writerEpoch)&&writerEpoch>=base.manifest.writerEpoch,'Invalid version');require(recovery?branch>base.manifest.branch:branch===base.manifest.branch,'Branch transition must be explicit');
 let index=roots.get(base),count=base.manifest.recordCount;const events=[],touched=[];
 for(const raw of receipts){const r=identity(raw);require(r.committedRevision<=worldRevision,'Receipt beyond world revision');const old=get(index,r.commandId);if(old){require(match(old,r),'CommandId identity conflict');if(old.disposition===r.disposition)continue;require(recovery,'Disposition change requires Recovery');events.push({kind:'disposition',receipt:r});}else{events.push({kind:'identity',receipt:r});count++;}index=set(index,r.commandId,r);touched.push(r);}
 if(!events.length&&branch===base.manifest.branch&&writerEpoch===base.manifest.writerEpoch)return base;
 const segments=base.segments.slice();let previousHash=base.manifest.lastSegmentHash,ordinal=base.manifest.eventCount,batch=[],bytes=0;
 const flush=async()=>{if(!batch.length)return;const body={format:FORMAT,campaignId:base.manifest.campaignId,sequence:segments.length+1,firstOrdinal:ordinal+1,count:batch.length,previousHash,events:batch};const segment=freeze({...body,checksum:await hash(body)});segments.push(segment);ordinal+=batch.length;previousHash=segment.checksum;batch=[];bytes=0;};
 for(const e of events){const n=new TextEncoder().encode(canonical(e)).length;if(batch.length&&(batch.length===LIMIT||bytes+n>BYTES))await flush();batch.push(e);bytes+=n;}await flush();
 const body={format:FORMAT,campaignId:base.manifest.campaignId,ledgerVersion:base.manifest.ledgerVersion+1,worldRevision,branch,writerEpoch,recordCount:count,eventCount:ordinal,segmentCount:segments.length,lastSegmentHash:previousHash};return new LedgerCandidate(token,{...body,checksum:await hash(body)},segments,index,touched);
}
export async function verifyLedger(value){
 require(value&&Object.keys(value).sort().join(',')==='manifest,segments','Invalid archive');const {manifest:m,segments}=value;require(m&&Object.keys(m).sort().join(',')==='branch,campaignId,checksum,eventCount,format,lastSegmentHash,ledgerVersion,recordCount,segmentCount,worldRevision,writerEpoch','Unknown manifest fields');require(m?.format===FORMAT&&Array.isArray(segments)&&segments.length===m.segmentCount,'Incomplete manifest');const {checksum,...body}=m;require(await hash(body)===checksum,'Manifest checksum mismatch');require(/^campaign:[A-Za-z0-9_.-]{1,100}$/.test(m.campaignId)&&[m.ledgerVersion,m.worldRevision,m.branch,m.writerEpoch,m.recordCount,m.eventCount,m.segmentCount].every(integer),'Invalid manifest version');
 require(m.ledgerVersion!==0||(m.segmentCount===0&&m.recordCount===0&&m.eventCount===0&&m.worldRevision===0&&m.branch===0&&m.writerEpoch===0),'Invalid empty root');
 let previous=ZERO,ordinal=0,index=null,count=0;
 for(let i=0;i<segments.length;i++){const s=segments[i],{checksum:sum,...data}=s;require(Object.keys(s).sort().join(',')==='campaignId,checksum,count,events,firstOrdinal,format,previousHash,sequence','Unknown segment fields');require(s.format===FORMAT&&s.campaignId===m.campaignId&&s.sequence===i+1&&s.firstOrdinal===ordinal+1&&s.count===s.events?.length&&s.count>0&&s.count<=LIMIT&&s.previousHash===previous,'Segment reference/order invalid');require(await hash(data)===sum,'Segment checksum mismatch');require(s.count===1||s.events.reduce((n,e)=>n+new TextEncoder().encode(canonical(e)).length,0)<=BYTES,'Segment byte bound exceeded');for(const e of s.events){require(Object.keys(e).sort().join(',')==='kind,receipt','Unknown event fields');const r=identity(e.receipt),old=get(index,r.commandId);require(r.committedRevision<=m.worldRevision,'Future revision');if(e.kind==='identity'){require(!old,'Duplicate identity event');count++;}else{require(e.kind==='disposition'&&old&&match(old,r)&&old.disposition!==r.disposition,'Invalid disposition evidence');}index=set(index,r.commandId,r);}ordinal+=s.count;previous=sum;}
 require(count===m.recordCount&&ordinal===m.eventCount&&previous===m.lastSegmentHash,'Manifest coverage mismatch');return new LedgerCandidate(token,copy(m),freeze(copy(segments)),index,[]);
}
export const candidateLimits=Object.freeze({recordsPerSegment:LIMIT,targetBytesPerSegment:BYTES,oversizedRecord:'one indivisible record; never truncate fingerprint',activation:'blocked'});
