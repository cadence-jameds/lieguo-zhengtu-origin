"""Local synthetic fixture server; never use against production or a real profile.
Usage: python scripts/serve-update-boundary-fixtures.py PREPARED_ROOT [PORT]
The browser probe writes r19-server-mode: normal / fail (503) / pending (5s) / race (150ms).
"""
import http.server
import sys
import time
from pathlib import Path

root = Path(sys.argv[1]).resolve()

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root / 'web'), **kwargs)

    def do_GET(self):
        if self.path.split('?')[0].endswith('/sw.js'):
            control = root / 'r19-server-mode'
            mode = control.read_text().strip() if control.exists() else 'normal'
            if mode in ('fail', 'pending', 'race'):
                (root / 'r19-request-seen').write_text(mode)
                if mode == 'fail':
                    self.send_error(503)
                    return
                time.sleep(5 if mode == 'pending' else 0.15)
        super().do_GET()

http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2]) if len(sys.argv) > 2 else 4218), Handler).serve_forever()
