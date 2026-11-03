import {afterEach,expect,it} from 'vitest';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createMetadata,nextVersion} from '../../scripts/release-metadata.mjs';
const rule='patch-99-to-minor',dirs:string[]=[];
afterEach(()=>{for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
it('the explicitly approved patch carry repeats without granting an implicit carry to other configurations',()=>{
 expect(nextVersion('0.30.99',1,99,rule)).toBe('0.31.0');
 expect(nextVersion('0.30.99',102,99,rule)).toBe('0.32.1');
 expect(nextVersion('0.99.99',1,99,rule)).toBe('0.100.0');
 expect(()=>nextVersion('0.30.99',1)).toThrow('owner-approved');
});
it('unknown rollover rules, different ceilings and unsafe arithmetic fail closed',()=>{
 expect(()=>nextVersion('0.30.99',1,99,'invented')).toThrow('Unknown');
 expect(()=>nextVersion('0.30.99',1,9,rule)).toThrow('configuration');
 expect(()=>nextVersion('0.30.9007199254740991',1,99,rule)).toThrow('Invalid');
 expect(()=>nextVersion('0.9007199254740991.99',1,99,rule)).toThrow('configuration');
 expect(()=>nextVersion('0.30.99',-1,99,rule)).toThrow('Invalid');
});
it('committed and dirty metadata use the same approved rule and repeat builds are deterministic',()=>{
 const root=mkdtempSync(join(tmpdir(),'r306-release-'));dirs.push(root);
 const git=(...args:string[])=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_AUTHOR_DATE:'2026-11-03T00:00:00Z',GIT_COMMITTER_DATE:'2026-11-03T00:00:00Z'}}).trim();
 const put=(path:string,value:unknown)=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),typeof value==='string'?value:JSON.stringify(value));};
 git('init','-q');git('config','user.name','Release Test');git('config','user.email','release-test@example.invalid');put('README.md','baseline');git('add','.');git('commit','-qm','baseline');
 const base=git('rev-parse','HEAD');put('releases/config.json',{baselineCommit:base,baselineVersion:'0.30.99',baselineDate:'2026-11-02',baselineTitle:'既有版本',baselineNotes:['保留既有玩家命令與正式世界。'],patchCeiling:99,rolloverRule:rule,bootstrap:{}});put('releases/legacy-notes.json',[]);
 put('src/play.ts','export const value=1;');put('releases/notes/one.json',{title:'操作回饋改善',notes:['改善玩家操作的等待提示與查詢回饋。']});git('add','.');git('commit','-qm','approved feature');
 const metadata=createMetadata(root,{working:false,strict:true});expect(metadata.version).toBe('0.31.0');expect(createMetadata(root,{working:false,strict:true})).toEqual(metadata);
 put('src/play.ts','export const value=2;');const dirty=createMetadata(root);expect(dirty.version).toBe('0.31.1');expect(dirty.dirty).toBe(true);expect(createMetadata(root)).toEqual(dirty);
});
