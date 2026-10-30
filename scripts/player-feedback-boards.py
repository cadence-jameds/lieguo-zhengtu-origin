"""Compose actual old/current portraits and browser captures; never repaint artwork."""
import json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageSequence
R=Path(__file__).resolve().parents[1];D=R/'docs/art-unification/player-feedback-20261029';S=R/'docs/art-source/player-feedback-20261029';O=D/'boards';O.mkdir(exist_ok=True);F='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';font=ImageFont.truetype(F,17);small=ImageFont.truetype(F,12);title=ImageFont.truetype(F,22);man={};digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
archive=json.loads((D/'capture-index.json').read_text()) if (D/'capture-index.json').exists() else None
CACHE={}
def picture(p):
 if p.exists():return Image.open(p).convert('RGB')
 row=archive['records'][str(p.relative_to(R))];sheet=row['sheet']
 if sheet not in CACHE:
  with Image.open(R/sheet) as im:CACHE[sheet]=[f.convert('RGB').copy() for f in ImageSequence.Iterator(im)]
 return CACHE[sheet][row['frame']]
def original_sha(p):return digest(p) if p.exists() else archive['records'][str(p.relative_to(R))]['originalSHA256']
def compose(name,headers,rows,w=310,h=350):
 out=Image.new('RGB',(len(headers)*w,60+len(rows)*h),'#20291f');dr=ImageDraw.Draw(out);cells=[]
 for i,label in enumerate(headers):dr.text((i*w+8,12),label,font=title,fill='#e6d4aa')
 for y,row in enumerate(rows):
  rr=[]
  for x,(label,p) in enumerate(row):
   im=picture(p);ratio=min((w-12)/im.width,(h-42)/im.height);scaled=im.resize((round(im.width*ratio),round(im.height*ratio)),Image.Resampling.LANCZOS);px=x*w+(w-scaled.width)//2;py=60+y*h+30+(h-42-scaled.height)//2;out.paste(scaled,(px,py));dr.text((x*w+6,60+y*h+3),label,font=font,fill='#e5e3cd');rr.append({'label':label,'source':str(p.relative_to(R)),'sourceSize':list(im.size),'sha256':original_sha(p),'destination':[px,py,*scaled.size],'scale':ratio})
  cells.append(rr)
 p=O/(name+'.webp');out.save(p,'WEBP',quality=92,method=4);man[name]={'headers':headers,'rows':cells,'sha256':digest(p),'size':list(out.size)}
units=[('china','連弩衛隊',S/'references/guard-china.png',D/'before/elite.guard.civ_zhongguo.webp',R/'public/art/unified/units/elite.guard.civ_zhongguo.webp'),('japan','武士侍從隊',S/'references/guard-japan.png',D/'before/elite.guard.civ_japan.webp',R/'public/art/unified/units/elite.guard.civ_japan.webp'),('frankia','法蘭克擲斧衛隊',S/'references/guard-frankia.png',D/'before/elite.guard.civ_frankia.webp',R/'public/art/unified/units/elite.guard.civ_frankia.webp')]
for key,name,base,old,new in units:compose('unit-'+key,['普通版（保留）','修正前精銳'+('：硬性FAIL' if key=='frankia' else ''),'修正後精銳候選'],[[(name,base),('舊精銳',old),('新精銳',new)]],360,410)
compose('unit-light',['修正前：槍尖向後','修正後：單一槍桿朝前'],[[('輕騎兵原卡',D/'before/light-cavalry.webp'),('輕騎兵修正版',R/'public/art/unified/units/light-cavalry.webp')]],420,465)
compose('unit-knight',['騎士修正前','騎士修正後','重甲騎兵：完全保留'],[[('正式舊卡',D/'before/knight.webp'),('低飽和／輕裝',R/'public/art/unified/units/knight.webp'),('核准原圖／SHA不變',R/'public/art/unified/units/heavy-knight.webp')]],360,410)
# Native 64px: no enlargement or per-object fit, preserve full card canvas.
out=Image.new('RGB',(600,5*112),'#20291f');dr=ImageDraw.Draw(out)
for y,(name,a,b,c) in enumerate([(n,a,old,new) for _,n,a,old,new in units]+[('輕騎兵',D/'before/light-cavalry.webp',D/'before/light-cavalry.webp',R/'public/art/unified/units/light-cavalry.webp'),('騎士',D/'before/knight.webp',R/'public/art/unified/units/heavy-knight.webp',R/'public/art/unified/units/knight.webp')]):
 dr.text((6,y*112+35),name,font=small,fill='#e6ddc3')
 for col,p in enumerate([a,b,c]):
  im=Image.open(p).convert('RGB');im.thumbnail((64,64),Image.Resampling.LANCZOS);out.paste(im,(150+col*140+(64-im.width)//2,y*112+30));dr.text((150+col*140,y*112+5),['普通／前','舊精銳／重甲','修正候選'][col],font=small,fill='#ddd9be')
out.save(O/'units-native-64.png')
# Crop-only anatomical detail from the original generated Frankish candidate.
p=S/'candidates/frankia-v1.png';im=Image.open(p).convert('RGB');rois=[('上手與同一斧柄',(720,340,890,520)),('下手、腕與斧柄',(450,500,690,700)),('盾牌背帶固定',(300,180,840,650))];compose('frankia-anatomy',['雙手／盾帶連接檢視'],[[(label,p)] for label,_ in rois],540,550)
# Replace anatomy board with genuine detail crops, with explicit source provenance.
o=Image.new('RGB',(1000,390),'#20291f');dr=ImageDraw.Draw(o)
for i,(label,rect) in enumerate(rois):
 crop=im.crop(rect);crop.thumbnail((320,330));o.paste(crop,(i*330+5,42));dr.text((i*330+5,7),label,font=font,fill='#e6d5ae')
o.save(O/'frankia-anatomy.webp','WEBP',quality=95,method=4);man['frankia-anatomy']={'source':str(p.relative_to(R)),'sha256':digest(O/'frankia-anatomy.webp'),'rois':[{'label':label,'rect':rect} for label,rect in rois],'note':'Cropped source details only; no repainting or formal output edits.'}
city=D/'browser/cities'
if (city/'result.json').exists():
 civs=[('civ_britannia','不列顛'),('civ_japan','日本'),('civ_mongolia','蒙古')]
 for width in [320,390,1440]:
  for civ,name in civs:
   rows=[[(name+' '+phase+' '+['黑暗','封建','城堡','帝王'][age],city/f'{phase}-{width}-{civ}-{age}-wall5.png') for age in range(4)] for phase in ['before','after']]
   compose(f'city-{civ}-{width}',['黑暗','封建','城堡','帝王（保留）'],rows,320,350)
  rows=[[(name+' '+phase+' '+['黑暗','封建','城堡','帝王'][age],city/f'{phase}-{width}-{civ}-{age}-wall5.png') for age in range(4)] for civ,name in [('civ_zhongguo','中國'),('civ_byzantium','拜占庭'),('civ_frankia','法蘭克')] for phase in ['before','after']]
  compose(f'city-other-three-{width}',['黑暗','封建','城堡','帝王'],rows,320,350)
  rows=[[(name+' '+phase+' 無牆 '+str(age),city/f'{phase}-{width}-{civ}-{age}-wall0.png') for age in range(4)] for civ,name in civs for phase in ['before','after']];compose(f'city-unwalled-{width}',['黑暗／無牆','封建／無牆','城堡／無牆','帝王／無牆'],rows,320,350)
man['units-native-64']={'sha256':digest(O/'units-native-64.png'),'size':list(out.size),'note':'64px card canvas, no upscaling, ordinary/old/new shown without badge changes.'}
(O/'manifest.json').write_text(json.dumps(man,ensure_ascii=False,separators=(',',':'))+'\n');print('Wrote',len(man),'comparison boards plus native64')
