"""Read-only geometry gate; Pillow/NumPy needed only for art production review."""
import json
from pathlib import Path
from PIL import Image
import numpy as np
root=Path(__file__).resolve().parents[1]
metrics=json.loads((root/'docs/art-unification/city-scale/measurements.json').read_text())['rows']
for i in range(6):
 old=next(r for r in metrics if r['index']==i and r['stage']=='城堡／舊帝王')
 new=next(r for r in metrics if r['index']==i and r['stage']=='修正後新帝王')
 assert abs(new['footY']-old['footY'])<=2,(i,'foot')
 assert abs(new['bboxCenterOffset'][0]-old['bboxCenterOffset'][0])<=2,(i,'center')
 assert new['height']<=old['height']*1.06+2,(i,'height')
 assert new['left']>=0 and new['right']>=0,(i,'clip')
layout=json.loads((root/'docs/art-unification/boards/city-board-layout.json').read_text());assert layout['sourceCell']==[512,512] and layout['scale']==202/512
assert all(len(r['destRects'])==5 and all(d[2:]==[202,202] for d in r['destRects']) for r in layout['rows'])
print('PASS: six city feet/centers aligned, height <= castle +6% +2px; 30 board cells use identical full-canvas scale.')
