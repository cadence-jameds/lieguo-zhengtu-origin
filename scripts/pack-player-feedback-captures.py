"""Preserve review screenshot RGB pixels in lossless WebP frames, never resize/repaint."""
import hashlib,json,shutil,re
from pathlib import Path
from collections import defaultdict
from PIL import Image
R=Path(__file__).resolve().parents[1];D=R/'docs/art-unification/player-feedback-20261029';B=D/'browser';O=D/'capture-sheets';O.mkdir(exist_ok=True);backup=R/'work/player-feedback-20261029/original-captures';backup.mkdir(exist_ok=True)
for p in B.rglob('*'):
 if p.suffix not in ['.png','.jpg']:continue
 dst=backup/p.relative_to(B);dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dst)
paths=sorted(p for p in backup.rglob('*') if p.suffix in ['.png','.jpg']);assert len(paths)==387,'Require all 288 city frames,18 city UI,27 army cards,54 army UI/detail captures before packing'
groups=defaultdict(list)
for p in paths:
 if p.suffix=='.png' and 'cities' in p.parts:
  m=re.search(r'-(\d)-wall(\d)\.png$',p.name);kind='city-age'+m[1]+'-wall'+m[2]
 else:kind='-'.join(p.parts[-2:-1])+('-card' if p.suffix=='.png' else '-detail' if p.name.endswith('-detail.jpg') else '-ui')
 with Image.open(p) as im:groups[(im.size,kind)].append(p)
records={};sheets={}
for seq,((size,kind),ps) in enumerate(sorted(groups.items()),1):
 frames=[];by_hash={};refs=[]
 for p in ps:
  im=Image.open(p).convert('RGB');h=hashlib.sha256(im.tobytes()).hexdigest()
  if h not in by_hash:by_hash[h]=len(frames);frames.append(im)
  refs.append((p,h,by_hash[h]))
 out=O/f'frames-{seq:02}.webp';frames[0].save(out,'WEBP',save_all=True,append_images=frames[1:],lossless=True,quality=100,method=4,duration=2000,loop=0);name=str(out.relative_to(R));sheets[name]={'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'size':list(size),'frames':len(frames),'category':kind,'bytes':out.stat().st_size};decoded=Image.open(out);assert getattr(decoded,'n_frames',1)==len(frames)
 for i,frame in enumerate(frames):decoded.seek(i);assert hashlib.sha256(decoded.convert('RGB').tobytes()).digest()==hashlib.sha256(frame.tobytes()).digest()
 for p,h,frame in refs:
  rel=p.relative_to(backup);target=B/rel;retain=p.suffix=='.jpg';records[str(target.relative_to(R))]={'originalSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'rgbSHA256':h,'sheet':name,'frame':frame,'size':list(size),'retained':retain}
  if not retain:target.unlink(missing_ok=True)
 print(out.name,kind,len(refs),'captures',len(frames),'frames',out.stat().st_size,flush=True)
(D/'capture-index.json').write_text(json.dumps({'method':'Exact decoded RGB frames, no resizing/cropping/repainting. Original PNG/JPEG bytes retained in work/player-feedback-20261029/original-captures. Full UI/detail JPEGs remain directly accessible in PR.','records':records,'sheets':sheets},ensure_ascii=False,separators=(',',':'))+'\n');print('PASS',len(records),'captures;',len(sheets),'lossless collections;',sum(r['retained'] for r in records.values()),'direct UI JPEGs')
