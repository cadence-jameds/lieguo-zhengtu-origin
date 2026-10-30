"""Exact selected artwork, historical preservation and current browser evidence."""
import hashlib
import json
import struct
import subprocess
from pathlib import Path
from approved_japan_art import validate_approved_japan, BASE
from city_ui_successor import accepts_ui_successor

R = Path(__file__).resolve().parents[1]
D = R / 'docs/art-unification/japan-approved-20261030'
load = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
record = validate_approved_japan()
changes = subprocess.check_output(['git', '-C', str(R), 'diff', '--name-only', BASE, '--', 'public'], text=True).splitlines()
assert changes == [record['path']], ('Only Japanese approved new file is permitted', changes)
data = (R / record['path']).read_bytes()
assert data[:4] == b'RIFF' and data[8:16] == b'WEBPVP8L' and data[20] == 0x2f
bits = int.from_bytes(data[21:25], 'little')
assert [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1] == [512, 512]
sizes = load(D / 'sizes/manifest.json')
assert [row['size'] for row in sizes] == [512, 128, 64]
for row in sizes:
    p = R / row['path']
    assert sha(p) == row['sha256']
    assert list(struct.unpack('>II', p.read_bytes()[16:24])) == [row['size']] * 2
manifest = load(D / 'browser-manifest.json')
for section in ['sources', 'files']:
    for p, expected in manifest[section].items():
        assert sha(R / p) == expected or (section == 'sources' and accepts_ui_successor(p, expected)), ('Stale current Japanese evidence', p)
army = load(D / 'browser/army/result.json')
gallery = load(D / 'browser/gallery/result.json')
assert army['status'] == gallery['status'] == 'PASS'
assert not army['errors'] and not gallery['errors']
assert len(army['rows']) == 9 and {row['width'] for row in army['rows']} == {320, 390, 1440}
for key, active in [(record['key'], record), ('elite.guard.civ_zhongguo', load(R / 'docs/art-unification/elite-final-20261030/china-runtime.json'))]:
    rows = [row for row in army['rows'] if row['id'] == key]
    assert len(rows) == 3
    for row in rows:
        assert row['status'] == 'PASS'
        assert row['card']['natural'] == [512, 512]
        assert row['card']['path'].removeprefix('/') == active['path'].removeprefix('public/')
        assert row['card']['decodedRGBSHA256'] == active['decodedRGBSHA256']
        assert row['detail']['path'] == row['card']['path']
assert gallery['nativeCards'] == 18 and len(gallery['rows']) == 3
for row in gallery['rows']:
    assert len(row['cards']) == 6
    for civ in ['japan', 'zhongguo']:
        cards = [c for c in row['cards'] if c['civ'] == civ]
        assert {c['size'] for c in cards} == {512, 128, 64}
        assert all(c['width'] == c['height'] == c['size'] for c in cards)
print('PASS: Japan candidate1 exact bytes; China/all other assets locked; previous Runtime and candidates retained; 9 actual ArmyView/detail and18 native512/128/64 cases passed. Independent art and physical phones pending.')
