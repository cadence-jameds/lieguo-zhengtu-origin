"""Measure existing city atlas alpha bounds without changing any image."""
from pathlib import Path
import hashlib,json
from PIL import Image
R=Path(__file__).resolve().parents[1]
civs=['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongol'];rows=[]
for age in range(3):
 p=R/f'public/art/cities-age-{age}.webp'
 with Image.open(p) as im:
  assert im.size==(1536,1024)
  for i,civ in enumerate(civs):
   rect=(i%3*512,i//3*512,i%3*512+512,i//3*512+512);cell=im.crop(rect);box=cell.getchannel('A').point(lambda a:255 if a>96 else 0).getbbox()
   rows.append({'civ':civ,'age':age,'path':str(p.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cell':list(rect),'alphaBounds':list(box),'effectiveSize':[box[2]-box[0],box[3]-box[1]],'footY':box[3],'leftBlank':box[0],'rightBlank':512-box[2],'centerOffset':[(box[0]+box[2])/2-256,(box[1]+box[3])/2-256]})
out=R/'docs/art-unification/player-feedback-20261029/legacy-measurements.json';out.write_text(json.dumps({'method':'512px atlas cells; alpha>96 bbox, exclusive right/bottom. Diagnostic only; final placement reviewed in actual browser wall composition.','rows':rows},ensure_ascii=False,indent=2)+'\n');print('Measured',len(rows),'unchanged city cells')
