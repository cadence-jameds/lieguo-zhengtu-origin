// Static import audit, independent of browser/Node timing. This guards the preview capability boundary.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const seen=new Set();
function visit(file){
 if(seen.has(file))return;seen.add(file);const source=fs.readFileSync(file,'utf8');
 assert.ok(!/indexedDB|new\s+Dexie|\.transaction\(/.test(source),`Storage capability in preview graph: ${file}`);
 for(const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)){
  if(!match[1].startsWith('.'))continue;
  const stem=path.resolve(path.dirname(file),match[1]);const next=['.ts','.tsx'].map(ext=>stem+ext).find(f=>fs.existsSync(f));if(next)visit(next);
 }
}
visit(path.resolve('src/game/constructionPreview.worker.ts'));
for(const file of seen)assert.ok(!/\/(reducer|worldDraft|runtime\.worker|persistence|durableCommands)\.ts$/.test(file),`Authority/reducer in preview graph: ${file}`);
for(const file of ['src/game/FormalCityPanel.tsx','src/game/presentation/BuildingDetail.tsx','src/game/presentation/CraftsmanPanel.tsx'])assert.ok(!/\b(constructionPreview|craftsmanCastleAction|submitFormalOrder)\s*\(/.test(fs.readFileSync(file,'utf8')),`Synchronous render preview in ${file}`);
assert.ok(!/submitFormalOrder|formal\/reducer/.test(fs.readFileSync('src/game/presentation/cityActions.ts','utf8')));
console.log(JSON.stringify({pass:true,previewTransitiveModules:seen.size,worldAuthorityImports:0,storageCapabilities:0,renderReducerPreviewCalls:0}));
