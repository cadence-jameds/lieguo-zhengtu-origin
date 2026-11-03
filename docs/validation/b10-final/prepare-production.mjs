// Builds isolated PR58 and PR59 sites with their actual source and metadata.
// No deployment, ref mutation, fabricated version or product source edit.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {build} from 'vite';
import {createMetadata} from '../../../scripts/release-metadata.mjs';
const root=process.cwd(),out=path.resolve(process.argv[2]??'/workspace/b10-final-production');
execFileSync('git',['diff','--exit-code','8d40f63c5efbd08ee252f533719d5f58fc95b3dd','--','src','public','scripts','releases','package.json','package-lock.json','vite.config.ts','tsconfig.json','index.html'],{stdio:'pipe'});
const before=path.join(out,'before-source'),sha='c370ff8a492de8711e764a82c8f1d43efef1a00e';
fs.mkdirSync(before,{recursive:true});
const archive=path.join(out,'before.tar');
execFileSync('git',['archive','--format=tar','--output='+archive,sha,'src','public','scripts','releases','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','README.md']);
execFileSync('tar',['-xf',archive,'-C',before]);fs.unlinkSync(archive);
if(!fs.existsSync(path.join(before,'node_modules')))fs.symlinkSync(path.join(root,'node_modules'),path.join(before,'node_modules'),'dir');
const env={...process.env,GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'cadence-jameds/lieguo-zhengtu-origin'};
const manifest={source:'8d40f63c5efbd08ee252f533719d5f58fc95b3dd',variants:[]};
for(const [name,cwd,head]of [['before',before,sha],['after',root,manifest.source]]){
 const metadata=createMetadata(root,{head,working:false});
 fs.mkdirSync(path.join(cwd,'.release'),{recursive:true});fs.writeFileSync(path.join(cwd,'.release/metadata.json'),JSON.stringify(metadata,null,2));
 const dest=path.join(out,name),log=fs.openSync(path.join(out,name+'-build.log'),'w');
 execFileSync(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build','--outDir',dest,'--emptyOutDir'],{cwd,env,stdio:['ignore',log,log]});fs.closeSync(log);
 const lab=path.join(cwd,'docs/validation/b10-final/production-lab.worker.ts');
 if(cwd!==root){fs.mkdirSync(path.dirname(lab),{recursive:true});fs.copyFileSync(path.join(root,'docs/validation/b10-final/production-lab.worker.ts'),lab);}
 await build({root:cwd,configFile:false,publicDir:false,define:{__APP_RELEASE_METADATA__:JSON.stringify(metadata)},build:{target:'es2022',outDir:path.join(dest,'__validation'),emptyOutDir:true,copyPublicDir:false,minify:false,rolldownOptions:{input:lab,output:{entryFileNames:'seed.js',inlineDynamicImports:true,format:'es'}}}});
 manifest.variants.push({name,head,version:metadata.version,contentSha:metadata.contentSha});
}
fs.writeFileSync(path.join(out,'variant.txt'),'after');fs.writeFileSync(path.join(out,'mode.txt'),'normal');fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
