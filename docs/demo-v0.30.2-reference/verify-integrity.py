"""Read-only audit against the pinned GitHub subtree. Does not rewrite source."""
from pathlib import Path
import hashlib
import json

base = Path(__file__).resolve().parent
manifest = json.loads((base / 'remote-manifest.json').read_text())
rows = []
for entry in manifest['tree']['tree']:
    if entry['type'] != 'blob':
        continue
    path = base / 'source' / entry['path']
    data = path.read_bytes() if path.exists() else b''
    sha = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    rows.append({'path': entry['path'], 'matches': sha == entry['sha'] and len(data) == entry['size']})
failures = [row['path'] for row in rows if not row['matches']]
print(json.dumps({'commit': manifest['commit'], 'tree': manifest['tree']['sha'], 'files': len(rows), 'mismatches': failures}, indent=2))
raise SystemExit(bool(failures))
