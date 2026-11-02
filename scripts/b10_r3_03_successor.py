"""Exact R3-03 successor: verified formal ledger, no old-save migration grant."""
import hashlib,json,subprocess
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='c5683f5a9daf51cf2245a557a2aec3d73e3dad5b'
IMPLEMENTATION='3697185c2ab7a088feeb1c5066539d3f44c9e511'
RECORD='docs/validation/b10-r3-03/formal-v1/compatibility.json'
CHANGES={'src/game/formal/persistence.test.ts', 'src/game/formal/durableWorkerTestSupport.ts', 'src/game/formal/governance.ts', 'src/game/formal/battles.ts', 'src/game/developer/B5Lab.ts', 'src/game/formal/commandLedgerR303.test.ts', 'src/game/formal/growthTasks.ts', 'src/game/formal/reducer.ts', 'docs/validation/b10-r3-03/formal-v1/CONTRACT.md', 'src/game/formal/versions.ts', 'src/game/formal/autonomy.ts', 'src/game/formal/durableCommands.test.ts', 'scripts/command-ledger-candidate.mjs', 'src/game/runtime.worker.ts', 'src/game/formal/extinction.ts', 'scripts/verify-formal-ledger-browser.mjs', 'scripts/benchmark-formal-ledger.mjs', 'src/game/formal/modernCatchupSchema.ts', 'src/game/campaignStorage.ts', 'src/game/ledgerStore.ts', 'src/game/formal/commandLedger.ts', 'src/game/formal/worldDraft.ts', 'src/game/formal/saveCodec.ts', 'src/game/worldStream.ts', 'src/game/formal/autoLogistics.ts', 'src/game/formal/extinctionB7.test.ts', 'src/game/durableCommands.ts', 'src/game/formal/combatSchema.ts', 'src/game/formal/model.ts', 'src/game/formal/wonderSchema.ts', 'src/game/formal/ledgerFormalR303.test.ts', 'src/game/governanceAdmission.ts', 'src/game/formal/durableRuntime.test.ts', 'src/game/formal/growthTaskSchema.ts', 'src/game/developer/session.ts', 'src/game/formal/schema.ts', 'scripts/verify-preview-boundaries.mjs', 'src/game/formal/buildingDetailData.ts', 'src/game/formal/wonderConditionSchema.ts', 'src/game/orderAdmission.ts', 'src/game/formal/breakthroughSchema.ts', 'src/game/persistence.ts', 'src/game/formal/recoveryR1.test.ts', 'releases/notes/b10-r3-03-formal-command-ledger.json'}
ADAPTERS={'scripts/b10_r3_02_successor.py','.github/workflows/ci.yml','scripts/test_b10_r3_01_successor.py','scripts/test_b10_r3_02_successor.py'}
def sha(b):return hashlib.sha256(b).hexdigest()
@lru_cache(maxsize=None)
def previous(commit,path):return subprocess.check_output(['git','-C',str(ROOT),'show',commit+':'+path],stderr=subprocess.DEVNULL)
@lru_cache(maxsize=None)
def paths(*args):return set(subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only','-z',BASE,'--',*args],text=True).split('\0'))-{''}
@lru_cache(maxsize=None)
def changes():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines())
 assert actual==CHANGES,('Unexpected R3-03 implementation scope',actual^CHANGES)
 out={}
 for p in sorted(CHANGES):
  try:before=sha(previous(BASE,p))
  except subprocess.CalledProcessError:before=None
  out[p]={'before':before,'after':sha(previous(IMPLEMENTATION,p))}
 return out
@lru_cache(maxsize=None)
def adapters():
 def edit(s,a,b):
  assert s.count(a)==1,('Exact adapter predecessor changed',a)
  return s.replace(a,b)
 s=previous(BASE,'scripts/b10_r3_02_successor.py').decode()
 s=edit(s,'def accepts(path,predecessor,root=ROOT):\n if path not in CHANGES:return False',"def accepts(path,predecessor,root=ROOT):\n from b10_r3_03_successor import accepts as next_accepts\n if path not in CHANGES:return next_accepts(path,predecessor,root)")
 s=edit(s,"and sha((root/path).read_bytes())==r['changes'][path]['after']\n","and (sha((root/path).read_bytes())==r['changes'][path]['after'] or next_accepts(path,r['changes'][path]['after'],root))\n")
 s=edit(s,'\ndef accepts_adapter(path,before,root=ROOT):','\ndef accepts_adapter(path,before,root=ROOT):\n from b10_r3_03_successor import accepts_adapter as next_adapter')
 s=edit(s,' return (root/path).exists() and (root/path).read_bytes()==adapters()[path]',' return (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or next_adapter(path,adapters()[path],root))')
 s=edit(s,'def validate(root=ROOT):\n r=read_record(root)','def validate(root=ROOT):\n from b10_r3_03_successor import accepts as next_accepts, accepts_adapter as next_adapter\n r=read_record(root)')
 s=edit(s,"==entry['after'],('Unrecorded R3-02 source change',p)","==entry['after'] or next_accepts(p,entry['after'],root),('Unrecorded R3-02 source change',p)")
 s=edit(s,"==digest,('Changed preserved R3-01/source/history',p)","==digest or section=='invariants' and next_accepts(p,digest,root),('Changed preserved R3-01/source/history',p)")
 s=edit(s,"==data,('Changed exact R3-02 adapter',p)","==data or next_adapter(p,data,root),('Changed exact R3-02 adapter',p)")
 ci=previous(BASE,'.github/workflows/ci.yml').decode();line='          python3 scripts/test_b10_r3_02_successor.py'
 ci=edit(ci,line,line+'\n          python3 scripts/b10_r3_03_successor.py\n          python3 scripts/test_b10_r3_03_successor.py')
 result={'scripts/b10_r3_02_successor.py':s.encode(),'.github/workflows/ci.yml':ci.encode()}
 for version in ['01','02']:
  p='scripts/test_b10_r3_'+version+'_successor.py';t=previous(BASE,p).decode()
  t=edit(t,"   self.assertFalse(gate.accepts(p,r['invariants'][p],self.root))","   # Exact reviewed R3-03 successors are permitted; forged predecessors still fail.\n   import b10_r3_03_successor as successor\n   self.assertEqual(gate.accepts(p,r['invariants'][p],self.root),successor.accepts(p,r['invariants'][p],self.root))\n   self.assertFalse(gate.accepts(p,'0'*64,self.root))")
  result[p]=t.encode()
 return result
@lru_cache(maxsize=None)
def expected_record():
 c=changes();invariants=paths('src')-CHANGES
 # Earlier gates can present their own immutable post-implementation digest.
 # Admit only those exact recorded bytes, never caller-supplied predecessors.
 grants={p:[v['before']] for p,v in c.items() if v['before']}
 for record in ['docs/validation/protection-extinction/compatibility.json','docs/validation/protection-extinction/clock-mode-delta/compatibility.json','docs/validation/recruit-input-p1/compatibility.json','docs/validation/journey-goals-integration/compatibility.json','docs/validation/mobile-town-labels/compatibility.json','docs/validation/city-ui-successor/compatibility.json']:
  upstream=json.loads(previous(BASE,record))
  for p,v in upstream.get('changes',{}).items():
   if p in CHANGES:
    for digest in [v.get('before'),v.get('after')]:
     if digest and digest not in grants.setdefault(p,[]):grants[p].append(digest)
  for p,digest in upstream.get('invariants',{}).items():
   if p in CHANGES and digest not in grants.setdefault(p,[]):grants[p].append(digest)
 historical=paths('docs/b6-v95','docs/b6-v96','docs/b6-v97','docs/validation','releases/notes')-CHANGES
 return {'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'changes':c,'grants':grants,'invariants':{p:sha(previous(BASE,p)) for p in sorted(invariants)},'historical':{p:sha(previous(BASE,p)) for p in sorted(historical)},'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(data)} for p,data in adapters().items()}}
def read_record(root=ROOT):
 file=root/RECORD
 if not file.exists():file=ROOT/RECORD
 r=json.loads(file.read_text());assert r==expected_record(),'Changed R3-03 immutable commit, grant, source, rule, history or adapter manifest'
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
 for p,v in r['changes'].items():assert sha((root/p).read_bytes())==v['after'],('Unrecorded R3-03 source change',p)
 for section in ['invariants','historical']:
  for p,digest in r[section].items():assert sha((root/p).read_bytes())==digest,('Changed preserved source/rule/history',p)
 for p,data in adapters().items():assert (root/p).read_bytes()==data,('Changed exact R3-03 adapter',p)
 return r
if __name__=='__main__':
 validate();print('PASS: exact R3-03 formal ledger successor; preserved game rules, scheduler, historical specifications and evidence. No release acceptance claim.')
