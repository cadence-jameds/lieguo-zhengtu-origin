"""Finite shared-training-slots successor; exact prior files and proofs are not rewritten."""
import hashlib,json,subprocess,sys
from functools import lru_cache
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE='155a1cd36d4f697db74537be840965976a95fe0e'
RESULTS={'scripts/verify-projection-boundaries.mjs': 'cdda3b08106601a62da79e03ea274ff0c6966dff7b642801f2d2e3d6bc832cc6',
 'src/game/FormalCityPanel.tsx': 'f685f40d588ef8ff124991d207af4e184aaf6f8078fc5807cd8e915f7aee778a',
 'src/game/FormalDevelopmentPanel.tsx': '861dc220b903ab388ff10cd2e3f3be4b279d34a4590a56028738061038e39265',
 'src/game/formal/aiActions.ts': '9b829b212ac0b1da9b544ea258fc55d9b98215011b5eae79a39639e6ff33206e',
 'src/game/formal/military.ts': '7afdbc0d64bdbe24d3e922df93388704d68117772bee779d04930dc25fb902d9',
 'src/game/formal/settlement.ts': '7576d543f2cfb28d1164b0bff99de144d6b3eca3c145d2f79a0140e6e0955990',
 'src/game/formal/trainingSlots.ts': 'e7dede0ea127c6f6f811ab752bb6dd177e0055f2deebbd0dc121536c8b8d7f68',
 'src/game/presentation/BuildingDetail.tsx': 'a0db4f0592f97f1ce00112129a09f815165d751d7c082a36f7bbe5a606c55af4',
 'src/game/presentation/CityQueues.tsx': '7ebd23166475fbd7972f31290f4cd9d33df6a4046b092852fad32119db0c18f3',
 'src/game/presentation/CityScenes.tsx': '9cc44538f65220cd889194bb2d218af775549040234b94c5c743b3d8de056626',
 'src/game/presentation/DevelopmentViews.tsx': '51ac529e9c65be8ede14d202a838fa7c096ac5bc3a09c4264d945159937bbe73',
 'src/game/presentation/cityActions.ts': '9e1f1b07730a031d83fcf7a86183918e926d3338749e338e950fc2dfc82822d9'}
BOUNDARY='scripts/verify-projection-boundaries.mjs'

def sha(data):
 return hashlib.sha256(data).hexdigest()

def git(*args):
 return subprocess.check_output(['git','-C',str(ROOT),*args])

def current(path,root=ROOT):
 if path not in RESULTS:return False
 f=root/path
 if f.is_file() and sha(f.read_bytes())==RESULTS.get(path):return True
 if path=='src/game/FormalDevelopmentPanel.tsx':
  from settlement_map_picker_successor import continues_file as picker
  return picker(path,RESULTS[path],root)
 if path=='src/game/presentation/DevelopmentViews.tsx':
  from special_unit_portraits_successor import accepts as portraits
  return portraits(path,RESULTS[path],root)
 if path=='src/game/presentation/CityScenes.tsx':
  from wall_build_marker_successor import continues_training_scene
  return continues_training_scene(path,RESULTS[path],root)
 if path!=BOUNDARY:return False
 from late_game_successor import accepts as late
 return late(path,RESULTS[path],root)

@lru_cache(maxsize=1)
def predecessors():
 result={p:set() for p in RESULTS}
 for p in result:
  if p!='src/game/formal/trainingSlots.ts':result[p].add(sha(git('show',BASE+':'+p)))
 for path in git('ls-tree','-r','--name-only',BASE,'docs/validation','docs/art-unification').decode().splitlines():
  if not path.endswith('.json'):continue
  record=json.loads(git('show',BASE+':'+path))
  if not isinstance(record,dict):continue
  for key in ('files','sourceFiles','sources','changes','invariants','grants','updates','adapters'):
   section=record.get(key)
   if not isinstance(section,dict):continue
   for p,grants in result.items():
    row=section.get(p)
    found=[row] if isinstance(row,str) else row if isinstance(row,list) else [row.get(k) for k in ('before','after','baseSha256','uiSha256','currentSha256')] if isinstance(row,dict) else ()
    grants.update(d for d in found if isinstance(d,str) and len(d)==64 and all(c in '0123456789abcdef' for c in d))
 return result

def accepts(path,prior,root=ROOT):
 return current(path,root) and prior in predecessors().get(path,())

def continues(path,prior,root=ROOT):
 return (current(path,root) and path!='src/game/formal/trainingSlots.ts'
         and prior==sha(git('show',BASE+':'+path)))

if __name__=='__main__':
 assert sys.argv[1:]==['--boundary-admissions']
 for p in RESULTS:assert current(p),'Changed exact shared training slot source: '+p
 print(json.dumps([p for p in RESULTS if p.startswith('src/game/formal/')]))
