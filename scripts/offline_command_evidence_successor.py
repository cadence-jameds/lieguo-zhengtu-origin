"""Grant exactly the reviewed offline command-evidence reducer, never a rule/format waiver."""
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = '87da678382be88040ddf38a6183e45d5c458e4b5'
IMPLEMENTATION = 'c2a73e70ca4675d6afe8b8819ac731c6fe3d50e1'
REDUCER = 'src/game/formal/reducer.ts'
SOURCES = {REDUCER, 'src/game/formal/offlineCommandEvidence.test.ts', 'releases/notes/offline-command-evidence.json'}


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])


def digest(data):
    return hashlib.sha256(data).hexdigest()


@lru_cache(maxsize=1)
def exact_scope():
    assert git('rev-parse', IMPLEMENTATION + '^').decode().strip() == BASE, 'Wrong offline optimization predecessor'
    paths = set(git('diff', '--name-only', BASE, IMPLEMENTATION).decode().splitlines())
    assert paths == SOURCES, ('Unreviewed offline optimization scope', paths ^ SOURCES)
    targets = {path: digest(git('show', f'{IMPLEMENTATION}:{path}')) for path in SOURCES}
    grants = {digest(git('show', f'{BASE}:{REDUCER}'))}
    for path in git('ls-tree', '-r', '--name-only', BASE, 'docs/validation').decode().splitlines():
        if not path.endswith('/compatibility.json'):
            continue
        proof = json.loads(git('show', f'{BASE}:{path}'))
        change = proof.get('changes', {}).get(REDUCER, {})
        grant = [proof.get('invariants', {}).get(REDUCER), change.get('before'), change.get('after')]
        grant += proof.get('grants', {}).get(REDUCER, [])
        grants.update(value for value in grant if isinstance(value, str) and len(value) == 64)
    return targets, frozenset(grants)


def accepts(path, predecessor, root=ROOT):
    if path != REDUCER:
        return False
    targets, grants = exact_scope()
    target = root / path
    return predecessor in grants and target.is_file() and digest(target.read_bytes()) == targets[path]


def validate(root=ROOT):
    targets, _ = exact_scope()
    for path, expected in targets.items():
        assert digest((root / path).read_bytes()) == expected, ('Unpinned offline optimization source', path)
