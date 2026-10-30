"""Exact, player-authorized Japanese successor; all other current assets stay locked."""
import copy
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'docs/art-unification/japan-approved-20261030'
BASE = '262d9efaa23670d82abcb2c7e99a0a39446bc9ab'
KEY = 'elite.guard.civ_japan'
RUNTIME = 'public/art/unified/units/elite.guard.civ_japan.approved-candidate-1.webp'
SHA = 'f9e55c7eb9babdfba36c98c63f7983b5b319d5c17b4cd5e60211eaf6dbebbda8'
PREVIOUS_SHA = '587edcaf65fb28af70f06fa065f81b6028d5c344fffa5864b7e7752d0b7ecc7a'

def previous(path):
    return subprocess.check_output(['git', '-C', str(ROOT), 'show', BASE + ':' + path])

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def validate_approved_japan():
    record = json.loads((REVIEW / 'runtime.json').read_text())
    assert record['key'] == KEY and record['path'] == RUNTIME
    assert record['candidateNumber'] == 1 and record['playerApproval'] == 'APPROVED'
    assert record['approvedArtworkCommit'] == record['base'] == BASE
    outputs_path = 'docs/art-unification/elite-final-20261030/japan/outputs.json'
    assert (ROOT / outputs_path).read_bytes() == previous(outputs_path), 'Historical generation records must remain unchanged'
    source = json.loads(previous(outputs_path))[0]
    assert record['source'] == source['output'] and record['sourceSHA256'] == SHA
    assert record['sha256'] == SHA == digest(ROOT / RUNTIME) == digest(ROOT / record['source'])
    assert (ROOT / RUNTIME).read_bytes() == (ROOT / source['output']).read_bytes()
    for field in ['raw', 'prompt']:
        assert record[field] == source[field]
        assert digest(ROOT / record[field]) == record[field + 'SHA256'] == source[field + 'SHA256']
    assert record['decodedRGBSHA256'] == source['decodedRGBSHA256']
    assert record['previousSHA256'] == PREVIOUS_SHA == digest(ROOT / record['previousPath'])
    before = previous('src/game/presentation/artAssets.json')
    assert (REVIEW / 'before/artAssets.json').read_bytes() == before
    assert record['previousRegistrySHA256'] == hashlib.sha256(before).hexdigest()
    expected = json.loads(before)
    expected['units'][KEY] = RUNTIME.removeprefix('public/')
    assert json.loads((ROOT / 'src/game/presentation/artAssets.json').read_text()) == expected, 'Only approved Japan may change from262d9ef; China and all other mappings are locked'
    assets = json.loads((ROOT / 'docs/art-source/unification/assets.json').read_text())
    old_assets = json.loads(previous('docs/art-source/unification/assets.json'))
    assert [a for a in assets if a['key'] != KEY] == [a for a in old_assets if a['key'] != KEY]
    asset = next(a for a in assets if a['key'] == KEY)
    old_asset = next(a for a in old_assets if a['key'] == KEY)
    assert asset['path'] == RUNTIME and asset['sha256'] == SHA and asset['approver'] == 'PLAYER'
    assert asset['approvedCandidate'] == 1 and asset['approvedArtworkCommit'] == BASE
    preserved = copy.deepcopy(old_asset)
    preserved.update(revision=BASE, preservedOutput=record['previousPath'])
    assert asset['supersedes'] == preserved
    batches = json.loads((ROOT / 'docs/art-source/unification/batches.json').read_text())
    expected_batches = json.loads(previous('docs/art-source/unification/batches.json'))
    for batch in expected_batches:
        if batch['id'] == old_asset['batch']:
            for cell in batch['cells']:
                if cell.get('key') == KEY:
                    cell['supersededBy'] = asset['batch']
    assert [b for b in batches if b['id'] != asset['batch']] == expected_batches
    added = [b for b in batches if b['id'] == asset['batch']]
    assert len(added) == 1 and added[0]['sourceSha256'] == source['rawSHA256']
    assert added[0]['references'] == source['references']
    assert added[0]['prompt'] == (ROOT / source['prompt']).read_text()
    assert record['chinaRuntime'] == 'UNCHANGED'
    assert [x['candidateNumber'] for x in record['notSelected']] == [2, 3]
    for row, old in zip(record['notSelected'], json.loads(previous(outputs_path))[1:]):
        assert row['status'] == 'NOT_SELECTED_RETAINED'
        assert row['source'] == old['output'] and row['sha256'] == old['outputSHA256'] == digest(ROOT / row['source'])
    return record
