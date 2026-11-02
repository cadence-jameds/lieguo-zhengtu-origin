import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const base='1737d14a8f210fb2d33eb5dadbde18c3bb375586',read=p=>fs.readFileSync(p,'utf8'),old=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const preserved=['src/game/formal/model.ts','src/game/formal/reducer.ts','src/game/formal/scheduler.ts','src/game/formal/commandLedger.ts','src/game/formal/saveCodec.ts','src/game/ledgerStore.ts','src/game/persistence.ts','src/game/formal/constructionRules.ts'];
for(const p of preserved)assert.equal(read(p),old(p),`Changed authority/rule contract: ${p}`);
const changed=execFileSync('git',['diff','--name-only',base,'HEAD','--','src/game/formal'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim().split('\n').filter(p=>p.endsWith('.ts')&&!p.endsWith('.test.ts')&&!/Support\.ts$/.test(p)),intentional=new Set(['src/game/formal/economy.ts','src/game/formal/buildingDetailData.ts','src/game/formal/schema.ts','src/game/formal/growthTaskSchema.ts']);
const js=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText;
let typeOnly=0;for(const p of changed)if(!intentional.has(p)){assert.equal(js(read(p)),js(old(p)),`Non-type gameplay change: ${p}`);typeOnly++;}
for(const p of ['src/game/useGame.ts','src/game/worldStream.ts','src/game/worldProjection.ts','src/game/presentationStore.ts','src/game/presentationSelectors.ts'])assert.ok(!/projectWorld\s*\(|Array\.from\(commandHistory|JSON\.stringify\([^\n]*commandReceipts/.test(read(p)),`History materialization on display path: ${p}`);
assert.ok(!/projectWorld/.test(read('src/game/runtime.worker.ts')));
assert.ok(!/commandReceipts:/.test(read('src/game/worldProjection.ts')));
// The only intentional economy runtime addition is a formal-only guard; the
// authoritative branch is byte-identical after removing that guard.
assert.equal(js(read('src/game/formal/economy.ts').replace("!legacy&&w.kind==='formal'","!legacy")),js(old('src/game/formal/economy.ts')));
console.log(JSON.stringify({pass:true,preservedAuthorityFiles:preserved.length,typeOnlyFormalModules:typeOnly,formalEconomyEquivalent:true,displayHistoryMaterialization:0}));
