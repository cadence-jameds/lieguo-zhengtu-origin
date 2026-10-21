from pathlib import Path
import shutil,json,re,hashlib
root=Path('/workspace/research/issue18-delta/native');root.mkdir(exist_ok=True)
manifest=[]
for name,src,version,token in [('main-55',Path('/workspace/lieguo-issue18/dist'),'0.30.55','a'),('time2-55',Path('/workspace/research/issue18-delta/time2-copy/dist'),'0.30.55','a'),('time2-56',Path('/workspace/research/issue18-delta/time2-copy/dist'),'0.30.56','b')]:
 dst=root/name/'lieguo-zhengtu-origin';shutil.copytree(src,dst,dirs_exist_ok=True);meta=json.loads((src/'version.json').read_text());replacements={meta['version']:version,meta['commitSha']:token*40,meta['contentSha']:token*40}
 for p in dst.rglob('*'):
  if not p.is_file() or p.suffix not in ['.js','.json','.html','.md','.svg','.map','.webmanifest']:continue
  s=p.read_text()
  for old,new in replacements.items():s=s.replace(old,new)
  if p.name=='sw.js':s=re.sub(r'revision:(?:null|"[^"]*")','revision:"'+hashlib.sha256(name.encode()).hexdigest()[:32]+'"',s)
  p.write_text(s)
 for p in dst.glob('sw-release-*.js'):
  target=dst/('sw-release-'+token*40+'.js')
  if p!=target:p.rename(target)
 manifest.append({'variant':name,'buildMetadata':meta,'label':version,'contentSha':token*40,'testOnlyChanges':'release labels, identity and precache revisions; time2 source copy substitutes only FORMAL_DB_NAME'})
src=root/'time2-55'/'lieguo-zhengtu-origin';dst=root/'fault-55'/'lieguo-zhengtu-origin';shutil.copytree(src,dst,dirs_exist_ok=True)
pre="let __r18Abort=false;self.addEventListener('message',e=>{if(e.data?.type==='sync')__r18Abort=true;});const __r18Tx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...a){const t=__r18Tx.apply(this,a);if(__r18Abort&&t.mode==='readwrite'){queueMicrotask(()=>{try{t.abort();self.postMessage({type:'r18-native-abort'});}catch{}});}return t;};\n"
for p in dst.glob('assets/runtime.worker-*.js'):p.write_text(pre+p.read_text())
p=dst/'sw.js';p.write_text(re.sub(r'revision:(?:null|"[^"]*")','revision:"delta-fault"',p.read_text()))
(root/'web').mkdir(exist_ok=True);link=root/'web/lieguo-zhengtu-origin'
if not link.exists():link.symlink_to(root/'time2-55/lieguo-zhengtu-origin',target_is_directory=True)
(root/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))

# Keep the previous worker identity helper served while its worker can restart.
# This isolates durable-save fault tests from deleting an old deployment asset.
helper=root/'time2-55/lieguo-zhengtu-origin'/('sw-release-'+'a'*40+'.js')
for name in ['time2-56']:
 shutil.copy2(helper,root/name/'lieguo-zhengtu-origin'/helper.name)
