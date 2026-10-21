from pathlib import Path
import shutil,json,re,hashlib,os
root=Path('/workspace/research/issue18-hotfix/native');root.mkdir(exist_ok=True)
variants=[('before-55',Path('/workspace/lieguo-ux2/dist'),'0.30.55','a'),('patched-55',Path('/workspace/lieguo-issue18/dist'),'0.30.55','a'),('patched-56',Path('/workspace/lieguo-issue18/dist'),'0.30.56','b'),('docs-55',Path('/workspace/lieguo-issue18/dist'),'0.30.55','a')]
manifest=[]
for name,src,version,token in variants:
 dst=root/name/'lieguo-zhengtu-origin';shutil.copytree(src,dst,dirs_exist_ok=True);original=json.loads((src/'version.json').read_text());replacements={original['version']:version,original['contentSha']:token*40,original['commitSha']:('d' if name=='docs-55' else token)*40}
 # Content identity can equal commit identity in the unmodified bundle.
 if original['contentSha']==original['commitSha']:replacements[original['commitSha']]=token*40
 for p in list(dst.rglob('*')):
  if not p.is_file() or p.suffix not in ['.js','.json','.html','.md','.svg','.map','.webmanifest']:continue
  s=p.read_text()
  for old,new in replacements.items():s=s.replace(old,new)
  if p.name=='sw.js':s,n=re.subn(r'revision:(?:null|"[^"]*")','revision:"'+hashlib.sha256(name.encode()).hexdigest()[:32]+'"',s);assert n>100,n
  p.write_text(s)
 for p in list(dst.glob('sw-release-*.js')):
  target=dst/('sw-release-'+token*40+'.js')
  if p!=target:p.rename(target)
 if name=='docs-55':
  p=dst/'version.json';d=json.loads(p.read_text());d['commitSha']='d'*40;p.write_text(json.dumps(d))
 manifest.append({'name':name,'sourceBuild':original,'syntheticVersion':version,'syntheticContentSha':token*40,'patches':'release labels/identity and precache revisions only; application logic unchanged'})
web=root/'web';web.mkdir(exist_ok=True);link=web/'lieguo-zhengtu-origin'
if not link.exists():link.symlink_to(root/'before-55'/'lieguo-zhengtu-origin',target_is_directory=True)
(root/'fixture-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('Prepared four synthetic native SW fixtures; actual candidate build remains unchanged')

# Deliberate native fault injection in a localhost-only fixture, never Production.
src=root/'patched-55'/'lieguo-zhengtu-origin';dst=root/'fault-55'/'lieguo-zhengtu-origin';shutil.copytree(src,dst,dirs_exist_ok=True)
pre="let __r18Abort=false;self.addEventListener('message',e=>{if(e.data?.type==='sync')__r18Abort=true;});const __r18Tx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...a){const t=__r18Tx.apply(this,a);if(__r18Abort&&t.mode==='readwrite'){queueMicrotask(()=>{try{t.abort();self.postMessage({type:'r18-native-abort'});}catch{}});}return t;};\n"
for p in dst.glob('assets/runtime.worker-*.js'):p.write_text(pre+p.read_text())
p=dst/'sw.js';p.write_text(re.sub(r'revision:(?:null|"[^"]*")','revision:"fault-55-final"',p.read_text()))
