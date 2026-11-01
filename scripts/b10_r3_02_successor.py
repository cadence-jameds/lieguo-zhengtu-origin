"""Exact R3-02 successor. R3-01 records and all historical grants remain immutable."""
import hashlib,json,subprocess
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='edca2f29805f0cdc4b0f89cd3cd00a8f9a819e39'
IMPLEMENTATION='12322f13419ea4913d7c83196f9278c4ab4be9ae'
RECORD='docs/validation/b10-r3-02/compatibility.json'
CHANGES={'src/game/formal/economy.ts', 'src/game/constructionPreviewController.test.ts', 'src/game/constructionPreviewCompute.ts', 'src/game/constructionPreviewContext.ts', 'releases/notes/b10-r3-02-async-construction-preview.json', 'src/game/constructionPreview.worker.ts', 'src/game/presentation/BuildingDetail.tsx', 'src/game/presentation/CraftsmanPanel.tsx', 'src/game/presentation/cityActions.ts', 'src/game/formal/constructionPreviewR302.test.ts', 'src/game/formal/buildingDetailData.ts', 'src/game/formal/ruleViolation.ts', 'src/game/presentation/useConstructionPreviews.tsx', 'src/game/constructionPreviewController.ts', 'src/game/formal/constructionRules.ts', 'scripts/verify-async-construction-preview-browser.mjs', 'src/game/FormalCityPanel.tsx', 'scripts/verify-preview-boundaries.mjs', 'src/game/constructionPreviewProtocol.ts', 'src/game/presentation/asyncConstructionPreview.test.tsx', 'src/game/GameApp.tsx', 'scripts/benchmark-construction-preview.mjs', 'src/game/formal/extinction.ts', 'src/game/useGame.ts'}
GATE_SUPPORT={'docs/validation/b10-r3-02/checks.json', 'docs/validation/b10-r3-02/node-perf.json', 'scripts/b10_r3_02_successor.py', 'docs/validation/b10-r3-02/compatibility.json', 'scripts/b10_r3_01_successor.py', 'docs/validation/b10-r3-02/preserved-contracts.json', 'docs/validation/b10-r3-02/browser-results.json', 'scripts/test_b10_r3_02_successor.py', 'docs/validation/b10-r3-02/attempts.json', 'docs/validation/b10-r3-02/REPORT.md', '.github/workflows/ci.yml'}
ADAPTERS={'scripts/b10_r3_01_successor.py','scripts/recruit_input_successor.py','.github/workflows/ci.yml'}
def sha(data):return hashlib.sha256(data).hexdigest()
@lru_cache(maxsize=None)
def previous(commit,path):return subprocess.check_output(['git','-C',str(ROOT),'show',commit+':'+path],stderr=subprocess.DEVNULL)
@lru_cache(maxsize=None)
def paths(*args):return set(subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only','-z',BASE,'--',*args],text=True).split('\0'))-{''}
@lru_cache(maxsize=None)
def changes():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines())
 assert actual==CHANGES|GATE_SUPPORT,('Unexpected R3-02 scope',actual^(CHANGES|GATE_SUPPORT))
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
 recruit=previous(BASE,'scripts/recruit_input_successor.py').decode()
 recruit=edit(recruit,'def validate(root=ROOT):\n record=', 'def validate(root=ROOT):\n from b10_r3_02_successor import accepts as preview_accepts\n record=')
 recruit=edit(recruit,"  assert entry['after']==sha(previous(root,UI,path))==sha((root/path).read_bytes()),('Changed recruitment source',path)","  assert entry['after']==sha(previous(root,UI,path)),('Changed original recruitment source digest',path)\n  assert entry['after']==sha((root/path).read_bytes()) or path=='src/game/presentation/cityActions.ts' and preview_accepts(path,entry['after'],root),('Changed recruitment source',path)")
 recruit=edit(recruit," before=previous(root,BASE,path).decode();after=(root/path).read_text()", " before=previous(root,BASE,path).decode();after=(root/path).read_text()\n if preview_accepts(path,record['changes'][path]['after'],root):after=previous(root,UI,path).decode()")
 return {'scripts/b10_r3_01_successor.py':b10.encode(),'scripts/recruit_input_successor.py':recruit.encode(),'.github/workflows/ci.yml':ci.encode()}
def recruitment_section(data):
 start=data.index(b'/** Read-only UI arithmetic')
 end=data.index(b'/** The real craftsman',start) if b'/** The real craftsman' in data[start:] else data.index(b'/** Shared-rule adapter for domain tooling',start)
 return data[start:end]
def preserved_recruitment(before,after):
 assert recruitment_section(before)==recruitment_section(after),'Unrequested recruitment calculation change'
 imports=[b"import {UNIT_CATALOG,ELITE_VARIANTS} from '../formal/unitCatalog';\n",b"import {unitRecruitCost,unitTrainingDuration} from '../formal/military';\n",b"import {modernUnitAuthorized} from '../formal/modernAwareness';\n"]
 for line in imports:assert before.count(line)==after.count(line)==1,('Changed recruitment binding',line)
 return {'sectionSha256':sha(recruitment_section(before)),'importsSha256':sha(b''.join(imports))}
@lru_cache(maxsize=None)
def expected_record():
 c=changes();invariants=paths('src')-CHANGES
 historical=paths('docs/b6-v95','docs/b6-v96','docs/b6-v97','docs/validation/protection-extinction','docs/validation/b10-r3-01','docs/validation/recruit-input-p1/compatibility.json')
 recruitment=preserved_recruitment(previous(BASE,'src/game/presentation/cityActions.ts'),previous(IMPLEMENTATION,'src/game/presentation/cityActions.ts'))
 return {'implementationSupport':sorted(GATE_SUPPORT),'preservedRecruitment':recruitment,'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'changes':c,
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
