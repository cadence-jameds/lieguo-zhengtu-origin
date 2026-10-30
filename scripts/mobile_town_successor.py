"""Finite UI successor to merged PR #49; no historical hashes are refreshed."""
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path
from city_ui_successor import HISTORICAL

ROOT = Path(__file__).resolve().parents[1]
BASE = '7f184d526019d40caf370d2b0fe3ed3ba7e8c66a'
UI = '96fcadb5c47e6533066ede29ce4dd631488e3da8'
RECORD = 'docs/validation/mobile-town-labels/compatibility.json'
DIRECTORY = 'docs/validation/mobile-town-labels'
SOURCES = {'src/game/game.css', 'src/game/presentation/CityScenes.tsx'}
INVARIANTS = {
    'src/game/presentation/cityVisuals.ts', 'src/game/presentation/artMap.ts',
    'src/game/presentation/artAssets.json', 'src/game/MiniatureCity.tsx',
    'src/game/presentation/parity.css', 'src/game/presentation/Shell.tsx',
    'src/game/FormalWorldMap.tsx', 'scripts/art-preview-world.ts',
}


@lru_cache(maxsize=None)
def previous(root, commit, path):
    return subprocess.check_output(['git', '-C', str(root), 'show', commit + ':' + path])


def sha(data):
    return hashlib.sha256(data).hexdigest()


def validate(root=ROOT):
    record = json.loads((root / RECORD).read_text())
    assert record['schemaVersion'] == 1
    assert record['baseCommit'] == BASE and record['uiCommit'] == UI
    assert set(record['changes']) == SOURCES
    for path, entry in record['changes'].items():
        assert entry['before'] == sha(previous(root, BASE, path))
        assert entry['after'] == sha(previous(root, UI, path)) == sha((root / path).read_bytes()), ('Unrecorded UI edit', path)
    assert set(record['invariants']) == INVARIANTS
    for path, digest in record['invariants'].items():
        assert digest == sha(previous(root, BASE, path)) == sha((root / path).read_bytes()), ('Calibration changed', path)
    # Pin every original PR #49 witness and its frozen historical art manifests.
    historical = set(subprocess.check_output(['git', '-C', str(root), 'ls-tree', '-r', '--name-only', BASE, '--',
        'docs/validation/city-ui-integration', 'docs/validation/city-ui-successor'], text=True).splitlines()) | HISTORICAL
    assert set(record['historical']) == historical
    for path, digest in record['historical'].items():
        assert digest == sha(previous(root, BASE, path)) == sha((root / path).read_bytes()), ('Historical evidence changed', path)
    witnesses = set(subprocess.check_output(['git', '-C', str(root), 'ls-tree', '-r', '--name-only', UI, '--', DIRECTORY,
        'scripts/verify-mobile-town-labels.mjs', 'src/game/presentation/cityUiIntegration.test.tsx'], text=True).splitlines())
    assert set(record['evidence']) == witnesses
    for path, digest in record['evidence'].items():
        assert digest == sha(previous(root, UI, path)) == sha((root / path).read_bytes()), ('Browser witness changed', path)
    report = json.loads((root / DIRECTORY / 'browser-result.json').read_text())
    assert report['baseline'] == BASE and report['status'] == 'PASS' and not report['errors']
    rows = {r['name']: r for r in report['results']}
    civs = ['civ_zhongguo', 'civ_byzantium', 'civ_frankia', 'civ_britannia', 'civ_japan', 'civ_mongolia']
    expected = {f'art-{civ}-{age}-{variant}' for civ in civs for age in range(4) for variant in ['complete', 'building-audit']}
    expected |= {'geometry-320', 'geometry-390', 'geometry-1440', 'construction', 'queued'}
    assert set(rows) == expected and len(report['results']) == 53
    for row in rows.values():
        assert row['status'] == 'PASS'
        if row['name'].startswith('art-'):
            assert not row['overlaps']
            before, after = row['before'], row['after']
            for collision in after['collisions']:
                old = next((c['fraction'] for c in before['collisions'] if (c['a'], c['b']) == (collision['a'], collision['b'])), 0)
                assert collision['fraction'] <= max(.12, old + .02)
        if row['name'].startswith('geometry-'):
            assert row['clicks'] == ['building', 'gate', 'vacant']
            for name, pair in row['pairs'].items():
                before, after = pair['before'], pair['after']
                assert (before['width'], before['height']) == (after['width'], after['height'])
                for a, b in zip(before['rows'], after['rows'], strict=True):
                    assert a['button'] == b['button']
                    if name != 'town-close':
                        assert a.get('visible') == b.get('visible')
                if name.startswith('outskirts'):
                    assert before['outerLabels'] == after['outerLabels']
                else:
                    assert not after['lowerNames'] and not after['overflow']
                    for badge in after['badges']:
                        assert badge['background'] == 'rgba(255, 244, 223, 0.91)'
                        assert badge['color'] == badge['numberColor'] == 'rgb(74, 65, 41)'
                        assert badge['pointer'] == 'none'
    return record


def accepts(path, predecessor, root=ROOT):
    if path not in SOURCES:
        return False
    record = validate(root)
    return predecessor == record['changes'][path]['before']


if __name__ == '__main__':
    validate()
    print('PASS: pinned mobile-town UI successor, 53 browser cases, unchanged art/calibration, complete historical evidence.')
