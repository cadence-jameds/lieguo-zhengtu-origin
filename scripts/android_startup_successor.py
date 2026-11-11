"""Finite P0 startup/recovery successor. No gameplay, storage-format or deadline waiver."""
import hashlib,json,subprocess
from pathlib import Path
from functools import lru_cache
ROOT=Path(__file__).resolve().parents[1]
BASE='233130edd7608c455dc1ebe429aaad99db10b452'
IMPLEMENTATION='547e0bcb981c489380168bfa94ba0d3cd5873048'
RECORD='docs/validation/android-startup-recovery/compatibility.json'
ADAPTERS=['scripts/b10_release_unblock_successor.py','.github/workflows/ci.yml']
def sha(data):return hashlib.sha256(data).hexdigest()
@lru_cache(maxsize=None)
def previous(ref,p):return subprocess.check_output(['git','-C',str(ROOT),'show',ref+':'+p],stderr=subprocess.DEVNULL)
def replace_once(text,before,after):
 assert text.count(before)==1,('Ambiguous adapter',before[:80]);return text.replace(before,after)
@lru_cache(maxsize=1)
def adapters():
 p=ADAPTERS[0];text=previous(BASE,p).decode()
 text=replace_once(text," return bool(entry and predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==entry['after'])", " if entry and predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==entry['after']:return True\n from android_startup_successor import accepts as child\n return child(path,predecessor,root)")
 text=replace_once(text," if path not in ADAPTER_EDITS:return False\n read_record(root)\n return before==previous(BASE,path) and (root/path).exists() and (root/path).read_bytes()==adapters()[path]", " from android_startup_successor import accepts_adapter as child\n if path not in ADAPTER_EDITS:return child(path,before,root)\n read_record(root)\n return before==previous(BASE,path) and (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or child(path,adapters()[path],root))")
 text=replace_once(text,'def validate(root=ROOT):\n r=read_record(root)', 'def validate(root=ROOT):\n from android_startup_successor import accepts as child, accepts_adapter as child_adapter\n r=read_record(root)')
 text=replace_once(text,"assert sha((root/p).read_bytes())==v['after'],('Unrecorded bounded-save edit',p)","assert sha((root/p).read_bytes())==v['after'] or child(p,v['after'],root),('Unrecorded bounded-save edit',p)")
 text=replace_once(text,"assert sha((root/p).read_bytes())==d,('Changed preserved gameplay/source/evidence',p)","assert sha((root/p).read_bytes())==d or section=='invariants' and child(p,d,root),('Changed preserved gameplay/source/evidence',p)")
 text=replace_once(text,"assert (root/p).read_bytes()==b,('Changed exact successor adapter',p)","assert (root/p).read_bytes()==b or child_adapter(p,b,root),('Changed exact successor adapter',p)")
 ci=previous(BASE,ADAPTERS[1]).decode();anchor='          python3 scripts/test_b10_release_unblock_successor.py\n'
 ci=replace_once(ci,anchor,anchor+'          python3 scripts/android_startup_successor.py\n          python3 scripts/test_android_startup_successor.py\n')
 return {p:text.encode(),ADAPTERS[1]:ci.encode()}
@lru_cache(maxsize=1)
def expected_record():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines())
 support={RECORD,'scripts/android_startup_successor.py','scripts/test_android_startup_successor.py',*ADAPTERS}
 paths=sorted(actual-support)
 expected={'src/game/'+p for p in ['FormalHome.tsx','GameApp.tsx','campaignStorage.ts','formal/incompatibleStartWorker.test.ts','presentation/integrationV94.css','presentationStore.ts','runtime.worker.ts','useGame.ts','useGameInteraction.test.tsx','LocalCampaignManager.tsx','LocalCampaignManager.test.tsx','storageRecovery.ts','storageRecovery.test.ts']}
 expected|={'releases/notes/android-startup-storage-recovery.json','scripts/fixtures/android-recovery.worker.ts','scripts/verify-startup-storage-browser.mjs'}
 assert set(paths)==expected and actual<=expected|support,'Scope differs from user-authorized P0 implementation'
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
   for value in values:
    if isinstance(value,str) and len(value)==64 and value not in grants[p]:grants[p].append(value)
 critical=['persistence.ts','saveLock.ts','durableCommands.ts','replayFence.ts','ledgerStore.ts','interaction.ts','worldStream.ts','orderAdmission.ts','governanceAdmission.ts','serviceWorkerRelease.ts','useAppUpdate.ts','formal/versions.ts','formal/model.ts','formal/schema.ts','formal/reducer.ts','formal/scheduler.ts','formal/autonomy.ts','formal/offline.ts','formal/saveCodec.ts','formal/commandLedger.ts','formal/constructionRules.ts','constructionPreviewController.ts']
 invariants={'src/game/'+p:sha(previous(BASE,'src/game/'+p)) for p in critical}
 invariants['scripts/verify-in-isolation.mjs']=sha(previous(BASE,'scripts/verify-in-isolation.mjs'))
 historical={p:sha(previous(BASE,p)) for p in ['docs/validation/b10-release-unblock/final-seal/compatibility.json','docs/b6-v95/河谷戰役_vNext_平衡重構討論_v95.md','docs/b6-v96/河谷戰役_vNext_平衡重構討論_v96.md','docs/b6-v97/河谷戰役_vNext_平衡重構討論_v97.md']}
 return {'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'changes':changes,'grants':grants,'invariants':invariants,'historical':historical,'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(b)} for p,b in adapters().items()}}
def read_record(root=ROOT):
 f=root/RECORD
 if not f.exists():f=ROOT/RECORD
 r=json.loads(f.read_text());assert r==expected_record(),'Changed pinned P0 proof or grants';return r
def accepts(path,predecessor,root=ROOT):
 r=read_record(root);v=r['changes'].get(path)
 if v and predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==v['after']:return True
 from home_art_ui_successor import accepts as child
 return child(path,predecessor,root)
def accepts_adapter(path,before,root=ROOT):
 read_record(root)
 from home_art_ui_successor import accepts_adapter as child
 if path not in ADAPTERS:return child(path,before,root)
 return before==previous(BASE,path) and (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or child(path,adapters()[path],root))
def validate(root=ROOT):
 from home_art_ui_successor import accepts as child, accepts_adapter as child_adapter
 r=read_record(root)
 for p,v in r['changes'].items():assert sha((root/p).read_bytes())==v['after'] or child(p,v['after'],root),('Unrecorded P0 source edit',p)
 for section in ['invariants','historical']:
  for p,d in r[section].items():assert sha((root/p).read_bytes())==d or (section=='invariants' and child(p,d,root)),('Protected authority/rule/evidence changed',p)
 for p,b in adapters().items():assert (root/p).read_bytes()==b or child_adapter(p,b,root),('Unrecorded adapter',p)
 p='src/game/runtime.worker.ts';assert (root/p).read_text().split(" if(r.type==='start'){",1)[1]==previous(BASE,p).decode().split(" if(r.type==='start'){",1)[1],'Changed formal transitions/intake/T2/drain'
 p='src/game/useGame.ts';assert next(x for x in (root/p).read_text().splitlines() if x.startswith(' const createIssue='))==next(x for x in previous(BASE,p).decode().splitlines() if x.startswith(' const createIssue=')),'Changed click admission'
 return r
if __name__=='__main__':validate();print('PASS: finite P0 startup/storage successor; T1/T2, rules, protocols, history and original deadlines preserved.')
