// Execute the existing pure TypeScript selectors; no game files are changed.
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
 const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env.BASE_URL', "'/'");
 const result = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 module._compile(result.outputText, filename);
};
const {unitArt, armyAtlasBounds} = require('../../../../src/game/presentation/artMap.ts');
const {UNIT_CATALOG} = require('../../../../src/game/formal/unitCatalog.ts');
const result = {};
for (const civ of ['zhongguo', 'japan']) result[civ] = ['guard.civ_'+civ, 'elite.guard.civ_'+civ].map(id => {
 const art=unitArt(id);
 return {id, name:UNIT_CATALOG[id].name, art, crop:art.sheet ? armyAtlasBounds(art.sheet,art.index) : null};
});
console.log(JSON.stringify(result));
