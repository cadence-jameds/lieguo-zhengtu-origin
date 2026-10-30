"""Equal-canvas comparison and native-size evidence, without altering source artwork."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib
R=Path(__file__).resolve().parents[1];D=R/'docs/art-unification/elite-review-20261029';O=D/'boards';font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',20);small=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',14);man={}
def canvas(p):
 im=Image.open(p).convert('RGB');im.thumbnail((512,512),Image.Resampling.LANCZOS);out=Image.new('RGB',(512,512),'#141513');out.paste(im,((512-im.width)//2,(512-im.height)//2));return out
def board(key,labels,paths,size=320):
 out=Image.new('RGB',(len(paths)*(size+16),size+60),'#20281f');dr=ImageDraw.Draw(out)
 for i,(label,p) in enumerate(zip(labels,paths)):
  dr.text((i*(size+16)+8,10),label,font=font,fill='#e6d6b9');im=canvas(p).resize((size,size),Image.Resampling.LANCZOS);out.paste(im,(i*(size+16)+8,50))
 p=O/(key+'.webp');out.save(p,'WEBP',quality=94,method=4);man[key]={'path':str(p.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sources':[{'path':str(p.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in paths],'size':list(out.size),'method':'Same complete512 canvas, equal isotropic scale, no per-silhouette fitting.'}
for civ,name,ids in [('zhongguo','中國',['china-A-lamellar','china-B-scale','china-C-imperial']),('japan','日本',['japan-A-oyoroi','japan-B-domaru','japan-C-gusoku'])]:
 paths=[D/'references'/f'ordinary-{civ}.png',*[D/'candidates'/(i+'.webp') for i in ids]];labels=['普通版（保留）','候選 A','候選 B','候選 C'];board(name+'-ABCs',labels,paths)
 for size in [128,64]:
  out=Image.new('RGB',(4*(size+16),size+38),'#20281f');dr=ImageDraw.Draw(out)
  for i,p in enumerate(paths):out.paste(canvas(p).resize((size,size),Image.Resampling.LANCZOS),(i*(size+16)+8,30));dr.text((i*(size+16)+8,4),['普通','A','B','C'][i],font=small,fill='#e6d6b9')
  p=O/f'{civ}-native-{size}.png';out.save(p);man[p.stem]={'path':str(p.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'nativePixels':size,'noUpscaling':True}
board('frankia-before-after',['普通擲斧衛隊','8736bad 舊精銳：雙手斧','新精銳：右手單斧／左手盾'],[D/'references/ordinary-frankia.png',D/'before/elite.guard.civ_frankia.webp',D/'candidates/frankia-single-hand-v1.webp'],360)
raw=D/'raw/frankia-single-hand-v1.png';im=Image.open(raw);rois=[('右手、唯一斧柄、雙面斧',(110,65,410,430)),('左腕、左手、盾牌內側',(670,335,900,650)),('左肩到盾牌連接',(625,285,1040,840))];out=Image.new('RGB',(1050,460),'#20281f');dr=ImageDraw.Draw(out)
for i,(label,rect) in enumerate(rois):
 crop=im.crop(rect);crop.thumbnail((330,400));out.paste(crop,(i*350+10,45));dr.text((i*350+7,8),label,font=small,fill='#e6d6b9')
p=O/'frankia-anatomy.webp';out.save(p,'WEBP',quality=97);man['frankia-anatomy']={'path':str(p.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'source':str(raw.relative_to(R)),'rects':[list(rect) for _,rect in rois],'method':'Source crops only; no paint, concealment or repair.'}
for size in [128,64]:
 out=Image.new('RGB',(2*(size+24)+180,6*(size+36)),'#20281f');dr=ImageDraw.Draw(out)
 for i,(c,n) in enumerate(zip(['zhongguo','byzantium','frankia','britannia','japan','mongolia'],['中國','拜占庭','法蘭克','不列顛','日本','蒙古'])):
  ps=[D/'references'/f'ordinary-{c}.png',R/f'public/art/unified/units/elite.guard.civ_{c}.webp'];dr.text((8,i*(size+36)+38),n,font=font,fill='#e6d6b9')
  for j,p in enumerate(ps):out.paste(canvas(p).resize((size,size),Image.Resampling.LANCZOS),(180+j*(size+24),i*(size+36)+30));dr.text((180+j*(size+24),i*(size+36)+5),['普通','目前精銳'][j],font=small,fill='#e6d6b9')
 p=O/f'six-civilizations-native-{size}.png';out.save(p);man[p.stem]={'path':str(p.relative_to(R)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'nativePixels':size,'noUpscaling':True}
(O/'manifest.json').write_text(json.dumps(man,ensure_ascii=False,indent=2)+'\n');print('Wrote',len(man),'current comparison outputs')
