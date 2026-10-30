"""Build documentation previews only. Never write runtime art or existing candidates."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json, subprocess

D = Path(__file__).resolve().parent
R = D.parents[3]
BG = '#141513'
PANEL = '#20281f'
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
mapping = json.loads(subprocess.check_output(['node', str(D.parent/'upgrade-comparison/query-runtime.cjs')], cwd=R, text=True))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = {'base': '2f7c34f14b1247ae887920ddc679a52024e492c1',
            'method': 'Full input contains within 480px on 512px, isotropic downscale only, soles at y450. No pose-height fit, no stretching a kneeling body upright. Source composition/anatomy differences remain visible.',
            'soleAnnotationUncertaintyPixels': 4, 'runtimeMapping': mapping,
            'sources': [], 'boards': [], 'generationHistory': []}

def text(draw, x, y, values, size):
    for value in values:
        draw.text((x,y), value, font=ImageFont.truetype(FONT,size), fill='#e8deca')
        y += size+7

def tile(im, sole):
    scale = 480/max(im.size)
    tx = (512-im.width*scale)/2
    ty = 450-sole*scale
    assert 0 < scale <= 1 and tx >= 0 and ty >= 0
    assert tx+im.width*scale <= 512 and ty+im.height*scale <= 512
    result = im.transform((512,512),Image.Transform.AFFINE,
        (1/scale,0,-tx/scale,0,1/scale,-ty/scale),Image.Resampling.BICUBIC,fillcolor=BG)
    return result, {'scale':scale,'translateXY':[tx,ty],'soleY':sole,'targetSoleY':450,'fullSourcePreserved':True}

for civ, title, raw, soles, ordinary, elite, pose, state in [
    ('zhongguo','中國','china-D-v1.png',[468,468,1097],'一般連弩兵','精銳連弩衛隊','候選 D／低姿架弩','動作概念／弩機待驗'),
    ('japan','日本','japan-D-v2.png',[471,470,1174],'一般武士','精銳武士侍從隊','候選 D／過頂舉刀 v2','雙手分握／待玩家審圖')]:
    labels = [[ordinary,mapping[civ][0]['name'],'正式／一般'],['目前正式精銳',elite,'正式圖未替換'],[elite,pose,state]]
    tiles=[]
    for i in range(3):
        path = R/'public'/mapping[civ][i]['art']['path'] if i<2 else D/'raw'/raw
        im=Image.open(path).convert('RGB'); crop = mapping[civ][i]['crop'] if i<2 else None
        if crop: im=im.crop((crop['x'],crop['y'],crop['x']+crop['w'],crop['y']+crop['h']))
        t, transform=tile(im,soles[i]); tiles.append(t)
        manifest['sources'].append({'civ':civ,'column':i,'path':str(path.relative_to(R)),
            'sha256':sha(path),'cropXYWH':crop,'dimensions':list(im.size),'transform':transform,'labels':labels[i]})
        if i==2: t.save(D/f'{civ}-D-preview.png',optimize=True)
    for size in [512,128,64]:
        cell=max(200,size);gap=16;art_y=206 if size==512 else 170
        out=Image.new('RGB',(16+3*(cell+gap),art_y+size+48),PANEL);draw=ImageDraw.Draw(out)
        text(draw,16,10,[title+'｜一般／正式精銳／動作 D',f'每張 {size}px；同畫布、同腳線，跪姿不拉高'],28 if size==512 else 18)
        for i,t in enumerate(tiles):
            x=16+i*(cell+gap);text(draw,x,100 if size==512 else 88,labels[i],24 if size==512 else 16)
            x+=(cell-size)//2;out.paste(t.resize((size,size),Image.Resampling.LANCZOS),(x,art_y))
            y=round(art_y+450*size/512)
            draw.line((x-6,y,x-1,y),fill='#cbb77d');draw.line((x+size,y,x+size+5,y),fill='#cbb77d')
        text(draw,16,art_y+size+12,['新生成動作候選；未接入遊戲。肢體／機構與玩家審圖仍待驗。'],18 if size==512 else 14)
        p=D/f'{civ}-compare-{size}.png';out.save(p,optimize=True)
        manifest['boards'].append({'path':str(p.relative_to(R)),'sha256':sha(p),'dimensions':list(out.size),'nativeArtPixels':size,'columns':3})
    out=Image.new('RGB',(320,80+3*400+40),PANEL);draw=ImageDraw.Draw(out)
    text(draw,16,8,[title+'｜一般／正式／動作 D','三列同畫布；動作候選待審圖'],18)
    for i,t in enumerate(tiles):
        y=80+i*400;text(draw,16,y+5,labels[i],17)
        out.paste(t.resize((288,288),Image.Resampling.LANCZOS),(16,y+84))
    text(draw,16,out.height-30,['正式圖與 A／B／C 均保留原樣。'],15)
    p=D/f'{civ}-mobile.png';out.save(p,optimize=True)
    manifest['boards'].append({'path':str(p.relative_to(R)),'sha256':sha(p),'dimensions':list(out.size),'previewArtPixels':288,'columnsAsRows':3})

for name, refs, state in [
    ('china-D-v1',['public/art/unified/units/elite.guard.civ_zhongguo.webp','docs/art-unification/elite-review-20261029/references/ordinary-zhongguo.png'],'POSE_CONCEPT_MECHANISM_REVIEW_PENDING'),
    ('japan-D-v1',['public/art/unified/units/elite.guard.civ_japan.webp','docs/art-unification/elite-review-20261029/references/ordinary-japan.png'],'SUPERSEDED_SHORT_OVERLAPPING_GRIP'),
    ('japan-D-v2',[str((D/'raw/japan-D-v1.png').relative_to(R))],'REVIEW_CANDIDATE_PLAYER_PENDING')]:
    p=D/'raw'/(name+'.png');prompt=D/'prompts'/(name+'.txt')
    manifest['generationHistory'].append({'id':name,'tool':'image_gen.imagegen','model':'not exposed','date':'2026-10-29','transparentBackground':False,
        'raw':str(p.relative_to(R)),'rawSHA256':sha(p),'dimensions':list(Image.open(p).size),
        'prompt':str(prompt.relative_to(R)),'promptSHA256':sha(prompt),
        'references':[{'path':ref,'sha256':sha(R/ref)} for ref in refs],'status':state})
(D/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('PASS: 3 generated raws, exact prompts/references, real runtime sources, 8 boards and 2 previews; complete sources, downscale only; runtime untouched.')
