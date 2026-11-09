#!/usr/bin/env python3
"""Product Forge local server. Started for you by /product-forge-start.

Serves the app from the plugin folder on this machine only, and hands the page your
keys from your own settings file so they never have to be typed into, or saved inside,
the app itself. Nothing here is reachable from another computer.

  serve.py [--port N]

Settings come from ~/.society/digitaltechz/.env. It never prints a key.
"""
import argparse
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.environ.get("CLAUDE_PLUGIN_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOCIETY = os.path.expanduser(os.environ.get("SOCIETY_HOME", "~/.society"))
APP = os.path.join(ROOT, "app")
KIT = "digitaltechz"
LOCAL = "127.0.0.1"
DEFAULT_PORT = 4790
TYPES = {".html": "text/html; charset=utf-8", ".template": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
         ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
         ".woff2": "font/woff2", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}


def read_env():
    d = {}
    path = os.path.join(SOCIETY, KIT, ".env")
    if os.path.isfile(path):
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    d[k.strip()] = v.strip().strip('"').strip("'")
    return d


class Handler(BaseHTTPRequestHandler):
    server_version = "digitaltechz"
    port = DEFAULT_PORT

    def log_message(self, fmt, *args):  # request lines only, never a body
        sys.stdout.write("%s %s\n" % (self.command, self.path.split("?")[0]))
        sys.stdout.flush()

    def _send(self, code, body, ctype, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _same_origin(self):
        """The keys go to the app's own page and nothing else. A page on another site
        must not be able to pull them, and neither must a name pointed at this machine."""
        allowed = {"%s:%d" % (LOCAL, self.port), "localhost:%d" % self.port}
        if (self.headers.get("Host") or "") not in allowed:
            return False
        site = self.headers.get("Sec-Fetch-Site")
        if site is not None and site != "same-origin":
            return False
        origin = self.headers.get("Origin")
        if origin and origin.split("://", 1)[-1] not in allowed:
            return False
        return True

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/kit-keys.json":
            if not self._same_origin():
                return self._send(403, b'{"error":"forbidden"}', "application/json")
            env = read_env()
            key_val = env.get("OMNIROUTE_API_KEY") or env.get("FREELLM_API_KEY", "")
            body = json.dumps({"omnirouteKey": key_val, "freellmKey": key_val, "geminiKey": env.get("GEMINI_API_KEY", ""),
                               "openaiKey": env.get("OPENAI_API_KEY", ""), "name": env.get("FORGE_NAME", "")}).encode()
            return self._send(200, body, "application/json")
        if path == "/healthz":
            return self._send(200, b'{"ok":true,"app":"digitaltechz"}', "application/json")
        rel = "index.html" if path in ("/", "", "/index.html") else path.lstrip("/")
        full = os.path.realpath(os.path.join(APP, rel))
        if not full.startswith(os.path.realpath(APP) + os.sep) or not os.path.isfile(full):
            return self._send(404, b"not found", "text/plain; charset=utf-8")
        with open(full, "rb") as fh:
            body = fh.read()
        return self._send(200, body, TYPES.get(os.path.splitext(full)[1].lower(), "application/octet-stream"))

    do_HEAD = do_GET


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT") or DEFAULT_PORT))
    args = ap.parse_args(argv)
    if not os.path.isfile(os.path.join(APP, "index.html")):
        print("the app file is missing from the plugin folder. Reinstall the kit.", flush=True)
        return 1
    Handler.port = args.port
    httpd = ThreadingHTTPServer((LOCAL, args.port), Handler)
    print("digitaltechz serving on http://localhost:%d" % args.port, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
