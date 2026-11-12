"""Finite global protection overlay successor; preserves preview, rules, storage and PWA."""
import atexit,hashlib,json,subprocess
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='0c2c9b05b7299639152ca7aa2bed80b618f5405a'
IMPLEMENTATION='9bc562731d090f63b14bed85b9d0c762efdae35f'
RECORD='docs/validation/global-protection/compatibility.json'
ADAPTERS=['scripts/preview_scene_successor.py','.github/workflows/ci.yml']
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
 s=replace_once(s,"def accepts(path,predecessor,root=ROOT):\n if path not in SOURCES:return False\n r=read_record(root);v=r['changes'].get(path)\n return bool(v and predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==v['after'])", "def accepts(path,predecessor,root=ROOT):\n from global_protection_successor import accepts as child\n if path not in SOURCES:return child(path,predecessor,root)\n r=read_record(root);v=r['changes'].get(path)\n if v and predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==v['after']:return True\n return child(path,predecessor,root)")
 s=replace_once(s,"def accepts_adapter(path,before,root=ROOT):\n if path not in ADAPTERS:return False\n read_record(root)\n return path in ADAPTERS and before==previous(BASE,path) and (root/path).exists() and (root/path).read_bytes()==adapters()[path]", "def accepts_adapter(path,before,root=ROOT):\n from global_protection_successor import accepts_adapter as child\n if path not in ADAPTERS:return child(path,before,root)\n read_record(root)\n return before==previous(BASE,path) and (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or child(path,adapters()[path],root))")
 s=replace_once(s,'def validate(root=ROOT):\n r=read_record(root)', 'def validate(root=ROOT):\n from global_protection_successor import accepts as child, accepts_adapter as child_adapter\n r=read_record(root)')
 s=replace_once(s,"assert sha((root/p).read_bytes())==v['after'],('Unrecorded preview/scene edit',p)","assert sha((root/p).read_bytes())==v['after'] or child(p,v['after'],root),('Unrecorded preview/scene edit',p)")
 s=replace_once(s,"assert (root/p).read_bytes()==b,('Unrecorded preview/scene adapter',p)","assert (root/p).read_bytes()==b or child_adapter(p,b,root),('Unrecorded preview/scene adapter',p)")
 ci=previous(BASE,ADAPTERS[1]).decode();anchor='          python3 scripts/test_preview_scene_successor.py\n';ci=replace_once(ci,anchor,anchor+'          python3 scripts/global_protection_successor.py\n          python3 scripts/test_global_protection_successor.py\n')
 return {p:s.encode(),ADAPTERS[1]:ci.encode()}
SOURCES={'releases/notes/preview-scene-shield.json','scripts/verify-preview-scene-browser.mjs','scripts/verify-global-protection-browser.mjs',*['src/game/presentation/'+p for p in ['CityScenes.tsx','ProtectionStatus.tsx','Shell.tsx','playable.css','playerExperience.test.tsx','sceneProtectionPreview.test.tsx','protectionPlacement.ts','protectionPlacement.test.ts']]}
# Player-approved follow-up; merged source evidence stays immutable.
FOLLOWUP_BASE='3cc66440942581aec2f85de02ce689634662abb8'
FOLLOWUP_IMPLEMENTATION='02fbbdbe1f51ef507623c4957d8093926e9e7934'
FOLLOWUP_SOURCES={'src/game/presentation/ProtectionStatus.tsx','src/game/presentation/protectionPlacement.ts','src/game/presentation/protectionPlacement.test.ts','scripts/verify-global-protection-browser.mjs','scripts/verify-preview-scene-browser.mjs','releases/notes/outskirts-adaptive-shield.json'}
@lru_cache(maxsize=1)
def followup_changes():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',FOLLOWUP_BASE,FOLLOWUP_IMPLEMENTATION],text=True).splitlines())
 assert actual==FOLLOWUP_SOURCES,('Outskirts follow-up scope differs',actual^FOLLOWUP_SOURCES)
 changes={}
 for p in sorted(FOLLOWUP_SOURCES):
  try:before=sha(previous(FOLLOWUP_BASE,p))
  except subprocess.CalledProcessError:before=None
  changes[p]={'before':before,'after':sha(previous(FOLLOWUP_IMPLEMENTATION,p))}
 # Preserve the original source pin and admit only this exact harness follow-up.
 base,commit,p='bfa2498ab5394f2e05bcdfc45c4fbb72bda0377e','d8c06e128708c0edd168f7a1e0e56b85224dbd86','scripts/verify-preview-scene-browser.mjs'
 assert subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',base,commit],text=True).splitlines()==[p],'Changed harness follow-up scope'
 assert sha(previous(base,p))==changes[p]['after'],'Changed harness predecessor'
 changes[p]['after']=sha(previous(commit,p))
 return changes
def accepts_followup(path,predecessor,root=ROOT):
 v=followup_changes().get(path)
 return bool(v and v['before']==predecessor and (root/path).exists() and sha((root/path).read_bytes())==v['after'])
@lru_cache(maxsize=1)
def expected_record():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines())
 assert actual==SOURCES,('Global shield scope differs',actual^SOURCES)
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
   e=r.get('changes',{}).get(p,{});values=[e.get('before'),e.get('after')] if isinstance(e,dict) else []
   values+=[r.get('invariants',{}).get(p)];values+=r.get('grants',{}).get(p,[])
   for v in values:
    if isinstance(v,str) and len(v)==64 and v not in grants[p]:grants[p].append(v)
 critical=subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only',BASE,'src','public/art'],text=True).splitlines()+['vite.config.ts','package.json','package-lock.json','scripts/verify-in-isolation.mjs','scripts/verify-startup-storage-browser.mjs']
 invariants={p:sha(previous(BASE,p)) for p in critical if p not in SOURCES}
 historical={p:sha(previous(BASE,p)) for p in records if p.endswith('/compatibility.json')}
 for v in [95,96,97]:
  p=f'docs/b6-v{v}/河谷戰役_vNext_平衡重構討論_v{v}.md';historical[p]=sha(previous(BASE,p))
 return {'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'changes':changes,'grants':grants,'invariants':invariants,'historical':historical,'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(b)} for p,b in adapters().items()}}
def read_record(root=ROOT):
 f=root/RECORD
 if not f.exists():f=ROOT/RECORD
 r=json.loads(f.read_text());assert r==expected_record(),'Changed pinned global protection proof';return r
def accepts(path,predecessor,root=ROOT):
 if path not in SOURCES:return False
 r=read_record(root);v=r['changes'].get(path)
 return bool(v and predecessor in r['grants'].get(path,[]) and (root/path).exists() and (sha((root/path).read_bytes())==v['after'] or accepts_followup(path,v['after'],root)))
def accepts_adapter(path,before,root=ROOT):
 if path not in ADAPTERS:return False
 read_record(root)
 return before==previous(BASE,path) and (root/path).exists() and (root/path).read_bytes()==adapters()[path]
def validate(root=ROOT):
 r=read_record(root)
 for p,v in followup_changes().items():assert sha((root/p).read_bytes())==v['after'],('Unpinned outskirts follow-up',p)
 for p,v in r['changes'].items():assert sha((root/p).read_bytes())==v['after'] or accepts_followup(p,v['after'],root),('Unpinned global protection edit',p)
 for section in ['invariants','historical']:
  for p,v in r[section].items():assert sha((root/p).read_bytes())==v,('Preview/rules/storage/PWA/history changed',p)
 for p,b in adapters().items():assert (root/p).read_bytes()==b,('Unpinned global protection adapter',p)
 return r
if __name__=='__main__':validate();print('PASS: one global protection UI; exact PR64 previews, all other src, game rules, storage, PWA and historical evidence preserved.')
