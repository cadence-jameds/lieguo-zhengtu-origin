from pathlib import Path
import subprocess,json,shutil,os
root=Path('/workspace/lieguo-release-auto');p=Path('/workspace/r17-delta-private')
env=dict(os.environ,GIT_AUTHOR_NAME='Release validation',GIT_AUTHOR_EMAIL='release-validation@example.invalid',GIT_COMMITTER_NAME='Release validation',GIT_COMMITTER_EMAIL='release-validation@example.invalid',GIT_AUTHOR_DATE='2026-10-16T05:30:00Z',GIT_COMMITTER_DATE='2026-10-16T05:30:00Z')
def git(*args,input=None,extra=None):return subprocess.check_output(['git',*args],cwd=root,env=dict(env,**(extra or {})),input=input).decode().strip()
tree=git('write-tree','--missing-ok');candidate=git('commit-tree',tree,'-p','6405f7e155b5747c93a063799912b66f1362b9c7',input=b'Isolated PR17 integration candidate; no ref or merge action\n')
idx={'GIT_INDEX_FILE':str(p/'docs-fixture.index')};git('read-tree',tree,extra=idx)
blob=git('hash-object','-w','--stdin',input=b'Docs-only R17 validation fixture, never published\n');git('update-index','--add','--cacheinfo','100644',blob,'docs/r17-docs-only-fixture.md',extra=idx)
docs_tree=git('write-tree','--missing-ok',extra=idx);docs_commit=git('commit-tree',docs_tree,'-p',candidate,input=b'Docs-only validation fixture; no ref\n')
js="import {createMetadata} from './scripts/release-metadata.mjs'; console.log(JSON.stringify(createMetadata(process.cwd(),{head:process.argv[1],strict:true})))"
def metadata(sha):return json.loads(subprocess.check_output(['node','--input-type=module','-e',js,sha],cwd=root))
a=metadata(candidate);docs=metadata(docs_commit);assert a['version']=='0.30.52';assert [e['version'] for e in a['history']]==['0.30.52','0.30.51','0.30.50'];assert a['contentSha']==docs['contentSha'] and a['commitSha']!=docs['commitSha'];assert a['history']==docs['history']
b=dict(a,commitSha='f'*40,contentSha='e'*40)
cache=root/'.release/metadata.json';original=cache.read_bytes()
try:
 for label,meta in [('a',a),('docs',docs),('b',b)]:
  cache.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');dest=p/f'site-{label}/lieguo-zhengtu-origin'
  with (p/f'build-{label}.txt').open('w') as log:
   subprocess.run(['npm','run','build','--ignore-scripts','--','--outDir',str(dest)],cwd=root,env=dict(os.environ,GITHUB_ACTIONS='true',GITHUB_REPOSITORY='cadence-jameds/lieguo-zhengtu-origin'),stdout=log,stderr=subprocess.STDOUT,check=True)
  assert json.loads((dest/'version.json').read_text())==meta
finally:cache.write_bytes(original)
web=p/'web';web.mkdir(exist_ok=True);link=web/'lieguo-zhengtu-origin'
if link.is_symlink():link.unlink()
link.symlink_to(p/'site-a/lieguo-zhengtu-origin')
(p/'artifact-cases.json').write_text(json.dumps({'localObjectsOnly':True,'noRefUpdatesOrMergeActions':True,'integrationCandidate':candidate,'docsCommit':docs_commit,'a':a,'docs':docs,'b':b,'trueContentChangeBIsSynthetic':True},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'candidate':candidate,'docs':docs_commit,'version':a['version'],'docsKeepsContentHistoryVersion':True}))
