"""Lay out existing images for review; never generate or repaint game artwork."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'docs/art-unification/boards'; OUT.mkdir(parents=True, exist_ok=True)
font_path='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
font=ImageFont.truetype(font_path,14); title=ImageFont.truetype(font_path,19)
current=json.loads((ROOT/'work/art-audit/coverage.json').read_text())
before=json.loads((ROOT/'work/baseline-art.json').read_text())
units={x['id']:x for x in current['units']}; old_units={x['id']:x for x in before['units']}
techs={x['id']:x for x in current['technologies']}; old_techs={x['id']:x for x in before['technologies']}

def picture(spec):
    file=ROOT/'public'/spec['path']
    if file.suffix=='.svg': file=ROOT/'work/old-symbols'/(file.stem+'.png')
    image=Image.open(file).convert('RGBA')
    if spec.get('displayCrop'):
        b=spec['displayCrop'];image=image.crop((b['x'],b['y'],b['x']+b['w'],b['y']+b['h']))
    elif spec.get('sheet'):
        index=spec['index']; w,h=image.width//3,image.height//2
        image=image.crop((index%3*w,index//3*h,index%3*w+w,index//3*h+h))
    return image

def place(board,image,box):
    x,y,w,h=box; image=image.copy();image.thumbnail((w,h),Image.Resampling.LANCZOS)
    board.paste(image,(x+(w-image.width)//2,y+(h-image.height)//2),image)

def board(name,headers,rows,width=200,height=245):
    image=Image.new('RGB',(width*len(headers),64+height*len(rows)),(25,32,27));draw=ImageDraw.Draw(image)
    for i,header in enumerate(headers): draw.text((i*width+8,15),header,font=title,fill=(227,208,163))
    for row,cells in enumerate(rows):
        for col,cell in enumerate(cells):
            if cell is None: continue
            label,art=cell;x=col*width;y=64+row*height
            if art is not None: place(image,art,(x+8,y+28,width-16,height-43))
            draw.text((x+7,y+3),label,font=font,fill=(237,232,211))
    image.save(OUT/(name+'.webp'),'WEBP',quality=94,method=4)

rows=[]
for line in current['eliteLines']:
    base,elite=line['base'],line['elite']; modern='modern.'+base
    rows.append([(units[base]['name'],picture(units[base])),(units[elite]['name'],picture(units[elite])),(units[modern]['name'],picture(units[modern])) if modern in units else None])
for page in range(2):board('unit-lines-'+str(page+1),['正式一般兵種','既有精銳升階','現代世代（非新增等級）'],rows[page*6:(page+1)*6],250,270)

rows=[]
for line in current['techLines']:
    cells=[]
    for source in [old_techs,techs]:
        for tier in range(3):
            if tier<len(line['ids']):
                item=source[line['ids'][tier]];cells.append((techs[item['id']]['name'],picture(item)))
            else:cells.append(('無正式 III 階',None))
    rows.append(cells)
for page in range(2):board('technology-tiers-'+str(page+1),['舊 I','舊 II','舊 III','新 I','新 II','新 III'],rows[page*6:(page+1)*6],178,220)

catalog=json.loads((ROOT/'work/formal-catalogs.json').read_text())['technologies']
rows=[]
for civ in list(dict.fromkeys(c['civ'] for c in current['cities'])):
    pair=sorted([t for t in catalog.values() if t['civilizationId']==civ and t['category']=='civilization'],key=lambda t:t['age'])
    rows.append([(t['name'],picture(source[t['id']])) for source in [old_techs,techs] for t in pair])
board('civilization-technology-pairs',['舊文明科技 I','舊文明科技 II','新文明科技 I','新文明科技 II'],rows,225,245)

rows=[]
for item in [b for b in current['buildings'] if b['civ']=='civ_zhongguo' and b['age']==3]:
    cells=[]
    for label,path in [('完工 Sprite',item['finishedPath']),('施工 Sprite',item['constructionPath']),('資訊中圖（同來源）',item['finishedPath']),('詳情卡（同來源）',item['detailPath'])]:
        image=picture({'path':path})
        if item['id']=='wall': image=image.crop((650,94,886,216))
        cells.append((item['id']+' · '+label,image))
    rows.append(cells)
for page in range(2):board('building-states-'+str(page+1),['完工','施工／升級中','建築資訊','建築詳情'],rows[page*10:(page+1)*10],230,220)

rows=[]
names=['中國','拜占庭','法蘭克','不列顛','日本','蒙古']
for index,name in enumerate(names):
    cells=[]
    for age in [0,1,2,2]: cells.append((name,picture({'path':f'art/cities-age-{age}.webp','sheet':'cities','index':index})))
    cells.append((name,picture({'path':'art/unified/cities-imperial.webp','sheet':'cities','index':index})))
    rows.append(cells)
board('six-civilizations-four-ages',['黑暗','封建','城堡','舊帝王（沿用城堡）','新帝王'],rows,225,245)

board('priority-before-after',['已確認母圖','舊正式圖','退件候選','修正候選'],[
 [('民兵／槍兵錨點',picture(old_units['spearman'])),('舊戰矛兵',picture(old_units['skirmisher'])),('同系列民兵',picture(old_units['militia'])),('新戰矛兵',picture(units['skirmisher']))],
 [('舊衝撞車錨點',picture(old_units['ram'])),('舊投石機',picture(old_units['catapult'])),('器械結構 FAIL',Image.open(ROOT/'docs/art-source/unification/rejected/catapult-structural-fail.webp').convert('RGBA')),('修正投石機',picture(units['catapult']))],
 [('拜占庭衛隊錨點',picture(old_units['guard.civ_byzantium'])),('原衛隊卡面',picture(old_units['guard.civ_byzantium'])),('武器穿頭 FAIL',Image.open(ROOT/'docs/art-source/unification/rejected/byzantine-head-intersection-fail.webp').convert('RGBA')),('修正精銳騎兵',picture(units['elite.guard.civ_byzantium']))]
],240,275)

assets=json.loads((ROOT/'docs/art-source/unification/assets.json').read_text())
sprites=[a for a in assets if a['alphaPolicy']=='transparent']
for page in range((len(sprites)+11)//12):
    sample=sprites[page*12:(page+1)*12]; image=Image.new('RGB',(600,40+185*len(sample)));draw=ImageDraw.Draw(image)
    for col,(label,color) in enumerate([('黑底',(12,12,12)),('淺灰',(210,210,210)),('遊戲地景色',(86,103,55))]):
        draw.rectangle((col*200,0,(col+1)*200,image.height),fill=color);draw.text((col*200+8,6),label,font=title,fill=(150,145,110))
        for row,a in enumerate(sample):place(image,Image.open(ROOT/a['path']).convert('RGBA'),(col*200+8,40+row*185,184,170))
    image.save(OUT/('alpha-'+str(page+1)+'.webp'),'WEBP',quality=94,method=4)
    (OUT/('alpha-'+str(page+1)+'.json')).write_text(json.dumps([a['key'] for a in sample],ensure_ascii=False,indent=2)+'\n')

for size in [64,128]:
    selected=['skirmisher','catapult','swordsman','pikeman','knight','heavy-knight','elite.guard.civ_byzantium','elite.guard.civ_mongolia']
    image=Image.new('RGB',(8*(size+12),size+50),(25,32,27));draw=ImageDraw.Draw(image)
    for i,key in enumerate(selected):place(image,picture(units[key]),(i*(size+12)+6,8,size,size));draw.text((i*(size+12)+6,size+12),str(i+1),font=font,fill='white')
    image.save(OUT/('readability-'+str(size)+'.webp'),'WEBP',quality=95,method=4)
print('Comparison boards:',len(list(OUT.glob('*.webp'))))
