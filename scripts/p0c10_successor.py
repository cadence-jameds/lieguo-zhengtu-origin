"""Finite player-authorized P0-C-10 successor. Historical manifests are never rewritten."""
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE='9e3233090b634cc38ef280525444a32d0714ae47'
IMPLEMENTATION='acc818682f707eb66d72695e2d0e3a30cfb39cc3'
RECORD='docs/validation/protection-extinction/compatibility.json'
# Every existing source/test changed by this feature, with no wildcard/directory grant.
SOURCES={
 'src/game/developer/b5LabConfig.ts',
 'src/game/FormalWorldMap.tsx','src/game/GameApp.tsx','src/game/developer/B5Lab.ts',
 'src/game/formal/extinctionB7.test.ts',
 'src/game/formal/armies.ts','src/game/formal/battles.ts','src/game/formal/campaignTime.ts',
 'src/game/formal/combatSchema.ts','src/game/formal/developerCommand.ts','src/game/formal/extinction.ts',
 'src/game/formal/generator.ts','src/game/formal/model.ts','src/game/formal/offline.ts',
 'src/game/formal/playtest.ts','src/game/formal/reducer.ts','src/game/formal/schema.ts','src/game/formal/versions.ts',
 'src/game/persistence.ts','src/game/presentation/ExtinctionView.tsx','src/game/presentation/FormalReportsView.tsx',
 'src/game/presentation/Shell.tsx','src/game/presentation/liveClock.ts','src/game/presentation/playable.css',
 'src/game/runtime.worker.ts','src/game/useGame.ts',
 'src/game/developer/developer.test.ts','src/game/formal/developmentTestSupport.ts','src/game/formal/gateDeltaR4.test.ts','src/game/formal/integrationR4.test.ts','src/game/formal/mountains31.test.ts','src/game/formal/playtest26.test.ts','src/game/formal/replayP0.test.ts','src/game/formal/runtime.test.ts','src/game/presentation/p0cDemoUi.test.tsx','src/game/presentation/worldDynamicsR3.test.ts',
}
INVARIANTS={
 'src/game/formal/military.ts','src/game/formal/worldDraft.ts','src/game/formal/economy.ts',
 'src/game/formal/settlement.ts','src/game/formal/autonomy.ts','src/game/formal/aiActions.ts',
 'src/game/formal/aiAttackStrategies.ts','src/game/formal/unitCatalog.ts','src/game/formal/techCatalog.ts',
 'src/game/formal/growthTasks.ts','src/game/formal/growthTaskCatalog.ts','src/game/formal/growthTaskSchema.ts',
 'src/game/formal/saveCodec.ts','src/game/presentation/DevelopmentViews.tsx','src/game/presentation/cityActions.ts',
 'src/game/presentation/RecruitmentForm.tsx','src/game/presentation/recruitmentInput.test.tsx',
 'src/game/presentation/recruitmentPreview.test.ts','src/game/presentation/artAssets.json',
 'src/game/presentation/Art.tsx','src/game/presentation/artMap.ts','src/game/presentation/cityVisuals.ts',
 'src/game/MiniatureCity.tsx','src/game/presentation/parity.css','src/game/game.css',
}
HISTORY={
 'docs/b6-v96/河谷戰役_vNext_平衡重構討論_v96.md',
 'docs/art-unification/city-fit/measurements.json',
 'docs/art-unification/player-feedback-20261029/compatibility.json',
 'docs/art-unification/player-feedback-20261029/protected.json',
 'docs/art-unification/elite-review-20261029/protected.json',
 'docs/art-unification/elite-review-20261029/browser-manifest.json',
 'docs/art-unification/elite-final-20261030/browser-manifest.json',
 'docs/art-unification/japan-approved-20261030/browser-manifest.json',
 'docs/validation/city-ui-successor/compatibility.json',
 'docs/validation/mobile-town-labels/compatibility.json',
 'docs/validation/journey-goals-integration/compatibility.json',
 'docs/validation/recruit-input-p1/compatibility.json',
}

def sha(data):return hashlib.sha256(data).hexdigest()
@lru_cache(maxsize=None)
def previous(commit,path):
 return subprocess.check_output(['git','-C',str(ROOT),'show',commit+':'+path],stderr=subprocess.DEVNULL)
@lru_cache(maxsize=None)
def changed_sources():
 return set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION,'--','src'],text=True).splitlines())
@lru_cache(maxsize=None)
def predecessors(path):
 values={sha(previous(BASE,path))}
 def digests(value):
  if isinstance(value,str) and len(value)==64 and all(c in '0123456789abcdef' for c in value):values.add(value)
  elif isinstance(value,dict):
   for v in value.values():digests(v)
  elif isinstance(value,list):
   for v in value:digests(v)
 def visit(value):
  if isinstance(value,dict):
   for k,v in value.items():
    if k==path:digests(v)
    else:visit(v)
  elif isinstance(value,list):
   for v in value:visit(v)
 for p in HISTORY:
  if p.endswith('.json'):visit(json.loads(previous(BASE,p)))
 return sorted(values)

def expected_change(path):
 try:before=sha(previous(BASE,path))
 except subprocess.CalledProcessError:before=None
 return {'before':before,'after':sha(previous(IMPLEMENTATION,path))}

def read_record(root=ROOT):
 # Historical gate unit tests copy only their original witnesses. Immutable git
 # objects and this exact feature manifest remain shared with their test harness.
 manifest=root/RECORD
 if not manifest.exists():manifest=ROOT/RECORD
 r=json.loads(manifest.read_text())
 assert set(r)=={'schemaVersion','baseCommit','implementationCommit','changes','grants','invariants','historical'}
 assert r['schemaVersion']==1 and r['baseCommit']==BASE and r['implementationCommit']==IMPLEMENTATION
 assert set(r['changes'])==changed_sources() and set(r['grants'])==SOURCES
 assert set(r['invariants'])==INVARIANTS and set(r['historical'])==HISTORY
 for p,entry in r['changes'].items():assert entry==expected_change(p),('Feature source/commit tampering',p)
 for p,values in r['grants'].items():assert values==predecessors(p),('Wrong exact predecessor grant',p)
 for section in ['invariants','historical']:
  for p,digest in r[section].items():assert digest==sha(previous(BASE,p)),('Historical/invariant digest tampering',p)
 return r

def accepts(path,predecessor,root=ROOT):
 if path not in SOURCES:return False
 r=read_record(root)
 return predecessor in r['grants'][path] and (root/path).exists() and sha((root/path).read_bytes())==r['changes'][path]['after']

def validate(root=ROOT):
 r=read_record(root)
 for p,entry in r['changes'].items():assert sha((root/p).read_bytes())==entry['after'],('Unrecorded implementation change',p)
 for section in ['invariants','historical']:
  for p,digest in r[section].items():assert sha((root/p).read_bytes())==digest,('Changed preserved source/history',p)
 return r

if __name__=='__main__':
 validate();print('PASS: exact P0-C-10 implementation successor; historical evidence, military/economy/AI balance, PR #52 and art invariants retained. No release/Gate acceptance claim.')
