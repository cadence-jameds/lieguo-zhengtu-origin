"""Exact, presentation-only continuation of the pinned map and settlement form."""
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREDECESSORS = {'src/game/FormalDevelopmentPanel.tsx': '861dc220b903ab388ff10cd2e3f3be4b279d34a4590a56028738061038e39265', 'src/game/FormalWorldMap.tsx': '14e65e3ef98ecf722d511effb1315ce232e2d2925901feb46e68ed15a2b617e1'}
SOURCES = {'src/game/FormalDevelopmentPanel.tsx': '5fc00d06a0cc583ea557fa2d40d797c1e285c90e4affde1f83f43a9362ef6698', 'src/game/FormalWorldMap.tsx': '3d591d5a4816ee7d385f3edf154e4d7d191debb618fc95a166308064a21b7bbd', 'src/game/presentation/settlement-map-picker.css': 'f79f41a5ed287dc2504cb619ae055ae86282f0554dbd1947b9e9cd12e287636d', 'src/game/presentation/settlementSite.ts': '9ac366551b7d1caf42ad1659c9c693d8170b8328d21c5d010e914a2d4785b618'}

def _matches(path, root):
    target = root / path
    exact = target.is_file() and sha256(target.read_bytes()).hexdigest() == SOURCES[path]
    if exact:
        return True
    if path != 'src/game/FormalWorldMap.tsx':
        return False
    from world_map_readability_successor import accepts
    return accepts(path, SOURCES[path], root)


def continues_file(path, predecessor, root=ROOT):
    """Compose with historical per-file guards, including their sparse fixtures."""
    return path in PREDECESSORS and PREDECESSORS[path] == predecessor and _matches(path, root)


def validate_sources(root=ROOT):
    """Require all four exact files at the full-checkout compatibility gate."""
    for path in SOURCES:
        assert _matches(path, root), ('Unpinned settlement map picker source', path)
