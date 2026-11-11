"""Exact R3-04 display successor; no rule, persistence, history or deadline waiver."""
import atexit,hashlib,json,subprocess
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='1737d14a8f210fb2d33eb5dadbde18c3bb375586'
IMPLEMENTATION='68c4f88ada6ac47290600fd99c9fa0e1ec1ac86c'
RECORD='docs/validation/b10-r3-04/compatibility.json'
IMPLEMENTATION_SUPPORT={'docs/validation/b10-r3-04/pre-scope-final.json', 'docs/validation/b10-r3-04/native-flow.json', 'docs/validation/b10-r3-04/full-attempt1-summary.json', '.github/workflows/ci.yml', 'scripts/test_b10_r3_03_successor.py', 'scripts/test_b10_r3_04_successor.py', 'docs/validation/b10-r3-04/UI-DEPENDENCIES.md', 'docs/validation/b10-r3-04/native-perf.json', 'docs/validation/b10-r3-04/node-perf.json', 'docs/validation/b10-r3-04/native-recovery-perf.json', 'docs/validation/b10-r3-04/compatibility.json', 'scripts/recruit_input_successor.py', 'scripts/b10_r3_03_successor.py', 'scripts/mobile_town_successor.py', 'docs/validation/b10-r3-04/REPORT.md', 'scripts/b10_r3_04_successor.py'}
CHANGES={'src/game/presentation/Garrison.tsx', 'src/game/formal/projectionBenchmarkSupport.ts', 'src/game/FormalWorldMap.tsx', 'src/game/projectionAdmissionR304.test.ts', 'src/game/presentation/ProtectionStatus.tsx', 'src/game/presentation/BreakthroughPanel.tsx', 'src/game/formal/wonder.ts', 'src/game/governanceAdmission.ts', 'src/game/formal/settlement.ts', 'src/game/presentation/CraftsmanPanel.tsx', 'src/game/presentation/WonderRepairPanel.tsx', 'src/game/ProjectionSyncNotice.tsx', 'src/game/usePresentation.ts', 'src/game/presentation/factionRankings.ts', 'src/game/orderAdmission.ts', 'src/game/presentationSharing.ts', 'src/game/formal/wonderRuntimeB91.test.ts', 'src/game/formal/modernAwareness.ts', 'src/game/useGameInteraction.test.tsx', 'src/game/presentation/BattleReportBody.tsx', 'src/game/presentation/IncomingArmyAlert.tsx', 'src/game/presentation/mapRaster.worker.ts', 'scripts/ui-projection-benchmark-case.mjs', 'src/game/worldProjection.ts', 'src/game/worldStream.ts', 'src/game/FormalHome.tsx', 'src/game/presentation/mapSemantics.ts', 'src/game/projectionProtocol.ts', 'src/game/presentation/CityScenes.tsx', 'src/game/presentation/artMap.ts', 'src/game/presentation/WonderPanel.tsx', 'src/game/formal/offlineExtinctionClockWorkerDelta.test.ts', 'src/game/presentationStore.ts', 'src/game/presentation/VictoryPanel.tsx', 'src/game/presentation/QuickSettings.tsx', 'src/game/formal/projectionTestSupport.ts', 'src/game/presentation/useConstructionPreviews.tsx', 'src/game/formal/reportScope.ts', 'src/game/formal/durableWorkerTestSupport.ts', 'src/game/updatePreparation.test.tsx', 'src/game/presentation/FormalReportsView.tsx', 'scripts/benchmark-ui-projection.mjs', 'src/game/durableCommands.ts', 'src/game/formal/economy.ts', 'src/game/projectionScopeR304.test.tsx', 'src/game/formal/routing.ts', 'src/game/presentation/CityQueues.tsx', 'scripts/verify-ui-projection-performance-browser.mjs', 'src/game/formal/battleView.ts', 'src/game/admissionMap.ts', 'scripts/verify-ui-projection-browser.mjs', 'src/game/presentation/CatchupPanel.tsx', 'src/game/worldStream.test.ts', 'src/game/FormalDevelopmentPanel.tsx', 'src/game/presentationSelectors.ts', 'src/game/presentation/mapPaint.ts', 'src/game/formal/politics.ts', 'src/game/presentation/cityActions.ts', 'src/game/projectionReactR304.test.tsx', 'src/game/formal/mountains.ts', 'src/game/presentation/liveClock.ts', 'src/game/presentation/CombatPanel.tsx', 'src/game/FormalCityPanel.tsx', 'src/game/presentationModel.ts', 'src/game/presentation/Shell.tsx', 'src/game/presentation/UI.tsx', 'src/game/interaction.ts', 'scripts/serve-ui-projection-validation.mjs', 'src/game/formal/growthTasks.ts', 'src/game/formal/playtest.ts', 'src/game/presentation/ResearchView.tsx', 'src/game/formal/buildingDetailData.ts', 'src/game/presentation/mapRelations.ts', 'docs/validation/b10-r3-04/CONTRACT.md', 'src/game/formal/wonderCondition.ts', 'src/game/presentation/ModernizationPanel.tsx', 'src/game/presentation/RecruitmentForm.tsx', 'src/game/presentation/ScoutIntelDetails.tsx', 'src/game/presentation/EraUpgrade.tsx', 'src/game/presentation/PoliticsView.tsx', 'src/game/useGame.ts', 'src/game/presentation/LogisticsSettingsPanel.tsx', 'src/game/formal/combatWorkerB5.test.ts', 'src/game/formal/militaryPower.ts', 'src/game/presentation/AwarenessPanel.tsx', 'src/game/formal/breakthroughRuntimeB92.test.ts', 'src/game/presentation/ExtinctionView.tsx', 'src/game/formal/schema.ts', 'src/game/GameApp.tsx', 'src/game/presentation/LiveValues.tsx', 'src/game/presentation/researchTree.ts', 'src/game/formal/aiKnowledge.ts', 'releases/notes/b10-r3-04-ui-projection.json', 'src/game/presentation/targetIntel.ts', 'src/game/formal/spatial.ts', 'src/game/interaction.test.ts', 'src/game/formal/modernCatchup.ts', 'src/game/formal/victory.ts', 'src/game/presentation/LiveBattleDetails.tsx', 'src/game/presentation/PoliticalAction.tsx', 'src/game/presentation/armyOverlay.ts', 'src/game/presentation/civilianOverlay.ts', 'src/game/formal/extinctionWorkerP0C10.test.ts', 'src/game/formal/breakthrough.ts', 'src/game/presentation/BuildingDetail.tsx', 'src/game/formal/demolition.ts', 'src/game/formal/military.ts', 'src/game/formal/armies.ts', 'src/game/formal/autonomyRuntimeR2c.test.ts', 'src/game/projectionRecovery.ts', 'src/game/formal/extinction.ts', 'src/game/presentation/DevelopmentViews.tsx', 'src/game/formal/playerOrderRuntimeP0.test.ts', 'src/game/ConnectedCityPanel.tsx', 'src/game/formal/runtime.test.ts', 'src/game/presentation/DemoMapCache.ts', 'src/game/formal/runtimeB4.test.ts', 'src/game/presentation/CampaignSettings.tsx', 'src/game/runtime.worker.ts', 'src/game/presentation/DeveloperControls.tsx', 'src/game/constructionPreviewContext.ts', 'scripts/benchmark-projection-recovery-browser.mjs', 'src/game/developer/B5BattleLab.tsx', 'src/game/presentation/mapViewRules.ts', 'src/game/presentation/GovernanceView.tsx', 'src/game/presentation/LegionView.tsx', 'src/game/presentation/specialFields.ts', 'src/game/projectionArmyR304.test.ts', 'src/game/formal/durableRuntime.test.ts', 'src/game/formal/growthTaskSchema.ts', 'src/game/formal/terrain.ts', 'src/game/formal/projectionFixtureSupport.ts', 'src/game/formal/logisticsAllocation.ts', 'src/game/presentation/FormalTargetPanel.tsx', 'src/game/presentation/JourneyGoals.tsx', 'scripts/verify-projection-boundaries.mjs'}
ADAPTERS={'scripts/b10_r3_03_successor.py','scripts/test_b10_r3_03_successor.py','.github/workflows/ci.yml','scripts/mobile_town_successor.py','scripts/recruit_input_successor.py'}
def sha(b):return hashlib.sha256(b).hexdigest()
_objects=None
def close_objects():
 global _objects
 if _objects is not None:
  _objects.stdin.close();_objects.wait();_objects=None
atexit.register(close_objects)
@lru_cache(maxsize=None)
def previous(commit,path):
 # Same immutable blob bytes as git show, without thousands of process forks.
 global _objects
 if _objects is None:_objects=subprocess.Popen(['git','-C',str(ROOT),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 _objects.stdin.write((commit+':'+path+'\n').encode());_objects.stdin.flush();header=_objects.stdout.readline().decode()
 if header.endswith(' missing\n'):raise subprocess.CalledProcessError(128,['git','show',commit+':'+path])
 fields=header.split();assert len(fields)==3 and fields[1]=='blob',('Unexpected immutable object',commit,path,header)
 size=int(fields[2]);data=_objects.stdout.read(size);assert len(data)==size and _objects.stdout.read(1)==b'\n','Incomplete immutable blob'
 return data
@lru_cache(maxsize=None)
def paths(*args):return set(subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only','-z',BASE,'--',*args],text=True).split('\0'))-{''}
@lru_cache(maxsize=None)
def adapters():
 def edit(s,a,b):
  assert s.count(a)==1,('Changed adapter predecessor',a)
  return s.replace(a,b)
 s=previous(BASE,'scripts/b10_r3_03_successor.py').decode()
 s=edit(s,"def previous(commit,path):return subprocess.check_output(['git','-C',str(ROOT),'show',commit+':'+path],stderr=subprocess.DEVNULL)","def previous(commit,path):\n from b10_r3_04_successor import previous as exact_blob\n return exact_blob(commit,path)")
 s=edit(s,'def accepts(path,predecessor,root=ROOT):\n if path not in CHANGES:return False','def accepts(path,predecessor,root=ROOT):\n from b10_r3_04_successor import accepts as next_accepts\n if path not in CHANGES:return next_accepts(path,predecessor,root)')
 s=edit(s,"and sha((root/path).read_bytes())==r['changes'][path]['after']\n","and (sha((root/path).read_bytes())==r['changes'][path]['after'] or next_accepts(path,r['changes'][path]['after'],root))\n")
 s=edit(s,'def accepts_adapter(path,before,root=ROOT):\n if path not in ADAPTERS or before!=previous(BASE,path):return False','def accepts_adapter(path,before,root=ROOT):\n from b10_r3_04_successor import accepts_adapter as next_adapter\n if path not in ADAPTERS:return next_adapter(path,before,root)\n if before!=previous(BASE,path):return False')
 s=edit(s,'return (root/path).exists() and (root/path).read_bytes()==adapters()[path]\n','return (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or next_adapter(path,adapters()[path],root))\n')
 s=edit(s,'def validate(root=ROOT):\n r=read_record(root)','def validate(root=ROOT):\n from b10_r3_04_successor import accepts as next_accepts, accepts_adapter as next_adapter\n r=read_record(root)')
 s=edit(s,"==v['after'],('Unrecorded R3-03 source change',p)","==v['after'] or next_accepts(p,v['after'],root),('Unrecorded R3-03 source change',p)")
 s=edit(s,"==digest,('Changed preserved source/rule/history',p)","==digest or section=='invariants' and next_accepts(p,digest,root),('Changed preserved source/rule/history',p)")
 s=edit(s,"==data,('Changed exact R3-03 adapter',p)","==data or next_adapter(p,data,root),('Changed exact R3-03 adapter',p)")
 ci=previous(BASE,'.github/workflows/ci.yml').decode();line='          python3 scripts/test_b10_r3_03_successor.py';ci=edit(ci,line,line+'\n          python3 scripts/b10_r3_04_successor.py\n          python3 scripts/test_b10_r3_04_successor.py\n          node scripts/verify-projection-boundaries.mjs')
 t=previous(BASE,'scripts/test_b10_r3_03_successor.py').decode()
 t=edit(t,"   self.assertFalse(gate.accepts(p,r['invariants'][p],self.root))","   import b10_r3_04_successor as successor\n   self.assertEqual(gate.accepts(p,r['invariants'][p],self.root),successor.accepts(p,r['invariants'][p],self.root))\n   self.assertFalse(gate.accepts(p,'0'*64,self.root))")
 mobile=previous(BASE,'scripts/mobile_town_successor.py').decode()
 mobile=edit(mobile,"        assert entry['after'] == sha(previous(root, UI, path)) == sha((root / path).read_bytes()), ('Unrecorded UI edit', path)","        assert entry['after'] == sha(previous(root, UI, path)), ('Original UI source changed', path)\n        from b10_r3_04_successor import accepts as projection_accepts\n        assert entry['after'] == sha((root / path).read_bytes()) or projection_accepts(path,entry['after'],root), ('Unrecorded UI edit', path)")
 recruit=previous(BASE,'scripts/recruit_input_successor.py').decode()
 recruit=edit(recruit," from b10_r3_02_successor import accepts as preview_accepts"," from b10_r3_02_successor import accepts as preview_accepts\n from b10_r3_04_successor import accepts as projection_accepts")
 recruit=edit(recruit,"or path=='src/game/presentation/cityActions.ts' and preview_accepts(path,entry['after'],root)","or path=='src/game/presentation/cityActions.ts' and preview_accepts(path,entry['after'],root) or projection_accepts(path,entry['after'],root)")
 recruit=edit(recruit,"  assert digest==sha(previous(root,UI,path))==sha((root/path).read_bytes()),('Changed recruitment witness',path)","  assert digest==sha(previous(root,UI,path)),('Changed original recruitment witness',path)\n  assert digest==sha((root/path).read_bytes()) or path=='src/game/presentation/RecruitmentForm.tsx' and projection_accepts(path,digest,root),('Changed recruitment witness',path)")
 return {'scripts/b10_r3_03_successor.py':s.encode(),'scripts/test_b10_r3_03_successor.py':t.encode(),'.github/workflows/ci.yml':ci.encode(),'scripts/mobile_town_successor.py':mobile.encode(),'scripts/recruit_input_successor.py':recruit.encode()}
@lru_cache(maxsize=None)
def expected_record():
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines())
 assert actual==CHANGES|IMPLEMENTATION_SUPPORT,('Unexpected R3-04 source commit scope',actual^(CHANGES|IMPLEMENTATION_SUPPORT))
 changes={}
 for p in sorted(CHANGES):
  try:before=sha(previous(BASE,p))
  except subprocess.CalledProcessError:before=None
  changes[p]={'before':before,'after':sha(previous(IMPLEMENTATION,p))}
 grants={p:[v['before']] for p,v in changes.items() if v['before']}
 records=sorted(p for p in paths('docs') if p.endswith('/compatibility.json'))
 for record in records:
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
 return {'implementationSupport':sorted(IMPLEMENTATION_SUPPORT),'schemaVersion':1,'baseCommit':BASE,'implementationCommit':IMPLEMENTATION,'changes':changes,'grants':grants,'invariants':{p:sha(previous(BASE,p)) for p in sorted(paths('src')-CHANGES)},'historical':{p:sha(previous(BASE,p)) for p in sorted(paths('docs/b6-v95','docs/b6-v96','docs/b6-v97','docs/validation','releases/notes')-CHANGES)},'adapters':{p:{'before':sha(previous(BASE,p)),'after':sha(data)} for p,data in adapters().items()}}
def read_record(root=ROOT):
 f=root/RECORD
 if not f.exists():f=ROOT/RECORD
 r=json.loads(f.read_text());assert r==expected_record(),'Changed immutable R3-04 source, predecessor, historical record or adapter manifest'
 return r
def accepts(path,predecessor,root=ROOT):
 from b10_r3_05_successor import accepts as next_accepts
 if path not in CHANGES:
  from home_art_ui_successor import accepts as presentation_accepts
  return presentation_accepts(path,predecessor,root)
 r=read_record(root)
 return predecessor in r['grants'].get(path,[]) and (root/path).exists() and (sha((root/path).read_bytes())==r['changes'][path]['after'] or next_accepts(path,r['changes'][path]['after'],root))
def accepts_adapter(path,before,root=ROOT):
 from b10_r3_05_successor import accepts_adapter as next_adapter
 if path not in ADAPTERS or before!=previous(BASE,path):return False
 read_record(root)
 return (root/path).exists() and ((root/path).read_bytes()==adapters()[path] or next_adapter(path,adapters()[path],root))
def validate(root=ROOT):
 from b10_r3_05_successor import accepts as next_accepts, accepts_adapter as next_adapter
 r=read_record(root)
 for p,v in r['changes'].items():assert sha((root/p).read_bytes())==v['after'] or next_accepts(p,v['after'],root),('Unrecorded R3-04 source change',p)
 for section in ['invariants','historical']:
  for p,d in r[section].items():assert sha((root/p).read_bytes())==d or section=='invariants' and next_accepts(p,d,root),('Changed preserved source/history',p)
 for p,b in adapters().items():assert (root/p).read_bytes()==b or next_adapter(p,b,root),('Changed exact R3-04 adapter',p)
 return r
if __name__=='__main__':
 validate();print('PASS: exact R3-04 UI projection successor; no gameplay, T2, saved-format, deadline or history waiver. No release acceptance claim.')
