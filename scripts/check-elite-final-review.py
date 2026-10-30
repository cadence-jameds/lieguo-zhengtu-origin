"""Verify new Japanese review evidence and the exact approved Chinese successor.

Hashes prove provenance and scope, not anatomy or independent art acceptance.
"""
import hashlib
import json
import struct
import subprocess
from pathlib import Path
from approved_china_art import validate_approved_china
from approved_japan_art import validate_approved_japan, BASE, previous

R = Path(__file__).resolve().parents[1]
D = R / 'docs/art-unification/elite-final-20261030'
load = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
active = validate_approved_china()
japan = validate_approved_japan()
# The candidate/browsing manifests below describe the preserved pre-selection review.
review = load(D / 'japan/review.json')
outputs = load(D / 'japan/outputs.json')
history = load(D / 'japan/generation-history.json')
assert len(outputs) == 3 and len(history) == 4
assert review['japanRuntime'] == 'UNCHANGED' and review['playerSelection'] == 'PENDING'
registry = load(R / 'src/game/presentation/artAssets.json')['units']
for row in history:
    assert sha(R / row['raw']) == row['rawSHA256']
    assert sha(R / row['prompt']) == row['promptSHA256']
    assert len(row['references']) >= 2
    for reference in row['references']:
        assert sha(R / reference['path']) == reference['sha256']
for number, row in enumerate(outputs, 1):
    assert row['candidateNumber'] == number and row['playerApproval'] == 'PENDING'
    assert row['runtimeInstalled'] is False and row['output'] not in registry.values()
    assert row['output'].removeprefix('public/') not in registry.values()
    assert sha(R / row['output']) == row['outputSHA256']
    data = (R / row['output']).read_bytes()
    assert data[:4] == b'RIFF' and data[8:16] == b'WEBPVP8L' and data[20] == 0x2f
    bits = int.from_bytes(data[21:25], 'little')
    assert [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1] == [512, 512]
    gate = row['artGate']
    assert gate['reviewedSHA256'] == row['outputSHA256']
    assert gate['total'] == sum(gate['scores']) >= 17
    assert all(gate['scores'][i] > 0 for i in [0, 1, 8])
    assert gate['hardGate'] == 'PASS_SELF_REVIEW' and gate['playerApproval'] == 'PENDING'
assert len(review['rows']) == 5 and len(review['boards']) == 6
for row in review['rows']:
    assert sha(R / row['source']) == row['sha256']
    transform = row['transform']
    assert 0 < transform['scale'] <= 1 and transform['sourceFullyContained']
    assert abs(transform['normalizedCrownY'] - 100) < 1e-6
    assert abs(transform['normalizedSoleY'] - 460) < 1e-6
for board in review['boards']:
    p = R / board['path']
    assert sha(p) == board['sha256']
    assert list(struct.unpack('>II', p.read_bytes()[16:24])) == board['dimensions']
browser = load(D / 'browser-manifest.json')
for section in ['sources', 'files']:
    for path, expected in browser[section].items():
        if section == 'sources' and path == 'src/game/presentation/artAssets.json':
            assert hashlib.sha256(previous(path)).hexdigest() == expected  # preserved262d9ef review; current mapping validated above
        else:
            assert sha(R / path) == expected, ('Stale browser evidence', path)
gallery = load(D / 'browser/gallery/result.json')
army = load(D / 'browser/army/result.json')
assert gallery['status'] == army['status'] == 'PASS' and not gallery['errors'] and not army['errors']
assert {r['width'] for r in gallery['rows']} == {320, 390, 1440}
for row in gallery['rows']:
    assert len(row['cards']) == 10 and len(row['china']) == 3
    for card in row['cards']:
        assert card['width'] == card['height'] == card['size']
    assert {card['size'] for card in row['china']} == {512, 128, 64}
assert len(army['rows']) == 27 and all(row['status'] == 'PASS' for row in army['rows'])
china = [row for row in army['rows'] if row['id'] == active['key']]
assert len(china) == 3
for row in china:
    assert row['card']['path'].removeprefix('/') == active['path'].removeprefix('public/')
    assert row['card']['decodedRGBSHA256'] == active['decodedRGBSHA256']
    assert row['detail']['path'] == row['card']['path']
base = '34be1b5c2dba64b2d84c4a8bfbc8656ad5d726c6'
public_changes = subprocess.check_output(['git', '-C', str(R), 'diff', '--name-only', base, '--', 'public'], text=True).splitlines()
assert public_changes == sorted([active['path'], japan['path']]), ('Unexpected Runtime art change', public_changes)
historical_changes = subprocess.check_output(['git', '-C', str(R), 'diff', '--name-only', base, '--', 'docs/art-unification/elite-review-20261029'], text=True).splitlines()
assert all(path.endswith('.md') for path in historical_changes), ('Historical artwork/provenance modified', historical_changes)
preserved_changes = subprocess.check_output(['git', '-C', str(R), 'diff', '--name-only', BASE, '--', str(D.relative_to(R))], text=True).splitlines()
assert all(path.endswith('.md') for path in preserved_changes), ('Historical Japanese source/boards/evidence modified', preserved_changes)
subprocess.run(['python3', str(R / 'scripts/check-japan-approved.py')], cwd=R, check=True)
print('PASS: exact player-approved China and Japan successors; preserved pre-selection 3 candidates/4 generations/6 boards,27 ArmyView and39 native Art cases; original A/B/C/D unchanged. Independent art review pending.')
