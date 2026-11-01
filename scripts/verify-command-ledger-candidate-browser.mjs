// Native IndexedDB laboratory, not a FormalPersistence/Runtime acceptance test.
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 await page.route('**/r303-candidate-lab.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic ledger laboratory</title>'}));
 await page.goto((process.env.LAB_ORIGIN??'http://127.0.0.1:5173')+'/r303-candidate-lab.html');
 const evidence=await page.evaluate(async()=>{
  const {emptyLedger,prepareLedger}=await import('/scripts/command-ledger-candidate.mjs');
  const {candidateDatabase,publishCandidate,readCandidate,readHistoricalCandidate}=await import('/scripts/command-ledger-candidate-store.mjs');
  const results=[],campaign='campaign:native-lab',receipt={commandId:'command:native',issuerId:'faction:000',fingerprint:'synthetic-native-evidence',committedRevision:1,disposition:'applied'};
  const check=(ok,label)=>{if(!ok)throw Error(label);results.push(label);};
  for(const point of ['segment-write','index-write','manifest-write','marker-write','head-write']){
   const db=candidateDatabase('synthetic-ledger-r303-'+crypto.randomUUID());
   try{const base=await emptyLedger(campaign),next=await prepareLedger(base,[receipt],{worldRevision:1});let rejected=false;
    try{await publishCandidate(db,next,base.manifest.checksum,{fault:p=>{if(p===point)throw new DOMException('Injected native transaction failure','QuotaExceededError');}});}catch(e){rejected=e.name==='QuotaExceededError';}
    check(rejected,'injected '+point+' rejects');
    check((await Promise.all(db.tables.map(t=>t.count()))).every(n=>n===0),'native abort leaves all tables empty: '+point);
   }finally{await db.delete();}
  }
  const name='synthetic-ledger-r303-'+crypto.randomUUID();let db=candidateDatabase(name);
  try{
   const base=await emptyLedger(campaign),a=await prepareLedger(base,[receipt],{worldRevision:1,writerEpoch:1});await publishCandidate(db,a,base.manifest.checksum);db.close();db=candidateDatabase(name);
   check((await readCandidate(db,campaign)).lookup(campaign,receipt.commandId)?.fingerprint===receipt.fingerprint,'close/reopen retains identity');
   check((await publishCandidate(db,a,base.manifest.checksum)).duplicate,'lost notification resend is idempotent');
   const stale=await prepareLedger(base,[{...receipt,commandId:'command:stale'}],{worldRevision:1});let rejected=false;try{await publishCandidate(db,stale,base.manifest.checksum);}catch{rejected=true;}check(rejected,'stale root CAS rejects');
   const fork=await prepareLedger(stale,[{...receipt,commandId:'command:fork',committedRevision:2}],{worldRevision:2,writerEpoch:1});rejected=false;try{await publishCandidate(db,fork,a.manifest.checksum);}catch{rejected=true;}check(rejected,'verified divergent prefix rejects despite matching version and caller CAS');
   const b=await prepareLedger(a,[{...receipt,disposition:'rolled-back'}],{worldRevision:2,branch:1,writerEpoch:1,recovery:true});await publishCandidate(db,b,a.manifest.checksum);
   check((await readCandidate(db,campaign)).lookup(campaign,receipt.commandId)?.disposition==='rolled-back','current projection follows Recovery candidate');
   check((await readHistoricalCandidate(db,campaign,1)).lookup(campaign,receipt.commandId)?.disposition==='applied','historic root retains original projection');
   await db.table('segments').delete([campaign,1]);rejected=false;try{await readCandidate(db,campaign);}catch{rejected=true;}check(rejected,'missing segment rejects');
  }finally{await db.delete();}
  let rejected=false;try{candidateDatabase('lieguo-formal');}catch{rejected=true;}check(rejected,'production namespace is blocked');
  return {scope:'Inactive synthetic candidate only; not Formal T2, Runtime Worker, migration or real quota exhaustion',nativeIndexedDB:typeof indexedDB.open==='function',checks:results};
 });
 const report={chromium:browser.version(),timestamp:new Date().toISOString(),...evidence};
 await fs.mkdir('artifacts/b10-r3-03',{recursive:true});await fs.writeFile('artifacts/b10-r3-03/native-candidate.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
