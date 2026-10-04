#!/usr/bin/env python3
"""Serve dist/public the way Vercel does, so the built app can be exercised.

The static file server that came before could not answer /login, because on
Vercel that path is a rewrite to app.html rather than a file. Mirroring the
rewrite rules is the only way to load a route other than / in a browser without
deploying.

Usage: python3 scripts/serve-dist.py [port]
"""
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DIST = Path(__file__).resolve().parent.parent / "dist" / "public"

# Mirrors the `rewrites` array in vercel.json.
REWRITES = [
    (re.compile(r"^/api/"), None),          # never rewritten
    (re.compile(r"^/assets/"), None),       # never rewritten
    (re.compile(r"^/app\.html"), None),     # never rewritten
]


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0].split("#", 1)[0]
        target = (DIST / clean.lstrip("/")).resolve()

        # A real file, or a real directory with an index.html inside it.
        if target.is_file():
            return str(target)
        for name in ("index.html", "app.html"):
            candidate = target / name
            if candidate.is_file():
                return str(candidate)

        if any(pattern.match(clean) for pattern, _ in REWRITES):
            return str(DIST / clean.lstrip("/"))

        # Everything else is the SPA: /login, /dashboard, /reset-password.
        return str(DIST / "app.html")

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args) -> None:  # quieter output
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8993
    if not DIST.is_dir():
        raise SystemExit(f"missing {DIST} - run the build first")
    print(f"serving {DIST} on http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(DIST))).serve_forever()
