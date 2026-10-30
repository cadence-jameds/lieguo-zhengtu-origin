"""Pixel measurements + explicitly approximate semantic landmarks; no painting."""
import json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/art-unification/city-scale';OUT.mkdir(exist_ok=True)
CIVS=['中國','拜占庭','法蘭克','不列顛','日本','蒙古']
# Manually read architectural roof/ground junctions from 32px coordinate grids.
# Excludes flagpoles, includes architectural spires. Estimated +/-12px, not automated CAD.
PRIMARY=[[(158,286),(150,298),(103,294),(84,216),(72,202),(111,202)],[(112,230),(109,260),(69,256),(80,208),(76,187),(127,236)],[(112,230),(96,268),(85,279),(58,239),(48,229),(134,254)],[(123,298),(89,293),(70,312),(118,304),(97,307),(132,309)]]
GROUND_BACK=[[212,235,233,143,121,149],[191,198,193,142,156,190],[200,191,204,142,132,180],[227,211,201,227,227,230]]
def cell(im,i):return im.crop((i%3*512,i//3*512,i%3*512+512,i//3*512+512)).convert('RGBA')
def bbox(im):return im.getchannel('A').point(lambda a:255 if a>96 else 0).getbbox()
def metrics(im,landmarks,ground_back):
 a=np.array(im.getchannel('A'));ys,xs=np.where(a>96);x0,y0,x1,y1=bbox(im);roof,base=landmarks
 return {'bbox':[x0,y0,x1,y1],'width':x1-x0,'height':y1-y0,'left':x0,'right':512-x1,'footY':y1,'bboxCenterOffset':[round((x0+x1)/2-256,2),round((y0+y1)/2-256,2)],'alphaCentroidOffset':[round(float(xs.mean()-256),2),round(float(ys.mean()-256),2)],'occupiedPixels':len(xs),'primaryRoofY':roof,'primaryBaseY':base,'primaryHeight':base-roof,'groundEnvelopeEstimate':[x0,ground_back,x1,y1],'groundWidthEstimate':x1-x0,'groundDepthEstimate':y1-ground_back}
rows=[]
for age in range(5):
 stage=min(age,3);path=f'public/art/cities-age-{age}.webp' if age<3 else 'docs/art-unification/city-scale/before/cities-imperial.webp' if age==3 else 'public/art/unified/cities-imperial.webp'
 im=Image.open(ROOT/path)
 for i,civ in enumerate(CIVS):
  s=cell(im,i);land=PRIMARY[stage][i];ground=GROUND_BACK[stage][i]
  if age==4:
   trans=json.loads((OUT/'calibration.json').read_text())[i];scale=trans['scale'];dy=trans['translation'][1];land=tuple(round(y*scale+dy) for y in land);ground=round(ground*scale+dy)
  row={'civilization':civ,'index':i,'stage':['黑暗','封建','城堡／舊帝王','修正前新帝王','修正後新帝王'][age],'path':path,**metrics(s,land,ground)};rows.append(row)
  bg=Image.new('RGBA',(512,512),(28,36,29,255));bg.alpha_composite(s);d=ImageDraw.Draw(bg);d.rectangle(row['bbox'],outline='#d4b45f',width=2);d.line((0,row['footY'],512,row['footY']),fill='#ee7777',width=2);d.line((256,0,256,512),fill='#777777');d.line((180,land[0],330,land[0]),fill='#77bbee',width=2);d.line((180,land[1],330,land[1]),fill='#77bbee',width=2);d.rectangle(row['groundEnvelopeEstimate'],outline='#70a577',width=1);bg.convert('RGB').save(OUT/f'measure-{age}-{i}.webp','WEBP',quality=90)
report={'method':{'alpha':'A>96; bbox uses exclusive right/bottom, pixel-exact at this threshold','primary':'human roof/base landmarks +/-12px; spires included, flagpoles excluded','ground':'approximate projected ground envelope behind occluding buildings, +/-16px; NOT actual land or gameplay footprint; width follows visible city hull','oldImperial':'identical to castle; listed as castle/oldImperial, no invented separate asset'},'rows':rows}
(OUT/'measurements.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
md='# 六文明五欄量測（像素）\n\n'+report['method']['alpha']+'。主要建築高度為人工語義標點（±12px）；地面投影為遮擋下外包估測（±16px），不是遊戲土地面積。完整標點、左右留白、中心與佔位像素在 JSON；金線外框、紅線腳點、藍線主建築、綠線地面投影均附圖。城堡與舊帝王原本完全同圖，分開列出以便核對五欄。\n\n|文明|時代|有效 W×H|主建築 H ≈|地面 W×D ≈|左／右留白|腳點 Y|外框中心偏移 X,Y|圖|\n|---|---|---|---|---|---|---|---|---|\n'
for row in rows:
 labels=['城堡','舊帝王'] if row['stage']=='城堡／舊帝王' else [row['stage']]
 for label in labels:md+=f"|{row['civilization']}|{label}|{row['width']}×{row['height']}|{row['primaryHeight']}|{row['groundWidthEstimate']}×{row['groundDepthEstimate']}|{row['left']}/{row['right']}|{row['footY']}|{row['bboxCenterOffset']}|[標點](measure-{rows.index(row)//6}-{row['index']}.webp)|\n"
(OUT/'measurements.md').write_text(md)
print('Measured',len(rows),'independent cells; castle also explicitly listed as old imperial')
