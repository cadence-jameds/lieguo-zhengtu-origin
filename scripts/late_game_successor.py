"""Finite late-game implementation pin. Historical rules, tests and records are not changed."""
import hashlib
import json
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = '0bd1a33bbfe173fc1e8b67a17eab66b5f4c3407f'
IMPLEMENTATION = '109e8a13581f99122360e8fe9a94a21910228450'
BOUNDARY = 'scripts/verify-projection-boundaries.mjs'
SOURCES = {
    'docs/b10-p0-offline/LATE-LOGISTICS.md',
    'releases/notes/late-game-reliability.json',
    'src/game/formal/economy.ts',
    'src/game/formal/logisticsAllocation.ts',
    'src/game/formal/logisticsPerformance.test.ts',
    'src/game/formal/logisticsRoute.ts',
    'src/game/formal/offlineCommandScheduler.test.ts',
    'src/game/formal/politicalAdmissionRuntime.test.ts',
    'src/game/formal/reducer.ts',
    'src/game/formal/reportScope.ts',
    'src/game/orderAdmission.ts',
    'src/game/presentation/BattleReportBody.tsx',
    'src/game/presentation/FormalReportsView.tsx',
    'src/game/presentation/formalReportCorrections.test.tsx',
}


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], stderr=subprocess.DEVNULL)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def previous(ref, path):
    return git('show', f'{ref}:{path}')


def replace_once(text, before, after):
    assert text.count(before) == 1, ('Unexpected projection-boundary predecessor', before)
    return text.replace(before, after)


@lru_cache(maxsize=1)
def boundary_bytes():
    source = previous(BASE, BOUNDARY).decode()
    before = 'const admitted=p=>bounded(p)||Object.hasOwn(successor.changes,p)||Object.hasOwn(runtimeSuccessor.changes,p);'
    source = replace_once(source, before, (
        "const lateSuccessor=JSON.parse(execFileSync('python3',['scripts/late_game_successor.py','--boundary-record'],"
        "{encoding:'utf8',stdio:['ignore','pipe','pipe']}));\n"
        "const late=p=>Object.hasOwn(lateSuccessor.changes,p);\n"
        + before.replace('bounded(p)', 'late(p)||bounded(p)', 1)
    ))
    old_comment = (
        '// The only intentional economy runtime addition is a formal-only guard; the\n'
        '// authoritative branch is byte-identical after removing that guard.\n'
    )
    source = replace_once(source, old_comment, (
        '// Without the pinned late-game logistics successor, economy must retain\n'
        '// the exact historic implementation after removing its formal-only guard.\n'
        "if(!late('src/game/formal/economy.ts'))"
    ))
    source = replace_once(source, 'formalEconomyEquivalent:true', (
        "formalEconomySource:late('src/game/formal/economy.ts')?'finite late-game logistics successor plus parity':'historical guard equivalent'"
    ))
    return source.encode()


@lru_cache(maxsize=1)
def exact_scope():
    assert git('rev-list', '--parents', '-n', '1', IMPLEMENTATION).decode().split() == [IMPLEMENTATION, BASE], 'Incorrect late-game predecessor'
    actual = set(git('diff', '--name-only', BASE, IMPLEMENTATION).decode().splitlines())
    assert actual == SOURCES, ('Unexpected late-game source scope', actual ^ SOURCES)
    changes, grants = {}, {}
    for path in sorted(SOURCES):
        try:
            before = sha(previous(BASE, path))
        except subprocess.CalledProcessError:
            before = None
        changes[path] = {'before': before, 'after': sha(previous(IMPLEMENTATION, path))}
        grants[path] = {before} if before else set()
    # Historical predecessors are sourced from the fixed baseline commit,
    # never from the live checkout, a submitted local hash, or another path.
    records = git('ls-tree', '-r', '--name-only', BASE, 'docs/validation').decode().splitlines()
    for filename in records:
        if not filename.endswith('/compatibility.json'):
            continue
        proof = json.loads(previous(BASE, filename))
        for path, allowed in grants.items():
            changed = proof.get('changes', {}).get(path, {})
            for h in [proof.get('invariants', {}).get(path), changed.get('before'), changed.get('after'), *proof.get('grants', {}).get(path, [])]:
                if isinstance(h, str) and len(h) == 64:
                    allowed.add(h)
    return changes, {path: frozenset(values) for path, values in grants.items()}


def accepts_adapter(path, before, root=ROOT):
    target = root / path
    return path == BOUNDARY and before == previous(BASE, BOUNDARY) and target.is_file() and target.read_bytes() == boundary_bytes()


def accepts(path, predecessor, root=ROOT):
    if path == BOUNDARY:
        base_bytes = previous(BASE, BOUNDARY)
        return predecessor == sha(base_bytes) and accepts_adapter(path, base_bytes, root)
    if path not in SOURCES:
        return False
    changes, grants = exact_scope()
    target = root / path
    return predecessor in grants[path] and target.is_file() and sha(target.read_bytes()) == changes[path]['after']


def validate(root=ROOT):
    changes, _ = exact_scope()
    for path, change in changes.items():
        target = root / path
        assert target.is_file() and sha(target.read_bytes()) == change['after'], ('Unpinned late-game implementation', path)
    assert accepts_adapter(BOUNDARY, previous(BASE, BOUNDARY), root), 'Unpinned late-game projection adapter'
    return {'changes': changes}


if __name__ == '__main__':
    record = validate()
    print(json.dumps(record) if '--boundary-record' in sys.argv else
          f'PASS: exact late-game implementation at {IMPLEMENTATION} with historical gates unchanged.')
