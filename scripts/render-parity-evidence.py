#!/usr/bin/env python3
"""Review actual Formal presentation inputs with Pillow; NOT browser screenshots or FPS.
Terrain pixels come from mapVisualEvidence.test.ts. City crops are the DEMO atlas
bounds exported by the adapter; mountain coverage uses the immutable Formal mask.
"""
from pathlib import Path
import json,sys,math
from PIL import Image,ImageDraw,ImageChops
root=Path(__file__).resolve().parents[1];out=Path(sys.argv[1])
for p in out.glob('map-*-scene.json'):
 s=json.loads(p.read_text());name=p.name.replace('-scene.json','');w,h=s['width'],s['height']
 im=Image.frombytes('RGBA',(w,h),(out/(name+'-ground.rgba')).read_bytes());scenery=Image.new('RGBA',(w,h))
 def screen(x,y):return (((x-y)*20-s['origin']['x'])*s['scale'],((x+y)*10-s['origin']['y'])*s['scale'])
 def inv(px,py):
  x=s['origin']['x']+px/s['scale'];y=s['origin']['y']+py/s['scale'];return x/40+y/20,y/20-x/40
 mask=Image.new('L',(w,h));md=ImageDraw.Draw(mask)
 for y in range(384):
  for x in range(384):
   if s['terrain'][y*384+x]=='M':md.polygon([screen(x-.5,y-.5),screen(x+.5,y-.5),screen(x+.5,y+.5),screen(x-.5,y+.5)],fill=255)
 def paste(target,sprite,x,y,width,height,bottom,flip=False,alpha=1,mountain=False):
  sw,sh=max(1,round(width)),max(1,round(height));left,top=round(x-width/2),round(y-height*bottom)
  if left>w or top>h or left+sw<0 or top+sh<0:return
  sprite=sprite.resize((sw,sh),Image.Resampling.LANCZOS)
  if flip:sprite=sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
  a=sprite.getchannel('A')
  if alpha!=1:a=a.point(lambda v:round(v*alpha))
  if mountain:a=ImageChops.multiply(a,mask.crop((left,top,left+sw,top+sh)))
  sprite.putalpha(a);target.alpha_composite(sprite,(left,top))
 atlas=json.loads((root/'src/game/sceneryAtlas.json').read_text());images={k:Image.open(root/'public/art'/f'world-{v}-0299.webp').convert('RGBA') for k,v in [('tree','trees'),('mountain','mountains'),('detail','details')]}
 for d in sorted(s['decorations'],key=lambda d:(-1000000 if d['kind']=='detail' else 0)+d['x']+d['y']):
  x,y=screen(d['x'],d['y']);kind=d['kind'];b=atlas[{'tree':'trees','mountain':'mountains','detail':'ground'}[kind]][d['variant']];sprite=images[kind].crop((b['x'],b['y'],b['x']+b['w'],b['y']+b['h']))
  paste(scenery,sprite,x,y,d['width']*s['scale'],d['height']*s['scale'],.84,d['flip'],.38 if kind=='detail' else 1,kind=='mountain')
 # Same radial city/site clearings. This is a Pillow approximation of Canvas gradients.
 alpha=scenery.getchannel('A');ar=alpha.load()
 for n in s['cities']+s['sites']:
  x,y=screen(n['x'],n['y']);sz=17*s['scale'];cy=y-sz*.7;rx,ry=sz*2.6,sz*2.4
  for py in range(max(0,round(cy-ry)),min(h,round(cy+ry)+1)):
   for px in range(max(0,round(x-rx)),min(w,round(x+rx)+1)):
    radius=math.hypot((px-x)/rx,(py-cy)/ry)
    if radius<1:ar[px,py]=round(ar[px,py]*max(0,(radius-.72)/.28))
 scenery.putalpha(alpha);im.alpha_composite(scenery)
 piccache={}
 items=[dict(c,kind='city') for c in s['cities']]+[dict(site,kind='site') for site in s['sites']]
 for d in sorted(items,key=lambda d:d['x']+d['y']):
  x,y=screen(d['x'],d['y']);sz=max(7,min(17,s['scale']*19))
  if d['kind']=='city':
   path=d['artPath'];pic=piccache.setdefault(path,Image.open(root/'public'/path).convert('RGBA'));b=d['crop'];sprite=pic.crop((round(b['x']),round(b['y']),round(b['x']+b['w']),round(b['y']+b['h'])))
   draw=ImageDraw.Draw(im);rx,ry=28*s['scale']+8,14*s['scale']+4;draw.polygon([(x,y-ry),(x+rx,y),(x,y+ry),(x-rx,y)],fill=d['relationColor']+'55',outline=d['relationColor']);paste(im,sprite,x,y+sz*.8,sz*3.8,sz*3.8,1)
  else:
   path='art/world-resources.webp';pic=piccache.setdefault(path,Image.open(root/'public'/path).convert('RGBA'));cw,ch=pic.width/4,pic.height/2;i={'food':0,'wood':1,'stone':2,'gold':3,'bandit':6}[d['resource']];sprite=pic.crop((round(i%4*cw),round(i//4*ch),round((i%4+1)*cw),round((i//4+1)*ch)));sz*=.7;paste(im,sprite,x,y+sz*1.43,sz*3.4,sz*4.53,1)
 im.save(out/(name+'-offscreen.png'));print(name+'-offscreen.png: Pillow review, not a browser screenshot')
