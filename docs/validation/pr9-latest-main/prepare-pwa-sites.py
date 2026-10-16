from pathlib import Path
import json,subprocess,os,shutil
root=Path('/workspace/lieguo-pr9-delta');p=Path('/workspace/pr9-delta-private/pwa');env=dict(os.environ,GIT_AUTHOR_NAME='Release validation',GIT_AUTHOR_EMAIL='release-validation@example.invalid',GIT_COMMITTER_NAME='Release validation',GIT_COMMITTER_EMAIL='release-validation@example.invalid')
def git(*args,input=None,extra=None):return subprocess.check_output(['git',*args],cwd=root,env=dict(env,**(extra or {})),input=input).decode().strip()
head=git('rev-parse','HEAD');tree=git('rev-parse','HEAD^{tree}');idx={'GIT_INDEX_FILE':str(p/'docs.index')};git('read-tree',tree,extra=idx);blob=git('hash-object','-w','--stdin',input=b'Docs-only PR9 PWA validation, no ref\n');git('update-index','--add','--cacheinfo','100644',blob,'docs/pr9-docs-pwa-fixture.md',extra=idx);dt=git('write-tree','--missing-ok',extra=idx);docsHead=git('commit-tree',dt,'-p',head,input=b'Isolated docs fixture; never publish or update a ref\n')
js="import {createMetadata} from './scripts/release-metadata.mjs';console.log(JSON.stringify(createMetadata(process.cwd(),{head:process.argv[1],strict:true})))"
def metadata(sha):return json.loads(subprocess.check_output(['node','--input-type=module','-e',js,sha],cwd=root))
a=metadata(head);docs=metadata(docsHead);b=dict(a,commitSha='f'*40,contentSha='e'*40);assert a['version']=='0.30.53';assert a['history']==docs['history'] and a['contentSha']==docs['contentSha'] and a['commitSha']!=docs['commitSha'];assert [r['version'] for r in a['history']]==['0.30.53','0.30.52','0.30.51','0.30.50']
shutil.copytree(root/'dist',p/'site-a/lieguo-zhengtu-origin',dirs_exist_ok=True);assert json.loads((p/'site-a/lieguo-zhengtu-origin/version.json').read_text())==a
cache=root/'.release/metadata.json';original=cache.read_bytes()
try:
 for label,m in [('docs',docs),('b',b)]:
  cache.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
  with (p/f'build-{label}.txt').open('w') as log:subprocess.run(['node','node_modules/vite/bin/vite.js','build','--outDir',str(p/f'site-{label}/lieguo-zhengtu-origin')],cwd=root,env=dict(os.environ,GITHUB_ACTIONS='true',GITHUB_REPOSITORY='cadence-jameds/lieguo-zhengtu-origin'),stdout=log,stderr=subprocess.STDOUT,check=True)
finally:cache.write_bytes(original)
web=p/'web';web.mkdir(exist_ok=True);link=web/'lieguo-zhengtu-origin'
if link.is_symlink():link.unlink()
link.symlink_to(p/'site-a/lieguo-zhengtu-origin')
(p/'metadata-cases.json').write_text(json.dumps({'testedSourceHead':head,'localDocsObjectOnly':True,'a':a,'docs':docs,'b':b,'bIdentitiesSynthetic':True},ensure_ascii=False,indent=2)+'\n');print(json.dumps({'head':head,'version':a['version'],'history':[r['version'] for r in a['history']],'docsStable':True}))
