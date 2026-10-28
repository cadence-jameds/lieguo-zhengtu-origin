"""Read-only technical gate for preserved candidates and shipped derivatives."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image
import numpy as np

root = Path(__file__).resolve().parents[1]
output = root / (sys.argv[1] if len(sys.argv) > 1 else 'work/art-files.json')
source = root / 'docs/art-source/unification'
assets = json.loads((source/'assets.json').read_text())
batches = json.loads((source/'batches.json').read_text())
failures, results = [], []
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for batch in batches:
    if digest(root/batch['source']) != batch['sourceSha256']:
        failures.append(batch['id']+': source checksum')
    if len(batch['references']) < 2:
        failures.append(batch['id']+': fewer than two actual references')
    for reference in batch['references']:
        if digest(root/reference['path']) != reference['sha256']:
            failures.append(batch['id']+': reference checksum '+reference['path'])
for asset in assets:
    file = root/asset['path']
    image = Image.open(file); image.load()
    errors = []
    if list(image.size) != asset['dimensions']: errors.append('dimensions')
    if digest(file) != asset['sha256']: errors.append('checksum')
    if asset['alphaPolicy'] == 'transparent':
        if image.mode != 'RGBA': errors.append('missing alpha')
        else:
            alpha = np.asarray(image.getchannel('A'))
            if any(alpha[y,x] != 0 for x,y in [(0,0),(-1,0),(0,-1),(-1,-1)]): errors.append('opaque corner')
            if not (alpha.max() > 128 and (alpha == 0).any()): errors.append('invalid alpha range')
    results.append({'key':asset['key'],'path':asset['path'],'dimensions':list(image.size),'bytes':file.stat().st_size,'errors':errors})
    failures.extend(asset['key']+': '+error for error in errors)
foreground = []
base = np.asarray(Image.open(root/'public/art/city-scene-stone.webp').convert('RGB'))
for name in ['city-scene-imperial','city-scene-imperial-construction']:
    image = np.asarray(Image.open(root/('public/art/unified/'+name+'.webp')).convert('RGB'))
    exact = bool(np.array_equal(base[235:], image[235:]))
    foreground.append({'path':name,'unchangedFromRow':235,'exactDecodedPixels':exact})
    if not exact: failures.append(name+': lot/road foreground changed')
ring = np.asarray(Image.open(root/'public/art/unified/wall-ring-imperial.webp').convert('RGBA'))
red = (ring[:,:,0]>180)&(ring[:,:,1]<80)&(ring[:,:,2]<80)&(ring[:,:,3]>16)
if red.any(): failures.append('imperial wall: visible red fringe')
report = {'status':'FAIL' if failures else 'PASS','sourceBatches':len(batches),'assets':len(results),'runtimeBytes':sum(r['bytes'] for r in results),'largestBytes':max(r['bytes'] for r in results),'foreground':foreground,'visibleWallRedPixels':int(red.sum()),'results':results,'failures':failures,'limits':'Technical alpha/decoding/checksum checks do not establish artistic consistency or player approval.'}
output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['status','sourceBatches','assets','runtimeBytes','largestBytes','failures']}))
sys.exit(1 if failures else 0)
