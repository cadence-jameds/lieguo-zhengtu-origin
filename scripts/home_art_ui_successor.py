"""Finite player-experience successor: exact UI/art implementation, no gameplay/storage grant."""
import atexit,hashlib,json,subprocess
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='db63881e2ffd617259d736e2c66342de791b331d'
IMPLEMENTATION='9428b9cad8dbfafa929b5a5f9efde33bdb4bf3a2'
RECORD='docs/validation/home-art-ui/compatibility.json'
ADAPTERS=['scripts/android_startup_successor.py','.github/workflows/ci.yml','scripts/b10_r3_04_successor.py','scripts/b10_r3_06_successor.py']
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
 s=replace_once(s," return bool(v and predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==v['after'])", " if v and predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==v['after']:return True\n from home_art_ui_successor import accepts as child\n return child(path,predecessor,root)")
 s=replace_once(s," return path in ADAPTERS and before==previous(BASE,path) and (root/path).exists() and (root/path).read_bytes()==adapters()[path]", " from home_art_ui_successor import accepts_adapter as child\n if path not in ADAPTERS:return child(path,before,root)\n return before==previous(BASE,path) and (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or child(path,adapters()[path],root))")
 s=replace_once(s,'def validate(root=ROOT):\n r=read_record(root)', 'def validate(root=ROOT):\n from home_art_ui_successor import accepts as child, accepts_adapter as child_adapter\n r=read_record(root)')
 s=replace_once(s,"assert sha((root/p).read_bytes())==v['after'],('Unrecorded P0 source edit',p)","assert sha((root/p).read_bytes())==v['after'] or child(p,v['after'],root),('Unrecorded P0 source edit',p)")
 s=replace_once(s,"assert (root/p).read_bytes()==b,('Unrecorded adapter',p)","assert (root/p).read_bytes()==b or child_adapter(p,b,root),('Unrecorded adapter',p)")
 ci=previous(BASE,ADAPTERS[1]).decode();anchor='          python3 scripts/test_android_startup_successor.py\n'
 ci=replace_once(ci,anchor,anchor+'          python3 scripts/home_art_ui_successor.py\n          python3 scripts/test_home_art_ui_successor.py\n')
 projection=previous(BASE,ADAPTERS[2]).decode()
 projection=replace_once(projection,'\n if path not in CHANGES:return False\n r=read_record(root)','\n if path not in CHANGES:\n  from home_art_ui_successor import accepts as presentation_accepts\n  return presentation_accepts(path,predecessor,root)\n r=read_record(root)')
 runtime=previous(BASE,ADAPTERS[3]).decode()
 runtime=replace_once(runtime,'\n if path not in ADAPTERS:return False\n read_record(root)','\n if path not in ADAPTERS:\n  from home_art_ui_successor import accepts_adapter as presentation_adapter\n  return presentation_adapter(path,before,root)\n read_record(root)')
 return {p:s.encode(),ADAPTERS[1]:ci.encode(),ADAPTERS[2]:projection.encode(),ADAPTERS[3]:runtime.encode()}
@lru_cache(maxsize=1)
def expected_record():
 paths=subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines()
 expected={'releases/notes/home-art-loading-ui.json','scripts/fixtures/home-art.worker.ts','scripts/verify-home-art-browser.mjs','scripts/verify-startup-storage-browser.mjs','vite.config.ts'}
 expected|={'src/game/'+p for p in ['FormalHome.tsx','GameApp.tsx','game.css','newCampaignEntry.test.tsx','updateEntry.test.tsx']}
 expected|={'src/game/presentation/'+p for p in ['ArtLoading.tsx','CommandFailure.tsx','CommandInbox.tsx','ExtinctionView.tsx','ProtectionStatus.tsx','Start.tsx','artInventory.test.tsx','artInventory.ts','artLoader.test.ts','artLoader.ts','artMap.ts','artUrl.ts','extinctionP0C10.test.tsx','integrationV94.css','parity.test.tsx','playable.css','playerExperience.test.tsx','wallDelta.test.tsx']}
 support={RECORD,'scripts/home_art_ui_successor.py','scripts/test_home_art_ui_successor.py',*ADAPTERS}
 actual=set(paths);assert actual-support==expected and actual<=expected|support,'Scope differs from authorized four presentation/art tasks'
 paths=sorted(expected)
 changes={};grants={}
 for p in paths:
  try:before=sha(previous(BASE,p))
  except subprocess.CalledProcessError:before=None
  changes[p]={'before':before,'after':sha(previous(IMPLEMENTATION,p))};grants[p]=[before] if before else []
 records=subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only',BASE,'docs/validation'],text=True).splitlines()
 for record in records:
  if not record.endswith('/compatibility.json'):continue
  r=json.loads(previous(BASE,record))
  for p in paths:
   entry=r.get('changes',{}).get(p,{})
   values=[entry.get('before'),entry.get('after')] if isinstance(entry,dict) else []
   values+=[r.get('invariants',{}).get(p)];values+=r.get('grants',{}).get(p,[])
   for v in values:
    if isinstance(v,str) and len(v)==64 and v not in grants[p]:grants[p].append(v)
 critical=subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only',BASE,'src/game/formal','public/art'],text=True).splitlines()
 critical+=['src/game/'+p for p in ['LocalCampaignManager.tsx','campaignStorage.ts','storageRecovery.ts','useGame.ts','runtime.worker.ts','persistence.ts','replayFence.ts','durableCommands.ts','saveLock.ts','interaction.ts','serviceWorkerRelease.ts','useAppUpdate.ts','presentationStore.ts','worldStream.ts']]
 critical+=['scripts/verify-in-isolation.mjs','package.json','package-lock.json']
 invariants={p:sha(previous(BASE,p)) for p in critical}
 historical={p:sha(previous(BASE,p)) for p in records if p.endswith('/compatibility.json')}
 for v in [95,96,97]:
  p=f'docs/b6-v{v}/河谷戰役_vNext_平衡重構討論_v{v}.md';historical[p]=sha(previous(BASE,p))
 return {'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'implementationSupport':sorted(actual&support),'changes':changes,'grants':grants,'invariants':invariants,'historical':historical,'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(b)} for p,b in adapters().items()}}
def read_record(root=ROOT):
 f=root/RECORD
 if not f.exists():f=ROOT/RECORD
 r=json.loads(f.read_text());assert r==expected_record(),'Changed pinned UI/art proof or scope';return r
def accepts(path,predecessor,root=ROOT):
 r=read_record(root);v=r['changes'].get(path)
 if v and predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==v['after']:return True
 adapter=r['adapters'].get(path)
 return bool(adapter and predecessor==adapter['before'] and (root/path).exists() and sha((root/path).read_bytes())==adapter['after'])
def accepts_adapter(path,before,root=ROOT):
 read_record(root)
 return path in ADAPTERS and before==previous(BASE,path) and (root/path).exists() and (root/path).read_bytes()==adapters()[path]
def validate(root=ROOT):
 r=read_record(root)
 for p,v in r['changes'].items():assert sha((root/p).read_bytes())==v['after'],('Unrecorded UI/art source edit',p)
 for section in ['invariants','historical']:
  for p,v in r[section].items():assert sha((root/p).read_bytes())==v,('Gameplay, data safety, art file or history changed',p)
 for p,b in adapters().items():assert (root/p).read_bytes()==b,('Unrecorded successor adapter',p)
 # Release reply and update consent remain the existing implementation.
 config=(root/'vite.config.ts').read_text();old=previous(BASE,'vite.config.ts').decode()
 assert config.split('const workerReleaseSource=',1)[1].split('\n',1)[0]==old.split('const workerReleaseSource=',1)[1].split('\n',1)[0]
 assert 'registerType: "prompt"' in config and 'clientsClaim: false' in config
 assert 'importScripts: [workerReleaseFile,workerArtFile]' in config
 return r
if __name__=='__main__':validate();print('PASS: exact homepage/art/UI successor; Formal rules, B10 command/persistence/fence, PR62 storage recovery, art bytes and historical evidence preserved.')
