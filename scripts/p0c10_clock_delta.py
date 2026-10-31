"""Exact PR #53 clock-mode Delta: preserve every predecessor pin and grant four source diffs."""
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='889089aeb0139a18144c14990035a23075832b4d'
IMPLEMENTATION='615e8a988a27c6778173df49574dbe3e2f338d4d'
RECORD='docs/validation/protection-extinction/clock-mode-delta/compatibility.json'
SOURCES={'src/game/formal/offline.ts','src/game/formal/campaignTime.ts','src/game/formal/reducer.ts','src/game/formal/saveCodec.ts'}
TESTS={'src/game/formal/offlineExtinctionClockDelta.test.ts','src/game/formal/offlineExtinctionClockDeltaTestSupport.ts','src/game/formal/offlineExtinctionClockWorkerDelta.test.ts'}
NOTE='releases/notes/formal-protection-extinction.json'
INVARIANTS={
 'src/game/formal/schema.ts','src/game/formal/combatSchema.ts','src/game/formal/model.ts','src/game/formal/scheduler.ts',
 'src/game/formal/extinction.ts','src/game/formal/playtest.ts','src/game/formal/battles.ts','src/game/formal/economy.ts',
 'src/game/formal/military.ts','src/game/formal/aiActions.ts','src/game/formal/aiAttackStrategies.ts','src/game/formal/autonomy.ts',
 'src/game/formal/techCatalog.ts','src/game/formal/unitCatalog.ts','src/game/formal/growthTasks.ts','src/game/formal/growthTaskCatalog.ts',
 'src/game/formal/growthTaskSchema.ts','src/game/formal/queueCapacity.ts','src/game/formal/settlement.ts','src/game/formal/worldDraft.ts',
 'src/game/runtime.worker.ts','src/game/persistence.ts','src/game/useGame.ts','src/game/orderAdmission.ts','src/game/governanceAdmission.ts',
 'src/game/FormalWorldMap.tsx','src/game/presentation/ExtinctionView.tsx','src/game/presentation/RecruitmentForm.tsx',
 'src/game/presentation/DevelopmentViews.tsx','src/game/presentation/cityActions.ts','src/game/presentation/liveClock.ts',
}
def sha(data):return hashlib.sha256(data).hexdigest()
@lru_cache(maxsize=None)
def previous(commit,path):return subprocess.check_output(['git','-C',str(ROOT),'show',commit+':'+path],stderr=subprocess.DEVNULL)
@lru_cache(maxsize=None)
def history_paths():
 return set(subprocess.check_output(['git','-C',str(ROOT),'ls-tree','-r','--name-only','-z',BASE,'--','docs/validation/protection-extinction','docs/b6-v96','docs/b6-v97'],text=True).split('\0'))-{''}
@lru_cache(maxsize=None)
def expected_change(path):
 try:before=sha(previous(BASE,path))
 except subprocess.CalledProcessError:before=None
 return {'before':before,'after':sha(previous(IMPLEMENTATION,path))}

def adapters():
 path='scripts/p0c10_successor.py';old=previous(BASE,path).decode()
 a=" if path not in SOURCES:return False\n r=read_record(root)\n return predecessor in r['grants'][path] and (root/path).exists() and sha((root/path).read_bytes())==r['changes'][path]['after']"
 b=" from p0c10_clock_delta import accepts as delta_accepts\n if path not in SOURCES:return delta_accepts(path,predecessor,root)\n r=read_record(root)\n if predecessor not in r['grants'][path] or not (root/path).exists():return False\n return sha((root/path).read_bytes())==r['changes'][path]['after'] or delta_accepts(path,r['changes'][path]['after'],root)"
 assert old.count(a)==1;new=old.replace(a,b)
 new=new.replace(" r=read_record(root)\n for p,entry in r['changes'].items():assert sha((root/p).read_bytes())==entry['after'],('Unrecorded implementation change',p)"," r=read_record(root)\n from p0c10_clock_delta import accepts as delta_accepts\n for p,entry in r['changes'].items():assert sha((root/p).read_bytes())==entry['after'] or delta_accepts(p,entry['after'],root),('Unrecorded implementation change',p)")
 new=new.replace("for p,digest in r[section].items():assert sha((root/p).read_bytes())==digest,('Changed preserved source/history',p)","for p,digest in r[section].items():assert sha((root/p).read_bytes())==digest or section=='invariants' and delta_accepts(p,digest,root),('Changed preserved source/history',p)")
 ci='.github/workflows/ci.yml';original=previous(BASE,ci).decode();line='          python3 scripts/test_p0c10_successor.py'
 assert original.count(line)==1
 return {path:new.encode(),ci:original.replace(line,line+'\n          python3 scripts/p0c10_clock_delta.py\n          python3 scripts/test_p0c10_clock_delta.py').encode()}

def read_record(root=ROOT):
 p=root/RECORD
 if not p.exists():p=ROOT/RECORD
 r=json.loads(p.read_text())
 assert set(r)=={'schemaVersion','baseCommit','implementationCommit','changes','invariants','historical','adapters'}
 assert r['schemaVersion']==1 and r['baseCommit']==BASE and r['implementationCommit']==IMPLEMENTATION
 assert set(r['changes'])==SOURCES|TESTS|{NOTE} and set(r['invariants'])==INVARIANTS and set(r['historical'])==history_paths()
 actual=set(subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',BASE,IMPLEMENTATION],text=True).splitlines());assert actual==set(r['changes'])
 for p,entry in r['changes'].items():assert entry==expected_change(p),('Delta source/commit tampering',p)
 for section in ['invariants','historical']:
  for p,digest in r[section].items():assert digest==sha(previous(BASE,p)),('Changed predecessor digest',p)
 assert r['adapters']=={p:{'before':sha(previous(BASE,p)),'after':sha(data)} for p,data in adapters().items()}
 old=json.loads(previous(BASE,NOTE));new=json.loads(previous(IMPLEMENTATION,NOTE));assert new['title']==old['title'] and new['notes'][:-1]==old['notes']
 return r

def accepts(path,predecessor,root=ROOT):
 if path not in SOURCES:return False
 r=read_record(root);entry=r['changes'][path]
 return predecessor==entry['before'] and (root/path).exists() and sha((root/path).read_bytes())==entry['after']

def validate(root=ROOT):
 r=read_record(root)
 for p,entry in r['changes'].items():assert sha((root/p).read_bytes())==entry['after'],('Unrecorded Delta edit',p)
 for section in ['invariants','historical']:
  for p,digest in r[section].items():assert sha((root/p).read_bytes())==digest,('Preserved contract/evidence changed',p)
 for p,data in adapters().items():assert (root/p).read_bytes()==data,('Gate adapter scope changed',p)
 return r
if __name__=='__main__':
 validate();print('PASS: PR53 clock Delta admits only four exact source diffs; unchanged Schema, Worker, Scheduler, PR52 and all original P0-C-10 evidence retained.')
