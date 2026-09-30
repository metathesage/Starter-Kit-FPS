#!/usr/bin/env python3
"""Minimal players-online server. GET /heartbeat?id=<session> -> {"online": N}. Sessions expire after 45s.
   python3 tools/presence_server.py [port]   then set PRESENCE_URL=http://host:port (or project setting game/presence_url)."""
import json, sys, time, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

TTL = 45
seen: dict[str, float] = {}
lock = threading.Lock()


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        u = urlparse(self.path)
        now = time.time()
        with lock:
            if u.path == "/heartbeat":
                sid = (parse_qs(u.query).get("id") or [""])[0][:32]
                if sid:
                    seen[sid] = now
            for k in [k for k, t in seen.items() if now - t > TTL]:
                del seen[k]
            n = len(seen)
        body = json.dumps({"online": n}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    ThreadingHTTPServer(("0.0.0.0", port), H).serve_forever()
