#!/usr/bin/env python3
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

UNITS = {
    "/_logs/backend": "polar-backend",
    "/_logs/frontend": "polar-frontend",
    "/_logs/seed": "polar-seed-simple-complement",
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        unit = UNITS.get(self.path.split("?")[0].rstrip("/"))
        if unit is None:
            self.send_error(404)
            return
        logs = subprocess.run(
            ["journalctl", "-u", unit, "-n", "500", "--no-pager", "-o", "short-iso"],
            capture_output=True,
            text=True,
        ).stdout
        body = logs.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


HTTPServer(("127.0.0.1", 9990), Handler).serve_forever()
