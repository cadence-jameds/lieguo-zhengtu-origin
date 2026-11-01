"""Exact B10-R3-01 implementation successor; no historical record or rule waiver."""
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='443f170b277f71ee26a34ee3b5017687a98e01ab'
IMPLEMENTATION='2cb1fe908dbfae4f81be13593e93798494773351'
RECORD='docs/validation/b10-r3-01/compatibility.json'
CHANGES={
 'releases/notes/b10-r3-01-durable-player-commands.json','scripts/verify-durable-commands-browser.mjs',
 'src/game/campaignStorage.ts','src/game/campaignStorage.test.ts',
 'src/game/GameApp.tsx','src/game/durableCommands.ts','src/game/interaction.ts','src/game/persistence.ts',
 'src/game/presentation/CommandInbox.tsx','src/game/presentation/integrationV94.css','src/game/runtime.worker.ts',
 'src/game/useGame.ts','src/game/useGameInteraction.test.tsx',
 'src/game/formal/autonomyRuntimeR2c.test.ts','src/game/formal/breakthroughRuntimeB92.test.ts',
 'src/game/formal/combatWorkerB5.test.ts','src/game/formal/durableCommands.test.ts',
 'src/game/formal/durableRuntime.test.ts','src/game/formal/durableWorkerTestSupport.ts',
 'src/game/formal/extinctionWorkerP0C10.test.ts','src/game/formal/offlineExtinctionClockWorkerDelta.test.ts',
 'src/game/formal/playerOrderRuntimeP0.test.ts','src/game/formal/runtime.test.ts',
 'src/game/formal/runtimeB4.test.ts','src/game/formal/wonderRuntimeB91.test.ts',
}
ADAPTERS={'.github/workflows/ci.yml','scripts/p0c10_successor.py','scripts/p0c10_clock_delta.py'}
# The source anchor also contains the earlier Gate bootstrap commit. Only these
# explicit support paths (including prior delivery evidence) are separated; no directory/prefix is exempted.
GATE_SUPPORT=ADAPTERS|{RECORD,'scripts/b10_r3_01_successor.py','scripts/test_b10_r3_01_successor.py',
 'docs/validation/b10-r3-01/REPORT.md','docs/validation/b10-r3-01/attempts.json',
 'docs/validation/b10-r3-01/browser-results.json','docs/validation/b10-r3-01/checks.json','docs/validation/b10-r3-01/UI_REVIEW_FIX.md'}
def sha(data):return hashlib.sha256(data).hexdigest()
@lru_cache(maxsize=None)
def previous(commit,path):return subprocess.check_output(['git','-C',str(ROOT),'show',commit+':'+path],stderr=subprocess.DEVNULL)
@lru_cache(maxsize=None)
def paths(*args):return set(subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only','-z',BASE,'--',*args],text=True).split('\0'))-{''}
@lru_cache(maxsize=None)
def changes():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines())
 assert actual==CHANGES|GATE_SUPPORT,('Unexpected implementation scope',actual^(CHANGES|GATE_SUPPORT))
 result={}
 for p in sorted(CHANGES):
  try:before=sha(previous(BASE,p))
  except subprocess.CalledProcessError:before=None
  result[p]={'before':before,'after':sha(previous(IMPLEMENTATION,p))}
 return result
@lru_cache(maxsize=None)
def adapters():
 def edit(data,old,new):
  assert data.count(old)==1,('Adapter base changed',old)
  return data.replace(old,new)
 successor=previous(BASE,'scripts/p0c10_successor.py').decode()
 successor=successor.replace(' from p0c10_clock_delta import accepts as delta_accepts\n',' from p0c10_clock_delta import accepts as delta_accepts\n from b10_r3_01_successor import accepts as b10_accepts\n')
 successor=edit(successor,'if path not in SOURCES:return delta_accepts(path,predecessor,root)','if path not in SOURCES:return delta_accepts(path,predecessor,root) or b10_accepts(path,predecessor,root)')
 successor=edit(successor,"return sha((root/path).read_bytes())==r['changes'][path]['after'] or delta_accepts(path,r['changes'][path]['after'],root)","return sha((root/path).read_bytes())==r['changes'][path]['after'] or delta_accepts(path,r['changes'][path]['after'],root) or b10_accepts(path,r['changes'][path]['after'],root)")
 successor=edit(successor,"or delta_accepts(p,entry['after'],root),('Unrecorded implementation change',p)","or delta_accepts(p,entry['after'],root) or b10_accepts(p,entry['after'],root),('Unrecorded implementation change',p)")
 successor=edit(successor,"or section=='invariants' and delta_accepts(p,digest,root),('Changed preserved source/history',p)","or section=='invariants' and (delta_accepts(p,digest,root) or b10_accepts(p,digest,root)),('Changed preserved source/history',p)")
 delta=previous(BASE,'scripts/p0c10_clock_delta.py').decode()
 delta=edit(delta,'def validate(root=ROOT):\n r=read_record(root)','def validate(root=ROOT):\n from b10_r3_01_successor import accepts as b10_accepts, accepts_adapter as b10_adapter\n r=read_record(root)')
 delta=edit(delta,"==entry['after'],('Unrecorded Delta edit',p)","==entry['after'] or b10_accepts(p,entry['after'],root),('Unrecorded Delta edit',p)")
 delta=edit(delta,"==digest,('Preserved contract/evidence changed',p)","==digest or section=='invariants' and b10_accepts(p,digest,root),('Preserved contract/evidence changed',p)")
 delta=edit(delta,"==data,('Gate adapter scope changed',p)","==data or b10_adapter(p,data,root),('Gate adapter scope changed',p)")
 ci=previous(BASE,'.github/workflows/ci.yml').decode();line='          python3 scripts/test_p0c10_clock_delta.py'
 ci=edit(ci,line,line+'\n          python3 scripts/b10_r3_01_successor.py\n          python3 scripts/test_b10_r3_01_successor.py')
 return{'scripts/p0c10_successor.py':successor.encode(),'scripts/p0c10_clock_delta.py':delta.encode(),'.github/workflows/ci.yml':ci.encode()}
@lru_cache(maxsize=None)
def expected_record():
 c=changes();historical=paths('docs/b6-v95','docs/b6-v96','docs/b6-v97','docs/validation/protection-extinction')
 invariants=paths('src')-CHANGES
 return{'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'implementationScope':sorted(CHANGES|GATE_SUPPORT),'changes':c,
  'grants':{p:[v['before']] for p,v in c.items() if v['before'] is not None},
  'invariants':{p:sha(previous(BASE,p)) for p in sorted(invariants)},
  'historical':{p:sha(previous(BASE,p)) for p in sorted(historical)},
  'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(data)} for p,data in adapters().items()}}
def read_record(root=ROOT):
 file=root/RECORD
 if not file.exists():file=ROOT/RECORD
 r=json.loads(file.read_text());assert r==expected_record(),'Changed B10 scope, immutable commit, predecessor, invariant, history or adapter record'
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
 for p,entry in r['changes'].items():assert sha((root/p).read_bytes())==entry['after'],('Unrecorded B10 source change',p)
 for section in ['invariants','historical']:
  for p,digest in r[section].items():assert sha((root/p).read_bytes())==digest,('Changed preserved rule/source/history',p)
 for p,data in adapters().items():assert (root/p).read_bytes()==data,('Changed exact Gate adapter',p)
 return r
if __name__=='__main__':
 validate();print('PASS: exact B10-R3-01 implementation; all other source, Reducer, Scheduler, v95/v96/v97 and PR53 evidence preserved. No release acceptance claim.')
