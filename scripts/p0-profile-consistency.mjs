import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const source=path.resolve(process.env.P0_SOURCE_DIR??path.join(process.cwd(),'artifacts/p0/event-only'));
const savePath=process.env.P0_SAVE_PATH;
if(!savePath)throw new Error('P0_SAVE_PATH is required.');
const out=path.resolve(process.env.P0_RESULTS_DIR??path.join(process.cwd(),'artifacts/p0/results'));
fs.mkdirSync(out,{recursive:true,mode:0o700});
const hours=Number(process.env.P0_HOURS??6),speed=Number(process.env.P0_SPEED??10);
if(![0,0.1,0.25,1,6,24].includes(hours)||![1,10,50].includes(speed))throw new Error('Unsupported benchmark duration/speed.');
const label=process.env.P0_LABEL??`private-${hours}h-${speed}x-consistency`;
if(!/^[A-Za-z0-9_.-]+$/.test(label))throw new Error('Invalid P0_LABEL.');
const sourceMetadata=JSON.parse(fs.readFileSync(path.join(source,'source-metadata.json'),'utf8'));
if(sourceMetadata.instrumented||!sourceMetadata.recordEvents)throw new Error('Prepare with P0_INSTRUMENT=0 P0_RECORD_EVENTS=1 for consistency.');
await import(path.join(source,'node_modules/fake-indexeddb/auto/index.mjs'));
const {decodeSave,encodeSave}=await import(path.join(source,'src/game/formal/saveCodec.js'));
const {canonicalJSON}=await import(path.join(source,'src/game/formal/canonical.js'));
const {advanceFormal,advanceFormalCooperative}=await import(path.join(source,'src/game/formal/reducer.js'));
const {FormalPersistence,validateCheckpointCandidate}=await import(path.join(source,'src/game/persistence.js'));
const originalNow=Date.now,savedAt=1700000000000;
let clock=savedAt,recording=null;
Date.now=()=>clock;
const inputText=fs.readFileSync(savePath,'utf8');
const inputFileHash=createHash('sha256').update(inputText).digest('hex');
const base=await decodeSave(JSON.parse(inputText));
base.world.speed=speed;if(base.world.developer?.enabled)base.world.developer.speed=speed;
if(hours===24)base.world.offlineHours=24;
const initialHash=hash(base.world),target=base.world.time+hours*3600000*speed;
const initialReportIds=new Set((base.reports??[]).map(r=>r.id));
globalThis.__p0={recordEvent(event){if(recording){recording.digest.update(event.id+'\0'+event.type+'\0'+event.at+'\n');recording.events++;recording.types[event.type]=(recording.types[event.type]??0)+1;if(recording.events%512===0&&performance.now()-recording.lastProgressAt>=15000){recording.lastProgressAt=performance.now();console.log(JSON.stringify({progress:{strategy:recording.strategy,hours,speed,processedEvents:recording.events,elapsedMs:recording.lastProgressAt-recording.started}}));}}}};
const results=[];
for(const strategy of ['direct','cooperative','segmented','save-load']){
 const started=performance.now(),store=new FormalPersistence({suffix:`p0-consistency-${process.pid}-${strategy}`});
 clock=savedAt;
 const envelope=await encodeSave(base.world);
 await store.db.transaction('rw',store.db.saves,store.db.backups,store.db.BattleReports,async()=>{
  await store.db.saves.bulkPut([{id:'current',kind:'world',at:savedAt,data:envelope},{id:'authority',kind:'authority',revision:base.world.revision,sequences:{...base.world.sequences},campaigns:[{campaignId:base.world.campaignId,receipts:base.world.commandReceipts}]}]);
  await store.db.backups.add({at:savedAt,label:'private consistency',campaignId:base.world.campaignId,gameTime:base.world.time,reportCursor:base.world.sequences.report,data:envelope});
  if(base.reports?.length)await store.db.BattleReports.bulkPut(base.reports.map(r=>({...r,key:r.campaignId+'/'+r.id})));
 });
 let current=(await store.loadSave()).game;
 if(!current)throw new Error('Missing seeded world.');
 const segments=strategy==='segmented'?6:strategy==='save-load'?2:1;
 const revisionHistory=[],checks={inputImmutable:true,historyPreserved:true,naturalTransitionRevision:true,naturalNoopReportsEmpty:true,clockBoundaryPrivate:true,revisionsInRange:true,durableAuthority:true,monotonicSequences:true,checkpointValidity:true,presentationClock:true};
 let naturalNoops=0;
 recording={strategy,started:performance.now(),lastProgressAt:performance.now(),digest:createHash('sha256'),events:0,types:{}};
 for(let i=1;i<=segments;i++){
  const at=base.world.time+Math.floor((target-base.world.time)*i/segments),prior=current,priorHash=hash(prior);
  clock=savedAt+Math.floor((at-base.world.time)/speed);
  const transition=strategy==='cooperative'?await advanceFormalCooperative(prior,at):advanceFormal(prior,at);
  // Match loadWithOffline's durable clock boundary: a natural no-op does not
  // advance the reducer revision, but refreshing its wall anchor still commits.
  const naturalNoop=transition.world===prior;
  checks.naturalTransitionRevision&&=transition.world.revision===prior.revision+(naturalNoop?0:1);
  checks.naturalNoopReportsEmpty&&=!naturalNoop||transition.reports.length===0;
  const draft=naturalNoop?structuredClone(transition.world):transition.world;
  if(naturalNoop){draft.revision++;naturalNoops++;}
  checks.clockBoundaryPrivate&&=draft!==prior;
  checks.inputImmutable&&=hash(prior)===priorHash;
  checks.revisionsInRange&&=draft.revision===prior.revision+1&&draft.commandReceipts.every(r=>Number.isSafeInteger(r.committedRevision)&&r.committedRevision>=0&&r.committedRevision<=draft.revision);
  checks.monotonicSequences&&=['event','report','project'].every(k=>draft.sequences[k]>=prior.sequences[k]);
  current=await store.save(draft,transition.reports,prior.revision);
  const authority=await store.db.saves.get('authority'),row=await store.db.saves.get('current');
  checks.durableAuthority&&=authority.revision===current.revision&&current.revision===base.world.revision+i&&row.at===clock;
  const ledger=new Map(current.commandReceipts.map(r=>[r.commandId,r]));
  checks.historyPreserved&&=prior.commandReceipts.every(r=>{const next=ledger.get(r.commandId);return next&&next.issuerId===r.issuerId&&next.fingerprint===r.fingerprint&&next.disposition===r.disposition&&next.committedRevision===r.committedRevision;});
  revisionHistory.push({commit:i,naturalNoop,naturalRevision:transition.world.revision,worldRevision:current.revision,authorityRevision:authority.revision,commandReceipts:current.commandReceipts.length,savedAt:row.at});
  if(strategy==='save-load')current=(await store.loadSave()).game;
 }
 const eventOrderHash=recording.digest.digest('hex'),processedEvents=recording.events,eventTypeCounts=recording.types;recording=null;
 const rows=await store.db.BattleReports.toArray(),checkpoints=await store.db.backups.toArray();
 checks.presentationClock&&=rows.filter(r=>!initialReportIds.has(r.id)).every(r=>r.realAt===Math.max(0,Math.floor(savedAt+(r.at-base.world.time)/speed))&&r.clockSpeed===speed&&r.read===false);
 for(const checkpoint of checkpoints){try{await validateCheckpointCandidate(checkpoint);}catch{checks.checkpointValidity=false;}}
 const loaded=(await store.loadSave()).game;
 checks.durableAuthority&&=hash(loaded)===hash(current);
 checks.historyPreserved&&=new Set(current.commandReceipts.map(r=>r.commandId)).size===current.commandReceipts.length&&new Set(current.events.map(e=>e.id)).size===current.events.length&&new Set(current.completionReceipts.map(r=>r.eventId)).size===current.completionReceipts.length;
 const normalized=structuredClone(current);normalized.revision=0;for(const receipt of normalized.commandReceipts)receipt.committedRevision=0;
 const result={strategy,elapsedMs:performance.now()-started,segments,durableCommits:segments,naturalNoops,processedEvents,eventTypeCounts,eventOrderHash,worldHash:hash(current),normalizedGameplayHash:hash(normalized),reportsHash:hash(rows),finalRevision:current.revision,expectedFinalRevision:base.world.revision+segments,revisionHistory,checks};
 fs.writeFileSync(path.join(out,`${label}.${strategy}.world.private.json`),JSON.stringify(current),{mode:0o600});
 fs.writeFileSync(path.join(out,`${label}.${strategy}.reports.private.json`),JSON.stringify(rows),{mode:0o600});
 results.push(result);console.log(JSON.stringify({completed:result}));
 store.db.close();await store.db.delete();
}
Date.now=originalNow;
const [direct,cooperative,segmented,saveLoad]=results;
const checks={
 unchangedInitialWorld:hash(base.world)===initialHash,
 directCooperativeExactWorld:direct.worldHash===cooperative.worldHash,
 directCooperativeExactReports:direct.reportsHash===cooperative.reportsHash,
 segmentedGameplayEqual:direct.normalizedGameplayHash===segmented.normalizedGameplayHash,
 segmentedReportsExact:direct.reportsHash===segmented.reportsHash,
 saveLoadGameplayEqual:direct.normalizedGameplayHash===saveLoad.normalizedGameplayHash,
 saveLoadReportsExact:direct.reportsHash===saveLoad.reportsHash,
 eventOrderingEqual:results.every(r=>r.eventOrderHash===direct.eventOrderHash),
 eventTypeCountsEqual:results.every(r=>canonicalJSON(r.eventTypeCounts)===canonicalJSON(direct.eventTypeCounts)),
 eventCountEqual:results.every(r=>r.processedEvents===direct.processedEvents),
 internalAssertions:results.every(r=>Object.values(r.checks).every(Boolean))
};
const summary={label,source:sourceMetadata,configuration:{hours,speed,savedAt,target},input:{fileHash:inputFileHash,configuredWorldHash:initialHash},normalization:'ONLY world.revision and each commandReceipts[].committedRevision set to0 for gameplay hash; real CAS high-water values and exact history preservation separately asserted.',checks,results};
fs.writeFileSync(path.join(out,label+'.aggregate.json'),JSON.stringify(summary,null,2),{mode:0o600});
console.log(JSON.stringify({summary},null,2));if(!Object.values(checks).every(Boolean))process.exitCode=1;

function hash(value){return createHash('sha256').update(canonicalJSON(value)).digest('hex');}
