"""Finite recruitment presentation successor; formal authority and old evidence stay fixed."""
import json
import subprocess
from pathlib import Path
from city_ui_successor import previous, sha
ROOT = Path(__file__).resolve().parents[1]
BASE = 'fd29dd11c04fce806e973e747db55a126c206acf'
UI = '73a063098ae3b1419750c28b941e4e1a96463ec2'
RECORD = 'docs/validation/recruit-input-p1/compatibility.json'
PROTECTED = 'docs/art-unification/elite-review-20261029/protected.json'
SOURCES = {'src/game/presentation/DevelopmentViews.tsx', 'src/game/presentation/cityActions.ts'}
INVARIANTS = {
 'src/game/formal/worldDraft.ts','src/game/formal/military.ts','src/game/formal/reducer.ts',
 'src/game/formal/schema.ts','src/game/formal/saveCodec.ts','src/game/formal/model.ts',
 'src/game/formal/unitCatalog.ts','src/game/formal/modernAwareness.ts','src/game/formal/versions.ts',
 'src/game/persistence.ts','src/game/runtime.worker.ts','src/game/presentation/liveClock.ts',
 'src/game/formal/growthTaskCatalog.ts','src/game/formal/growthTaskSchema.ts','src/game/formal/growthTasks.ts',
 'src/game/presentation/JourneyGoals.tsx','src/game/presentation/journeyGoals.css',
 'src/game/presentation/artAssets.json','src/game/presentation/Art.tsx',
}
HISTORICAL = {PROTECTED,'docs/validation/city-ui-successor/compatibility.json',
 'docs/validation/mobile-town-labels/compatibility.json','docs/validation/journey-goals-integration/compatibility.json'}

def validate(root=ROOT):
 record=json.loads((root/RECORD).read_text())
 assert record['schemaVersion']==1 and record['baseCommit']==BASE and record['uiCommit']==UI
 assert set(record['changes'])==SOURCES and set(record['invariants'])==INVARIANTS and set(record['historical'])==HISTORICAL
 protected=json.loads(previous(root,BASE,PROTECTED))['files']
 for path,entry in record['changes'].items():
  assert entry['before']==protected[path]==sha(previous(root,BASE,path))
  assert entry['after']==sha(previous(root,UI,path))==sha((root/path).read_bytes()),('Changed recruitment source',path)
 for section in ['invariants','historical']:
  for path,digest in record[section].items():
   assert digest==sha(previous(root,BASE,path)),('Original authority/history digest changed',path)
   from p0c10_successor import accepts as p0c10_accepts
   assert digest==sha((root/path).read_bytes()) or section=='invariants' and p0c10_accepts(path,digest,root),('Changed authority/history',path)
 witnesses=set(subprocess.check_output(['git','-C',str(root),'ls-tree','-r','--name-only','-z',UI,'--',
  'docs/validation/recruit-input-p1','src/game/presentation/RecruitmentForm.tsx',
  'src/game/presentation/recruitmentInput.test.tsx','src/game/presentation/recruitmentPreview.test.ts',
  'scripts/measure-recruit-input.mjs','scripts/serve-recruit-input.mjs'],text=True).split('\0'))-{''}
 assert set(record['evidence'])==witnesses
 for path,digest in record['evidence'].items():
  assert digest==sha(previous(root,UI,path))==sha((root/path).read_bytes()),('Changed recruitment witness',path)
 # Non-recruitment action previews and military/settlement presentation remain byte-identical.
 path='src/game/presentation/cityActions.ts'
 before=previous(root,BASE,path).decode();after=(root/path).read_text()
 old_start=before.index('/** Actual recruitment scheduler preview');old_end=before.index('/** The real craftsman')
 new_start=after.index('/** Read-only UI arithmetic');new_end=after.index('/** The real craftsman')
 prefix=after[:new_start]
 for line in ["import {UNIT_CATALOG,ELITE_VARIANTS} from '../formal/unitCatalog';\n","import {unitRecruitCost,unitTrainingDuration} from '../formal/military';\n","import {modernUnitAuthorized} from '../formal/modernAwareness';\n"]:
  prefix=prefix.replace(line,'')
 assert before[:old_start]+before[old_end:]==prefix+after[new_end:]
 path='src/game/presentation/DevelopmentViews.tsx';before=previous(root,BASE,path).decode();after=(root/path).read_text()
 start='\n </>:<><CombatPanel'
 assert before[before.index(start):before.index('\n {selected&&info')]==after[after.index(start):after.index('\n {selected&&<Dialog')]
 metrics=json.loads((root/'docs/validation/recruit-input-p1/metrics.json').read_text())
 assert metrics['baseCommit']==BASE and metrics['saveShaVerified'] and metrics['saveSha256']=='16be5971dfec1ca347fef4cbfa898f18f69c59a6c77e0b04517d41c3c2499608'
 for group in ['afterFirst','afterBackground','afterDesktopBatch']:
  assert metrics['runs'][group]
  for row in metrics['runs'][group]:
   assert not row.get('status') and not row['errors'] and row['formalCalls']==row['cloneTotal']==row['schemaTotal']==row['longTasks']==0
 worker=[r for r in metrics['runs']['afterBackground'] if r['mode']=='worker25']
 assert {r['width'] for r in worker}=={320,390,1440} and all(r['p95']<50 and r['updates']>0 for r in worker)
 assert metrics['firstDesktopOutlierMs']==60.5 and metrics['allFirstRunsUnder50'] is False
 failures=[r for r in metrics['runs']['beforeBackground'] if r.get('status')]
 assert len(failures)==3 and all(r['status']=='UNRESPONSIVE' for r in failures)
 return record

def accepts(path,predecessor,root=ROOT):
 if path not in SOURCES:return False
 record=validate(root)
 return predecessor==record['changes'][path]['before']

if __name__=='__main__':
 validate();print('PASS: exact recruitment UI successor; unchanged Worker/rules/save/v96/art; scalar-only performance witnesses and cold outlier retained.')
