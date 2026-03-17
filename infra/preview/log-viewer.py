#!/usr/bin/env python3
"""Minimal log viewer for preview environments. Serves journalctl output over HTTP."""

import os
import subprocess
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from html import escape

HTML_TEMPLATE = """\
<!DOCTYPE html>
<html>
<head>
<title>Logs: {service} (PR {pr})</title>
<meta http-equiv="refresh" content="5">
<style>
  body {{ background: #1a1a2e; color: #e0e0e0; font-family: monospace; margin: 0; padding: 16px; }}
  pre {{ white-space: pre-wrap; word-wrap: break-word; font-size: 13px; line-height: 1.5; }}
  h1 {{ font-size: 16px; color: #8888cc; margin: 0 0 12px 0; }}
  a {{ color: #8888cc; }}
  nav {{ margin-bottom: 12px; }}
</style>
</head>
<body>
<h1>PR {pr} &mdash; {service}</h1>
<nav>
  <a href="/pr-{pr}/backend">backend</a> |
  <a href="/pr-{pr}/frontend">frontend</a> |
  <a href="/pr-{pr}/backend?n=2000">backend (2000)</a> |
  <a href="/pr-{pr}/frontend?n=2000">frontend (2000)</a>
</nav>
<pre>{logs}</pre>
<script>window.scrollTo(0, document.body.scrollHeight);</script>
</body>
</html>
"""


WAKE_HTML = """\
<!DOCTYPE html>
<html>
<head>
<title>Waking PR {pr}</title>
<meta http-equiv="refresh" content="3">
<style>
  body {{ background: #1a1a2e; color: #e0e0e0; font-family: monospace;
         display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
  .box {{ text-align: center; }}
  h1 {{ font-size: 18px; color: #8888cc; }}
  p {{ color: #888; font-size: 14px; }}
</style>
</head>
<body>
<div class="box">
  <h1>PR {pr} preview is hibernating</h1>
  <p>Waking up... this page will refresh automatically.</p>
</div>
</body>
</html>
"""

TRIGGER_DIR = "/srv/preview-triggers"


class LogHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        query = self.path.split("?")[1] if "?" in self.path else ""

        wake_match = re.match(r"/wake/pr-(\d+)$", path)
        if wake_match:
            pr_num = int(wake_match.group(1))
            trigger = os.path.join(TRIGGER_DIR, f"pr-{pr_num}.wake")
            try:
                open(trigger, "w").close()
            except OSError:
                pass
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(WAKE_HTML.format(pr=pr_num).encode())
            return

        match = re.match(r"/pr-(\d+)/(backend|frontend)", path)
        if not match:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Usage: /pr-{num}/backend or /pr-{num}/frontend")
            return

        pr_num = match.group(1)
        service = match.group(2)
        unit = f"polar-preview-{service}@{pr_num}"

        n = "500"
        for param in query.split("&"):
            if param.startswith("n="):
                n = param[2:]

        result = subprocess.run(
            ["journalctl", "-u", unit, "-n", n, "--no-pager"],
            capture_output=True,
            text=True,
        )

        html = HTML_TEMPLATE.format(
            pr=pr_num,
            service=service,
            logs=escape(result.stdout or result.stderr or "No logs found"),
        )

        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 9999), LogHandler)
    print("Log viewer listening on 127.0.0.1:9999")
    server.serve_forever()
