"""Exact HUD presentation successor. Frozen evidence and runtime are untouched."""
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = {
    'src/game/presentation/Shell.tsx': '3a9d8f56cc3c01f032cf7330ae967c8ffbe84ce9a070c1d7b3412fb0e91e42e7',
    'src/game/MobileNavigation.tsx': '9f417844f307be012ebcd41a3961f15f577f0a1e449177b04d58a4df38ab84a7',
    'src/game/MobileNavigationSettings.tsx': '1a99f0f0d38a0da5c86d7fcf63c766b52266c4b043bd83420560639dbf73e85b',
    'src/game/game.css': '7a083bb2d92f17180e8dd2356d0d0e752550bf1bd211edab8637f393f7bcead8',
}
PREDECESSORS = {
    'src/game/presentation/Shell.tsx': frozenset({
        '0c63de06305b2bc50d78dc2232f9c90b689169af62606b504926b5625db18b83',
        '3cf68263ff237c5b211a8cfc9892b4014effcd8ec8a8c54bf56012a11dd75a25',
        '58fccc071be7dc8f97407a122b7d8002dd069a7079a53eab12a12ae5e3cdfa9c',
        '88785f63068ebc940d1ebb51f8448253d6f2f34788a6b19e7bf240a66a7efff7',
        '8b5dcc4991a07c3411584f488732dad284bb540006550d60bb81c1f65b6698ac',
        'd35f0f0a058d92d474af4fd3a94931704f78f09163343642d65180ecf41904b9',
        'da01ffef24213031b89f0df0ca0cbd3667386a75f4d0d34687a11fa5e37d5e68',
    }),
    'src/game/MobileNavigation.tsx': frozenset({
        'fd55e74cb01ce0fbdda18dadf5d58e2587cfddded2aa7ec1f3decbe0bee7c34f',
    }),
    'src/game/MobileNavigationSettings.tsx': frozenset({
        '0fe9e0959d5a1eb6985ec01020ee836fdb8a273f2a955ece6f589938f4e2bf33',
        'a3a734be55ece8c2e33032ea6977f80389f40c9f40a7817a97c16d3c6e673171',
    }),
    'src/game/game.css': frozenset({
        '0444a47ec824fa0542f427e1a3eb0d442924e7820f9a8889e97057381427a281',
        '091ce21d8170ccac8ff86a00abc93c83b44651bcae97b6ba6ea0145da2bbe085',
        '27f940cd0e2afd89ba6d34c9a6f64d01b917977f25b17461decb29878c16f87c',
        '7e31556b031c29a7c2200b5c09ec2671f108cd367f72c05cb8e5f57a7c3f7443',
        'd153e2a2da34749e8c50dbcde4637a75957b4ebb73d66fe330df6b587d4ee544',
    }),
}

def accepts(path, predecessor, root=ROOT):
    if path not in RESULTS or predecessor not in PREDECESSORS[path]:
        return False
    source = root / path
    return source.is_file() and sha256(source.read_bytes()).hexdigest() == RESULTS[path]
