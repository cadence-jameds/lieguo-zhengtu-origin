import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const run=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024}).trim();
const canonical=v=>JSON.stringify(v,(_k,n)=>n&&typeof n==='object'&&!Array.isArray(n)?Object.fromEntries(Object.entries(n).sort(([a],[b])=>a<b?-1:a>b?1:0)):n);
const read=(root,p)=>readFileSync(resolve(root,p),'utf8');
const at=(root,ref,p)=>{try{return run(root,'show',`${ref}:${p}`);}catch{return '';}};
export function playablePath(p){return (/^src\//.test(p)&&!/(\.test\.[cm]?[jt]sx?$|TestSupport|testSupport|\/__tests__\/)/.test(p))||(/^public\//.test(p)&&p!=='public/version.json')||['index.html','vite.config.ts','tsconfig.json','scripts/release-metadata.mjs','scripts/prepare-release.mjs','scripts/build-playable.py','releases/config.json','releases/legacy-notes.json','releases/legacy-changelog.md'].includes(p);}
export function playableChanges(paths,before=()=>'',after=()=> ''){
 return paths.some(p=>{
  if(p==='package.json'){const select=s=>{const v=JSON.parse(s||'{}');return canonical([v.dependencies,v.optionalDependencies,v.scripts?.build,v.scripts?.prebuild,Object.fromEntries(Object.entries(v.devDependencies??{}).filter(([k])=>['vite','vite-plugin-pwa','typescript','@vitejs/plugin-react'].includes(k)))]);};return select(before(p))!==select(after(p));}
  if(p==='package-lock.json'){const select=s=>Object.entries(JSON.parse(s||'{}').packages??{}).filter(([k,v])=>k&&!v.dev).map(([k,v])=>[k,v.version,v.integrity]).sort(([a],[b])=>a<b?-1:a>b?1:0);return canonical(select(before(p)))!==canonical(select(after(p)));}
  return playablePath(p);
 });
}
export function nextVersion(base,count,ceiling=99){
 if(!/^\d+\.\d+\.\d+$/.test(base)||!Number.isSafeInteger(count)||count<0)throw Error('Invalid release version/count');
 const [a,b,c]=base.split('.').map(Number);if(c+count>ceiling)throw Error('Version rollover requires the owner-approved numbering rule; refusing an invented carry.');return `${a}.${b}.${c+count}`;
}
export function validateNote(value){
 if(!value||Object.keys(value).some(k=>!['title','notes','pr'].includes(k))||typeof value.title!=='string'||value.title.length>60||!/[\u3400-\u9fff]/.test(value.title)||!Array.isArray(value.notes)||!value.notes.length||value.notes.length>10)throw Error('Release Notes require a short Chinese title and 1–10 player-visible notes.');
 for(const n of value.notes)if(typeof n!=='string'||n.length<8||n.length>200||!/[\u3400-\u9fff]/.test(n)||/Gate\s*(HOLD|PASS)|準備施工|規格已核准|尚未實作|待實作|^[a-z]+\([^)]*\):/i.test(n))throw Error('Release Notes must describe completed player-visible changes, not plans or internal commit titles.');
 if(/Gate\s*(HOLD|PASS)|準備施工|規格已核准|尚未實作|待實作/i.test(value.title))throw Error('Release title must describe completed work');
 if(Object.hasOwn(value,'pr')&&(!Number.isSafeInteger(value.pr)||value.pr<=0))throw Error('Release PR reference must be a positive integer');
 if(new Set(value.notes).size!==value.notes.length)throw Error('Duplicate release notes');return value;
}
export function checkNotes(root,base,head='HEAD',body){
 const paths=run(root,'diff','--name-only',base,head).split('\n').filter(Boolean),functional=playableChanges(paths,p=>at(root,base,p),p=>at(root,head,p));
 const notePaths=paths.filter(p=>/^releases\/notes\/[a-z0-9-]+\.json$/.test(p));
 for(const p of notePaths)if(at(root,base,p))throw Error('Merged release-note records are immutable; add a new note file.');
 if(!functional)return {functional:false,notes:[]};
 if(notePaths.length!==1)throw Error('Playable PR requires exactly one new releases/notes/<slug>.json record.');
 const note=validateNote(JSON.parse(at(root,head,notePaths[0])));
 if(body!==undefined){const block=body.match(/<!-- release-notes:start -->\s*```json\s*([\s\S]*?)```\s*<!-- release-notes:end -->/);if(!block||JSON.stringify(JSON.parse(block[1]))!==JSON.stringify(note))throw Error('PR controlled Release Notes JSON must match the new note file.');}
 return {functional:true,notes:[note]};
}
export function createMetadata(root,options={}){
 const config=JSON.parse(read(root,'releases/config.json')),head=options.head??run(root,'rev-parse','HEAD');
 run(root,'merge-base','--is-ancestor',config.baselineCommit,head);
 const commits=run(root,'rev-list','--first-parent','--reverse',`${config.baselineCommit}..${head}`).split('\n').filter(Boolean);
 const history=[{version:config.baselineVersion,date:config.baselineDate,title:config.baselineTitle,notes:config.baselineNotes,commitSha:config.baselineCommit}];
 for(const commit of commits){
  const parent=run(root,'rev-parse',`${commit}^1`),paths=run(root,'diff','--name-only',parent,commit).split('\n').filter(Boolean);
  if(!playableChanges(paths,p=>at(root,parent,p),p=>at(root,commit,p)))continue;
  let note=config.bootstrap[commit];
  if(!note){try{note=checkNotes(root,parent,commit).notes[0];}catch(error){if(options.strict)throw error;note={title:'遊戲建置預覽',notes:['此為待審建置；正式玩家更新摘要須在合併前通過檢查。']};}}
  note=validateNote(note);history.push({...note,version:nextVersion(config.baselineVersion,history.length,config.patchCeiling),date:run(root,'show','-s','--format=%cI',commit).slice(0,10),commitSha:commit});
 }
 let dirty=false;
 if(!options.head&&options.working!==false){const paths=[...run(root,'-c','core.quotepath=false','diff','--name-only',head).split('\n'),...run(root,'-c','core.quotepath=false','ls-files','--others','--exclude-standard').split('\n')].filter(Boolean);dirty=playableChanges(paths,p=>at(root,head,p),p=>{try{return read(root,p);}catch{return '';}});if(dirty){const pending=paths.filter(p=>/^releases\/notes\/[a-z0-9-]+\.json$/.test(p)&&!at(root,head,p));const note=pending.length===1?validateNote(JSON.parse(read(root,pending[0]))):{title:'本機建置預覽',notes:['本機尚未提交的變更，正式更新資訊以合併後建置為準。']};history.push({...note,version:nextVersion(config.baselineVersion,history.length,config.patchCeiling),date:run(root,'show','-s','--format=%cI',head).slice(0,10),commitSha:head});}}
 const current=history.at(-1);return {format:1,version:current.version,date:current.date,title:current.title,commitSha:head,contentSha:current.commitSha,dirty,history:history.reverse(),legacyNotes:JSON.parse(read(root,'releases/legacy-notes.json'))};
}
export function prepare(root=process.cwd(),options={}){const metadata=createMetadata(root,options),file=resolve(root,'.release/metadata.json');mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(metadata,null,2)+'\n');return metadata;}
export function loadMetadata(root=process.cwd()){const file=resolve(root,'.release/metadata.json');return existsSync(file)?JSON.parse(readFileSync(file,'utf8')):prepare(root);}
