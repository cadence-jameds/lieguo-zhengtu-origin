"""Exact downstream world-map presentation witness. Never refresh historical evidence."""
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Tail after d4445324ec897ca2de1b7d82d65c20e6d89b672a; only visual files and relevant tests.
SOURCES = {
    'src/game/FormalWorldMap.tsx': ('3d591d5a4816ee7d385f3edf154e4d7d191debb618fc95a166308064a21b7bbd', '763082df907b63a05e6d043000a987fc2847915ef5bbaef89f895167d37eb25c'),
    'src/game/presentation/armyOverlay.ts': ('70f2f29b1b5dd4a03b936fc5774bf039eba9da2445eb107a58d217a0d90296b0', '6df33964d77058ac7a55f96879ec11c7a50320a04da6563df872f014ee6e359f'),
    'src/game/presentation/armyOverlayB6.test.tsx': ('50cd3d0f0cd29339e2487d92d57c69b9a7758bc72e664ef21706605b90ae2b35', 'fd1e3b461f1cf44ac43d25171af8003443fd323b80f61bfe777f8f4a2655a2ce'),
    'src/game/presentation/civilianOverlay.ts': ('c9525bdcfc7aef0c1d0192d0aa465027a21b7c06b1edba916fb4191faa3c4d92', '23962c039a0c06827dc237829f55eef450a4d1e7a5587f2eba1d07aaa5cdabca'),
    'src/game/presentation/civilianOverlay.test.ts': ('c2299b821374ecbb2a4b4a9fc61d7fcaa6d8ef84a3a3a960ff6a2c240b0e0c96', '0c17b4775ebb989b5528fb085608d881f5713e6cd894482e70fe6d7f8df0bd81'),
    'src/game/presentation/mapRelations.ts': ('0dc559a3cf301edac604323a1da945b7e2d82c6808b450f91cbd76a341d3ea73', 'f02beff22a91dc53bcae29d9913b827450cb22bd077ec9c80251e57a3579ca57'),
    'src/game/presentation/mapRouteStyle.ts': (None, '27f25aaf41b08fafc4b613ca77f0a747a640ac849e9ee0112551e5da9bb6994a'),
    'src/game/presentation/mapRouteStyle.test.ts': (None, '870a51ca297068aa0f1de1e8f557efdb30fb3ed694e89057d1c792c3c85a8fc5'),
}

# Original hashes already verified by the immutable R3-04 and art witnesses.
# Admit exactly the existing historical route to this display-only successor.
HISTORICAL_PREDECESSORS = {
    'src/game/presentation/armyOverlay.ts': frozenset({'bee14e911243120f35b4756b06d198047e1dd91a23bbf9408d0dbfd5e56590f5'}),
    'src/game/presentation/mapRelations.ts': frozenset({'cc5a4763a5e96aed46a0e40dfe0614d2714338fb0820f0143177a1e40797fa22'}),
}

def matches(path, root=ROOT):
    pin = SOURCES.get(path)
    target = root / path
    return bool(pin and target.is_file() and sha256(target.read_bytes()).hexdigest() == pin[1])

def accepts(path, predecessor, root=ROOT):
    pin = SOURCES.get(path)
    return bool(pin and pin[0] and (predecessor == pin[0] or predecessor in HISTORICAL_PREDECESSORS.get(path, ())) and matches(path, root))

def validate_sources(root=ROOT):
    for path in SOURCES:
        assert matches(path, root), ('Unpinned world-map presentation source', path)
