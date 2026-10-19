// Compile the actual Runtime. Trace wrappers observe results; only comparison policy is overridden.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const source=process.cwd(),out=path.resolve(process.argv[2]??'artifacts/p0c9/compiled');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
execFileSync(process.execPath,['scripts/p0-profile-prepare.mjs',source,out],{stdio:'inherit',env:{...process.env,P0_INSTRUMENT:'0',P0_RECORD_EVENTS:'0',P0_SHA:head}});
const targets={
 'formal/aiAttackStrategies':['pickAttackStrategy','autonomousDispatchReason'],
 'formal/aiActions':['militaryDecision'],
 'formal/autonomy':['submitAutonomous'],
 'formal/reducer':['advanceOneEvent','submitOrderDraft'],
 'formal/battles':['handleCombatEvent','finishReceipt'],
 'formal/economy':['addStock']
};
const changes=[];
for(const [module,names] of Object.entries(targets)){
 const file=path.join(out,'src/game',module+'.js');let text=fs.readFileSync(file,'utf8');
 for(const name of names){
  const pattern=new RegExp('(export )?function '+name+'\\(');const match=text.match(pattern);
  if(!match)throw Error('Missing instrumentation boundary '+module+'.'+name);
  const exported=!!match[1],original='__p0c9_original_'+name;
  text=text.replace(pattern,'function '+original+'(');
  text+='\n'+(exported?'export ':'')+'function '+name+'(...args){\n'+
   (name==='pickAttackStrategy'?' if(globalThis.__p0c9?.policy)args[2]=globalThis.__p0c9.policy;\n':'')+
   ' const token=globalThis.__p0c9?.before('+JSON.stringify(name)+',args);\n'+
   ' try{const result='+original+'(...args);globalThis.__p0c9?.after('+JSON.stringify(name)+',args,result,token);return result;}\n'+
   ' catch(error){globalThis.__p0c9?.fault('+JSON.stringify(name)+',error);throw error;}\n}\n';
  changes.push({module,name,policyOnly:name==='pickAttackStrategy'});
 }
 fs.writeFileSync(file,text);
}
const metadata=JSON.parse(fs.readFileSync(path.join(out,'source-metadata.json'),'utf8'));
const hash=createHash('sha256');for(const module of Object.keys(targets))hash.update(fs.readFileSync(path.join(out,'src/game',module+'.js')));
fs.writeFileSync(path.join(out,'p0c9-harness.json'),JSON.stringify({head,sourceTreeHash:metadata.sourceTreeHash,compiledTraceHash:hash.digest('hex'),changes,authority:'fa038a00d3aa5a500cb055176164a907495b6212',worldMutations:'none; comparison runs substitute only the pure strategy selector policy'},null,2));
console.log(JSON.stringify({out,head,wrappers:changes.length}));
