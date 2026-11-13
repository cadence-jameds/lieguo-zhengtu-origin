"""Finite preview/scene presentation successor; no gameplay, save, Runtime or PWA grant."""
import atexit,hashlib,json,subprocess
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='96935268381f4e6366489b46e7a168b89fd78fcc'
IMPLEMENTATION='7e528e4e8b12fa90f476c9b6690ec672059ad813'
RECORD='docs/validation/preview-scene-shield/compatibility.json'
ADAPTERS=['scripts/home_art_ui_successor.py','.github/workflows/ci.yml','scripts/android_startup_successor.py']
def sha(data):return hashlib.sha256(data).hexdigest()
_objects=None
def close_objects():
 global _objects
 if _objects is not None:_objects.stdin.close();_objects.wait();_objects=None
atexit.register(close_objects)
@lru_cache(maxsize=None)
def previous(ref,path):
 global _objects
 if _objects is None:_objects=subprocess.Popen(['git','-C',str(ROOT),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 _objects.stdin.write((ref+':'+path+'\n').encode());_objects.stdin.flush();header=_objects.stdout.readline().decode()
 if header.endswith(' missing\n'):raise subprocess.CalledProcessError(128,['git','show',ref+':'+path])
 fields=header.split();assert len(fields)==3 and fields[1]=='blob','Unexpected immutable object'
 size=int(fields[2]);data=_objects.stdout.read(size);assert len(data)==size and _objects.stdout.read(1)==b'\n','Incomplete immutable blob'
 return data
def replace_once(text,before,after):
 assert text.count(before)==1,('Ambiguous adapter',before[:80]);return text.replace(before,after)
@lru_cache(maxsize=1)
def adapters():
 p=ADAPTERS[0];s=previous(BASE,p).decode()
 s=replace_once(s," r=read_record(root);v=r['changes'].get(path)\n if v and", " from preview_scene_successor import accepts as child\n if child(path,predecessor,root):return True\n r=read_record(root);v=r['changes'].get(path)\n if v and")
 s=replace_once(s,"def accepts_adapter(path,before,root=ROOT):\n read_record(root)\n return path in ADAPTERS and before==previous(BASE,path) and (root/path).exists() and (root/path).read_bytes()==adapters()[path]", "def accepts_adapter(path,before,root=ROOT):\n read_record(root)\n from preview_scene_successor import accepts_adapter as child\n if path not in ADAPTERS:return child(path,before,root)\n return before==previous(BASE,path) and (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or child(path,adapters()[path],root))")
 s=replace_once(s,'def validate(root=ROOT):\n r=read_record(root)', 'def validate(root=ROOT):\n from preview_scene_successor import accepts as child, accepts_adapter as child_adapter\n r=read_record(root)')
 s=replace_once(s,"assert sha((root/p).read_bytes())==v['after'],('Unrecorded UI/art source edit',p)","assert sha((root/p).read_bytes())==v['after'] or child(p,v['after'],root),('Unrecorded UI/art source edit',p)")
 s=replace_once(s,"assert (root/p).read_bytes()==b,('Unrecorded successor adapter',p)","assert (root/p).read_bytes()==b or child_adapter(p,b,root),('Unrecorded successor adapter',p)")
 ci=previous(BASE,ADAPTERS[1]).decode();anchor='          python3 scripts/test_home_art_ui_successor.py\n';ci=replace_once(ci,anchor,anchor+'          python3 scripts/preview_scene_successor.py\n          python3 scripts/test_preview_scene_successor.py\n')
 startup=previous(BASE,ADAPTERS[2]).decode()
 startup=replace_once(startup,"for p,d in r[section].items():assert sha((root/p).read_bytes())==d,('Protected authority/rule/evidence changed',p)","for p,d in r[section].items():assert sha((root/p).read_bytes())==d or (section=='invariants' and child(p,d,root)),('Protected authority/rule/evidence changed',p)")
 return {p:s.encode(),ADAPTERS[1]:ci.encode(),ADAPTERS[2]:startup.encode()}
SOURCES={
 'releases/notes/preview-scene-shield.json','scripts/fixtures/preview-scene.worker.ts','scripts/verify-preview-scene-browser.mjs','scripts/verify-home-art-browser.mjs',
 *['src/game/'+p for p in ['FormalCityPanel.tsx','constructionPreviewCompute.ts','constructionPreviewController.ts','constructionPreviewDependencies.ts','constructionPreviewDependencies.test.ts','constructionPreviewProtocol.ts']],
 *['src/game/presentation/'+p for p in ['BuildingDetail.tsx','CityScenes.tsx','ProtectionStatus.tsx','Shell.tsx','asyncConstructionPreview.test.tsx','playable.css','playerExperience.test.tsx','sceneProtectionPreview.test.tsx','useConstructionPreviews.tsx']]
}
@lru_cache(maxsize=1)
def expected_record():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines())
 support={RECORD,'scripts/preview_scene_successor.py','scripts/test_preview_scene_successor.py',*ADAPTERS}
 # Review evidence never grants a gameplay/source change. Keep its paths finite.
 support|={'docs/validation/preview-scene-shield/'+p for p in ['README.md','1440x900-shield.png','320x640-details.png','320x640-shield.png','390x844-details.png','after-390-25x-dialog.png','after-390-shield.png','before-390-25x-dialog.png','before-390-shield.png','browser-checks.json','measurements.json','safety-browser-checks.json']}
 assert actual-support==SOURCES and actual<=SOURCES|support,('Scope differs from the authorized preview/shield/copy task',actual-SOURCES-support)
 changes={};grants={}
 for p in sorted(SOURCES):
  try:before=sha(previous(BASE,p))
  except subprocess.CalledProcessError:before=None
  changes[p]={'before':before,'after':sha(previous(IMPLEMENTATION,p))};grants[p]=[before] if before else []
 records=subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only',BASE,'docs/validation'],text=True).splitlines()
 for record in records:
  if not record.endswith('/compatibility.json'):continue
  r=json.loads(previous(BASE,record))
  for p in SOURCES:
   entry=r.get('changes',{}).get(p,{})
   values=[entry.get('before'),entry.get('after')] if isinstance(entry,dict) else []
   values+=[r.get('invariants',{}).get(p)];values+=r.get('grants',{}).get(p,[])
   for v in values:
    if isinstance(v,str) and len(v)==64 and v not in grants[p]:grants[p].append(v)
 critical=subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only',BASE,'src','public/art'],text=True).splitlines()
 critical+=['vite.config.ts','package.json','package-lock.json','scripts/verify-in-isolation.mjs','scripts/verify-startup-storage-browser.mjs']
 invariants={p:sha(previous(BASE,p)) for p in critical if p not in SOURCES}
 historical={p:sha(previous(BASE,p)) for p in records if p.endswith('/compatibility.json')}
 for v in [95,96,97]:
  p=f'docs/b6-v{v}/河谷戰役_vNext_平衡重構討論_v{v}.md';historical[p]=sha(previous(BASE,p))
 return {'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'implementationSupport':sorted(actual&support),'changes':changes,'grants':grants,'invariants':invariants,'historical':historical,'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(b)} for p,b in adapters().items()}}
def read_record(root=ROOT):
 f=root/RECORD
 if not f.exists():f=ROOT/RECORD
 r=json.loads(f.read_text());assert r==expected_record(),'Changed pinned preview/scene proof or scope';return r
def accepts(path,predecessor,root=ROOT):
 from android_save_successor import accepts as hotfix
 from global_protection_successor import accepts as child
 if path not in SOURCES:return child(path,predecessor,root)
 r=read_record(root);v=r['changes'].get(path)
 if v and predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==v['after']:return True
 return child(path,predecessor,root) or hotfix(path,predecessor,root)
def accepts_adapter(path,before,root=ROOT):
 from global_protection_successor import accepts_adapter as child
 if path not in ADAPTERS:return child(path,before,root)
 read_record(root)
 return before==previous(BASE,path) and (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or child(path,adapters()[path],root))
def validate(root=ROOT):
 from android_save_successor import accepts as hotfix
 from global_protection_successor import accepts as child, accepts_adapter as child_adapter
 r=read_record(root)
 for p,v in r['changes'].items():assert sha((root/p).read_bytes())==v['after'] or child(p,v['after'],root) or hotfix(p,v['after'],root),('Unrecorded preview/scene edit',p)
 for section in ['invariants','historical']:
  for p,v in r[section].items():assert sha((root/p).read_bytes())==v or section=='invariants' and hotfix(p,v,root),('Gameplay, Runtime, PWA, data safety or historical evidence changed',p)
 for p,b in adapters().items():assert (root/p).read_bytes()==b or child_adapter(p,b,root),('Unrecorded preview/scene adapter',p)
 return r
if __name__=='__main__':validate();print('PASS: pinned preview/scene UI successor; all other src, Formal rules, B10 persistence/fence, PR62 storage recovery, PWA and art bytes preserved.')
