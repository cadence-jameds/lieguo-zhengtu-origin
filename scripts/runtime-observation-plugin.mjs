// Native validation only. Uses an independent real monotonic clock even when
// the synthetic campaign clock advances; never shipped or persisted.
import ts from 'typescript';
const methods={'reducer.ts':['advanceOneEvent','advanceFormalCooperative','submitOrderDraft','finishFormalAdvance'],'autonomy.ts':['handleAutonomy'],'victory.ts':['reconcileVictory'],'scheduler.ts':['push','pop','snapshot','replace'],'worldDraft.ts':['cloneWorldDraft'],'persistence.ts':['receiveCommand','commit','finishCommand'],'runtime.worker.ts':['executeCommand','state']};
export function runtimeObservationPlugin(){return{name:'native-runtime-observation',enforce:'pre',transform(source,id){const name=id.split('/').at(-1);if(!id.includes('/src/game/')||!methods[name])return;const f=ts.createSourceFile(id,source,ts.ScriptTarget.Latest,true),edits=[];
 function visit(n){if((ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n))&&n.body&&n.name&&methods[name].includes(n.name.getText(f))){const method=n.name.getText(f),a=n.body.getStart(f)+1,b=n.body.end-1,async=n.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword),label=JSON.stringify(name+':'+method)+(method==='advanceOneEvent'?`+':'+scheduler.peek()?.type`:'');let pre='',post='';
  if(method==='receiveCommand'){pre=`globalThis.__runtimeStage?.('t1-start',order.commandId);`;post=`globalThis.__runtimeStage?.('t1-end',order.commandId);`;}
  if(method==='advanceFormalCooperative'){pre=`globalThis.__runtimeStage?.('catchup-start');`;post=`globalThis.__runtimeStage?.('catchup-end');`;}
  if(method==='submitOrderDraft'){pre=`globalThis.__runtimeStage?.('reducer-start',value?.commandId);`;post=`globalThis.__runtimeStage?.('reducer-end',value?.commandId);`;}
  if(method==='commit'){pre=`globalThis.__runtimeStage?.('t2-start',command?.row.commandId);`;post=`globalThis.__runtimeStage?.('t2-end',command?.row.commandId);`;}
  if(method==='finishCommand'){pre=`globalThis.__runtimeStage?.('t2-start',row.commandId);`;post=`globalThis.__runtimeStage?.('t2-end',row.commandId);`;}
  if(method==='executeCommand')post=`globalThis.__runtimeStage?.('execution-end',r.order.commandId);`;
  edits.push([a,`const __rtAt=globalThis.__runtimeNow?.()??performance.now(),__rtLabel=${label};${pre}try{return ${async?'await (async':'('}()=>{`],[b,`})();}finally{${post}globalThis.__runtimeSample?.(__rtLabel,(globalThis.__runtimeNow?.()??performance.now())-__rtAt);}`]);
 }if(ts.isAwaitExpression(n)){let owner=n.parent;while(owner&&!ts.isFunctionDeclaration(owner))owner=owner.parent;if(owner?.name?.getText(f)==='advanceFormalCooperative'&&ts.isExpressionStatement(n.parent))edits.push([n.parent.getStart(f),'{globalThis.__runtimeYieldStart?.();'],[n.parent.end,'globalThis.__runtimeYieldEnd?.();}']);}ts.forEachChild(n,visit);}visit(f);
 if(name==='runtime.worker.ts'){const needle='let row=await intake.get(r)!;';if(source.includes(needle))edits.push([source.indexOf(needle)+needle.length,`globalThis.__runtimeStage?.('execution-start',r.order.commandId);`]);}
 let code=source;for(const[at,s]of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,at)+s+code.slice(at);return{code,map:null};
}};}
