"""Strict successor gate for the single player-approved Chinese portrait.

Historical manifests remain immutable: their original assets stay on disk.
This Chinese migration remains exact; a separately pinned Japanese successor
is now allowed following the player approval recorded in approved_japan_art.
Uses the standard library so GitHub's art checks need no extra dependencies.
"""
import copy
import hashlib
import json
import struct
import subprocess
from pathlib import Path
from approved_japan_art import validate_approved_japan

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'docs/art-unification/elite-final-20261030'
REGISTRY_PATH = 'src/game/presentation/artAssets.json'
KEY = 'elite.guard.civ_zhongguo'
RUNTIME = 'public/art/unified/units/elite.guard.civ_zhongguo.approved-3798a7f.webp'
RUNTIME_SHA = 'e12b39f6ba3ca10f10028611a892b890c46ac1c173b96a8cb5a0ea39abaf50db'
APPROVED_PNG_SHA = '80709f92bade96fe285617b56a138ec8604c07d80ad6653b6ac499251b70a30b'
RAW_SHA = 'b7ff3b671ac852511b3a61fd1f118bbfb2ba0b7aac979250c2675d3906993790'
PREVIOUS_REGISTRY_SHA = '25f9ba608c04e75f709389c9f110ac20ac83a58e64eadae7d93aba40e46208da'
PREVIOUS_ART_SHA = 'def163fc3df9f3337396c32f7714acfbe332e0806ab3a100edd1e239819bfe83'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_approved_china():
    record = json.loads((REVIEW / 'china-runtime.json').read_text())
    assert record['approvedArtworkCommit'] == '3798a7f70fd76bfb5143a320a1e3703339a743a0'
    assert record['key'] == KEY and record['path'] == RUNTIME
    assert record['sha256'] == RUNTIME_SHA == digest(ROOT / RUNTIME)
    assert record['sourceSHA256'] == APPROVED_PNG_SHA == digest(ROOT / record['source'])
    assert record['rawSHA256'] == RAW_SHA == digest(ROOT / record['raw'])
    assert record['playerApproval'] == 'APPROVED' and record['japanRuntime'] == 'UNCHANGED'
    assert record['previousSHA256'] == PREVIOUS_ART_SHA == digest(ROOT / record['previousPath'])
    assert digest(REVIEW / 'before/elite.guard.civ_zhongguo.webp') == PREVIOUS_ART_SHA
    assert digest(REVIEW / 'before/artAssets.json') == PREVIOUS_REGISTRY_SHA
    previous = json.loads((REVIEW / 'before/artAssets.json').read_text())
    expected = copy.deepcopy(previous)
    expected['units'][KEY] = RUNTIME.removeprefix('public/')
    japan = validate_approved_japan()
    expected['units'][japan['key']] = japan['path'].removeprefix('public/')
    current = json.loads((ROOT / REGISTRY_PATH).read_text())
    assert current == expected, 'Only the two exact player-approved Chinese/Japanese successors may change.'
    data = (ROOT / RUNTIME).read_bytes()
    assert data[:4] == b'RIFF' and data[8:16] == b'WEBPVP8L' and data[20] == 0x2f
    bits = int.from_bytes(data[21:25], 'little')
    assert [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1] == [512, 512]
    png = (ROOT / record['source']).read_bytes()
    assert list(struct.unpack('>II', png[16:24])) == [512, 512]
    assets = json.loads((ROOT / 'docs/art-source/unification/assets.json').read_text())
    asset = next(a for a in assets if a['group'] == 'units' and a['key'] == KEY)
    assert asset['path'] == RUNTIME and asset['sha256'] == RUNTIME_SHA
    assert asset['supersedes']['sha256'] == PREVIOUS_ART_SHA
    assert asset['approvedArtworkCommit'] == record['approvedArtworkCommit']
    assert asset['approver'] == 'PLAYER' and asset['dimensions'] == [512, 512]
    base = '34be1b5c2dba64b2d84c4a8bfbc8656ad5d726c6'
    old_assets = json.loads(subprocess.check_output(['git', '-C', str(ROOT), 'show', base + ':docs/art-source/unification/assets.json'], text=True))
    assert [a for a in assets if a['key'] not in [KEY, japan['key']]] == [a for a in old_assets if a['key'] not in [KEY, japan['key']]], 'Other asset metadata changed'
    batches = json.loads((ROOT / 'docs/art-source/unification/batches.json').read_text())
    old_batches = json.loads(subprocess.check_output(['git', '-C', str(ROOT), 'show', base + ':docs/art-source/unification/batches.json'], text=True))
    previous_asset = next(a for a in old_assets if a['group'] == 'units' and a['key'] == KEY)
    expected_batches = copy.deepcopy(old_batches)
    for batch in expected_batches:
        if batch['id'] == previous_asset['batch']:
            for cell in batch['cells']:
                if cell.get('key') == KEY:
                    cell['supersededBy'] = asset['batch']
    japan_asset = next(a for a in assets if a['key'] == japan['key'])
    for batch in expected_batches:
        if batch['id'] == japan_asset['supersedes']['batch']:
            for cell in batch['cells']:
                if cell.get('key') == japan['key']:
                    cell['supersededBy'] = japan_asset['batch']
    assert [b for b in batches if b['id'] not in [asset['batch'], japan_asset['batch']]] == expected_batches, 'Other batch metadata changed'
    added = [b for b in batches if b['id'] == asset['batch']]
    assert len(added) == 1 and added[0]['sourceSha256'] == RAW_SHA
    assert added[0]['approvedArtworkCommit'] == record['approvedArtworkCommit']
    return record
