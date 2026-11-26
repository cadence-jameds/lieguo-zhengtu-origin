"""Exact, presentation-only continuation of the pinned map and settlement form."""
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREDECESSORS = {'src/game/FormalDevelopmentPanel.tsx': '861dc220b903ab388ff10cd2e3f3be4b279d34a4590a56028738061038e39265', 'src/game/FormalWorldMap.tsx': '14e65e3ef98ecf722d511effb1315ce232e2d2925901feb46e68ed15a2b617e1'}
SOURCES = {'src/game/FormalDevelopmentPanel.tsx': '5fc00d06a0cc583ea557fa2d40d797c1e285c90e4affde1f83f43a9362ef6698', 'src/game/FormalWorldMap.tsx': '3d591d5a4816ee7d385f3edf154e4d7d191debb618fc95a166308064a21b7bbd', 'src/game/presentation/settlement-map-picker.css': 'f79f41a5ed287dc2504cb619ae055ae86282f0554dbd1947b9e9cd12e287636d', 'src/game/presentation/settlementSite.ts': '9ac366551b7d1caf42ad1659c9c693d8170b8328d21c5d010e914a2d4785b618'}

def accepts(path, predecessor, root=ROOT):
    if path not in PREDECESSORS or PREDECESSORS[path] != predecessor:
        return False
    return all((root / p).is_file() and sha256((root / p).read_bytes()).hexdigest() == expected
               for p, expected in SOURCES.items())
