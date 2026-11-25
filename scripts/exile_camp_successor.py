"""Finite display-only grant for precisely the approved exile camp map art."""
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'src/game/FormalWorldMap.tsx': ('54b1cc760466b3e2739c4a27d9202091b6c7df025811fca884ee9f51c34f8c16', 'dd92780efe7d21b66c985ab8858eab84731fc47ec5ece5df3a49e955fe8e0545'),
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
    return bool(entry and predecessor == entry[0] and matches(root, path, entry[1])
                and all(matches(root, p, h) for p, h in COMPANIONS.items()))
