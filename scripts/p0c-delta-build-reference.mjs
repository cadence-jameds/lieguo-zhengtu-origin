// Build a committed comparison snapshot without switching or overwriting the working branch.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
const [source,head,out]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});const archive=path.join(out,'local-source.tar');
execFileSync('git',['archive','--output='+archive,head,'src','public','scripts','releases','vite.config.ts','tsconfig.json','package.json','package-lock.json','index.html'],{cwd:source});execFileSync('tar',['-x','-f',archive,'-C',out]);
if(!fs.existsSync(path.join(out,'node_modules')))fs.symlinkSync(path.join(source,'node_modules'),path.join(out,'node_modules'),'dir');
const {createMetadata}=await import(pathToFileURL(path.join(source,'scripts/release-metadata.mjs')).href);fs.mkdirSync(path.join(out,'.release'),{recursive:true});const release=createMetadata(source,{head});fs.writeFileSync(path.join(out,'.release/metadata.json'),JSON.stringify(release,null,2));
fs.writeFileSync(path.join(out,'comparison-source.json'),JSON.stringify({head,tree:execFileSync('git',['rev-parse',head+'^{tree}'],{cwd:source,encoding:'utf8'}).trim(),release,instrumented:false},null,2));
execFileSync(process.execPath,[path.join(source,'node_modules/vite/bin/vite.js'),'build'],{cwd:out,stdio:'inherit',env:{...process.env,GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'cadence-jameds/lieguo-zhengtu-origin'}});
