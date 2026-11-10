// Validation-only inclusive timings. Never imported by the shipped app.
import ts from 'typescript';
const functions={
 'reducer.ts':['advanceFormalCooperative','advanceOneEvent','finishFormalAdvance','replayClonePolicy','cloneReplayCommandDraft','cloneReplayCityDraft','submitOrderDraft'],
 'autonomy.ts':['handleAutonomy','economicChoices','chooseEconomic','submitAutonomous'],
 'aiActions.ts':['updatePublicMemory','politicalDecision','militaryDecision','expansionDecision','wonderDecision'],
 'endgameAI.ts':['computeThreats','publicWonderThreats','ownCombatPower','knownCombatPower'],
 'victory.ts':['campStatistics','victoryConditions','reconcileVictory'],
 'militaryPower.ts':['militaryRanking','unitMilitaryPower'],
 'modernCatchup.ts':['reconcileCatchup','catchupDecision'],
 'economy.ts':['settleCity','populationGrowth','promoteCityQueues','administrationMultiplier'],
 'growthTasks.ts':['syncGrowthTasks','captureGrowthEvent','recordGrowthEvent'],
 'politics.ts':['embassy','empireOf','legionOf','politicalScope','reconcilePolitics'],
 'scheduler.ts':['push','pop','snapshot','replace'],
 'worldDraft.ts':['cloneWorldDraft'],
 'schema.ts':['validateFormalWorld'],
 'runtime.worker.ts':['executeCommand','advanceAndSave','handle','runRequest','drain','state'],
 'persistence.ts':['receiveCommand','commit','commandStatus'],
 'worldProjection.ts':['project','snapshot','update'],
};
export function runtimeProfilePlugin(){return{name:'validation-runtime-profile',enforce:'pre',transform(source,id){
 const name=id.split('/').at(-1);if(!id.includes('/src/game/')||!functions[name])return;
 const file=ts.createSourceFile(id,source,ts.ScriptTarget.Latest,true),edits=[];
 function visit(n){if((ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n))&&n.body&&n.name&&functions[name].includes(n.name.getText(file))){
  const method=n.name.getText(file),async=n.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword),label=JSON.stringify(name+':'+method),event=method==='advanceOneEvent'?`+':'+scheduler.peek()?.type`:'';
  edits.push([n.body.getStart(file)+1,`const __rtLabel=${label}${event},__rtStart=performance.now();try{return ${async?'await (async':'('}()=>{`],[n.body.end-1,`})();}finally{globalThis.__runtimeProfileRecord?.(__rtLabel,performance.now()-__rtStart);}`]);
 }ts.forEachChild(n,visit);}visit(file);let code=source;for(const[at,s]of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,at)+s+code.slice(at);return{code,map:null};
}};}
