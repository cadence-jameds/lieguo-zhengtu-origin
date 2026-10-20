// Diagnostics only: patch a fixed git archive, never the production working tree.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
const [source,head,out]=process.argv.slice(2),require=createRequire(path.join(source,'package.json')),ts=require('typescript');
if(fs.existsSync(out))throw Error('Use a new isolated output directory');fs.mkdirSync(out,{recursive:true});
const archive=path.join(out,'diagnostic-source.tar');execFileSync('git',['archive','--output='+archive,head,'src','public','scripts','releases','vite.config.ts','tsconfig.json','package.json','package-lock.json','index.html'],{cwd:source});execFileSync('tar',['-xf',archive,'-C',out]);fs.symlinkSync(path.join(source,'node_modules'),path.join(out,'node_modules'),'dir');
// Frozen identity belongs to the archived source, rather than whichever tree last built in source.
const metadata=JSON.parse(fs.readFileSync(path.join(source,'.release/metadata.json'),'utf8'));metadata.commitSha=head;metadata.contentSha=head;metadata.dirty=true;fs.mkdirSync(path.join(out,'.release'));fs.writeFileSync(path.join(out,'.release/metadata.json'),JSON.stringify(metadata));
const helper=`type Span={id:number;parent?:number;job:string;name:string;start:number;end?:number;ms?:number;meta?:unknown};
let seq=0,job='setup';const spans:Span[]=[],active:Span[]=[];export const now=()=>performance.timeOrigin+performance.now();
export function shape(v:any){if(!v||typeof v!=='object')return undefined;if(Array.isArray(v))return {items:v.length};if(v.dimensions&&v.commandReceipts)return {cities:v.cities.length,armies:v.armies.length,events:v.events.length,receipts:v.commandReceipts.length,completed:v.completionReceipts.length,agents:v.autonomy?.agents.length,time:v.time};return {keys:Object.keys(v).length};}
export function mark(name:string,meta?:unknown){const t=now();spans.push({id:++seq,job,name,start:t,end:t,ms:0,meta});}
export function begin(name:string,meta?:unknown){const s:Span={id:++seq,parent:active.at(-1)?.id,job,name,start:now(),meta};active.push(s);spans.push(s);return s;}
export function end(s:Span){s.end=now();s.ms=s.end-s.start;const i=active.indexOf(s);if(i>=0)active.splice(i,1);}
export function setJob(id:string){job=id;}export function snapshot(){return spans.slice(-60000).map(s=>({...s}));}export function trim(){if(spans.length>60000)spans.splice(0,spans.length-40000);}
const clone=globalThis.structuredClone.bind(globalThis);globalThis.structuredClone=((v:unknown,o?:StructuredSerializeOptions)=>{const s=begin('structuredClone',shape(v));try{return clone(v,o);}finally{end(s);}}) as typeof structuredClone;
if(typeof IDBDatabase!=='undefined'){
const transaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(this:any,...args:any[]){const s=begin('idb.transaction.native',{stores:args[0],mode:args[1]});try{const tx=(transaction as any).apply(this,args);const lifetime={id:++seq,job,name:'idb.transaction.lifetime',start:s.start,meta:{stores:args[0],mode:args[1]}} as Span;spans.push(lifetime);for(const event of ['complete','abort'])tx.addEventListener(event,()=>{lifetime.end=now();lifetime.ms=lifetime.end-lifetime.start;mark('idb.transaction.'+event);},{once:true});return tx;}finally{end(s);}} as typeof transaction;
for(const key of ['get','put','add','delete','getAll','getAllKeys','openCursor'] as const){const proto=IDBObjectStore.prototype as any,native=proto[key];proto[key]=function(this:any,...args:any[]){if(args[0]===-Infinity)return native.apply(this,args);const s=begin('idb.'+this.name+'.'+key+'.submit',shape(args[0]));try{const r=native.apply(this,args),start=s.start,captured=job,parent=s.parent;r.addEventListener('success',()=>{const t=now();spans.push({id:++seq,parent,job:captured,name:'idb.'+this.name+'.'+key+'.request',start,end:t,ms:t-start});},{once:true});return r;}finally{end(s);}};}}
`;
fs.writeFileSync(path.join(out,'src/game/c4Trace.ts'),helper);
const spec={
 'formal/worldDraft.ts':['cloneWorldDraft'],
 'formal/reducer.ts':['advanceFormal','advanceFormalCooperative','advanceOneEvent','finishFormalAdvance','submitFormalOrder','submitOrderDraft','cloneOrderDraft'],
 'formal/saveCodec.ts':['encodeSave','decodeSave','validateReportHistory'],
 'formal/schema.ts':['validateFormalWorld'], 'formal/canonical.ts':['digest'],
 'persistence.ts':['commit','authority','save','reportStatus'],
 'orderAdmission.ts':['playerOrderWithBase','playerOrderBase'], 'governanceAdmission.ts':['governanceWithBase','governanceAfterCatchup'],
 'worldStream.ts':['worldPatch','applyWorldPatch'],
 'formal/autonomy.ts':['handleAutonomy'], 'formal/governance.ts':['handleGovernance'],
 'formal/combat.ts':['handleCombatEvent']
};
const provenance=[];
for(const [rel,names]of Object.entries(spec)){
 const file=path.join(out,'src/game',rel);if(!fs.existsSync(file))continue;let text=fs.readFileSync(file,'utf8');const before=createHash('sha256').update(text).digest('hex');
 if(rel==='persistence.ts')text=text.replace('const receipts=new Map(w.commandReceipts.map(r=>[r.commandId,r]));',"const __hist=begin('receipt.history',{prior:prior.length,next:w.commandReceipts.length});const receipts=new Map(w.commandReceipts.map(r=>[r.commandId,r]));").replace("throw new Error('Durable dedupe history cannot be dropped');}","throw new Error('Durable dedupe history cannot be dropped');}end(__hist);");
 if(rel==='formal/canonical.ts')text=text.replace('const data=new TextEncoder().encode(canonicalJSON(value));',"const __j=begin('canonical.JSON',shape(value)),json=canonicalJSON(value);end(__j);const __u=begin('canonical.UTF8',{chars:json.length}),data=new TextEncoder().encode(json);end(__u);const __sha=begin('checksum.crypto',{bytes:data.byteLength});").replace("return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');","const result=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');end(__sha);return result;");
 const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),found=[];
 const transformed=ts.transform(sf,[context=>root=>{const visit=node=>{
 if((ts.isFunctionDeclaration(node)||ts.isMethodDeclaration(node))&&node.name&&names.includes(node.name.getText(sf))&&node.body){const name=node.name.getText(sf);found.push(name);let body=node.body;
 if(node.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword)){const awaited=n=>{if(ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n))return n;if(ts.isReturnStatement(n)&&n.expression&&!ts.isAwaitExpression(n.expression))return ts.factory.updateReturnStatement(n,ts.factory.createAwaitExpression(n.expression));return ts.visitEachChild(n,awaited,context);};body=ts.visitEachChild(body,awaited,context);}
 const first=node.parameters[0]?.name.getText(sf);const meta=first&&/^[a-zA-Z]+$/.test(first)?`shape(${first})`:'undefined';
 const token=ts.factory.createVariableStatement(undefined,ts.factory.createVariableDeclarationList([ts.factory.createVariableDeclaration('__span',undefined,undefined,ts.factory.createCallExpression(ts.factory.createIdentifier('begin'),undefined,[ts.factory.createStringLiteral(rel+'.'+name),first&&/^[a-zA-Z]+$/.test(first)?ts.factory.createCallExpression(ts.factory.createIdentifier('shape'),undefined,[ts.factory.createIdentifier(first)]):ts.factory.createIdentifier('undefined')]))],ts.NodeFlags.Const));
 const ending=ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createIdentifier('end'),undefined,[ts.factory.createIdentifier('__span')]));
 body=ts.factory.createBlock([token,ts.factory.createTryStatement(body,undefined,ts.factory.createBlock([ending],true))],true);
 return ts.isFunctionDeclaration(node)?ts.factory.updateFunctionDeclaration(node,node.modifiers,node.asteriskToken,node.name,node.typeParameters,node.parameters,node.type,body):ts.factory.updateMethodDeclaration(node,node.modifiers,node.asteriskToken,node.name,node.questionToken,node.typeParameters,node.parameters,node.type,body);
 }return ts.visitEachChild(node,visit,context);};return ts.visitNode(root,visit);}]);
 text=`import {begin,end,shape} from '${rel.startsWith('formal/')?'../c4Trace':'./c4Trace'}';\n`+ts.createPrinter().printFile(transformed.transformed[0]);transformed.dispose();
 fs.writeFileSync(file,text);provenance.push({rel,before,instrumented:createHash('sha256').update(text).digest('hex'),found});
}
const patch=(rel,fn)=>{const file=path.join(out,'src/game',rel),old=fs.readFileSync(file,'utf8'),text=fn(old);fs.writeFileSync(file,text);provenance.push({rel,before:createHash('sha256').update(old).digest('hex'),instrumented:createHash('sha256').update(text).digest('hex')});};
patch('runtime.worker.ts',text=>{
 text="import {begin,end,mark,setJob,snapshot,trim,shape} from './c4Trace';\n"+text;
 text=text.replace('const post=(value:unknown)=>self.postMessage(value);',"const post=(value:any)=>{mark('worker.send.'+value.type,{commandId:value.ack?.commandId??value.commandId});const s=begin('worker.postMessage.'+value.type);try{self.postMessage(value);}finally{end(s);}};");
 text=text.replace('async function runRequest(r:RuntimeRequest){',"async function runRequest(r:RuntimeRequest){setJob(r.type==='command'?r.order.commandId:r.type);const __run=begin('worker.runRequest',{type:r.type,world:shape(world)});");
 text=text.replace("}finally{if(r.requestId)","}finally{end(__run);if(r.type==='command'){post({type:'c4Trace',commandId:r.order.commandId,spans:snapshot()});trim();}if(r.requestId)");
 text=text.replace('const r=event.data;',"const r=event.data;mark('worker.received.'+r.type,{commandId:r.type==='command'?r.order?.commandId:undefined,tickRunning,queued:requests.length});");
 text=text.replace('try{if(!away)await advanceAndSave();}',"try{setJob('background');const __bg=begin('worker.background',{world:shape(world)});try{if(!away)await advanceAndSave();}finally{end(__bg);}}");
 return text;
});
patch('useGame.ts',text=>{
 text="import {begin,end,mark,setJob} from './c4Trace';\n"+text;
 text=text.replace('const msg=e.data;',"const msg=e.data;mark('ui.received.'+msg.type,{commandId:msg.ack?.commandId??msg.commandId});");
 text=text.replace('current.current=next;setWorld(next);',"current.current=next;const __apply=begin('react.setWorld');setWorld(next);end(__apply);mark('ui.worldApplied',{revision:next?.revision,receipts:next?.commandReceipts.length});");
 text=text.replace('send({type:\'command\',order,',"setJob(order.commandId);mark('ui.issue',{commandId:order.commandId});send({type:'command',order,");
 return text;
});
patch('GameApp.tsx',text=>"import {mark} from './c4Trace';\nimport {useLayoutEffect} from 'react';\n"+text.replace('const engine=useGame(),{world,status,busy}=engine,{theme,setTheme}=useTheme();',"const engine=useGame(),{world,status,busy}=engine,{theme,setTheme}=useTheme();useLayoutEffect(()=>{mark('react.layoutCommit',{revision:world?.revision,receipts:world?.commandReceipts.length});});"));
// Expose only numeric diagnostics; no world bodies or private report content.
fs.appendFileSync(path.join(out,'src/game/c4Trace.ts'),"\n(globalThis as any).__c4trace={snapshot,mark,now};\n");
fs.writeFileSync(path.join(out,'trace-source.json'),JSON.stringify({head,instrumented:true,provenance,method:'Absolute performance.timeOrigin + now; inclusive nested spans with parent IDs; object counts, checksum bytes and fixture bytes (no extra synchronous JSON sizing per clone). Diagnostic overhead is not acceptance latency.'},null,2));console.log(JSON.stringify({head,out,provenance}));
