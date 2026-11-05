// Diagnostic transforms only; original reducer/test bytes and deadlines stay intact.
import ts from 'typescript';
const names={
 'breakthroughTestSupport.ts':['fundedBreakthroughSnapshot','completedWonder','breakthroughWorld','fundTrip'],
 'wonderTestSupport.ts':['fundWonder','wonderWorld'],
 'reducer.ts':['submitFormalOrder','advanceFormal','replayClonePolicy'],
 'worldDraft.ts':['cloneWorldDraft'],
 'schema.ts':['validateFormalWorld'],
 'commandEvidence.ts':['pruneCommandEvidence','ensureCommandFacts'],
 'ledgerTestSupport.ts':['scenarioBinding','encodeScenario'],
 'commandLedger.ts':['prepareVerifiedLedger','verifyLedgerArchive'],
 'saveCodec.ts':['encodeSave','decodeSave']
};
export function b9ProfilePlugin(){return{name:'b9-validation-profile',enforce:'pre',transform(source,id){const path=Object.keys(names).find(p=>id.endsWith('/src/game/formal/'+p));if(!path)return;const file=ts.createSourceFile(id,source,ts.ScriptTarget.Latest,true),edits=[];function visit(n){if(ts.isFunctionDeclaration(n)&&n.body&&n.name&&names[path].includes(n.name.text)){const name=n.name.text,label=path+':'+name,async=n.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword),hook=name==='fundedBreakthroughSnapshot',progress=name==='fundTrip';edits.push([n.body.getStart(file)+1,`const __b9Token=globalThis.__b9Enter?.(${JSON.stringify(label)});try{return ${async?'await (async':'('}()=>{`],[n.body.end-1,`})();}finally{globalThis.__b9Exit?.(__b9Token);${progress?'globalThis.__b9Progress?.(w);':''}${hook?'await globalThis.__b9Finish?.("hook-returned");':''}}`]);}ts.forEachChild(n,visit);}visit(file);let code=source;for(const[at,text]of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,at)+text+code.slice(at);return{code,map:null};}};}
