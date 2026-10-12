from PIL import Image,ImageDraw,ImageChops
from pathlib import Path
import json,math
out=Path(__file__).resolve().parent;repo=out.parent.parent;s=json.loads((out/'scene.json').read_text());a=json.loads((repo/'src/game/sceneryAtlas.json').read_text());atlas=Image.open(repo/'public/art/world-mountains-0299.webp');ground=Image.frombytes('RGBA',(s['width'],s['height']),(out/'ground.rgba').read_bytes())
def screen(x,y):return (((x-y)*20-s['origin']['x'])*s['scale'],((x+y)*10-s['origin']['y'])*s['scale'])
mask=Image.new('L',ground.size);q=ImageDraw.Draw(mask)
for y in range(384):
 for x in range(384):
  if s['terrain'][y*384+x]=='M':q.polygon([screen(x-.5,y-.5),screen(x+.5,y-.5),screen(x+.5,y+.5),screen(x-.5,y+.5)],fill=255)
for name,key in [('before','oldMountains'),('after','newMountains')]:
 im=ground.copy()
 for d in sorted(s[key],key=lambda p:p['x']+p['y']):
  x,y=screen(d['x'],d['y']);w=d['width']*s['scale'];h=d['height']*s['scale'];r=a['mountains'][d['variant']]
  if x+w/2<0 or x-w/2>=im.width or y+h*.16<0 or y-h*.84>=im.height:continue
  art=atlas.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h'])).resize((round(w),round(h)),Image.Resampling.LANCZOS)
  if d['flip']:art=art.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
  layer=Image.new('RGBA',im.size);layer.alpha_composite(art,(round(x-w/2),round(y-h*.84)))
  if name=='before':layer.putalpha(ImageChops.multiply(layer.getchannel('A'),mask))
  im.alpha_composite(layer)
 im.convert('RGB').save(out/(name+'.png'))
