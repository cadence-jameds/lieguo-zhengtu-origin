// Validation server only: source remains byte-identical on disk. Inclusive times
// overlap; never sum nested phases or call fake-indexeddb a native measurement.
import ts from 'typescript';
const phases={
 'src/game/persistence.ts':['pruneRetainedStorage','commit','loadAnchored','checkpoint','switchInbox','projectInbox','advanceOtherLedgers','restoreValidatedCheckpoint','importSave','exportStoredSave','receiveCommand','finishCommand','commandStatus'],
 'src/game/ledgerStore.ts':['archiveFromBundle','readLedgerArchive','readLedger','writeLedger','publishLedgerHead'],
 'src/game/formal/commandLedger.ts':['prepareVerifiedLedger','verifyLedgerArchive'],
 'src/game/formal/saveCodec.ts':['encodeSave','decodeSave','sealTransport'],
 'src/game/formal/schema.ts':['validateFormalWorld'],
 'src/game/formal/canonical.ts':['digest'],
 'src/game/formal/recentReceiptIndex.ts':['build','verifyLedger','prepareLedger']
};
export function persistenceProfilePlugin(){return {name:'validation-persistence-profile',enforce:'pre',transform(source,id){
 const path=Object.keys(phases).find(p=>id.endsWith('/'+p));if(!path)return;
 const file=ts.createSourceFile(id,source,ts.ScriptTarget.Latest,true),edits=[];
 function visit(n){
 if(process.env.B10_FINE_PROFILE==='1'&&ts.isCallExpression(n)){
  const expression=n.expression.getText(file),json=['src/game/persistence.ts','src/game/formal/saveCodec.ts'].includes(path),label=expression==='structuredClone'?'clone.explicit':json&&expression==='JSON.parse'?'json.parse':json&&expression==='JSON.stringify'?'json.encode':json&&expression==='new TextEncoder().encode'?'utf8.encode':expression==='crypto.subtle.digest'?'crypto.sha256':undefined;
  if(label){const async=label==='crypto.sha256';edits.push([n.getStart(file),`(${async?'async ':''}()=>{const __fineStart=performance.now();try{return ${async?'await ':''}`],[n.end,`;}finally{globalThis.__persistenceProfileRecord?.(${JSON.stringify(label)},performance.now()-__fineStart);}})()`]);}
 }
 if((ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n))&&n.body&&n.name&&phases[path].includes(n.name.getText(file))){
  const label=path.split('/').at(-1)+':'+n.name.getText(file),start=n.body.getStart(file)+1,end=n.body.end-1;
  const async=n.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword);
  edits.push([start,`const __profileStart=performance.now();try{return ${async?'await (async':'('}()=>{`],[end,`})();}finally{globalThis.__persistenceProfileRecord?.(${JSON.stringify(label)},performance.now()-__profileStart);}`]);
 }ts.forEachChild(n,visit);}visit(file);let result=source;for(const [at,text]of edits.sort((a,b)=>b[0]-a[0]))result=result.slice(0,at)+text+result.slice(at);return {code:result,map:null};
 }};}
