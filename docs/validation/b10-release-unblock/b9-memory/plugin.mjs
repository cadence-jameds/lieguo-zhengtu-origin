// Observation only: original workload, assertions and 240s beforeAll stay intact.
import ts from 'typescript';
export function memoryPlugin(){return{name:'b9-memory-observer',enforce:'pre',transform(source,id){
 const edits=[],file=ts.createSourceFile(id,source,ts.ScriptTarget.Latest,true);
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.body&&n.name){const name=n.name.text;
  if(id.endsWith('/breakthroughTestSupport.ts')&&name==='fundedBreakthroughSnapshot'){
   edits.push([n.body.getStart(file)+1,'globalThis.__memStart?.();const __memResult=await(async()=>{'],[n.body.end-1,'})();await globalThis.__memHookDone?.(__memResult);return __memResult;']);
  }else if(id.endsWith('/breakthroughTestSupport.ts')&&name==='fundTrip'){
   edits.push([n.body.getStart(file)+1,'try{'],[n.body.end-1,'}finally{globalThis.__memTrip?.();}']);
  }else if(id.endsWith('/worldDraft.ts')&&name==='cloneWorldDraft'||id.endsWith('/schema.ts')&&name==='validateFormalWorld'){
   edits.push([n.body.getStart(file)+1,'try{'],[n.body.end-1,`}finally{globalThis.__memBoundary?.(${JSON.stringify(name)});} `]);
  }
 }ts.forEachChild(n,visit);}visit(file);
 if(id.endsWith('/shipmentSyntax.ts')){const before='readers.add(this);';if(!source.includes(before))throw Error('Unknown reader constructor');source=source.replace(before,'readers.add(this);globalThis.__memReader?.(new WeakRef(this));');}
 for(const [at,text]of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,at)+text+source.slice(at);
 return edits.length||id.endsWith('/shipmentSyntax.ts')?{code:source,map:null}:undefined;
}};}
