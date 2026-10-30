"""Read-only integrity/scope gate; image anatomy is an explicit human review, not file QA."""
import hashlib,json,subprocess,sys
from pathlib import Path
from approved_china_art import validate_approved_china, REGISTRY_PATH, PREVIOUS_REGISTRY_SHA
from approved_japan_art import validate_approved_japan
from city_ui_successor import accepts_ui_successor
R=Path(__file__).resolve().parents[1];D=R/'docs/art-unification/player-feedback-20261029';S=R/'docs/art-source/player-feedback-20261029';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();load=lambda p:json.loads(p.read_text())
approved=validate_approved_china()
japan=validate_approved_japan()
selected=load(S/'outputs.json');allowed={r['path'] for r in selected};assert len(selected)==5
for r in selected:
 successor=R/'docs/art-unification/elite-review-20261029/runtime.json'
 if r['key']=='elite.guard.civ_frankia' and successor.exists():
  active=load(successor);assert active['previousSHA256']==r['sha256'] and sha(R/r['path'])==active['sha256'];subprocess.run([sys.executable,str(R/'scripts/check-elite-review.py')],cwd=R,check=True)
 else:assert sha(R/r['path'])==r['sha256']
 assert sha(R/r['candidate'])==r['sourceSha256'];assert r['dimensions']==[512,512] and len(r['references'])>=2
 for ref in r['references']:assert sha(R/ref['path'])==ref['sha256']
 gate=r['artGate'];assert gate['total']>=17 and gate['reviewedSHA256']==r['sha256'];assert all(gate['scores'][i]>0 for i in [0,1,8]);assert gate['hardGate']['anatomy']=='PASS_SELF_REVIEW'
protected=load(D/'protected.json')
for p,h in protected['files'].items():
 if p==REGISTRY_PATH:assert h==PREVIOUS_REGISTRY_SHA
 elif isinstance(h,dict):
  for f,v in h.items():assert sha(R/f)==v
 else:assert sha(R/p)==h or accepts_ui_successor(p,h),('Protected approved art/display changed',p)
for p,h in protected['publicTree'].items():
 if p not in allowed:
  data=(R/p).read_bytes();assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==h,('Unrequested public asset changed',p)
for p,h in protected['unitDirectory'].items():
 if p not in allowed:assert sha(R/p)==h,('Unrequested unit changed',p)
registry=load(R/'src/game/presentation/artAssets.json')['units']
for r in selected:assert registry[r['key']]==(approved['path'] if r['key']==approved['key'] else japan['path'] if r['key']==japan['key'] else r['path']).removeprefix('public/')
city=load(D/'browser/cities/result.json');assert city['status']=='PASS' and not city['errors'];assert city['counts']=={'cases':288,'paired':144,'changed':27,'unchanged':117}
assert len(city['pairs'])==144
for p in city['pairs']:assert p['slotStable'] and p['wallsStable'] and p['samePixels']!=p['changedExpected']
units=load(D/'browser/units/result.json');assert units['status']=='PASS' and not units['errors'] and len(units['rows'])==27
compat=load(D/'compatibility.json')
for p,h in compat['renderFiles'].items():assert sha(R/p)==h,('Stale source evidence',p)
for p,r in compat['updates'].items():
 assert sha(R/r['baselineFile'])==r['baselineSha256']
 assert sha(R/p)==r['currentSha256'] or accepts_ui_successor(p,r['currentSha256']),('Stale successor source evidence',p)

history=load(S/'generation-history.json')
for r in history:
 if 'image' not in r:continue
 assert sha(R/r['image'])==r['imageSHA256'] and sha(R/r['prompt'])==r['promptSHA256']
 for ref in r['references']:assert sha(R/ref['path'])==ref['sha256']
if (D/'capture-index.json').exists():
 caps=load(D/'capture-index.json');assert len(caps['records'])==387
 for p,m in caps['sheets'].items():assert sha(R/p)==m['sha256']
 for p,r in caps['records'].items():
  assert r['sheet'] in caps['sheets'] and 0<=r['frame']<caps['sheets'][r['sheet']]['frames']
  if r['retained']:assert sha(R/p)==r['originalSHA256']
 man=load(D/'boards/manifest.json')
 for name,m in man.items():
  p=D/'boards'/(name+('.png' if name=='units-native-64' else '.webp'));assert sha(p)==m['sha256']
  for row in m.get('rows',[]):
   for c in row:
    original=R/c['source']
    if original.exists():
     successor=R/'docs/art-unification/elite-review-20261029/runtime.json'
     if c['source']=='public/art/unified/units/elite.guard.civ_frankia.webp' and successor.exists():
      active=load(successor);assert c['sha256']==active['previousSHA256'] and sha(R/'docs/art-unification/elite-review-20261029/before/elite.guard.civ_frankia.webp')==c['sha256']
     else:assert sha(original)==c['sha256']
    else:assert caps['records'][c['source']]['originalSHA256']==c['sha256']

subprocess.run([sys.executable,str(R/'scripts/check-elite-final-review.py')],cwd=R,check=True)
print('PASS: historical five portraits/evidence preserved; approved Chinese/Japanese successors verified; heavy cavalry, other units, technology, legacy atlases, imperial calibration and world110% unchanged. Display sources remain exact or have the pinned PR #49 UI successor; independent review remains pending.')
