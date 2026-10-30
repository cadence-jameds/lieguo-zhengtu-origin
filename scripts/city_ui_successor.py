"""Exact PR #49 display successor; historical art gates remain authoritative.

This is a finite migration between two immutable commits, not a source whitelist.
Every source, historical manifest and browser witness is checked against Git and
disk. New edits require a separately reviewed successor, not refreshed hashes.
"""
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'bfe242939a791350c4d4a2c0b262e4891266684e'
UI = '574cdac0f50b1352289f9fec3764db53b04b6742'
RECORD = 'docs/validation/city-ui-successor/compatibility.json'
EVIDENCE = 'docs/validation/city-ui-integration'
MEASUREMENTS = 'docs/art-unification/city-fit/measurements.json'
COMPATIBILITY = 'docs/art-unification/player-feedback-20261029/compatibility.json'
PROTECTED = 'docs/art-unification/player-feedback-20261029/protected.json'
HISTORICAL = {
    MEASUREMENTS, COMPATIBILITY, PROTECTED,
    'docs/art-unification/elite-review-20261029/protected.json',
    'docs/art-unification/elite-review-20261029/browser-manifest.json',
    'docs/art-unification/elite-final-20261030/browser-manifest.json',
    'docs/art-unification/japan-approved-20261030/browser-manifest.json',
}
SOURCES = {
    'src/game/presentation/CityScenes.tsx', 'src/game/presentation/Shell.tsx',
    'src/game/FormalWorldMap.tsx', 'src/game/game.css',
    'src/game/presentation/parity.css',
    'src/game/presentation/v95City.test.tsx',
}
VISUAL_INVARIANTS = {
    'src/game/presentation/cityVisuals.ts', 'src/game/MiniatureCity.tsx',
    'src/game/presentation/artMap.ts', 'src/game/presentation/artAssets.json',
    'scripts/art-preview-world.ts',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


@lru_cache(maxsize=None)
def previous(root, commit, path):
    return subprocess.check_output(['git', '-C', str(root), 'show', commit + ':' + path])


def pinned(root, path, recorded):
    assert recorded == sha(previous(root, UI, path)), ('Changed original UI witness', path)
    if recorded != sha((root / path).read_bytes()):
        from mobile_town_successor import accepts
        assert path in SOURCES and accepts(path, recorded, root), ('Changed UI witness', path)


def predecessors(root, path):
    values = {sha(previous(root, BASE, path))}
    for manifest_path in HISTORICAL:
        manifest = json.loads(previous(root, UI, manifest_path))
        for section in ['sourceFiles', 'sources', 'files']:
            if path in manifest.get(section, {}):
                values.add(manifest[section][path])
        if path in manifest.get('updates', {}):
            values.add(manifest['updates'][path]['currentSha256'])
    return sorted(values)


def validate_ui_successor(root=ROOT):
    record = json.loads((root / RECORD).read_text())
    assert record['schemaVersion'] == 1 and record['pr'] == 49
    assert record['baseCommit'] == BASE and record['uiCommit'] == UI
    assert set(record['changes']) == SOURCES, 'Only five exact PR #49 UI sources and their existing governor test are eligible'
    for path, entry in record['changes'].items():
        assert entry['baseSha256'] == sha(previous(root, BASE, path)), ('Wrong UI base', path)
        assert entry['acceptedPredecessorSha256'] == predecessors(root, path), ('Wrong predecessor chain', path)
        pinned(root, path, entry['uiSha256'])
    assert set(record['historicalEvidence']) == HISTORICAL
    assert set(record['visualInvariants']) == VISUAL_INVARIANTS
    for section in ['historicalEvidence', 'visualInvariants', 'evidenceFiles']:
        for path, digest in record[section].items():
            pinned(root, path, digest)
            if section == 'visualInvariants':
                assert previous(root, BASE, path) == previous(root, UI, path), ('Visual calibration changed', path)
    expected = set(subprocess.check_output(
        ['git', '-C', str(root), 'ls-tree', '-r', '--name-only', UI, '--', EVIDENCE], text=True).splitlines())
    assert expected and set(record['evidenceFiles']) == expected, 'Complete original PR #49 evidence is required'

    browser = json.loads((root / EVIDENCE / 'browser-result.json').read_text())
    checks = json.loads((root / EVIDENCE / 'checks.json').read_text())
    assert browser['baseline'] == checks['baseCommit'] == BASE
    assert browser['status'] == 'PASS' and not browser['errors']
    rows = {row['name']: row for row in browser['results']}
    viewports = [(320, 568), (390, 844), (844, 390), (1440, 900)]
    civs = ['civ_zhongguo', 'civ_byzantium', 'civ_frankia', 'civ_britannia', 'civ_japan', 'civ_mongolia']
    expected_rows = {f'{phase}-{w}x{h}-imperial' for phase in ['before', 'after'] for w, h in viewports}
    expected_rows |= {f'{phase}-map-age-{age}' for phase in ['before', 'after'] for age in [2, 3]}
    expected_rows |= {f'art-{civ}-{age}' for civ in civs for age in range(4)}
    expected_rows |= {'same-mounted-four-age-HUD', 'construction-completed-levels', 'queued-completed-levels'}
    assert set(rows) == expected_rows and len(browser['results']) == 39
    assert all(row['status'] == 'PASS' for row in rows.values())
    assert rows['before-map-age-3']['imperialMarker'] is True
    assert all(rows[name]['imperialMarker'] is False for name in ['before-map-age-2', 'after-map-age-2', 'after-map-age-3'])
    ages = rows['same-mounted-four-age-HUD']['ages']
    assert [(a['age'], a['label']) for a in ages] == list(enumerate(['黑暗', '封建', '城堡', '帝王']))
    assert len({a['topbarHeight'] for a in ages}) == 1
    for w, h in viewports:
        geometry = rows[f'after-{w}x{h}-imperial']['geometry']
        assert not geometry['overflow'] and geometry['title'] == geometry['aria']
        assert {'1', '9', '10', '15'} <= {level['value'] for level in geometry['levels']}
        for level in geometry['levels']:
            art, badge = level['art'], level['badge']
            assert abs(art['x'] + art['width']/2 - badge['x'] - badge['width']/2) < 1
            assert abs(art['y'] + art['height']/2 - badge['y'] - badge['height']/2) < 1
            assert abs(badge['width'] - badge['height']) < .1
            assert level['background'] == 'rgba(0, 0, 0, 0.65)' and level['radius'] == '50%'
            assert level['color'] == 'rgb(255, 255, 255)' and level['visible']
    assert {(c['width'], c['height']) for c in browser['finalCaptures']} == set(viewports)
    assert all(c['status'] == 'PASS' and c['hiddenNamesKeepLevels'] for c in browser['finalCaptures'])
    assert all(status == 'PASS' for status in checks['features'].values())
    assert checks['artPaths']['failureCount'] == 0 and checks['artIntegrity']['status'] == 'PASS'
    # The original full-suite timeout remains FAIL; browser evidence is not a full-suite waiver.
    assert checks['fullRegression']['status'] == 'FAIL' and checks['fullRegression']['failed'] == 1
    return record


def accepts_ui_successor(path, predecessor_sha, root=ROOT):
    if path not in SOURCES:
        # Separately pinned task revision; this never admits art/calibration edits.
        from growth_tasks_successor import accepts
        return accepts(path, predecessor_sha, root)
    record = validate_ui_successor(root)
    return predecessor_sha in record['changes'][path]['acceptedPredecessorSha256']


if __name__ == '__main__':
    validate_ui_successor()
    print('PASS: exact PR #49 UI successor, predecessor SHA chain, original browser evidence and visual invariants; historical FAIL retained.')
