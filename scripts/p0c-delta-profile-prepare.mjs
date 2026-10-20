// Instrument an isolated, committed source snapshot. Never use these timings as uninstrumented ABBA results.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';
const [source,head,out]=process.argv.slice(2),require=createRequire(path.join(source,'package.json')),ts=require('typescript');
fs.mkdirSync(out,{recursive:true});const archive=path.join(out,'diagnostic-source.tar');execFileSync('git',['archive','--output='+archive,head,'src','public','scripts','releases','vite.config.ts','tsconfig.json','package.json','package-lock.json','index.html'],{cwd:source});execFileSync('tar',['-x','-f',archive,'-C',out]);
if(!fs.existsSync(path.join(out,'node_modules')))fs.symlinkSync(path.join(source,'node_modules'),path.join(out,'node_modules'),'dir');fs.mkdirSync(path.join(out,'.release'),{recursive:true});fs.copyFileSync(path.join(source,'.release/metadata.json'),path.join(out,'.release/metadata.json'));
const helper=`const metrics=new Map<string,{count:number,totalMs:number,maxMs:number}>();
export const begin=()=>performance.now();
export function end(key:string,start:number){const ms=performance.now()-start,v=metrics.get(key)??{count:0,totalMs:0,maxMs:0};v.count++;v.totalMs+=ms;v.maxMs=Math.max(v.maxMs,ms);metrics.set(key,v);}
export function reset(){metrics.clear();}
export const snapshot=()=>Object.fromEntries(metrics);
const clone=globalThis.structuredClone.bind(globalThis);globalThis.structuredClone=((v:unknown,o?:StructuredSerializeOptions)=>{const t=begin();try{return clone(v,o);}finally{end('global.structuredClone',t);}}) as typeof structuredClone;
for(const key of ['get','put','add'] as const){const proto=IDBObjectStore.prototype as any,native=proto[key];proto[key]=function(...args:any[]){if(args[0]===-Infinity)return native.apply(this,args);const t=begin(),label='idb.'+this.name+'.'+key+(typeof args[0]==='string'?'.'+args[0]:args[0]?.id?'.'+args[0].id:'');const request=native.apply(this,args);end(label+'.submit',t);request.addEventListener('success',()=>end(label+'.request',t),{once:true});return request;};}
`;
fs.writeFileSync(path.join(out,'src/game/deltaProfile.ts'),helper);
const names=new Set(['advanceFormal','advanceFormalCooperative','submitFormalOrder','submitOrderDraft','encodeSave','validateFormalWorld','digest','authority','commit','save']);
for(const rel of ['formal/reducer.ts','formal/saveCodec.ts','formal/schema.ts','formal/canonical.ts','persistence.ts']){
 const file=path.join(out,'src/game',rel);let text=fs.readFileSync(file,'utf8');
 if(rel==='persistence.ts'){text=text.replace('const receipts=new Map(w.commandReceipts.map(r=>[r.commandId,r]));',"const historyStart=begin();const receipts=new Map(w.commandReceipts.map(r=>[r.commandId,r]));");text=text.replace("throw new Error('Durable dedupe history cannot be dropped');}\n   }else{","throw new Error('Durable dedupe history cannot be dropped');}end('persistence.historyGuard',historyStart);\n   }else{");}
 const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),transformed=ts.transform(sf,[context=>root=>{
  const visit=node=>{if((ts.isFunctionDeclaration(node)||ts.isMethodDeclaration(node))&&node.name&&names.has(node.name.getText(sf))&&node.body){const label=rel+'.'+node.name.getText(sf),async=node.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword);let body=node.body;
   if(async){const awaited=n=>{if(ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n))return n;if(ts.isReturnStatement(n)&&n.expression&&!ts.isAwaitExpression(n.expression))return ts.factory.updateReturnStatement(n,ts.factory.createAwaitExpression(n.expression));return ts.visitEachChild(n,awaited,context);};body=ts.visitEachChild(body,awaited,context);}
   const token=ts.factory.createVariableStatement(undefined,ts.factory.createVariableDeclarationList([ts.factory.createVariableDeclaration('__dt',undefined,undefined,ts.factory.createCallExpression(ts.factory.createIdentifier('begin'),undefined,[]))],ts.NodeFlags.Const));
   const end=ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createIdentifier('end'),undefined,[ts.factory.createStringLiteral(label),ts.factory.createIdentifier('__dt')]));body=ts.factory.createBlock([token,ts.factory.createTryStatement(body,undefined,ts.factory.createBlock([end],true))],true);
   return ts.isFunctionDeclaration(node)?ts.factory.updateFunctionDeclaration(node,node.modifiers,node.asteriskToken,node.name,node.typeParameters,node.parameters,node.type,body):ts.factory.updateMethodDeclaration(node,node.modifiers,node.asteriskToken,node.name,node.questionToken,node.typeParameters,node.parameters,node.type,body);
  }return ts.visitEachChild(node,visit,context);};return ts.visitNode(root,visit);
 }]);
 text=ts.createPrinter().printFile(transformed.transformed[0]);transformed.dispose();text=`import {begin,end} from '${rel.startsWith('formal/')?'../deltaProfile':'./deltaProfile'}';\n`+text;
 if(rel==='formal/canonical.ts')text=text.replace('const data = new TextEncoder().encode(canonicalJSON(value));',"const ct=begin(),json=canonicalJSON(value);end('canonical.stringify',ct);const et=begin(),data=new TextEncoder().encode(json);end('canonical.utf8',et);");
 fs.writeFileSync(file,text);
}
const runtime=path.join(out,'src/game/runtime.worker.ts');let text=fs.readFileSync(runtime,'utf8');
text="import {begin,end,reset,snapshot} from './deltaProfile';\n"+text;
text=text.replace("const post=(value:unknown)=>self.postMessage(value);","const post=(value:unknown)=>{const t=begin();try{self.postMessage(value);}finally{end('worker.postMessage',t);}};");
text=text.replace('try{await handle(r);}',"if(r.type==='command')reset();const started=begin();try{await handle(r);}");
text=text.replace("}finally{if(r.requestId)","}finally{if(r.type==='command'){end('worker.handle',started);post({type:'deltaProfile',commandId:r.order.commandId,queueMs:started-((r as any).__received??started),metrics:snapshot()});}if(r.requestId)");
text=text.replace('const r=event.data;',"const r=event.data;(r as any).__received=performance.now();");
fs.writeFileSync(runtime,text);
fs.writeFileSync(path.join(out,'profile-source.json'),JSON.stringify({head,instrumented:true,method:'Inclusive nested durations; isolated source instrumentation, not production acceptance timing.'},null,2));
console.log(JSON.stringify({head,out}));
