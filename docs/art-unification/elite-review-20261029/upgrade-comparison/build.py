"""Documentation-only boards from current unitArt selectors and existing candidate files.

Run from any directory with Node dependencies installed, Pillow and Noto CJK fonts.
No generation, painting, background removal, candidate editing or runtime writes.
"""
from pathlib import Path
import hashlib
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
REVIEW = HERE.parent
BG = '#141513'
PANEL = '#20281f'
INK = '#eee4cf'
MUTED = '#bfc6b7'
GOLD = '#cbb77d'
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
CANVAS = 512
BODY_HEIGHT = 360
FOOT_Y = 460
START = 'd052a1951fd5d3c9b1b4fa807520bfeddb5fccb8'

# Manually inspected pixel coordinates in each unscaled, complete source crop.
# Crown is the metal helmet dome (excluding plume, finial and decorative crest).
# Sole is the bottom edge of the lowest visible boot, excluding ground shadow.
# Visual annotation uncertainty is approximately +/-4 source pixels.
LANDMARKS = {
    'zhongguo': [(42, 468), (51, 468), (51, 465), (53, 460), (55, 466)],
    'japan': [(53, 471), (58, 470), (62, 468), (60, 459), (56, 458)],
}
CONFIG = {
    'zhongguo': ('中國', '一般連弩兵', '連弩衛隊', '精銳連弩衛隊',
                 ['china-A-lamellar', 'china-B-scale', 'china-C-imperial'],
                 ['重型札甲', '高階魚鱗甲', '禁軍重甲']),
    'japan': ('日本', '一般武士', '武士侍從隊', '精銳武士侍從隊',
              ['japan-A-oyoroi', 'japan-B-domaru', 'japan-C-gusoku'],
              ['大鎧', '胴丸', '具足']),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size):
    return ImageFont.truetype(FONT, size)


def lines(draw, xy, values, size, color=INK):
    x, y = xy
    for value in values:
        draw.text((x, y), value, font=font(size), fill=color)
        y += size + 7


def normalize(source, crown, sole):
    # Apply one isotropic affine transform to the ENTIRE input, never fit armor
    # width or a weapon, and never enlarge any source. Preserve all source edges.
    scale = BODY_HEIGHT / (sole - crown)
    tx = (CANVAS - source.width * scale) / 2
    ty = FOOT_Y - sole * scale
    assert 0 < scale <= 1
    assert tx >= 0 and ty >= 0
    assert tx + source.width * scale <= CANVAS
    assert ty + source.height * scale <= CANVAS
    tile = source.transform((CANVAS, CANVAS), Image.Transform.AFFINE,
                            (1 / scale, 0, -tx / scale, 0, 1 / scale, -ty / scale),
                            resample=Image.Resampling.BICUBIC, fillcolor=BG)
    return tile, {'scale': scale, 'translateXY': [tx, ty],
                  'crownY': crown, 'soleY': sole,
                  'normalizedCrownY': crown * scale + ty,
                  'normalizedSoleY': sole * scale + ty,
                  'sourceFullyContained': True}


def row_board(civ, title, entries, tiles, size):
    cell = max(160, size)
    gap = 16
    top = 110 if size == 512 else 94
    label_size = 26 if size == 512 else 16
    label_height = 3 * (label_size + 7) + 12
    image_y = top + label_height
    width = gap + 5 * (cell + gap)
    out = Image.new('RGB', (width, image_y + size + 54), PANEL)
    draw = ImageDraw.Draw(out)
    lines(draw, (16, 10), [f'{title}｜一般 → 正式精銳 → 候選 A／B／C',
                          f'每欄 {size}×{size}px｜等高・同腳線｜候選待玩家選定'],
          32 if size == 512 else 21)
    rectangles = []
    for i, (entry, tile) in enumerate(zip(entries, tiles)):
        x = gap + i * (cell + gap)
        lines(draw, (x, top), entry['labels'], label_size)
        x += (cell - size) // 2
        image = tile.resize((size, size), Image.Resampling.LANCZOS)
        out.paste(image, (x, image_y))
        foot = round(image_y + FOOT_Y * size / CANVAS)
        draw.line((x - 6, foot, x - 1, foot), fill=GOLD)
        draw.line((x + size, foot, x + size + 5, foot), fill=GOLD)
        rectangles.append([x, image_y, size, size])
        assert out.crop((x, image_y, x + size, image_y + size)).tobytes() == image.tobytes()
    lines(draw, (16, image_y + size + 12),
          ['原素材等比縮小／平移；無放大、重繪、換色。金色短線＝共同腳線。'],
          20 if size == 512 else 15, MUTED)
    return out, rectangles


def mobile_board(title, entries, tiles, size):
    width = 320
    image_size = 288 if size == 512 else size
    top = 108
    block = 410 if size == 512 else max(size + 44, 128)
    out = Image.new('RGB', (width, top + 5 * block + 36), PANEL)
    draw = ImageDraw.Draw(out)
    lines(draw, (16, 10), [title + '｜五欄直排審圖',
                          '一般／正式精銳／A／B／C',
                          '288px 等比預覽' if size == 512 else f'原生 {size}px，不放大'], 19)
    rectangles = []
    for i, (entry, tile) in enumerate(zip(entries, tiles)):
        y = top + i * block
        draw.line((16, y, 304, y), fill='#48503e')
        image = tile.resize((image_size, image_size), Image.Resampling.LANCZOS)
        if size == 512:
            lines(draw, (16, y + 8), entry['labels'], 18)
            x, image_y = 16, y + 94
        else:
            x, image_y = 16, y + 18
            lines(draw, (image_size + 28, y + 14), entry['labels'], 17)
        out.paste(image, (x, image_y))
        foot = round(image_y + FOOT_Y * image_size / CANVAS)
        draw.line((x - 6, foot, x - 1, foot), fill=GOLD)
        draw.line((x + image_size, foot, x + image_size + 5, foot), fill=GOLD)
        rectangles.append([x, image_y, image_size, image_size])
        assert out.crop((x, image_y, x + image_size, image_y + image_size)).tobytes() == image.tobytes()
    lines(draw, (16, out.height - 30), ['僅審圖；正式美術與映射維持原值。'], 15, MUTED)
    return out, rectangles


def main():
    mapping = json.loads(subprocess.check_output(
        ['node', str(HERE / 'query-runtime.cjs')], cwd=ROOT, text=True))
    outputs = {row['id']: row for row in json.loads((REVIEW / 'outputs.json').read_text())}
    registry = json.loads((ROOT / 'src/game/presentation/artAssets.json').read_text())['units']
    result = {
        'startingHEAD': START,
        'method': 'Complete source, uniform downscale only, helmet-dome-to-sole 360px on 512px; foot y460; no painting/cropping beyond actual runtime atlas bounds.',
        'landmarkUncertaintySourcePixels': 4,
        'runtimeMapping': mapping,
        'selectorSources': {p: sha(ROOT / p) for p in [
            'src/game/presentation/artMap.ts', 'src/game/presentation/Art.tsx',
            'src/game/presentation/artRegistry.ts', 'src/game/presentation/artAssets.json',
            'src/game/formal/unitCatalog.ts']},
        'civilizations': {}, 'boards': [],
    }
    for civ, (title, ordinary, formal_ordinary, elite, ids, names) in CONFIG.items():
        rows = mapping[civ]
        assert rows[0]['id'] not in registry  # general guard uses its real atlas cell
        assert rows[0]['art']['path'] == 'art/catalog-guards.webp'
        assert rows[0]['name'] == formal_ordinary and rows[1]['name'] == elite
        entries = []
        tiles = []
        for i in range(5):
            crop = None
            if i < 2:
                r = rows[i]
                path = 'public/' + r['art']['path']
                crop = r['crop']
                labels = [ordinary, formal_ordinary, '正式／一般'] if i == 0 else [
                    '目前正式精銳', elite, '8736bad 保留版']
                unit_id = r['id']
            else:
                candidate = outputs[ids[i - 2]]
                path = candidate['output']
                assert sha(ROOT / path) == candidate['outputSHA256']
                assert path.removeprefix('public/') not in registry.values()
                labels = [elite, f'候選 {"ABC"[i - 2]}／{names[i - 2]}', '20261029／待選']
                unit_id = candidate['id']
            source = Image.open(ROOT / path).convert('RGB')
            if crop:
                source = source.crop((crop['x'], crop['y'], crop['x'] + crop['w'], crop['y'] + crop['h']))
            tile, transform = normalize(source, *LANDMARKS[civ][i])
            entry = {'id': unit_id, 'labels': labels, 'source': path, 'sha256': sha(ROOT / path),
                     'runtimeCropXYWH': crop, 'inputDimensions': list(source.size),
                     'transform': transform, 'normalizedPixelSHA256': hashlib.sha256(tile.tobytes()).hexdigest()}
            entries.append(entry)
            tiles.append(tile)
        result['civilizations'][civ] = entries
        for size in [512, 128, 64]:
            for mobile in [False, True]:
                out, rects = mobile_board(title, entries, tiles, size) if mobile else row_board(civ, title, entries, tiles, size)
                path = HERE / f'{civ}-{size}{"-mobile" if mobile else ""}.png'
                out.save(path, optimize=True)
                result['boards'].append({'path': str(path.relative_to(ROOT)), 'sha256': sha(path),
                                         'canvas': list(out.size), 'artPixels': 288 if mobile and size == 512 else size,
                                         'mobile': mobile, 'columns': [e['id'] for e in entries],
                                         'imageRectanglesXYWH': rects})
    (HERE / 'manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print('PASS: actual runtime selectors; 10 verified sources; equal helmet/sole anchors; downscale only; 12 lossless boards with exact 128/64px tiles; no source files modified.')


if __name__ == '__main__':
    main()
