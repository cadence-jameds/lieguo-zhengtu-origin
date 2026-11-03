"""Finite Persistence successor; exact rules, formats, UI contracts and evidence."""
import json,subprocess,sys
from functools import lru_cache
from pathlib import Path
import b10_r3_04_successor as prior
ROOT=Path(__file__).resolve().parents[1]
BASE='dfa574a4de24fe9069df2a90d3edae6a64f191da'
IMPLEMENTATION='097410658611af08596df40d54fd35b21904d069'
RECORD='docs/validation/b10-r3-05/compatibility.json'
CHANGES={'scripts/measure-process-resources.py', 'src/game/formal/jsonDataEqual.ts', 'scripts/benchmark-persistence-cold-browser.mjs', 'scripts/benchmark-persistence-browser.mjs', 'docs/validation/b10-r3-05/CONTRACT.md', 'scripts/serve-persistence-validation.mjs', 'src/game/persistence.ts', 'scripts/benchmark-persistence-import-browser.mjs', 'src/game/formal/canonicalBytes.ts', 'src/game/formal/canonical.ts', 'scripts/profile-persistence.mjs', 'releases/notes/b10-r3-05-persistence-optimization.json', 'src/game/ledgerStore.ts', 'src/game/runtime.worker.ts', 'scripts/persistence-profile-plugin.mjs', 'scripts/verify-persistence-browser.mjs', 'src/game/formal/commandLedger.ts', 'docs/validation/b10-r3-05/PROFILE.md', 'src/game/formal/persistenceOptimizationR305.test.ts', 'scripts/verify-persistence-compat-browser.mjs'}
ADAPTERS={'scripts/b10_r3_04_successor.py','scripts/b10_r3_03_successor.py','scripts/verify-projection-boundaries.mjs','.github/workflows/ci.yml'}
previous=prior.previous
sha=prior.sha
@lru_cache(maxsize=None)
def paths(*args):return set(subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only','-z',BASE,'--',*args],text=True).split('\0'))-{''}
@lru_cache(maxsize=None)
def adapters():
 def edit(s,a,b):
  assert s.count(a)==1,('Changed adapter predecessor',a)
  return s.replace(a,b)
 s=previous(BASE,'scripts/b10_r3_04_successor.py').decode()
 s=edit(s,'def accepts(path,predecessor,root=ROOT):\n if path not in CHANGES:return False','def accepts(path,predecessor,root=ROOT):\n from b10_r3_05_successor import accepts as next_accepts\n if path not in CHANGES:return False')
 s=edit(s,"return predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==r['changes'][path]['after']","return predecessor in r['grants'].get(path,[]) and (root/path).exists() and (sha((root/path).read_bytes())==r['changes'][path]['after'] or next_accepts(path,r['changes'][path]['after'],root))")
 s=edit(s,'def accepts_adapter(path,before,root=ROOT):\n if path not in ADAPTERS or before!=previous(BASE,path):return False','def accepts_adapter(path,before,root=ROOT):\n from b10_r3_05_successor import accepts_adapter as next_adapter\n if path not in ADAPTERS or before!=previous(BASE,path):return False')
 s=edit(s,'\n return (root/path).exists() and (root/path).read_bytes()==adapters()[path]\ndef validate','\n return (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or next_adapter(path,adapters()[path],root))\ndef validate')
 s=edit(s,'def validate(root=ROOT):\n r=read_record(root)','def validate(root=ROOT):\n from b10_r3_05_successor import accepts as next_accepts, accepts_adapter as next_adapter\n r=read_record(root)')
 s=edit(s,"==v['after'],('Unrecorded R3-04 source change',p)","==v['after'] or next_accepts(p,v['after'],root),('Unrecorded R3-04 source change',p)")
 s=edit(s,"==d,('Changed preserved source/history',p)","==d or section=='invariants' and next_accepts(p,d,root),('Changed preserved source/history',p)")
 s=edit(s,"==b,('Changed exact R3-04 adapter',p)","==b or next_adapter(p,b,root),('Changed exact R3-04 adapter',p)")
 result={'scripts/b10_r3_04_successor.py':s.encode()}
 s=previous(BASE,'scripts/b10_r3_03_successor.py').decode().replace('from b10_r3_04_successor import','from b10_r3_05_successor import');result['scripts/b10_r3_03_successor.py']=s.encode()
 s=previous(BASE,'.github/workflows/ci.yml').decode();s=edit(s,'          node scripts/verify-projection-boundaries.mjs','          python3 scripts/b10_r3_05_successor.py\n          python3 scripts/test_b10_r3_05_successor.py\n          node scripts/verify-projection-boundaries.mjs');result['.github/workflows/ci.yml']=s.encode()
 s=previous(BASE,'scripts/verify-projection-boundaries.mjs').decode()
 s=edit(s,"for(const p of preserved)assert.equal(read(p),old(p),`Changed authority/rule contract: ${p}`);","const successor=JSON.parse(execFileSync('python3',['scripts/b10_r3_05_successor.py','--boundary-record'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));\nconst admitted=p=>Object.hasOwn(successor.changes,p);\nfor(const p of preserved)if(!admitted(p))assert.equal(read(p),old(p),`Changed authority/rule contract: ${p}`);")
 s=edit(s,"if(!intentional.has(p)){assert.equal", "if(!intentional.has(p)&&!admitted(p)){assert.equal")
 s=edit(s,'preservedAuthorityFiles:preserved.length','preservedAuthorityFiles:preserved.filter(p=>!admitted(p)).length,verifiedPersistenceSuccessorFiles:preserved.filter(admitted).length')
 result['scripts/verify-projection-boundaries.mjs']=s.encode()
 return result
@lru_cache(maxsize=None)
def expected_record():
 changes={}
 for p in sorted(CHANGES):
  try:before=sha(previous(BASE,p))
  except subprocess.CalledProcessError:before=None
  changes[p]={'before':before,'after':sha(previous(IMPLEMENTATION,p))}
 grants={p:[v['before']] for p,v in changes.items() if v['before']}
 for record in sorted(p for p in paths('docs') if p.endswith('/compatibility.json')):
  data=json.loads(previous(BASE,record))
  for p,v in data.get('changes',{}).items():
   if p in CHANGES and isinstance(v,dict):
    for d in [v.get('before'),v.get('after')]:
     if d and d not in grants.setdefault(p,[]):grants[p].append(d)
  for p,d in data.get('invariants',{}).items():
   if p in CHANGES and d not in grants.setdefault(p,[]):grants[p].append(d)
  for p,ds in data.get('grants',{}).items():
   if p in CHANGES:
    for d in ds:
     if d not in grants.setdefault(p,[]):grants[p].append(d)
 return {'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'changes':changes,'grants':grants,'invariants':{p:sha(previous(BASE,p)) for p in sorted(paths('src')-CHANGES)},'historical':{p:sha(previous(BASE,p)) for p in sorted(paths('docs/b6-v95','docs/b6-v96','docs/b6-v97','docs/validation','releases/notes'))},'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(b)} for p,b in adapters().items()}}
def read_record(root=ROOT):
 path=root/RECORD
 if not path.exists():path=ROOT/RECORD
 r=json.loads(path.read_text());assert r==expected_record(),'Changed pinned Persistence successor source/history/format/adapter manifest';return r
def accepts(path,predecessor,root=ROOT):
 r=read_record(root)
 if path in CHANGES:return predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==r['changes'][path]['after']
 if path in ADAPTERS:return predecessor==sha(previous(BASE,path)) and (root/path).exists() and (root/path).read_bytes()==adapters()[path]
 # Preserve the previous finite UI grants without delegating recursively.
 p=prior.read_record(root)
 return path in prior.CHANGES and predecessor in p['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==p['changes'][path]['after']
def accepts_adapter(path,before,root=ROOT):
 if path not in ADAPTERS:return prior.accepts_adapter(path,before,root)
 read_record(root)
 if before!=previous(BASE,path):return prior.accepts_adapter(path,before,root)
 return (root/path).exists() and (root/path).read_bytes()==adapters()[path]
def validate(root=ROOT):
 r=read_record(root)
 for p,v in r['changes'].items():assert sha((root/p).read_bytes())==v['after'],('Unrecorded Persistence edit',p)
 for section in ['invariants','historical']:
  for p,d in r[section].items():assert sha((root/p).read_bytes())==d,('Changed rule/format/UI/history',p)
 for p,b in adapters().items():assert (root/p).read_bytes()==b,('Changed exact Persistence adapter',p)
 return r
if __name__=='__main__':
 r=validate()
 if '--boundary-record' in sys.argv:print(json.dumps(r))
 else:print('PASS: pinned R3-05 Persistence successor; exact rules, format, UI contracts, history and deadlines preserved. No release acceptance claim.')
