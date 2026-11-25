"""Finite display-only grant for precisely the approved exile camp map art."""
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'src/game/FormalWorldMap.tsx': ('54b1cc760466b3e2739c4a27d9202091b6c7df025811fca884ee9f51c34f8c16', 'dd92780efe7d21b66c985ab8858eab84731fc47ec5ece5df3a49e955fe8e0545'),
}
# The immutable R3-04 compatibility record already admits these historical
# renderers to the exact current renderer. This composes only that same path.
HISTORICAL_RENDERER_PREDECESSORS = {
    'f647e9cefcf5662c8689053d7a2fbfdbb2f48df36ce0db7fd5211056dd0abcf7',
    'bf3ced0883728d1c2fa86109764b80a3e7899127ce08101e77680e14016f5bf9',
    '346b5f975d1ece11689b79e41e3196a9913a70cb6842d9344212de37a28953ee',
}
COMPANIONS = {
    'src/game/presentation/exileCampArt.ts': 'c60380dc2f3646f983be2140e283e9ecb9aebaf114d19e074806cc544b44a1b7',
    'src/game/presentation/media/world-exile-camp.webp': 'e23eb7a44c2fee9286ddb7851972a8b1bbb96f195c56f64a7e6209c533deed80',
}

def matches(root, path, digest):
    target = root / path
    return target.is_file() and sha256(target.read_bytes()).hexdigest() == digest

def accepts(path, predecessor, root=ROOT):
    entry = SOURCES.get(path)
    return bool(entry and (predecessor == entry[0] or predecessor in HISTORICAL_RENDERER_PREDECESSORS)
                and matches(root, path, entry[1]))


def validate_assets(root=ROOT):
    for path, digest in COMPANIONS.items():
        assert matches(root, path, digest), ('Unexpected exile camp asset', path)
