"""Finite display-only grant for precisely the approved exile camp map art."""
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'src/game/FormalWorldMap.tsx': ('54b1cc760466b3e2739c4a27d9202091b6c7df025811fca884ee9f51c34f8c16', '9ebc882915bcead741f9cfbb282bcb1537e3a841fa89a93e02f0d1f5d2d35b18'),
    'src/game/presentation/artInventory.ts': ('29835822a874fb7d7274505192b0cb19e16143aca33ef4bc14a835709d8fd5f7', '4b5b268157578997510c838463670409756d9b7a8f5375742e6fae682399d012'),
}
COMPANIONS = {
    'src/game/presentation/exileCampArt.ts': 'e7d3ad5c8bb8d7004a32840185876f3f87a5a1c0c0808025931b0e20b475af05',
    'public/art/world-exile-camp.webp': 'e23eb7a44c2fee9286ddb7851972a8b1bbb96f195c56f64a7e6209c533deed80',
}

def matches(root, path, digest):
    target = root / path
    return target.is_file() and sha256(target.read_bytes()).hexdigest() == digest

def accepts(path, predecessor, root=ROOT):
    entry = SOURCES.get(path)
    return bool(entry and predecessor == entry[0] and matches(root, path, entry[1])
                and all(matches(root, p, h) for p, h in COMPANIONS.items()))
