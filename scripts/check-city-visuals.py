"""Standard-library CI integrity gate for actual browser/source scale evidence."""
import hashlib,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];D=R/'docs/art-unification/city-fit'
m=json.loads((D/'measurements.json').read_text())
for p,h in m['sourceFiles'].items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,('Stale display evidence',p)
assert len(m['rows'])==912 and len(m['anchorCases'])==72 and len(m['mapChecks'])==162
assert not m['afterImperialBuildingAlphaIntersections']
assert len(m['labelChecks'])==12 and all(r['castlePixelsOverRangeBadge']==0 for r in m['labelChecks'])
for r in m['rows']:
 if r['age']<3:assert r['scale']==1
 before=next(x for x in m['rows'] if x['phase']=='before' and all(x[k]==r[k] for k in ['civ','age','kind']))
 assert r['slotAnchor']==before['slotAnchor']
 if r['phase']=='after':
  assert abs(r['visiblePercentOfScene'][0]/before['visiblePercentOfScene'][0]-r['scale'])<.003
  assert abs(r['visiblePercentOfScene'][1]/before['visiblePercentOfScene'][1]-r['scale'])<.003
  assert abs(r['footAboveSlotBottomPx']-before['footAboveSlotBottomPx'])<1.5
for name in ['city','map','interactions']:
 b=json.loads((D/f'browser/result-{name}.json').read_text());assert b['status']=='PASS' and not b['errors'];assert b['counts']['failed']==0
captures=json.loads((D/'capture-index.json').read_text());assert len(captures['records'])==648
for p,s in captures['sheets'].items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==s['sha256']
for p,c in captures['records'].items():
 assert c['sheet'] in captures['sheets'] and 0<=c['frame']<captures['sheets'][c['sheet']]['frames'];x,y,w,h=c['rect'];sw,sh=captures['sheets'][c['sheet']]['size'];assert x>=0 and y>=0 and x+w<=sw and y+h<=sh and c['size']==[w,h]
 if c['retainedJpeg']:assert hashlib.sha256((R/p).read_bytes()).hexdigest()==c['originalJpegSHA256']
hits=json.loads((D/'validation/boundary-after.json').read_text());assert len(hits)==18 and all(not r['violations'] and r['pointerEvents']=='none' and r['centerHitsButton'] and r['clickEntersTown'] for r in hits)
man=json.loads((D/'board-manifest.json').read_text());assert len(man)==19
for name,b in man.items():
 assert hashlib.sha256((D/(name+'.webp')).read_bytes()).hexdigest()==b['sha256']
 assert len(b['rows'])==6 and all(len(row)==len(b['headers']) for row in b['rows'])
 for row in b['rows']:
  assert len({tuple(c['sourceSize']) for c in row})==1,(name,'inconsistent screenshot boxes')
  assert len({round(c['scale'],6) for c in row})==1,(name,'inconsistent montage scale')
  for c in row:
   rec=captures['records'][c['source']];assert rec['originalJpegSHA256']==c['sha256'];assert c['archive']==rec
   if (R/c['source']).exists():assert hashlib.sha256((R/c['source']).read_bytes()).hexdigest()==c['sha256']
print('PASS: 912 building measurements; 72 unchanged town anchor/slot cases; 162 map scale/foot comparisons; 19 six-civilization boards; 18 hit-boundary cases; no stale source or image references.')
