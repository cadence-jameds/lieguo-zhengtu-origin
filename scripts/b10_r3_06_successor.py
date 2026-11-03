"""Finite Runtime successor: preserve data, rules, event order and all old gates."""
import json,subprocess,sys
from pathlib import Path
from functools import lru_cache
import b10_r3_05_successor as prior
ROOT=Path(__file__).resolve().parents[1]
BASE='c370ff8a492de8711e764a82c8f1d43efef1a00e'
IMPLEMENTATION='803b174db5d2be0adef24b94b22782856ae365b9'
RECORD='docs/validation/b10-r3-06/compatibility.json'
CHANGES={'scripts/runtime-observation-plugin.mjs', 'scripts/runtime-profile-plugin.mjs', 'scripts/fixtures/r306/ui-browser.tsx.txt', 'docs/validation/b10-r3-06/native-faults.json', 'scripts/benchmark-runtime-browser.mjs', 'scripts/verify-runtime-parity.mjs', 'scripts/fixtures/r306/victory-r305.txt', 'docs/validation/b10-r3-06/profile-before.json', 'scripts/profile-runtime-worker-memory.mjs', 'scripts/fixtures/r306/reducer-r305.txt', 'docs/validation/b10-r3-06/profile-30-day-before.json', 'scripts/fixtures/r306/offline-r305.txt', 'scripts/soak-runtime-browser.mjs', 'src/game/releaseRolloverR306.test.ts', 'src/game/formal/victory.ts', 'releases/config.json', 'scripts/serve-runtime-validation.mjs', 'src/game/formal/reducer.ts', 'scripts/release-metadata.d.mts', 'src/game/persistence.ts', 'src/game/runtimeWorkBudget.ts', 'scripts/summarize-runtime-benchmark.mjs', 'docs/validation/b10-r3-06/PROFILE.md', 'scripts/fixtures/r306/runtime-browser.js.txt', 'scripts/verify-runtime-browser.mjs', 'docs/RELEASE_METADATA.md', 'releases/notes/b10-r3-06-ai-scheduling.json', 'src/game/formal/offline.ts', 'scripts/release-metadata.mjs', 'scripts/fixtures/r306/seed-browser.js.txt', 'docs/validation/b10-r3-06/CONTRACT.md', 'src/game/runtime.worker.ts', 'scripts/profile-runtime.mjs', 'src/game/formal/runtimeSchedulingR306.test.ts'}
IMPLEMENTATION_SUPPORT={'.github/workflows/ci.yml', 'scripts/test_b10_r3_06_successor.py', 'docs/validation/b10-r3-06/compatibility.json', 'scripts/b10_r3_06_successor.py', 'scripts/b10_r3_05_successor.py', 'scripts/verify-projection-boundaries.mjs'}
ADAPTERS={'scripts/b10_r3_05_successor.py','.github/workflows/ci.yml','scripts/verify-projection-boundaries.mjs'}
previous=prior.previous
sha=prior.sha
@lru_cache(maxsize=None)
def paths(*args):return set(subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only','-z',BASE,'--',*args],text=True).split('\0'))-{''}
@lru_cache(maxsize=None)
def adapters():
 def edit(s,a,b):
  assert s.count(a)==1,('Changed Runtime adapter predecessor',a)
  return s.replace(a,b)
 s=previous(BASE,'scripts/b10_r3_05_successor.py').decode()
 s=edit(s,'def accepts(path,predecessor,root=ROOT):\n r=read_record(root)','def accepts(path,predecessor,root=ROOT):\n from b10_r3_06_successor import accepts as child_accepts, accepts_adapter as child_adapter\n r=read_record(root)')
 s=edit(s," if path in CHANGES:return predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==r['changes'][path]['after']\n"," if path in CHANGES:return predecessor in r['grants'].get(path,[]) and (root/path).exists() and (sha((root/path).read_bytes())==r['changes'][path]['after'] or child_accepts(path,r['changes'][path]['after'],root))\n")
 s=edit(s,"if path in ADAPTERS:return predecessor==sha(previous(BASE,path)) and (root/path).exists() and (root/path).read_bytes()==adapters()[path]","if path in ADAPTERS:return predecessor==sha(previous(BASE,path)) and (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or child_adapter(path,adapters()[path],root))")
 s=edit(s,"return path in prior.CHANGES and predecessor in p['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==p['changes'][path]['after']","return (path in prior.CHANGES and predecessor in p['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==p['changes'][path]['after']) or child_accepts(path,predecessor,root)")
 s=edit(s,'def accepts_adapter(path,before,root=ROOT):\n if path not in ADAPTERS','def accepts_adapter(path,before,root=ROOT):\n from b10_r3_06_successor import accepts_adapter as child_adapter\n if path not in ADAPTERS')
 s=edit(s,'return (root/path).exists() and (root/path).read_bytes()==adapters()[path]\ndef validate','return (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or child_adapter(path,adapters()[path],root))\ndef validate')
 s=edit(s,'def validate(root=ROOT):\n r=read_record(root)','def validate(root=ROOT):\n from b10_r3_06_successor import accepts as child_accepts, accepts_adapter as child_adapter\n r=read_record(root)')
 s=edit(s,"==v['after'],('Unrecorded Persistence edit',p)","==v['after'] or child_accepts(p,v['after'],root),('Unrecorded Persistence edit',p)")
 s=edit(s,"==d,('Changed rule/format/UI/history',p)","==d or section=='invariants' and child_accepts(p,d,root),('Changed rule/format/UI/history',p)")
 s=edit(s,"==b,('Changed exact Persistence adapter',p)","==b or child_adapter(p,b,root),('Changed exact Persistence adapter',p)")
 result={'scripts/b10_r3_05_successor.py':s.encode()}
 s=previous(BASE,'.github/workflows/ci.yml').decode();s=edit(s,'          node scripts/verify-projection-boundaries.mjs','          python3 scripts/b10_r3_06_successor.py\n          python3 scripts/test_b10_r3_06_successor.py\n          node scripts/verify-runtime-parity.mjs\n          node scripts/verify-projection-boundaries.mjs');result['.github/workflows/ci.yml']=s.encode()
 s=previous(BASE,'scripts/verify-projection-boundaries.mjs').decode();s=edit(s,"const admitted=p=>Object.hasOwn(successor.changes,p);","const runtimeSuccessor=JSON.parse(execFileSync('python3',['scripts/b10_r3_06_successor.py','--boundary-record'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));\nconst admitted=p=>Object.hasOwn(successor.changes,p)||Object.hasOwn(runtimeSuccessor.changes,p);")
 s=edit(s,'verifiedPersistenceSuccessorFiles:preserved.filter(admitted).length','verifiedSuccessorFiles:preserved.filter(admitted).length');result['scripts/verify-projection-boundaries.mjs']=s.encode();return result
@lru_cache(maxsize=None)
def offline_budget_passthrough():
 # Exact, whole-file substitutions: no wildcard, normalization, transaction or
 # clock-rule exemption. Only the optional JS service budget is forwarded.
 edits={
 'src/game/formal/offline.ts':[
 ("import {advanceFormal,advanceFormalCooperative} from './reducer';","import {advanceFormal,advanceFormalCooperative,type CooperativeAdvanceOptions} from './reducer';"),
 ('onProgress?:(fraction:number,events:number)=>void):Promise','onProgress?:(fraction:number,events:number)=>void,options:CooperativeAdvanceOptions={}):Promise'),
 ('(at-start)/(target-start))),events));','(at-start)/(target-start))),events),options);')],
 'src/game/persistence.ts':[
 ("import {advanceOfflineCooperative,type OfflineSummary} from './formal/offline';","import {advanceOfflineCooperative,type OfflineSummary} from './formal/offline';\nimport type {CooperativeAdvanceOptions} from './formal/reducer';"),
 ("onProgress?:(stage:'read'|'offline'|'save',fraction?:number,events?:number)=>void):Promise","onProgress?:(stage:'read'|'offline'|'save',fraction?:number,events?:number)=>void,options:CooperativeAdvanceOptions={}):Promise"),
 ("onProgress?.('offline',fraction,events));","onProgress?.('offline',fraction,events),options);"),
 ('events?:number)=>void)=>active().loadWithOffline(Date.now(),onProgress);','events?:number)=>void,options:CooperativeAdvanceOptions={})=>active().loadWithOffline(Date.now(),onProgress,options);')]}
 result={}
 for p,changes in edits.items():
  text=previous(BASE,p).decode()
  for a,b in changes:
   assert text.count(a)==1,('Changed offline budget predecessor',p,a)
   text=text.replace(a,b)
  result[p]=text.encode()
 return result
@lru_cache(maxsize=None)
def expected_record():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines());assert actual==CHANGES|IMPLEMENTATION_SUPPORT,'Changed finite Runtime implementation scope'
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
 refs={f'scripts/fixtures/r306/{n}-r305.txt':sha(previous(BASE,f'src/game/formal/{n}.ts')) for n in ['reducer','victory','offline']}
 return {'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'implementationSupport':sorted(IMPLEMENTATION_SUPPORT),'changes':changes,'grants':grants,'references':refs,'invariants':{p:sha(previous(BASE,p)) for p in sorted(paths('src','scripts/release-metadata.mjs','releases/config.json','docs/RELEASE_METADATA.md')-CHANGES)},'historical':{p:sha(previous(BASE,p)) for p in sorted(paths('docs/b6-v95','docs/b6-v96','docs/b6-v97','docs/validation','releases/notes'))},'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(b)} for p,b in adapters().items()}}
def read_record(root=ROOT):
 file=root/RECORD
 if not file.exists():file=ROOT/RECORD
 r=json.loads(file.read_text());assert r==expected_record(),'Changed immutable Runtime source, grant, history or adapter proof';return r
def accepts(path,predecessor,root=ROOT):
 r=read_record(root)
 if path in CHANGES:return predecessor in r['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==r['changes'][path]['after']
 if path in ADAPTERS:return predecessor==sha(previous(BASE,path)) and (root/path).exists() and (root/path).read_bytes()==adapters()[path]
 for g in [prior,prior.prior]:
  p=g.read_record(root)
  if path in g.CHANGES:return predecessor in p['grants'].get(path,[]) and (root/path).exists() and sha((root/path).read_bytes())==p['changes'][path]['after']
 return False
def accepts_adapter(path,before,root=ROOT):
 if path not in ADAPTERS:return False
 read_record(root)
 if before!=previous(BASE,path):return prior.accepts_adapter(path,before,root)
 return (root/path).exists() and (root/path).read_bytes()==adapters()[path]
def validate(root=ROOT):
 r=read_record(root)
 for p,v in r['changes'].items():assert sha((root/p).read_bytes())==v['after'],('Unrecorded Runtime edit',p)
 for section in ['invariants','historical']:
  for p,d in r[section].items():assert sha((root/p).read_bytes())==d,('Changed preserved authority/rule/history',p)
 for p,b in adapters().items():assert (root/p).read_bytes()==b,('Changed exact Runtime adapter',p)
 for p,b in offline_budget_passthrough().items():assert (root/p).read_bytes()==b,('Changed transaction/clock content outside the exact budget passthrough',p)
 for p,d in r['references'].items():assert sha((root/p).read_bytes())==d,('Changed Reference',p)
 p='src/game/formal/reducer.ts';assert (root/p).read_text().split('export type CooperativeAdvanceOptions=')[0]==previous(BASE,p).decode().split('export type CooperativeAdvanceOptions=')[0],'Changed command rules/event reducer/synchronous replay'
 p='src/game/formal/victory.ts';a=(root/p).read_text();b=previous(BASE,p).decode()
 for prefix in [' const conquest=',' const hegemony=','export const VICTORY_DURATION=']:
  assert next(s for s in a.splitlines() if s.startswith(prefix))==next(s for s in b.splitlines() if s.startswith(prefix)),('Changed victory formula',prefix)
 assert a.split('export function handleVictoryEvent',1)[1]==b.split('export function handleVictoryEvent',1)[1],'Changed victory completion rule'
 return r
if __name__=='__main__':
 r=validate()
 if '--boundary-record' in sys.argv:print(json.dumps(r))
 else:print('PASS: pinned Runtime scheduling successor; exact command/event rules, AI policies, Scheduler, persistence, format, UI, history and deadlines preserved. No release acceptance claim.')
