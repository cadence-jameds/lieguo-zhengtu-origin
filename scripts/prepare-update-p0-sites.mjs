// Isolated production-build variants. Old labels on patched source are synthetic,
// not claims that a historical deployed bundle already contained this fix.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createMetadata,prepare} from './release-metadata.mjs';
const root=process.cwd(),out=path.resolve(process.argv[2]??'/tmp/update-p0-browser'),base='01247043bf79f51cb5fd5357c2f1c4eb88f027fc';
fs.mkdirSync(out,{recursive:true});const old=createMetadata(root,{head:base,working:false}),current=prepare(root),baseline=path.join(out,'baseline');
const skipBase=process.env.UPDATE_P0_SKIP_BASELINE==='1';if(!skipBase){fs.mkdirSync(baseline,{recursive:true});const archive=path.join(out,'baseline.tar');execFileSync('git',['archive','--format=tar','--output='+archive,base]);execFileSync('tar',['-xf',archive,'-C',baseline]);fs.unlinkSync(archive);fs.symlinkSync(path.join(root,'node_modules'),path.join(baseline,'node_modules'),'dir');}
const env={...process.env,GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'cadence-jameds/lieguo-zhengtu-origin'},manifest={base,sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),syntheticReleaseVariants:true,variants:[]};
function build(name,cwd,metadata){fs.mkdirSync(path.join(cwd,'.release'),{recursive:true});fs.writeFileSync(path.join(cwd,'.release/metadata.json'),JSON.stringify(metadata));const output=path.join(out,name);execFileSync(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build','--outDir',output,'--emptyOutDir'],{cwd,env,stdio:['ignore',fs.openSync(path.join(out,name+'-build.log'),'w'),'inherit']});manifest.variants.push({name,version:metadata.version,contentSha:metadata.contentSha,commitSha:metadata.commitSha,hookSHA256:createHash('sha256').update(fs.readFileSync(path.join(cwd,'src/game/useAppUpdate.ts'))).digest('hex')});}
try{
 if(!skipBase)build('before',baseline,old);else manifest.variants.push({name:'before',version:old.version,contentSha:old.contentSha,commitSha:old.commitSha,hookSHA256:createHash('sha256').update(fs.readFileSync(path.join(baseline,'src/game/useAppUpdate.ts'))).digest('hex')});build('patched-old',root,old);build('after',root,current);
 const same={...current,version:old.version,history:current.history.map((v,i)=>i? v:{...v,version:old.version})};build('same-version',root,same);
 fs.cpSync(path.join(out,'patched-old'),path.join(out,'docs-only'),{recursive:true});const docs={...old,commitSha:current.commitSha};fs.writeFileSync(path.join(out,'docs-only/version.json'),JSON.stringify(docs));fs.appendFileSync(path.join(out,'docs-only/sw.js'),'\n// Isolated docs-only deployment: identical playable identity.\n');
 fs.writeFileSync(path.join(out,'variant.txt'),'patched-old');fs.writeFileSync(path.join(out,'mode.txt'),'normal');fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
}finally{prepare(root);}
