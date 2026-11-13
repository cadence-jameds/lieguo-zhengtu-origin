"""Finite timestamp/notice hotfix. Historical proofs, rules and save formats stay pinned."""
import atexit,hashlib,json,subprocess
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='d5a6f544d87c0308c0105075f233bbfa0aeb1329'
IMPLEMENTATION='d86bce6d86d3e05b786f9046d587426e13760ef6'
RECORD='docs/validation/android-background-save/compatibility.json'
SOURCES={'releases/notes/android-background-save.json','scripts/fixtures/background-save.worker.ts','scripts/verify-background-save-browser.mjs',*['src/game/'+p for p in ['GameApp.tsx','LocalCampaignManager.tsx','ProjectionSyncNotice.tsx','commandFeedback.ts','persistence.ts','runtime.worker.ts','useGame.ts','persistenceTime.ts','persistenceTime.test.ts','playerMessage.ts','saveStatus.ts','useSaveNotices.test.tsx','formal/backgroundSaveHotfix.test.ts','presentation/GameNotices.tsx','presentation/gameNotices.test.tsx','presentation/GovernanceView.tsx','presentation/playable.css','presentation/useConstructionPreviews.tsx']]}
ADAPTERS=['scripts/global_protection_successor.py','scripts/preview_scene_successor.py','scripts/home_art_ui_successor.py','scripts/android_startup_successor.py','.github/workflows/ci.yml']
def sha(data):return hashlib.sha256(data).hexdigest()
_objects=None
def close_objects():
 global _objects
 if _objects is not None:_objects.stdin.close();_objects.wait();_objects.stdout.close();_objects=None
atexit.register(close_objects)
@lru_cache(maxsize=32)
def previous(ref,path):
 global _objects
 if _objects is None:_objects=subprocess.Popen(['git','-C',str(ROOT),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 _objects.stdin.write((ref+':'+path+'\n').encode());_objects.stdin.flush();header=_objects.stdout.readline().decode()
 if header.endswith(' missing\n'):raise subprocess.CalledProcessError(128,['git','show',ref+':'+path])
 fields=header.split();assert len(fields)==3 and fields[1]=='blob';size=int(fields[2]);data=_objects.stdout.read(size);assert len(data)==size and _objects.stdout.read(1)==b'\n';return data
def edit(s,before,after):
 assert s.count(before)==1,('Ambiguous finite adapter',before[:100]);return s.replace(before,after)
@lru_cache(maxsize=1)
def adapters():
 p=ADAPTERS[0];s=previous(BASE,p).decode()
 s=edit(s,"def accepts(path,predecessor,root=ROOT):\n if path not in SOURCES:return False", "def accepts(path,predecessor,root=ROOT):\n from android_save_successor import accepts as child\n if path not in SOURCES:return False")
 s=edit(s,"\n return bool(v and predecessor in r['grants'].get(path,[]) and (root/path).exists() and (sha((root/path).read_bytes())==v['after'] or accepts_followup(path,v['after'],root)))", "\n if v and predecessor in r['grants'].get(path,[]) and (root/path).exists() and (sha((root/path).read_bytes())==v['after'] or accepts_followup(path,v['after'],root)):return True\n return child(path,predecessor,root)")
 s=edit(s,"def accepts_adapter(path,before,root=ROOT):\n if path not in ADAPTERS:return False", "def accepts_adapter(path,before,root=ROOT):\n from android_save_successor import accepts_adapter as child\n if path not in ADAPTERS:return child(path,before,root)")
 s=edit(s,"\n return before==previous(BASE,path) and (root/path).exists() and (root/path).read_bytes()==adapters()[path]", "\n return before==previous(BASE,path) and (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or child(path,adapters()[path],root))")
 s=edit(s,'def validate(root=ROOT):\n r=read_record(root)', 'def validate(root=ROOT):\n from android_save_successor import accepts as child, accepts_adapter as child_adapter\n r=read_record(root)')
 s=edit(s,"assert sha((root/p).read_bytes())==v['after'] or accepts_followup(p,v['after'],root),('Unpinned global protection edit',p)","assert sha((root/p).read_bytes())==v['after'] or accepts_followup(p,v['after'],root) or child(p,v['after'],root),('Unpinned global protection edit',p)")
 s=edit(s,"\n  for p,v in r[section].items():assert sha((root/p).read_bytes())==v,('Preview/rules/storage/PWA/history changed',p)","\n  for p,v in r[section].items():assert sha((root/p).read_bytes())==v or section=='invariants' and child(p,v,root),('Preview/rules/storage/PWA/history changed',p)")
 s=edit(s,"\n for p,b in adapters().items():assert (root/p).read_bytes()==b,('Unpinned global protection adapter',p)","\n for p,b in adapters().items():assert (root/p).read_bytes()==b or child_adapter(p,b,root),('Unpinned global protection adapter',p)")
 result={p:s.encode()}
 for p,message in [(ADAPTERS[1],'Gameplay, Runtime, PWA, data safety or historical evidence changed'),(ADAPTERS[2],'Gameplay, data safety, art file or history changed')]:
  s=previous(BASE,p).decode()
  s=edit(s,'def validate(root=ROOT):\n', 'def validate(root=ROOT):\n from android_save_successor import accepts as hotfix\n')
  s=edit(s,f"\n  for p,v in r[section].items():assert sha((root/p).read_bytes())==v,('{message}',p)",f"\n  for p,v in r[section].items():assert sha((root/p).read_bytes())==v or section=='invariants' and hotfix(p,v,root),('{message}',p)")
  if p==ADAPTERS[1]:
   # Keep the older public UI-only scope: its existing negative tests still apply.
   s=edit(s,'def accepts(path,predecessor,root=ROOT):\n', 'def accepts(path,predecessor,root=ROOT):\n from android_save_successor import accepts as hotfix\n')
   s=edit(s,'\n return child(path,predecessor,root)\ndef accepts_adapter', '\n return child(path,predecessor,root) or hotfix(path,predecessor,root)\ndef accepts_adapter')
   s=edit(s,"assert sha((root/p).read_bytes())==v['after'] or child(p,v['after'],root),('Unrecorded preview/scene edit',p)","assert sha((root/p).read_bytes())==v['after'] or child(p,v['after'],root) or hotfix(p,v['after'],root),('Unrecorded preview/scene edit',p)")
  else:
   s=edit(s,'def accepts(path,predecessor,root=ROOT):\n', "def accepts(path,predecessor,root=ROOT):\n from android_save_successor import accepts as hotfix\n if path in read_record(root)['changes'] and hotfix(path,predecessor,root):return True\n")
   s=edit(s,"assert sha((root/p).read_bytes())==v['after'] or child(p,v['after'],root),('Unrecorded UI/art source edit',p)","assert sha((root/p).read_bytes())==v['after'] or child(p,v['after'],root) or hotfix(p,v['after'],root),('Unrecorded UI/art source edit',p)")
  result[p]=s.encode()
 p=ADAPTERS[3];s=previous(BASE,p).decode()
 s=edit(s,"def accepts(path,predecessor,root=ROOT):\n r=read_record(root);v=r['changes'].get(path)","def accepts(path,predecessor,root=ROOT):\n r=read_record(root);v=r['changes'].get(path)\n from android_save_successor import accepts as hotfix\n if hotfix(path,predecessor,root):return True")
 s=edit(s,'from home_art_ui_successor import accepts as child, accepts_adapter as child_adapter', 'from home_art_ui_successor import accepts as inherited, accepts_adapter as child_adapter\n from android_save_successor import accepts as hotfix\n def child(path,predecessor,root):return inherited(path,predecessor,root) or hotfix(path,predecessor,root)')
 s=edit(s,"assert (root/p).read_text().split(\" if(r.type==='start'){\",1)[1]==previous(BASE,p).decode().split(\" if(r.type==='start'){\",1)[1],'Changed formal transitions/intake/T2/drain'", "assert (root/p).read_text().split(\" if(r.type==='start'){\",1)[1]==previous(BASE,p).decode().split(\" if(r.type==='start'){\",1)[1] or child(p,sha(previous(BASE,p)),root),'Changed formal transitions/intake/T2/drain'");result[p]=s.encode()
 p=ADAPTERS[4];s=previous(BASE,p).decode();anchor='          python3 scripts/test_global_protection_successor.py\n';result[p]=edit(s,anchor,anchor+'          python3 scripts/android_save_successor.py\n          python3 scripts/test_android_save_successor.py\n').encode()
 return result
@lru_cache(maxsize=1)
def expected_record():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines());assert actual==SOURCES,('Unrequested hotfix source scope',actual^SOURCES)
 changes={};grants={};adapter_grants={p:[sha(previous(BASE,p))] for p in ADAPTERS}
 for p in sorted(SOURCES):
  try:before=sha(previous(BASE,p))
  except subprocess.CalledProcessError:before=None
  changes[p]={'before':before,'after':sha(previous(IMPLEMENTATION,p))};grants[p]=[before] if before else []
 records=subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only',BASE,'docs/validation'],text=True).splitlines()
 for p in records:
  if not p.endswith('/compatibility.json'):continue
  r=json.loads(previous(BASE,p))
  for source in SOURCES:
   v=r.get('changes',{}).get(source,{});values=[v.get('before'),v.get('after')] if isinstance(v,dict) else []
   values+=[r.get('invariants',{}).get(source)];values+=r.get('grants',{}).get(source,[])
   for h in values:
    if isinstance(h,str) and len(h)==64 and h not in grants[source]:grants[source].append(h)
  for source in ADAPTERS:
   for key in ['before','after']:
    h=r.get('adapters',{}).get(source,{}).get(key)
    if isinstance(h,str) and len(h)==64 and h not in adapter_grants[source]:adapter_grants[source].append(h)
 critical=subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only',BASE,'src','public/art','releases/notes'],text=True).splitlines()+['vite.config.ts','package.json','package-lock.json','scripts/verify-in-isolation.mjs','scripts/verify-runtime-parity.mjs','scripts/verify-projection-boundaries.mjs','scripts/verify-preview-boundaries.mjs']
 invariants={p:sha(previous(BASE,p)) for p in critical if p not in SOURCES}
 historical={p:sha(previous(BASE,p)) for p in records if p.endswith('/compatibility.json')}
 for v in [95,96,97]:
  p=f'docs/b6-v{v}/河谷戰役_vNext_平衡重構討論_v{v}.md';historical[p]=sha(previous(BASE,p))
 result={'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'changes':changes,'grants':grants,'adapterGrants':adapter_grants,'invariants':invariants,'historical':historical,'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(b)} for p,b in adapters().items()}}
 previous.cache_clear();close_objects();return result

def read_record(root=ROOT):
 f=root/RECORD
 if not f.exists():f=ROOT/RECORD
 r=json.loads(f.read_text());assert r==expected_record(),'Changed immutable Android save hotfix proof';return r
def accepts(path,predecessor,root=ROOT):
 if path not in SOURCES:return False
 r=read_record(root);v=r['changes'].get(path)
 return bool(v and predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==v['after'])
def accepts_adapter(path,before,root=ROOT):
 if path not in ADAPTERS:return False
 r=read_record(root)
 return sha(before) in r['adapterGrants'][path] and (root/path).exists() and (root/path).read_bytes()==adapters()[path]
def validate(root=ROOT):
 r=read_record(root)
 for p,v in r['changes'].items():assert sha((root/p).read_bytes())==v['after'],('Unpinned Android save hotfix',p)
 for section in ['invariants','historical']:
  for p,h in r[section].items():assert sha((root/p).read_bytes())==h,('Rules/schema/AI/ledger/fence/PWA/protection/history changed',p)
 for p,b in adapters().items():assert (root/p).read_bytes()==b,('Changed finite hotfix adapter',p)
 css='src/game/presentation/playable.css';assert (root/css).read_bytes().startswith(previous(BASE,css)),'Existing styles changed'
 p='src/game/persistence.ts';before=previous(BASE,p).decode();expected="import {persistenceTime} from './persistenceTime';\n"+before;expected=edit(expected,'  // Final encodeSave validates the entire stamped candidate before any writes.','  savedAt=persistenceTime(savedAt);\n  // Final encodeSave validates the entire stamped candidate before any writes.');assert (root/p).read_text()==expected,'Unrequested persistence transaction change'
 p='src/game/runtime.worker.ts';before=previous(BASE,p).decode();after=(root/p).read_text();assert next(x for x in before.splitlines() if x.startswith('const targetTime='))==next(x for x in after.splitlines() if x.startswith('const targetTime=')),'Changed world-time formula';assert before.split(' requests.push(r);',1)[1]==after.split(' requests.push(r);',1)[1],'Changed T1 intake, FIFO or tick scheduling'
 return r
if __name__=='__main__':validate();print('PASS: finite Android timestamp/notice hotfix; strict schema, atomic T1/T2/T3, rules, AI, Replay Fence, PWA, protection and historical evidence preserved.')
