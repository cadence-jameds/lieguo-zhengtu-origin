"""Finite administrative-technology presentation successor. Do not rewrite saved runtime or historical proofs."""
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'c8b3554ff9643b74b624e4e77f381653afcccc20'
IMPLEMENTATION = '21eca96854fdffb80f09844540e2d6438c416663'
SOURCES = frozenset({
    'src/game/GameApp.tsx',
    'src/game/useGame.ts',
    'src/game/useGameInteraction.test.tsx',
    'src/game/presentation/GovernanceView.tsx',
})
ADDITIONS = frozenset({
    'releases/notes/administrative-tech.json',
    'src/game/administration.ts',
    'src/game/administration.test.ts',
    'src/game/administrationPersistence.test.ts',
    'src/game/presentation/AdministrativeTools.tsx',
    'src/game/presentation/administrativeTools.test.tsx',
})


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])


def original(ref, path):
    return git('show', f'{ref}:{path}')


def sha(data):
    return hashlib.sha256(data).hexdigest()


@lru_cache(maxsize=1)
def records():
    assert git('rev-list', '--parents', '-n', '1', IMPLEMENTATION).decode().split() == [IMPLEMENTATION, BASE]
    changed = set(git('diff', '--name-only', '--no-renames', BASE, IMPLEMENTATION).decode().splitlines())
    assert changed == SOURCES | ADDITIONS, ('Unexpected administrative technology scope', changed ^ (SOURCES | ADDITIONS))
    grants = {p: {sha(original(BASE, p))} for p in SOURCES}
    protected = 'docs/art-unification/elite-review-20261029/protected.json'
    protected_hashes = json.loads(original(BASE, protected))['files']
    for path in SOURCES:
        if path in protected_hashes:
            grants[path].add(protected_hashes[path])
    files = git('ls-tree', '-r', '--name-only', BASE, 'docs/validation').decode().splitlines()
    for record in files:
        if not record.endswith('/compatibility.json'):
            continue
        proof = json.loads(original(BASE, record))
        for path, accepted in grants.items():
            entry = proof.get('changes', {}).get(path, {})
            for digest in [proof.get('invariants', {}).get(path), entry.get('before'), entry.get('after'), *proof.get('grants', {}).get(path, [])]:
                if isinstance(digest, str) and len(digest) == 64:
                    accepted.add(digest)
    return {p: sha(original(IMPLEMENTATION, p)) for p in SOURCES | ADDITIONS}, grants


def accepts(path, predecessor, root=ROOT):
    if path not in SOURCES:
        return False
    after, grants = records()
    return predecessor in grants[path] and (root/path).is_file() and sha((root/path).read_bytes()) == after[path]


def validate(root=ROOT):
    after, _ = records()
    for path, digest in after.items():
        assert (root/path).is_file() and sha((root/path).read_bytes()) == digest, ('Unpinned administrative technology change', path)
