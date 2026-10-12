"""Optional Unix/macOS launcher for the packaged Playable. Python 3 only."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

if __name__ == '__main__':
    root = Path(__file__).resolve().parent / 'game'
    if not (root / 'index.html').is_file():
        raise SystemExit('Extract the complete Playable ZIP before starting.')
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    with ThreadingHTTPServer(('127.0.0.1', 8771), handler) as server:
        print('Lieguo v0.30.11: open http://localhost:8771/ ; Ctrl+C to stop.', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
