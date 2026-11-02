"""Exact R3-03 successor: verified formal ledger, no old-save migration grant."""
import hashlib,json,subprocess
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='c5683f5a9daf51cf2245a557a2aec3d73e3dad5b'
IMPLEMENTATION='489f906c59b21d22dc14c40f0dedf9b9f93a5512'
RECORD='docs/validation/b10-r3-03/formal-v1/compatibility.json'
CHANGES={'src/game/formal/offlineExtinctionClockDelta.test.ts', 'src/game/formal/schema.ts', 'src/game/formal/p0cExileScout.test.ts', 'src/game/formal/buildingDetailData.ts', 'src/game/ledgerStore.ts', 'src/game/formal/worldDraft.ts', 'src/game/formal/commandLedger.ts', 'src/game/formal/endgameAIB95.test.ts', 'src/game/formal/extinctionB7.test.ts', 'src/game/formal/saveDraftIsolation.test.ts', 'src/game/orderAdmission.ts', 'src/game/formal/captureDeltaR4.test.ts', 'src/game/formal/siegeV91.test.ts', 'src/game/formal/growthTaskIntegration.test.ts', 'src/game/formal/integrationR4.test.ts', 'src/game/worldStream.ts', 'src/game/formal/combatSchema.ts', 'src/game/formal/governanceR2c.test.ts', 'src/game/formal/durableRuntime.test.ts', 'src/game/formal/wonderConditionSchema.ts', 'src/game/formal/victoryB95.test.ts', 'src/game/formal/growthTaskSchema.ts', 'src/game/formal/craftsmanCastleDeltaR4.test.ts', 'src/game/developer/B5Lab.ts', 'src/game/formal/worldB2.test.ts', 'src/game/formal/wonderCombatB95.test.ts', 'src/game/formal/autonomy.ts', 'src/game/formal/developmentB4.test.ts', 'src/game/formal/combatLongV91.test.ts', 'src/game/formal/v95Economy.test.ts', 'src/game/formal/scoutV90.test.ts', 'src/game/campaignStorage.ts', 'src/game/formal/battles.ts', 'src/game/formal/reviewDeltaR4.test.ts', 'src/game/developer/session.ts', 'src/game/formal/constructionPreviewR302.test.ts', 'src/game/formal/combatB5.test.ts', 'src/game/formal/gateDeltaR4.test.ts', 'src/game/formal/playerLogistics.test.ts', 'src/game/formal/growthTasks.test.ts', 'src/game/formal/economyB3.test.ts', 'src/game/formal/runtime.test.ts', 'src/game/formal/combatPersistenceB5.test.ts', 'src/game/formal/wonderSchema.ts', 'src/game/formal/banditLoot.test.ts', 'src/game/formal/ledgerTestSupport.ts', 'src/game/developer/checks.ts', 'src/game/formal/diplomacyV94.test.ts', 'src/game/formal/breakthroughB92.test.ts', 'src/game/formal/mountains31.test.ts', 'src/game/formal/colonizationV85.test.ts', 'src/game/campaignArchive.test.ts', 'src/game/formal/breakthroughSchema.ts', 'releases/notes/b10-r3-03-formal-command-ledger.json', 'src/game/formal/modernAwarenessB94.test.ts', 'src/game/formal/politicsB6.test.ts', 'src/game/runtime.worker.ts', 'src/game/formal/protectionExtinctionP0C10.test.ts', 'src/game/formal/autonomyR2a.test.ts', 'src/game/formal/modernEmergencyB94.test.ts', 'src/game/formal/wonderRuinsGate.test.ts', 'src/game/governanceAdmission.ts', 'src/game/formal/playerFeedback.test.ts', 'src/game/formal/governance.ts', 'src/game/formal/breakthroughTestSupport.ts', 'src/game/formal/metrics.test.ts', 'src/game/formal/saveCodec.ts', 'src/game/formal/commandLedgerR303.test.ts', 'src/game/formal/p0c9Strategies.test.ts', 'src/game/formal/playerOrderRuntimeP0.test.ts', 'scripts/command-ledger-candidate.mjs', 'src/game/formal/durableCommands.test.ts', 'src/game/formal/logisticsOwnership.test.ts', 'src/game/formal/persistence.test.ts', 'src/game/formal/reducer.ts', 'src/game/formal/modernMilitaryGateB93.test.ts', 'src/game/formal/hegemonyB95.test.ts', 'src/game/formal/cityV88.test.ts', 'src/game/formal/refundV86.test.ts', 'scripts/verify-formal-ledger-browser.mjs', 'src/game/formal/wonderDurabilityB95.test.ts', 'src/game/formal/empireDeltaR1.test.ts', 'src/game/formal/extinction.ts', 'src/game/formal/gateDeltaPersistenceR4.test.ts', 'src/game/formal/campaignTime.test.ts', 'src/game/formal/growthTasks.ts', 'src/game/formal/durableWorkerTestSupport.ts', 'src/game/formal/versions.ts', 'src/game/formal/waterDeltaR4.test.ts', 'src/game/persistence.ts', 'src/game/formal/p0cQueues.test.ts', 'src/game/durableCommands.ts', 'src/game/formal/modernTransferB94.test.ts', 'scripts/verify-preview-boundaries.mjs', 'docs/validation/b10-r3-03/formal-v1/CONTRACT.md', 'src/game/formal/wonderAutoSupply.test.ts', 'scripts/benchmark-formal-ledger.mjs', 'src/game/formal/wildScout.test.ts', 'src/game/formal/recoveryR1.test.ts', 'src/game/formal/model.ts', 'src/game/formal/wonderB91.test.ts', 'src/game/formal/schema.test.ts', 'src/game/formal/ledgerFormalR303.test.ts', 'src/game/formal/modernMilitaryB93.test.ts', 'src/game/formal/scheduler.test.ts', 'src/game/formal/modernCatchupSchema.ts', 'src/game/formal/replayP0.test.ts', 'src/game/formal/ledgerTestSupport.test.ts', 'src/game/formal/autoLogistics.ts', 'src/game/formal/wallDelta.test.ts', 'src/game/formal/wonderRepairB95.test.ts', 'src/game/formal/modernFundingIntegration.test.ts', 'src/game/formal/endgameChainB95.test.ts', 'src/game/formal/modernResearchB94.test.ts'}
IMPLEMENTATION_SUPPORT={'docs/validation/b10-r3-03/formal-v1/compatibility.json', 'docs/validation/b10-r3-03/formal-v1/native-perf.json', 'scripts/test_b10_r3_01_successor.py', 'docs/validation/b10-r3-03/formal-v1/REPORT.md', 'scripts/test_b10_r3_03_successor.py', 'docs/validation/b10-r3-03/formal-v1/node-perf.json', 'scripts/b10_r3_02_successor.py', 'scripts/b10_r3_03_successor.py', 'docs/validation/b10-r3-03/formal-v1/native-final.json', 'scripts/test_b10_r3_02_successor.py', '.github/workflows/ci.yml'}
ADAPTERS={'scripts/growth_tasks_successor.py','scripts/p0c10_clock_delta.py','scripts/b10_r3_02_successor.py','.github/workflows/ci.yml','scripts/test_b10_r3_01_successor.py','scripts/test_b10_r3_02_successor.py'}
def sha(b):return hashlib.sha256(b).hexdigest()
@lru_cache(maxsize=None)
def previous(commit,path):
 from b10_r3_04_successor import previous as exact_blob
 return exact_blob(commit,path)
@lru_cache(maxsize=None)
def paths(*args):return set(subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only','-z',BASE,'--',*args],text=True).split('\0'))-{''}
@lru_cache(maxsize=None)
def changes():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines())
 assert actual==CHANGES|IMPLEMENTATION_SUPPORT,('Unexpected R3-03 implementation scope',actual^(CHANGES|IMPLEMENTATION_SUPPORT))
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
 s=edit(s," if path not in ADAPTERS or before!=previous(BASE,path):return False\n read_record(root)"," if path not in ADAPTERS:return next_adapter(path,before,root)\n if before!=previous(BASE,path):return False\n read_record(root)")
 s=edit(s,' return (root/path).exists() and (root/path).read_bytes()==adapters()[path]',' return (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or next_adapter(path,adapters()[path],root))')
 s=edit(s,'def validate(root=ROOT):\n r=read_record(root)','def validate(root=ROOT):\n from b10_r3_03_successor import accepts as next_accepts, accepts_adapter as next_adapter\n r=read_record(root)')
 s=edit(s,"==entry['after'],('Unrecorded R3-02 source change',p)","==entry['after'] or next_accepts(p,entry['after'],root),('Unrecorded R3-02 source change',p)")
 s=edit(s,"==digest,('Changed preserved R3-01/source/history',p)","==digest or section=='invariants' and next_accepts(p,digest,root),('Changed preserved R3-01/source/history',p)")
 s=edit(s,"==data,('Changed exact R3-02 adapter',p)","==data or next_adapter(p,data,root),('Changed exact R3-02 adapter',p)")
 ci=previous(BASE,'.github/workflows/ci.yml').decode();line='          python3 scripts/test_b10_r3_02_successor.py'
 ci=edit(ci,line,line+'\n          python3 scripts/b10_r3_03_successor.py\n          python3 scripts/test_b10_r3_03_successor.py')
 result={'scripts/b10_r3_02_successor.py':s.encode(),'.github/workflows/ci.yml':ci.encode()}
 delta=previous(BASE,'scripts/p0c10_clock_delta.py').decode()
 delta=edit(delta,'def accepts(path,predecessor,root=ROOT):\n if path not in SOURCES:return False','def accepts(path,predecessor,root=ROOT):\n from b10_r3_03_successor import accepts as next_accepts\n if path not in SOURCES:return False')
 delta=edit(delta," return predecessor==entry['before'] and (root/path).exists() and sha((root/path).read_bytes())==entry['after']"," return predecessor==entry['before'] and (root/path).exists() and (sha((root/path).read_bytes())==entry['after'] or next_accepts(path,entry['after'],root))")
 result['scripts/p0c10_clock_delta.py']=delta.encode()
 growth=previous(BASE,'scripts/growth_tasks_successor.py').decode()
 growth=edit(growth,"        assert digest == sha(previous(root, UI, path)) == sha((root / path).read_bytes()), ('Changed task witness', path)","        assert digest == sha(previous(root, UI, path)), ('Changed original task witness digest', path)\n        from b10_r3_03_successor import accepts as ledger_accepts\n        assert digest == sha((root / path).read_bytes()) or path == 'src/game/formal/growthTaskIntegration.test.ts' and ledger_accepts(path,digest,root), ('Changed task witness', path)")
 result['scripts/growth_tasks_successor.py']=growth.encode()
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
 return {'implementationSupport':sorted(IMPLEMENTATION_SUPPORT),'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'changes':c,'grants':grants,'invariants':{p:sha(previous(BASE,p)) for p in sorted(invariants)},'historical':{p:sha(previous(BASE,p)) for p in sorted(historical)},'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(data)} for p,data in adapters().items()}}
def read_record(root=ROOT):
 file=root/RECORD
 if not file.exists():file=ROOT/RECORD
 r=json.loads(file.read_text());assert r==expected_record(),'Changed R3-03 immutable commit, grant, source, rule, history or adapter manifest'
 return r
def accepts(path,predecessor,root=ROOT):
 from b10_r3_04_successor import accepts as next_accepts
 if path not in CHANGES:return next_accepts(path,predecessor,root)
 r=read_record(root)
 return predecessor in r['grants'].get(path,[]) and (root/path).exists() and (sha((root/path).read_bytes())==r['changes'][path]['after'] or next_accepts(path,r['changes'][path]['after'],root))
def accepts_adapter(path,before,root=ROOT):
 from b10_r3_04_successor import accepts_adapter as next_adapter
 if path not in ADAPTERS:return next_adapter(path,before,root)
 if before!=previous(BASE,path):return False
 read_record(root)
 return (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or next_adapter(path,adapters()[path],root))
def validate(root=ROOT):
 from b10_r3_04_successor import accepts as next_accepts, accepts_adapter as next_adapter
 r=read_record(root)
 for p,v in r['changes'].items():assert sha((root/p).read_bytes())==v['after'] or next_accepts(p,v['after'],root),('Unrecorded R3-03 source change',p)
 for section in ['invariants','historical']:
  for p,digest in r[section].items():assert sha((root/p).read_bytes())==digest or section=='invariants' and next_accepts(p,digest,root),('Changed preserved source/rule/history',p)
 for p,data in adapters().items():assert (root/p).read_bytes()==data or next_adapter(p,data,root),('Changed exact R3-03 adapter',p)
 return r
if __name__=='__main__':
 validate();print('PASS: exact R3-03 formal ledger successor; preserved game rules, scheduler, historical specifications and evidence. No release acceptance claim.')
