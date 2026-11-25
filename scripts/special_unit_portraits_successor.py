"""Exact art-only successor: fixed byte witnesses; no permission for authority changes."""
from hashlib import sha256
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CRAFTSMAN='src/game/presentation/CraftsmanPanel.tsx'
DEVELOPMENT='src/game/presentation/DevelopmentViews.tsx'
BASE_CRAFTSMAN='df37cba551105a92a2b67566ac228060b7292dce81ef604668373bee2cee8d99'
CRAFTSMAN_ANCESTORS=frozenset((
 BASE_CRAFTSMAN, # R3-04 and later.
 '3c602d38e3a30e23edbfd8fce28accf622383295948bc87772304d155adf8fcf', # R3-02/R3-03
 'd6dde053329cb873475022f8ec1c8a58bddeb9968ce669064669b856d89cb3cd', # R3-01
))
BASE_DEVELOPMENT='51ac529e9c65be8ede14d202a838fa7c096ac5bc3a09c4264d945159937bbe73'
DEVELOPMENT_ANCESTORS=frozenset((
 BASE_DEVELOPMENT, # Settlement training slot sharing.
 '4e443b441bfe5faf956e0d2701ea230f4069e256699c2b78977c42f33b11aec2', # R3-04 UI.
 'de9c45d0079163ac34ad17f4ebd5fc9eda1aec82f38ee047b87d50313e3d3e51', # Recruitment input.
 '2d4ed35bd97fbb441cb091a144fed4b4ca40baf5004716e41986d4da54b4e0f9', # Original recruitment UI.
))
RESULTS={'releases/notes/special-unit-portraits.json': 'c93ac38a9e0fc748916453977d9bf47ab26b2a93bae85970771fa54e2216d346',
 'src/game/presentation/CraftsmanPanel.tsx': 'f615c98883159bb315cff39a4f74bc37b6bdce0b492b15f9b0aadd529e278ecc',
 'src/game/presentation/DevelopmentViews.tsx': '9ae02300d7390240cbe3324535178084c7c5a82c781a668cc0d017e6808e745e',
 'src/game/presentation/specialArmyArt.tsx': '041cd0f8d92423f0c25c8b2c3180d6139c91b1c56035cb0611255105f72e7f6e',
 'src/game/presentation/specialUnitPortrait.test.tsx': '67c67a968f389bd4293883744e22f7b30026460d0b4b6b8e2eb470d0be3fa59f',
 'src/game/presentation/media/unit-craftsman-corps.webp': '2260dded665ad46643b9bd20b5479c81f3e583faca0e7dd406740377cadc0072',
 'src/game/presentation/media/unit-settler-team.webp': '02b9d64cd428e8dba7966fa78f13122111d8d5fb5890272c4b3ce0b22f2b5008',
 'src/game/presentation/specialUnitPortrait.css': '841ea53511c8a7a2954d5aa5271c322ef0e6404483419b25d838717fa905b90a'}

def current(path,root=ROOT):
 target=root/path
 return path in RESULTS and target.is_file() and sha256(target.read_bytes()).hexdigest()==RESULTS[path]

def accepts(path,predecessor,root=ROOT):
 # Only existing exact R3 path digests can be continued by this registered portrait.
 if path==CRAFTSMAN:
  return predecessor in CRAFTSMAN_ANCESTORS and current(path,root)
 if path==DEVELOPMENT:
  return predecessor in DEVELOPMENT_ANCESTORS and current(path,root)
 return False

def validate(root=ROOT):
 for path in RESULTS:
  assert current(path,root), ('Unpinned special-unit portrait source/art',path)
