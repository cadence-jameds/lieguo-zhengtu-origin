"""Exact path continuation for the reviewed route cache; no rule or history waiver."""
from hashlib import sha256
from pathlib import Path

ROUTING = 'src/game/formal/routing.ts'
PREDECESSOR = 'a3a5a8e822e79980ada8657525a563141e6981af1293bd6131ab6f3aee2647db'
CANDIDATE = 'a76e5460a7181435e0acd90692eddb3055b5e4137a6a5898c63f2285dfde4d27'


def continues_file(path, predecessor, root: Path):
    if path != ROUTING or predecessor != PREDECESSOR:
        return False
    target = root / ROUTING
    return target.is_file() and sha256(target.read_bytes()).hexdigest() == CANDIDATE
