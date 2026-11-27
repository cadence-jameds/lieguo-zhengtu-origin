"""Exact display-only successor; no additional route data or simulation changes."""
from hashlib import sha256
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'src/game/presentation/civilianOverlay.ts'
PREDECESSORS = frozenset({
    'd5677aae1cb8704802008187df65df77fd11f945613cdc4659bda238d2ce43cf',
    '31e43dee15b8ff1eda33dd43ee2a4e499a46f61f59dc27197f63a04bdf311eaa',
})
RESULT = '26a40bf9223eff7f71c9f408df590b4f22b309e45f2cc423b212f9161dc38ea5'

CONSISTENT_WIDTH_RESULT = 'c9525bdcfc7aef0c1d0192d0aa465027a21b7c06b1edba916fb4191faa3c4d92'

def accepts(path, predecessor, root=ROOT):
    from world_map_readability_successor import accepts as readability
    if path == SOURCE and predecessor in PREDECESSORS | {RESULT, CONSISTENT_WIDTH_RESULT} and readability(path, CONSISTENT_WIDTH_RESULT, root):
        return True
    return path == SOURCE and (root/path).is_file() and (
        (predecessor in PREDECESSORS and sha256((root/path).read_bytes()).hexdigest() == RESULT) or
        (predecessor in PREDECESSORS | {RESULT} and sha256((root/path).read_bytes()).hexdigest() == CONSISTENT_WIDTH_RESULT)
    )
