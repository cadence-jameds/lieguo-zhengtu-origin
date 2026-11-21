"""Pin one finite authority-derived incoming intelligence display successor."""
from functools import lru_cache
import subprocess
import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'c8b3554ff9643b74b624e4e77f381653afcccc20'
IMPLEMENTATION = 'bb681cc8fd17fe3b5285b2e066289f64ff194031'
SOURCES = {
    'releases/notes/traditional-incoming-intelligence.json',
    'src/game/formal/incomingIntelligence.test.ts',
    'src/game/incomingIntelligence.ts',
    'src/game/presentation/CombatPanel.tsx',
    'src/game/presentation/IncomingArmyAlert.tsx',
    'src/game/presentation/LegionView.tsx',
    'src/game/presentationModel.ts',
    'src/game/presentationStore.ts',
    'src/game/worldProjection.ts',
}
ADDITIONS = {
    'releases/notes/traditional-incoming-intelligence.json',
    'src/game/formal/incomingIntelligence.test.ts',
    'src/game/incomingIntelligence.ts',
}


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], stderr=subprocess.DEVNULL)


def previous(ref, path):
    return git('show', f'{ref}:{path}')


def sha(data):
    return hashlib.sha256(data).hexdigest()


@lru_cache(maxsize=1)
def record():
    assert git('rev-list', '--parents', '-n', '1', IMPLEMENTATION).decode().split() == [IMPLEMENTATION, BASE], 'Invalid intel proof predecessor'
    actual = set(git('diff', '--name-only', '--no-renames', BASE, IMPLEMENTATION).decode().splitlines())
    assert actual == SOURCES, ('Invalid intel proof scope', actual ^ SOURCES)
    changes = {path: sha(previous(IMPLEMENTATION, path)) for path in sorted(SOURCES)}
    grants = {path: {sha(previous(BASE, path))} for path in sorted(SOURCES - ADDITIONS)}
    for path in sorted(ADDITIONS):
        assert not git('ls-tree', '-r', '--name-only', BASE, '--', path), ('Expected new intelligence path', path)
    for file in git('ls-tree', '-r', '--name-only', BASE, 'docs/validation').decode().splitlines():
        if not file.endswith('/compatibility.json'):
            continue
        proof = json.loads(previous(BASE, file))
        for path, digests in grants.items():
            item = proof.get('changes', {}).get(path, {})
            for value in [proof.get('invariants', {}).get(path), item.get('before'), item.get('after'), *proof.get('grants', {}).get(path, [])]:
                if isinstance(value, str) and len(value) == 64:
                    digests.add(value)
    return changes, {path: frozenset(values) for path, values in grants.items()}


def accepts(path, predecessor, root=ROOT):
    if path not in SOURCES - ADDITIONS:
        return False
    changes, grants = record()
    target = root / path
    return predecessor in grants[path] and target.is_file() and sha(target.read_bytes()) == changes[path]


def validate(root=ROOT):
    changes, _ = record()
    for path, digest in changes.items():
        target = root / path
        assert target.is_file() and sha(target.read_bytes()) == digest, ('Unpinned incoming intelligence display', path)
