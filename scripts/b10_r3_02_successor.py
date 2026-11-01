"""Exact R3-02 successor. R3-01 records and all historical grants remain immutable."""
import hashlib,json,subprocess
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='edca2f29805f0cdc4b0f89cd3cd00a8f9a819e39'
IMPLEMENTATION='ca596389752ece16c4cb26aac00e93de194ead27'
RECORD='docs/validation/b10-r3-02/compatibility.json'
CHANGES={'src/game/formal/economy.ts', 'src/game/constructionPreviewController.test.ts', 'src/game/constructionPreviewCompute.ts', 'src/game/constructionPreviewContext.ts', 'releases/notes/b10-r3-02-async-construction-preview.json', 'src/game/constructionPreview.worker.ts', 'src/game/presentation/BuildingDetail.tsx', 'src/game/presentation/CraftsmanPanel.tsx', 'src/game/presentation/cityActions.ts', 'src/game/formal/constructionPreviewR302.test.ts', 'src/game/formal/buildingDetailData.ts', 'src/game/formal/ruleViolation.ts', 'src/game/presentation/useConstructionPreviews.tsx', 'src/game/constructionPreviewController.ts', 'src/game/formal/constructionRules.ts', 'scripts/verify-async-construction-preview-browser.mjs', 'src/game/FormalCityPanel.tsx', 'scripts/verify-preview-boundaries.mjs', 'src/game/constructionPreviewProtocol.ts', 'src/game/presentation/asyncConstructionPreview.test.tsx', 'src/game/GameApp.tsx', 'scripts/benchmark-construction-preview.mjs', 'src/game/formal/extinction.ts', 'src/game/useGame.ts'}
ADAPTERS={'scripts/b10_r3_01_successor.py','.github/workflows/ci.yml'}
def sha(data):return hashlib.sha256(data).hexdigest()
@lru_cache(maxsize=None)
def previous(commit,path):return subprocess.check_output(['git','-C',str(ROOT),'show',commit+':'+path],stderr=subprocess.DEVNULL)
@lru_cache(maxsize=None)
def paths(*args):return set(subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only','-z',BASE,'--',*args],text=True).split('\0'))-{''}
@lru_cache(maxsize=None)
def changes():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines())
 assert actual==CHANGES,('Unexpected R3-02 scope',actual^CHANGES)
 result={}
 for p in sorted(CHANGES):
  try:before=sha(previous(BASE,p))
  except subprocess.CalledProcessError:before=None
  result[p]={'before':before,'after':sha(previous(IMPLEMENTATION,p))}
 return result
@lru_cache(maxsize=None)
def adapters():
 def edit(s,a,b):
  assert s.count(a)==1,('Exact adapter predecessor changed',a)
  return s.replace(a,b)
 b10=previous(BASE,'scripts/b10_r3_01_successor.py').decode()
 b10=edit(b10,'if path not in CHANGES:return False',"from b10_r3_02_successor import accepts as next_accepts\n if path not in CHANGES:return next_accepts(path,predecessor,root)")
 b10=edit(b10,"and sha((root/path).read_bytes())==r['changes'][path]['after']\n","and (sha((root/path).read_bytes())==r['changes'][path]['after'] or next_accepts(path,r['changes'][path]['after'],root))\n")
 b10=edit(b10,'def accepts_adapter(path,before,root=ROOT):','def accepts_adapter(path,before,root=ROOT):\n from b10_r3_02_successor import accepts_adapter as next_adapter')
 b10=edit(b10,'(root/path).read_bytes()==adapters()[path]','((root/path).read_bytes()==adapters()[path] or next_adapter(path,adapters()[path],root))')
 b10=edit(b10,'def validate(root=ROOT):\n r=read_record(root)','def validate(root=ROOT):\n from b10_r3_02_successor import accepts as next_accepts, accepts_adapter as next_adapter\n r=read_record(root)')
 b10=edit(b10,"==entry['after'],('Unrecorded B10 source change',p)","==entry['after'] or next_accepts(p,entry['after'],root),('Unrecorded B10 source change',p)")
 b10=edit(b10,"==digest,('Changed preserved rule/source/history',p)","==digest or section=='invariants' and next_accepts(p,digest,root),('Changed preserved rule/source/history',p)")
 b10=edit(b10,"==data,('Changed exact Gate adapter',p)","==data or next_adapter(p,data,root),('Changed exact Gate adapter',p)")
 ci=previous(BASE,'.github/workflows/ci.yml').decode()
 line='          python3 scripts/test_b10_r3_01_successor.py'
 ci=edit(ci,line,line+'\n          python3 scripts/b10_r3_02_successor.py\n          python3 scripts/test_b10_r3_02_successor.py\n          node scripts/verify-preview-boundaries.mjs')
 return {'scripts/b10_r3_01_successor.py':b10.encode(),'.github/workflows/ci.yml':ci.encode()}
@lru_cache(maxsize=None)
def expected_record():
 c=changes();invariants=paths('src')-CHANGES
 historical=paths('docs/b6-v95','docs/b6-v96','docs/b6-v97','docs/validation/protection-extinction','docs/validation/b10-r3-01')
 return {'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'changes':c,
  'grants':{p:[v['before']] for p,v in c.items() if v['before'] is not None},
  'invariants':{p:sha(previous(BASE,p)) for p in sorted(invariants)},
  'historical':{p:sha(previous(BASE,p)) for p in sorted(historical)},
  'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(data)} for p,data in adapters().items()}}
def read_record(root=ROOT):
 file=root/RECORD
 if not file.exists():file=ROOT/RECORD
 r=json.loads(file.read_text());assert r==expected_record(),'Changed R3-02 commit, source, predecessor, invariant, history or adapter manifest'
 return r
def accepts(path,predecessor,root=ROOT):
 if path not in CHANGES:return False
 r=read_record(root)
 return predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==r['changes'][path]['after']
def accepts_adapter(path,before,root=ROOT):
 if path not in ADAPTERS or before!=previous(BASE,path):return False
 read_record(root)
 return (root/path).exists() and (root/path).read_bytes()==adapters()[path]
def validate(root=ROOT):
 r=read_record(root)
 for p,entry in r['changes'].items():assert sha((root/p).read_bytes())==entry['after'],('Unrecorded R3-02 source change',p)
 for section in ['invariants','historical']:
  for p,digest in r[section].items():assert sha((root/p).read_bytes())==digest,('Changed preserved R3-01/source/history',p)
 for p,data in adapters().items():assert (root/p).read_bytes()==data,('Changed exact R3-02 adapter',p)
 return r
if __name__=='__main__':
 validate();print('PASS: exact R3-02 preview successor; R3-01 Inbox/T2 and historical source/spec/evidence preserved. No release acceptance claim.')
