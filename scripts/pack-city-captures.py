"""Preserve screenshot RGB pixels in lossless WebP frames; never scale/repaint captures."""
import hashlib,json,shutil,re
from collections import defaultdict
from pathlib import Path
from PIL import Image,ImageSequence
R=Path(__file__).resolve().parents[1];D=R/'docs/art-unification/city-fit';B=D/'browser';O=D/'capture-sheets';O.mkdir(exist_ok=True);backup=R/'work/city-fit/original-jpeg';backup.mkdir(exist_ok=True)
# Original JPEG files were retained outside Git even when a previous packing was made.
for p in B.glob('*.jpg'):shutil.copy2(p,backup/p.name)
paths=sorted(backup.glob('*.jpg'));assert len(paths)==648,'Run the full browser capture suites first (648 JPEGs), or restore work/city-fit/original-jpeg; refusing to replace a complete archive with a partial set.';groups=defaultdict(list)
for p in paths:
 name=p.name
 if name.startswith('map-'):category='map-'+(name.rsplit('-z',1)[1].split('.')[0] if '-z' in name else 'ui')
 elif name.startswith('interaction-'):category='construction' if name.endswith('-construction.jpg') else 'labels-map'
 elif name.endswith('-ui.jpg'):category='outskirts-ui' if name.endswith('-outskirts-ui.jpg') else 'town-ui'
 else:
  match=re.search(r'-(0|1|2|3)-(outskirts|complete-town|building-audit-town)\.jpg$',name)
  category=('outskirts-' if match.group(2)=='outskirts' else 'town-')+match.group(1)
 with Image.open(p) as im:groups[(im.size,category)].append(p)
records={};sheets={}
def retained(p):return p.name.startswith('after-') and p.name.endswith(('-outskirts-ui.jpg','-town-ui.jpg')) or p.name.startswith('interaction-') and p.name.endswith(('-labels-map.jpg','-construction.jpg'))
for seq,((size,category),ps) in enumerate(sorted(groups.items()),1):
 frames=[];by_hash={};refs=[]
 for p in ps:
  im=Image.open(p).convert('RGB');h=hashlib.sha256(im.tobytes()).hexdigest()
  if h not in by_hash:by_hash[h]=len(frames);frames.append(im)
  refs.append((p,h,by_hash[h]))
 out=O/f'frames-{seq:02}.webp';frames[0].save(out,'WEBP',save_all=True,append_images=frames[1:],lossless=True,quality=100,method=4,duration=2000,loop=0)
 sheet=str(out.relative_to(R));digest=hashlib.sha256(out.read_bytes()).hexdigest();sheets[sheet]={'sha256':digest,'size':list(size),'frames':len(frames),'category':category,'bytes':out.stat().st_size}
 decoded=Image.open(out);assert getattr(decoded,'n_frames',1)==len(frames)
 for i,expected in enumerate(frames):
  decoded.seek(i);assert hashlib.sha256(decoded.convert('RGB').tobytes()).digest()==hashlib.sha256(expected.tobytes()).digest()
 for p,h,frame in refs:
  dest=B/p.name;records[str(dest.relative_to(R))]={'originalJpegSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'rgbSHA256':h,'size':list(size),'sheet':sheet,'frame':frame,'rect':[0,0,*size],'retainedJpeg':retained(p)}
  if retained(p):shutil.copy2(p,dest)
 print(out.name,len(refs),'captures',len(frames),'unique frames',out.stat().st_size,flush=True)
(D/'capture-index.json').write_text(json.dumps({'method':'Lossless decoded screenshot RGB pixels in WebP frames, grouped by exact dimensions, duplicate RGB frames shared. No resize, crop, stretch or repaint. Original JPEG bytes in work/city-fit/original-jpeg; 72 direct final UI JPEGs also retained in PR.','records':records,'sheets':sheets},ensure_ascii=False,separators=(',',':'))+'\n')
for p in list(O.glob('captures-*.webp'))+list(O.glob('frames-*.webp')):
 if str(p.relative_to(R)) not in sheets:p.unlink()
for p in B.glob('*.jpg'):
 if not retained(p):p.unlink()
print('PASS',len(records),'screenshots,',len(sheets),'lossless frame collections,',sum(v['retainedJpeg'] for v in records.values()),'direct UI JPEGs; every RGB frame verified.')
