import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createMetadata} from '../../../../scripts/release-metadata.mjs';
const root=process.cwd(),out=path.resolve(process.argv[2]??'/tmp/b9-memory');
const variants=[['A','7264472e7cfc30ec72d64e24198d3d8d5d23adeb'],['B','dbcf7d59c55c322c272d4900cdf8a81e36ae8793']];
fs.mkdirSync(out,{recursive:true});
for(const [name,head]of variants){const dir=path.join(out,name),archive=path.join(out,name+'.tar');fs.mkdirSync(dir,{recursive:true});
 execFileSync('git',['archive','--format=tar','--output='+archive,head,'src','scripts','releases','README.md','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html'],{cwd:root});execFileSync('tar',['-xf',archive,'-C',dir]);fs.unlinkSync(archive);
 for(const p of ['node_modules','public'])if(!fs.existsSync(path.join(dir,p)))fs.symlinkSync(path.join(root,p),path.join(dir,p),'dir');
 const diagnostic=path.join(dir,'docs/validation/b10-release-unblock/b9-memory');fs.mkdirSync(diagnostic,{recursive:true});for(const p of ['plugin.mjs','config.ts','setup.mjs'])fs.copyFileSync(path.join(root,'docs/validation/b10-release-unblock/b9-memory',p),path.join(diagnostic,p));
 const legacy=path.join(dir,'docs/validation/b10-release-unblock/final-blockers');fs.mkdirSync(legacy,{recursive:true});fs.copyFileSync(path.join(root,'docs/validation/b10-release-unblock/final-blockers/b9-profile-plugin.mjs'),path.join(legacy,'b9-profile-plugin.mjs'));
 fs.writeFileSync(path.join(diagnostic,'interface.mjs'),"export {largeProjectSchema} from '../../../../src/game/formal/schema.ts';\n"+(name==='B'?"export {withDraftShipmentSyntax as scope} from '../../../../src/game/formal/shipmentSyntax.ts';\n":"export const scope=(_world,validate)=>validate();\n"));
 fs.mkdirSync(path.join(dir,'.release'),{recursive:true});fs.writeFileSync(path.join(dir,'.release/metadata.json'),JSON.stringify(createMetadata(root,{head,working:false})));
}
for(const p of ['src/game/formal/breakthroughB92.test.ts','src/game/formal/breakthroughTestSupport.ts'])if(!fs.readFileSync(path.join(out,'A',p)).equals(fs.readFileSync(path.join(out,'B',p))))throw Error('Workload mismatch: '+p);
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({variants,node:process.version,originalWorkloadEqual:true,diagnosticSource:'Working-tree observer only; immutable production refs above'},null,2));
console.log(out);
