import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import ts from 'typescript';
import {expect,it} from 'vitest';
/** Source-level authority boundary: not a text match, traverse actual non-type imports/re-exports. */
it('formal Worker authority cannot transitively import DEMO repair/storage or prototype code',()=>{
 const root=resolve('src'),seen=new Set<string>();
 function visit(path:string){
  if(seen.has(path))return;seen.add(path);if(!path.endsWith('.ts')&&!path.endsWith('.tsx'))return;
  const ast=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
  for(const s of ast.statements){
   let spec:string|undefined;
   if(ts.isImportDeclaration(s)&&!s.importClause?.isTypeOnly&&ts.isStringLiteral(s.moduleSpecifier))spec=s.moduleSpecifier.text;
   if(ts.isExportDeclaration(s)&&!s.isTypeOnly&&s.moduleSpecifier&&ts.isStringLiteral(s.moduleSpecifier))spec=s.moduleSpecifier.text;
   if(!spec?.startsWith('.'))continue;
   const base=resolve(dirname(path),spec),target=[base,base+'.ts',base+'.tsx',base+'.json'].find(existsSync);if(target)visit(target);
  }
 }
 visit(resolve(root,'game/runtime.worker.ts'));
 const paths=[...seen].map(p=>relative(root,p));
 expect(paths).toContain('game/persistence.ts');expect(paths).toContain('game/engine.ts');expect(paths).toContain('game/world.ts');
 expect(paths.filter(p=>/(^simulation\/|^persistence\/|^hooks\/|^worker\/|^map\/|game\/legacy)/.test(p))).toEqual([]);
});
