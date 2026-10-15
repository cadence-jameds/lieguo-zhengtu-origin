import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const source = path.resolve(process.argv[2] ?? process.cwd());
const output = path.resolve(process.argv[3] ?? path.join(source,'artifacts/p0/compiled'));
const require = createRequire(path.join(source, 'package.json'));
const sourceTreeHash=createHash('sha256');
const ts = require('typescript');
fs.mkdirSync(output, {recursive:true,mode:0o700});
fs.writeFileSync(path.join(output,'package.json'),JSON.stringify({type:'module',private:true}));
if (!fs.existsSync(path.join(output,'node_modules'))) fs.symlinkSync(path.join(source,'node_modules'),path.join(output,'node_modules'),'dir');
const metadata={sha:process.env.P0_SHA??'unrecorded',version:JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8')).version,instrumented:process.env.P0_INSTRUMENT!=='0',harnessVersion:3};
metadata.recordEvents=metadata.instrumented||process.env.P0_RECORD_EVENTS==='1';
fs.writeFileSync(path.join(output,'source-metadata.json'),JSON.stringify(metadata,null,2));
const modules=new Set(['src/game/formal/reducer.ts','src/game/formal/autonomy.ts','src/game/formal/governance.ts','src/game/formal/aiActions.ts','src/game/formal/politics.ts','src/game/formal/scheduler.ts','src/game/formal/offline.ts','src/game/formal/schema.ts','src/game/formal/saveCodec.ts','src/game/formal/canonical.ts','src/game/formal/economy.ts','src/game/formal/battles.ts','src/game/formal/battleRounds.ts','src/game/formal/spatial.ts','src/game/formal/aiKnowledge.ts','src/game/formal/mountains.ts','src/game/formal/migrationB5.ts','src/game/formal/settlement.ts','src/game/formal/battleProgress.ts','src/game/persistence.ts','src/game/worldStream.ts']);
const skip=new Set(['canonicalJSON','id','reportKey','reportMatches','stampBattle','stampPending','affordable','requireRule','zeroResources','isMissionArmy','aiRandom']);
function metricExpression(key,body,node,context){
 if(node.name?.text==='advanceFormalCooperative'){
  const pauseAfterYield=child=>{
   if(ts.isExpressionStatement(child)&&ts.isAwaitExpression(child.expression)&&ts.isNewExpression(child.expression.expression)&&ts.isIdentifier(child.expression.expression.expression)&&child.expression.expression.expression.text==='Promise'){
    return ts.factory.createBlock([child,ts.factory.createExpressionStatement(ts.factory.createAwaitExpression(ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__p0'),'pauseIfRequested'),undefined,[])))],true);
   }
   return ts.visitEachChild(child,pauseAfterYield,context);
  };
  body=pauseAfterYield(body);
 }
 if(node.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword)){
  const awaitReturns=child=>{
   if(ts.isFunctionDeclaration(child)||ts.isFunctionExpression(child)||ts.isArrowFunction(child)||ts.isMethodDeclaration(child))return child;
   if(ts.isReturnStatement(child)&&child.expression&&!ts.isAwaitExpression(child.expression))return ts.factory.updateReturnStatement(child,ts.factory.createAwaitExpression(child.expression));
   return ts.visitEachChild(child,awaitReturns,context);
  };
  body=awaitReturns(body);
 }
 const label=ts.factory.createStringLiteral(key);
 const call=ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__p0'),'begin'),undefined,[label]);
 const token=ts.factory.createVariableStatement(undefined,ts.factory.createVariableDeclarationList([ts.factory.createVariableDeclaration('__p0Token',undefined,undefined,call)],ts.NodeFlags.Const));
 const end=ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__p0'),'end'),undefined,[ts.factory.createIdentifier('__p0Token')]));
 if (node.name?.text==='advanceOneEvent') {
  const event=ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('scheduler'),'peek'),undefined,[]);
  const eventToken=ts.factory.createVariableStatement(undefined,ts.factory.createVariableDeclarationList([ts.factory.createVariableDeclaration('__p0Event',undefined,undefined,ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__p0'),'eventBegin'),undefined,[event]))],ts.NodeFlags.Const));
  const endEvent=ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__p0'),'endEvent'),undefined,[ts.factory.createIdentifier('__p0Event')]));
  return ts.factory.createBlock([token,eventToken,ts.factory.createTryStatement(body,undefined,ts.factory.createBlock([endEvent,end],true))],true);
 }
 return ts.factory.createBlock([token,ts.factory.createTryStatement(body,undefined,ts.factory.createBlock([end],true))],true);
}
function transformer(relative){return context=>{
 const visit=node=>{
  if (ts.isImportDeclaration(node)||ts.isExportDeclaration(node)) {
   const module=node.moduleSpecifier;
   if (module&&ts.isStringLiteral(module)&&module.text.startsWith('.')) {
    let specifier=module.text;
    if (!path.extname(specifier)) specifier+='.js';
    else if (/\.tsx?$/.test(specifier)) specifier=specifier.replace(/\.tsx?$/,'.js');
    const attributes=specifier.endsWith('.json')?ts.factory.createImportAttributes([ts.factory.createImportAttribute(ts.factory.createIdentifier('type'),ts.factory.createStringLiteral('json'))]):node.attributes;
    if(ts.isImportDeclaration(node))return ts.factory.updateImportDeclaration(node,node.modifiers,node.importClause,ts.factory.createStringLiteral(specifier),attributes);
    return ts.factory.updateExportDeclaration(node,node.modifiers,node.isTypeOnly,node.exportClause,ts.factory.createStringLiteral(specifier),attributes);
   }
  }
  if(metadata.instrumented&&modules.has(relative)&&ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&['find','some'].includes(node.expression.name.text)) {
   const receiver=node.expression.expression;
   if(ts.isPropertyAccessExpression(receiver)&&['commandReceipts','receipts'].includes(receiver.name.text)) {
    return ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__p0'),'receiptLookup'),undefined,[ts.visitNode(receiver,visit),ts.factory.createStringLiteral(node.expression.name.text),...node.arguments.map(x=>ts.visitNode(x,visit))]);
   }
  }
  let visited=ts.visitEachChild(node,visit,context);
  if(metadata.recordEvents&&!metadata.instrumented&&relative==='src/game/formal/reducer.ts'&&ts.isFunctionDeclaration(visited)&&visited.name?.text==='advanceOneEvent'&&visited.body){
   const record=ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('__p0'),'recordEvent'),undefined,[ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('scheduler'),'peek'),undefined,[])]));
   visited=ts.factory.updateFunctionDeclaration(visited,visited.modifiers,visited.asteriskToken,visited.name,visited.typeParameters,visited.parameters,visited.type,ts.factory.updateBlock(visited.body,[record,...visited.body.statements]));
  }
  if(metadata.instrumented&&modules.has(relative)&&((ts.isFunctionDeclaration(visited)&&visited.body&&visited.name)||ts.isMethodDeclaration(visited)&&visited.body&&ts.isIdentifier(visited.name))) {
   const name=visited.name.text;
   if(skip.has(name))return visited;
   const key=relative.replace('src/game/','').replace(/\.ts$/,'')+'.'+name;
   const body=metricExpression(key,visited.body,visited,context);
   if(ts.isFunctionDeclaration(visited))return ts.factory.updateFunctionDeclaration(visited,visited.modifiers,visited.asteriskToken,visited.name,visited.typeParameters,visited.parameters,visited.type,body);
   return ts.factory.updateMethodDeclaration(visited,visited.modifiers,visited.asteriskToken,visited.name,visited.questionToken,visited.typeParameters,visited.parameters,visited.type,body);
  }
  return visited;
 };
 return file=>ts.visitNode(file,visit);
};}
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
 const absolute=path.join(dir,item.name),relative=path.relative(source,absolute);
 if(item.isDirectory())walk(absolute);
 else if(/\.tsx?$/.test(item.name)&&!/\.d\.ts$|\.test\.tsx?$/.test(item.name)){
  const destination=path.join(output,relative.replace(/\.tsx?$/,'.js'));
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  const text=fs.readFileSync(absolute,'utf8');sourceTreeHash.update(relative+'\0'+text+'\0');
  const result=ts.transpileModule(text,{fileName:absolute,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,sourceMap:true,inlineSources:true,verbatimModuleSyntax:false},transformers:{before:[transformer(relative)]}});
  fs.writeFileSync(destination,result.outputText);
  fs.writeFileSync(destination+'.map',result.sourceMapText);
 } else if(item.name.endsWith('.json')){
  const destination=path.join(output,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(absolute,destination);sourceTreeHash.update(relative+'\0'+fs.readFileSync(absolute)+'\0');
 }
}}
walk(path.join(source,'src'));
fs.mkdirSync(path.join(output,'public'),{recursive:true});
fs.copyFileSync(path.join(source,'public/version.json'),path.join(output,'public/version.json'));
metadata.sourceTreeHash=sourceTreeHash.digest('hex');fs.writeFileSync(path.join(output,'source-metadata.json'),JSON.stringify(metadata,null,2));
console.log(JSON.stringify({...metadata,output}));
