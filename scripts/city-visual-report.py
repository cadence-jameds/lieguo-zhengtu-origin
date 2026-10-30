"""Measure source silhouettes and real browser geometry; compose screenshots without fitting silhouettes."""
import hashlib,json,re,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops,ImageSequence
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/art-unification/city-fit';B=OUT/'browser';OUT.mkdir(exist_ok=True)
CIVS=['civ_zhongguo','civ_byzantium','civ_frankia','civ_britannia','civ_japan','civ_mongolia'];NAMES=['中國','拜占庭','法蘭克','不列顛','日本','蒙古']
font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';F=ImageFont.truetype(font,16);T=ImageFont.truetype(font,22)
cases=json.loads((B/'result-city.json').read_text())['cases'];maps=json.loads((B/'result-map.json').read_text())['cases']
assert len(cases)==144 and len(maps)==216
assert all(c['status']=='PASS' for c in cases+maps)
cov=json.loads((ROOT/'docs/art-unification/coverage.json').read_text())['buildings']
# These are source crop boundaries, verified against assets.tsx in the source contract gate.
ROWS=[0,282,547,805,1122];COLS=[[0,282,572,847,1121,1402],[0,282,572,847,1121,1402],[0,288,572,855,1127,1402],[0,296,567,858,1147,1402]]
IDS=['hall','farm','lumber','quarry','mine','house','warehouse','barracks','range','stable','workshop','academy','market','wall']
ALIAS={'center':'hall','residence':'house','warehouse':'warehouse','market':'market','barracks':'barracks','archery':'range','stable':'stable','workshop':'workshop','academy':'academy','bunker':'cellar','castle':'castle'}
def kindof(cls):
 v=next(x[9:] for x in cls.split() if x.startswith('building-'));return {'hall':'center','house':'residence','range':'archery','cellar':'bunker'}.get(v,v)
SOURCE_CACHE={}
def source(item,index):
 key=(item['finishedPath'],item['age'],item['id'],index if item['id']=='center' else 0)
 if key in SOURCE_CACHE:return SOURCE_CACHE[key]
 p=item['finishedPath'];im=Image.open(ROOT/'public'/p).convert('RGBA');age=item['age'];k=item['id'];b=None
 if p in ['art/buildings-dark.webp','art/buildings-feudal.webp','art/building-atlas.webp']:
  n=14+index if k=='center' else IDS.index(ALIAS[k]);col=n%5;row=n//5
  if age>=2:b=[COLS[row][col],ROWS[row],COLS[row][col+1],ROWS[row+1]]
  else:
   bd=([724,728,728,738,750] if age==1 else [740,738,746,744,750])[col];y=bd if row==3 else row*256;h=bd-512 if row==2 else 1024-bd if row==3 else 256
   b=[col*1536/5,y,(col+1)*1536/5,y+h]
  im=im.crop(tuple(round(v) for v in b))
 box=im.getchannel('A').point(lambda a:255 if a>96 else 0).getbbox()
 SOURCE_CACHE[key]=(im,box,b)
 return im,box,b
records=[];anchor_checks=[];overlaps=[];label_checks=[]
for c in cases:
 if c['width']!=1440:continue
 if '--diagnose' in sys.argv and (c['phase']!='after' or c['age']!=3):continue
 seen=set()
 for town in c['towns']:
  lots=town['lots'];cw=lots[0]['rect']['width']/.18;ch=lots[0]['rect']['height']/.21;visible=[]
  for lot in lots:
   kind=kindof(lot['cls']);item=next(x for x in cov if x['id']==kind and x['civ']==c['civ'] and x['age']==c['age']);im,box,crop=source(item,CIVS.index(c['civ']));a=lot['art'];w=a['width'];h=a['height']
   pad=w*.03 if crop is None else 0;s=min((w-2*pad)/im.width,(h-2*pad)/im.height)
   x=a['x']+(w-im.width*s)/2+box[0]*s;y=a['y']+(h-im.height*s)/2+box[1]*s;v=[x,y,x+(box[2]-box[0])*s,y+(box[3]-box[1])*s];mask=Image.new('L',(round(cw)+2,round(ch)+2));alpha=im.getchannel('A').resize((round(im.width*s),round(im.height*s)),Image.Resampling.BICUBIC).point(lambda a:255 if a>96 else 0);sx=lots[0]['rect']['x']+lots[0]['rect']['width']/2-cw*.505;sy=lots[0]['rect']['bottom']-ch*.5;mask.paste(alpha,(round(a['x']+(w-im.width*s)/2-sx),round(a['y']+(h-im.height*s)/2-sy)));visible.append((kind,v,mask))
   if kind in seen:continue
   seen.add(kind);records.append({'phase':c['phase'],'civ':c['civ'],'age':c['age'],'kind':kind,'path':item['finishedPath'],'sourceCrop':crop,'sourceCanvas':list(im.size),'sourceBounds':list(box),'sourceVisibleSize':[box[2]-box[0],box[3]-box[1]],'slotAnchor':lot['anchor'],'slotRect':lot['rect'],'visibleScreenBounds':v,'visiblePercentOfScene':[100*(v[2]-v[0])/cw,100*(v[3]-v[1])/ch],'footAboveSlotBottomPx':lot['rect']['bottom']-v[3],'scale':float(lot['scale']),'method':'alpha>96, object-fit contain / SVG xMidYMid meet, existing img padding3%; roofs included, not semantic ground footprint'})
  if c['age']==3:
   if c['phase']=='after':
    castle=next(v for v in visible if v[0]=='castle');label=next(l for l in lots if kindof(l['cls'])=='archery').get('labelRect')
    assert label,('Missing current label geometry',c['name'])
    pixels=castle[2].crop((round(label['x']-sx),round(label['y']-sy),round(label['right']-sx),round(label['bottom']-sy))).histogram()[255]
    shift=next((dx for dx in range(81) if castle[2].crop((round(label['x']-sx+dx),round(label['y']-sy),round(label['right']-sx+dx),round(label['bottom']-sy))).histogram()[255]==0),None)
    label_checks.append({'case':c['name'],'state':town['state'],'castlePixelsOverRangeBadge':pixels,'minimumFurtherRightShiftPx':shift})
    if '--diagnose' not in sys.argv:assert pixels==0,label_checks
   for i,(k,v,mask) in enumerate(visible):
    for k2,v2,mask2 in visible[i+1:]:
     area=max(0,min(v[2],v2[2])-max(v[0],v2[0]))*max(0,min(v[3],v2[3])-max(v[1],v2[1]))
     if area>1:overlaps.append({'case':c['name'],'phase':c['phase'],'state':town['state'],'pair':[k,k2],'bboxIntersectionPx2':area,'alphaIntersectionPixels':ImageChops.multiply(mask,mask2).histogram()[255]})
 assert len(seen)==19,(c['name'],seen)
if '--diagnose' in sys.argv:
 print(json.dumps(label_checks,ensure_ascii=False,separators=(',',':')));sys.exit()
for c in cases:
 if c['phase']!='after':continue
 old=next(x for x in cases if x['phase']=='before' and all(x[k]==c[k] for k in ['civ','age','width']))
 for t,ot in zip(c['towns'],old['towns']):
  for lot,o in zip(t['lots'],ot['lots']):
   assert lot['anchor']==o['anchor'];assert all(abs(lot['rect'][k]-o['rect'][k])<.1 for k in ['x','y','width','height'])
 anchor_checks.append(c['name'])
# Canvas transforms record the actual destination, including retained visible-foot anchoring.
mapchecks=[]
for m in maps:
 if m['candidate']==1:continue
 old=next(x for x in maps if x['candidate']==1 and all(x[k]==m[k] for k in ['civ','width','zoomStep']))
 d=m['geometry']['draws'][-1];o=old['geometry']['draws'][-1];ratio=d['args'][-2]/o['args'][-2]
 assert abs(ratio-m['candidate'])<1e-5,(m['name'],ratio)
 def foot(v):return v['matrix']['f']+v['args'][5]+v['args'][7]*(477.5/512)
 delta=foot(d)-foot(o);assert abs(delta)<.1,(m['name'],delta)
 mapchecks.append({'case':m['name'],'ratio':ratio,'visibleFootDeltaPx':delta,'zoom':m['geometry']['scale']})
assert all(o['alphaIntersectionPixels']==0 for o in overlaps if o['phase']=='after'),overlaps
(OUT/'measurements.json').write_text(json.dumps({'sourceFiles':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['src/game/presentation/cityVisuals.ts','src/game/presentation/CityScenes.tsx','src/game/MiniatureCity.tsx','src/game/FormalWorldMap.tsx','src/game/game.css','scripts/art-preview-world.ts']},'rows':records,'labelChecks':label_checks,'anchorCases':anchor_checks,'mapChecks':mapchecks,'imperialBuildingBBoxCandidates':overlaps,'afterImperialBuildingAlphaIntersections':[o for o in overlaps if o['phase']=='after' and o['alphaIntersectionPixels']>0],'limitations':'Alpha silhouette includes roofs; shared function buildings deliberately identical across civilizations. Physics and land footprint are not inferred.'},ensure_ascii=False,separators=(',',':'))+'\n')
# Same screenshot box dimensions per column: no content-aware crop or new-art fit-to-fill.
capture_index=json.loads((OUT/'capture-index.json').read_text()) if (OUT/'capture-index.json').exists() else None
SHEET_CACHE={}
def capture(p):
 if p.exists():return Image.open(p).convert('RGB')
 rec=capture_index['records'][str(p.relative_to(ROOT))];sheet=rec['sheet']
 if sheet not in SHEET_CACHE:
  with Image.open(ROOT/sheet) as image:SHEET_CACHE[sheet]=[frame.convert('RGB').copy() for frame in ImageSequence.Iterator(image)]
 x,y,w,h=rec['rect'];return SHEET_CACHE[sheet][rec['frame']].crop((x,y,x+w,y+h))
man={}
def board(name,headers,rows,width,height):
 o=Image.new('RGB',(width*len(headers),60+height*len(rows)),'#20291f');d=ImageDraw.Draw(o)
 for i,h in enumerate(headers):d.text((i*width+8,14),h,font=T,fill='#ead5a4')
 entries=[]
 for r,cells in enumerate(rows):
  e=[]
  for col,(label,p) in enumerate(cells):
   im=capture(p);ratio=min((width-12)/im.width,(height-34)/im.height);res=im.resize((round(im.width*ratio),round(im.height*ratio)),Image.Resampling.LANCZOS);x=col*width+(width-res.width)//2;y=60+r*height+30;d.text((col*width+6,60+r*height+3),label,font=F,fill='#e2dfc9');o.paste(res,(x,y));e.append({'source':str(p.relative_to(ROOT)),'sourceSize':list(im.size),'scale':ratio,'destination':[x,y,*res.size],'sha256':hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else capture_index['records'][str(p.relative_to(ROOT))]['originalJpegSHA256'],'archive':capture_index['records'].get(str(p.relative_to(ROOT))) if capture_index else None})
  entries.append(e)
 p=OUT/(name+'.webp');o.save(p,'WEBP',quality=90,method=4);man[name]={'headers':headers,'rows':entries,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
for width in [320,390,1440]:
 rows=[[(n+' 修正前',B/f'before-{width}-{c}-3-outskirts.jpg'),(n+' 修正後',B/f'after-{width}-{c}-3-outskirts.jpg')] for c,n in zip(CIVS,NAMES)]
 board('outskirts-before-after-'+str(width),['846e98c 帝王城郊','本輪貼牆校準'],rows,330,340)
 for state in ['complete','building-audit']:
  rows=[[(n+' 修正前',B/f'before-{width}-{c}-3-{state}-town.jpg'),(n+' 修正後',B/f'after-{width}-{c}-3-{state}-town.jpg')] for c,n in zip(CIVS,NAMES)]
  board(f'town-before-after-{width}-{state}',['846e98c 城內','本輪建築比例'],rows,640 if width==1440 else width,480 if width==1440 else 560)
 for z in [0,1,3]:
  rows=[[(n+f' {s}%',B/f'map-{width}-{c}-{s}-z{z}.jpg') for s in [100,108,110,112]] for c,n in zip(CIVS,NAMES)]
  board(f'world-candidates-{width}-z{z}',['原版 100%','候選 A 108%','採用 B 110%','候選 C 112%'],rows,400 if width==1440 else width,330)
rows=[[(n+' '+['黑暗','封建','城堡','帝王'][a],B/f'after-1440-{c}-{a}-outskirts.jpg') for a in range(4)] for c,n in zip(CIVS,NAMES)]
board('six-civilizations-four-ages-in-walls',['黑暗（不變）','封建（不變）','城堡（不變）','帝王（顯示校準）'],rows,330,340)
(OUT/'board-manifest.json').write_text(json.dumps(man,ensure_ascii=False,separators=(',',':'))+'\n')
lines=['# 城內建築可見尺寸盤點','以桌面真實 DOM 槽位與實際圖片 alpha 外框估算可見 W/H，單位為場景百分比；不等同土地或碰撞範圍。19 類 ×6 文明 ×4 時代 ×前後 =912 列；牆環另列城郊檢查。','|文明|時代|建築|前 W/H %|後 W/H %|倍率|接地偏移變化 px|','|---|---|---|---|---|---|---|']
for r in records:
 if r['phase']!='after':continue
 old=next(x for x in records if x['phase']=='before' and all(x[k]==r[k] for k in ['civ','age','kind']))
 fmt=lambda v:'/'.join(f'{x:.2f}' for x in v)
 lines.append(f"|{NAMES[CIVS.index(r['civ'])]}|{r['age']}|{r['kind']}|{fmt(old['visiblePercentOfScene'])}|{fmt(r['visiblePercentOfScene'])}|{r['scale']:.2f}|{r['footAboveSlotBottomPx']-old['footAboveSlotBottomPx']:+.2f}|")
(OUT/'measurements.md').write_text('\n'.join(lines)+'\n')
print(f'PASS: {len(records)} building measurements, {len(anchor_checks)} unchanged anchor/slot cases, {len(mapchecks)} canvas scale/foot checks; 0 imperial building silhouette intersections; {len(man)} boards.')
