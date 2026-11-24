#!/usr/bin/env python3
"""Tiny local sink for browser-fetched data.

The shell in this environment can't resolve DNS, but the browser can.
Run this, navigate a tab to http://127.0.0.1:8765/, then fetch upstream
data from the page and POST it to /save?name=....

    python3 scripts/capture.py
"""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "raw"
OUT.mkdir(parents=True, exist_ok=True)


class Handler(BaseHTTPRequestHandler):
    def _headers(self, code=200, ctype="text/plain"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()

    def do_OPTIONS(self):
        self._headers(204)

    def do_GET(self):
        self._headers()
        self.wfile.write(b"ok")

    def do_POST(self):
        u = urlparse(self.path)
        name = (parse_qs(u.query).get("name") or ["capture.json"])[0]
        # keep it to a simple filename
        name = "".join(c for c in name if c.isalnum() or c in "-_.") or "capture.json"
        n = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(n)
        path = OUT / name
        path.write_bytes(body)
        print(f"saved {path} ({len(body)} bytes)")
        self._headers()
        self.wfile.write(str(path).encode())

    def log_message(self, fmt, *args):
        print(fmt % args)


if __name__ == "__main__":
    print(f"sink: http://127.0.0.1:8765/ -> {OUT}")
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
