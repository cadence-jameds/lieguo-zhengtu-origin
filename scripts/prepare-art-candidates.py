"""Deterministic cropping/compression of reviewed imagegen candidates; no painting.

Requires Python 3, Pillow, NumPy and SciPy for asset production only. Run from repository root.
Every source remains byte-for-byte intact; rejected cells never enter the registry.
"""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage
from city_art_normalize import calibrate_city

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/art-source/unification'
SOURCE.mkdir(parents=True, exist_ok=True)
recipe = ROOT / 'work/art-batches.json'
if not recipe.exists():
    recipe = SOURCE / 'batches.json'
records = json.loads(recipe.read_text())
registry = {key: {} for key in ['units', 'technologies', 'buildings', 'construction', 'cities', 'scenes']}
assets = []
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for batch in records:
    raw = SOURCE / (batch['id'] + '.png')
    if not raw.exists():
        shutil.copyfile(batch['sourcePath'], raw)
    with Image.open(raw) as image:
        if image.size != (1536, 1024) and not batch.get('single'):
            raise ValueError(f"{raw}: unexpected grid dimensions {image.size}")
        batch['sourceDimensions'] = list(image.size)
        batch['sourceSha256'] = sha(raw)
        batch['source'] = str(raw.relative_to(ROOT))
        row_boundary = 512
        if not batch['transparent'] and not batch.get('single'):
            pixels = np.asarray(image.convert('RGB'))
            neutral = (pixels.max(axis=2)-pixels.min(axis=2)<3) & (pixels[:, :, 0]>=24) & (pixels[:, :, 0]<=60)
            scores = neutral[450:550].mean(axis=1)
            if scores.max() > .5:
                row_boundary = 450 + int(scores.argmax())
            batch['measuredGrid'] = {'columns': [0, 512, 1024, 1536], 'rows': [0, row_boundary, 1024], 'trimBorderPx': 2}
        references = []
        for ref in batch['references']:
            path = ROOT / ref['path']
            if ref['path'].startswith('work/references/'):
                saved = SOURCE / 'references' / path.name
                saved.parent.mkdir(exist_ok=True)
                shutil.copyfile(path, saved)
                ref = {**ref, 'generationInputPath': ref['path'], 'path': str(saved.relative_to(ROOT))}
                path = saved
            references.append({**ref, 'sha256': sha(path)})
        batch['references'] = references
        for index, cell in enumerate(batch['cells']):
            if not cell.get('key') or cell.get('rejected'):
                continue
            default_rect = [0, 0, image.width, image.height] if batch.get('single') else [index % 3 * 512, index // 3 * 512, 512, 512]
            if not batch['transparent'] and not batch.get('single'):
                top, bottom = (0, row_boundary) if index < 3 else (row_boundary+1, 1024)
                default_rect = [index % 3 * 512+2, top+2, 508, bottom-top-4]
            x, y, width, height = cell.get('cropRect', default_rect)
            sprite = image.crop((x, y, x + width, y + height))
            dimensions = tuple(cell.get('outputDimensions', [512, 512]))
            extraction = None
            if batch['transparent'] and not batch.get('single'):
                # Atlas extraction, not repainting: isolate the largest alpha-connected
                # sprite near this cell and discard neighboring-cell fragments. Search
                # beyond nominal grid lines because generated gutters are not reliable.
                sx, sy = max(0, x-48), max(0, y-48)
                ex, ey = min(image.width, x+width+48), min(image.height, y+height+48)
                region = image.crop((sx, sy, ex, ey)).convert('RGBA')
                alpha = np.asarray(region.getchannel('A'))
                labels, count = ndimage.label(alpha > 96, structure=np.ones((3, 3)))
                sizes = np.bincount(labels.ravel()); sizes[0] = 0
                component = int(sizes.argmax())
                if not count or sizes[component] < 1000:
                    raise ValueError('No coherent sprite in '+batch['id'])
                mask = ndimage.binary_dilation(labels == component, iterations=3)
                cleaned = np.where(mask, alpha, 0).astype('uint8')
                region.putalpha(Image.fromarray(cleaned))
                bbox = region.getbbox()
                if not bbox:
                    raise ValueError('Empty atlas extraction')
                sprite = region.crop(bbox)
                x, y, width, height = sx+bbox[0], sy+bbox[1], bbox[2]-bbox[0], bbox[3]-bbox[1]
                sprite.thumbnail((460, 440), Image.Resampling.LANCZOS)
                canvas = Image.new('RGBA', (512, 512))
                canvas.paste(sprite, ((512-sprite.width)//2, 480-sprite.height))
                extraction = {'alphaThreshold': 96, 'edgeExpansionPx': 3, 'fitBox': [460, 440], 'feetY': 480}
                sprite = canvas
            elif sprite.size != dimensions and dimensions == (512, 512):
                # Preserve aspect ratio when measured atlas bounds differ.
                side = max(width, height)
                canvas = Image.new('RGBA', (side, side), (20, 21, 19, 255) if not batch['transparent'] else (0, 0, 0, 0))
                canvas.paste(sprite, ((side-width)//2, side-height))
                sprite = canvas.resize((512, 512), Image.Resampling.LANCZOS)
            elif sprite.size != dimensions:
                sprite = sprite.resize(dimensions, Image.Resampling.LANCZOS)
            if not batch['transparent'] and dimensions == (512, 512):
                sprite.thumbnail((480, 480), Image.Resampling.LANCZOS)
                canvas = Image.new('RGB', (512, 512), (20, 21, 19))
                canvas.paste(sprite, ((512-sprite.width)//2, (512-sprite.height)//2))
                sprite = canvas
            if cell.get('sceneBand'):
                # Integrate only the generated wall band. All lot/road pixels stay identical.
                base = Image.open(ROOT / 'public/art/city-scene-stone.webp').convert('RGB')
                band = cell['sceneBand']
                # Feather the empty ground at the wall band edge; y>=235 is untouched.
                mask = Image.new('L', (1536, band), 255)
                for row in range(max(0, band-24), band):
                    mask.paste(round((band-1-row)/23*255), (0, row, 1536, row+1))
                base.paste(sprite.crop((0, 0, 1536, band)), (0, 0), mask)
                sprite = base
            if batch['transparent'] and sprite.mode == 'RGBA':
                alpha = sprite.getchannel('A').point(lambda value: 0 if value <= 2 else value)
                sprite.putalpha(alpha)
            if cell.get('group', batch['group']) == 'cities':
                castle = Image.open(ROOT / 'public/art/cities-age-2.webp').convert('RGBA')
                sprite, calibration = calibrate_city(sprite.convert('RGBA'), castle, index)
                extraction = {**(extraction or {}), 'cityCalibration': calibration}
            output = ROOT / cell['path']
            output.parent.mkdir(parents=True, exist_ok=True)
            sprite.save(output, 'WEBP', quality=88, method=4, exact=True, lossless=bool(cell.get('sceneBand')))
            group = cell.get('group', batch['group'])
            if cell['key'] in registry[group]:
                raise ValueError('Duplicate reviewed art: ' + cell['key'])
            registry[group][cell['key']] = str(output.relative_to(ROOT / 'public'))
            assets.append({**cell, 'role': batch['role'], 'batch': batch['id'],
                           'cropRect': [x, y, width, height], 'dimensions': list(dimensions),
                           'sha256': sha(output), 'bytes': output.stat().st_size,
                           'atlasExtraction': extraction,
                           'alphaPolicy': 'transparent' if batch['transparent'] else 'dark-opaque',
                           'artGate': cell.get('artGate'), 'approver': None})
    batch.pop('sourcePath', None)
(SOURCE / 'batches.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
(SOURCE / 'assets.json').write_text(json.dumps(assets, ensure_ascii=False, indent=2) + '\n')
(ROOT / 'src/game/presentation/artAssets.json').write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n')
if len(registry['cities']) == 6:
    atlas = Image.new('RGBA', (1536, 1024))
    for index, path in enumerate(registry['cities'].values()):
        atlas.paste(Image.open(ROOT / 'public' / path), (index % 3 * 512, index // 3 * 512))
    atlas.save(ROOT / 'public/art/unified/cities-imperial.webp', 'WEBP', quality=90, method=4, exact=True)
print(json.dumps({'batches': len(records), 'assets': len(assets), 'registry': {k: len(v) for k, v in registry.items()}}))
