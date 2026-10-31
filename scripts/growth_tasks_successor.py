"""Exact authorized growth-task successor; historical art guards stay intact."""
import json
import re
import subprocess
from pathlib import Path
from city_ui_successor import previous, sha

ROOT = Path(__file__).resolve().parents[1]
BASE = '9ac3ccc06e1bc8915147ee405d385c369ea47027'
UI = 'f6c2bdd09d0b53e11a31ac87ad91e4ab7e3b6cef'
RECORD = 'docs/validation/journey-goals-integration/compatibility.json'
PROTECTED = 'docs/art-unification/elite-review-20261029/protected.json'
SOURCES = {
    'src/game/formal/growthTaskCatalog.ts', 'src/game/formal/growthTaskSchema.ts',
    'src/game/formal/growthTasks.ts', 'src/game/formal/schema.ts',
    'src/game/formal/growthTasks.test.ts', 'src/game/presentation/JourneyGoals.tsx',
    'src/game/presentation/journeyGoals.css', 'src/game/presentation/journeyGoals.test.tsx',
}


def validate(root=ROOT):
    record = json.loads((root / RECORD).read_text())
    assert record['schemaVersion'] == 1 and record['baseCommit'] == BASE and record['uiCommit'] == UI
    assert set(record['changes']) == SOURCES
    protected = json.loads(previous(root, BASE, PROTECTED))['files']
    for path, entry in record['changes'].items():
        assert entry['before'] == protected[path] == sha(previous(root, BASE, path))
        assert entry['after'] == sha(previous(root, UI, path)), ('Original task source changed', path)
        from p0c10_successor import accepts as p0c10_accepts
        assert entry['after'] == sha((root / path).read_bytes()) or p0c10_accepts(path,entry['after'],root), ('Changed task source', path)
    historical = {PROTECTED, 'docs/b6-v95/河谷戰役_vNext_平衡重構討論_v95.md',
                  'docs/validation/city-ui-successor/compatibility.json',
                  'docs/validation/mobile-town-labels/compatibility.json'}
    assert set(record['historical']) == historical
    for path, digest in record['historical'].items():
        assert digest == sha(previous(root, BASE, path)) == sha((root / path).read_bytes()), ('Changed historical guard', path)
    witnesses = set(subprocess.check_output(['git', '-C', str(root), 'ls-tree', '-r', '--name-only', '-z', UI, '--',
        'docs/validation/journey-goals-integration', 'docs/b6-v96',
        'src/game/formal/growthTaskRewardsV1.ts', 'src/game/formal/growthTaskIntegration.test.ts',
        'scripts/prepare-growth-legacy-fixtures.mjs', 'scripts/verify-journey-goals-integration.mjs'], text=True).split('\0')) - {''}
    assert set(record['evidence']) == witnesses
    for path, digest in record['evidence'].items():
        assert digest == sha(previous(root, UI, path)) == sha((root / path).read_bytes()), ('Changed task witness', path)
    catalog = 'src/game/formal/growthTaskCatalog.ts'
    parse = lambda data: [json.loads(row) for row in re.findall(r'^  ({.*}),$', data.decode(), re.M)]
    old, new = parse(previous(root, BASE, catalog)), parse((root / catalog).read_bytes())
    assert len(old) == len(new) == 80
    assert [{k: v for k, v in t.items() if k != 'reward'} for t in old] == [{k: v for k, v in t.items() if k != 'reward'} for t in new]
    assert sum(sum(t['reward'].values()) for t in old) == 2313000
    assert [sum(sum(t['reward'].values()) for t in new if t['era'] == era) for era in ['N', 'F', 'C', 'I']] == [12650, 74000, 210550, 545500]
    assert all(n % 5 == 0 for t in new for n in t['reward'].values())
    legacy = json.loads((root / 'docs/validation/journey-goals-integration/legacy-v1.json').read_text())
    assert legacy['sourceCommit'] == BASE and [c['name'] for c in legacy['cases']] == ['full', 'partial', 'zero']
    browser = json.loads((root / 'docs/validation/journey-goals-integration/browser-result.json').read_text())
    assert browser['status'] == 'PASS' and not browser['errors']
    assert {c['name'] for c in browser['cases']} == {'320', '390', '1440'}
    assert all(c['status'] == 'PASS' and c['claims'] == ['N01', 'C08'] and c['keyboard'] and c['reload'] and c['productionStable'] for c in browser['cases'])
    return record


def accepts(path, predecessor, root=ROOT):
    if path not in SOURCES:
        return False
    record = validate(root)
    return predecessor == record['changes'][path]['before']


if __name__ == '__main__':
    validate()
    print('PASS: exact growth-task successor; 80 unchanged task conditions, v1 proofs, v2 totals and browser evidence; historical art guards preserved.')
