import os
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

import structlog
from dramatiq.middleware import Middleware

from polar.logging import Logger

log: Logger = structlog.get_logger()

HTTP_HOST = os.getenv("dramatiq_prom_host", "0.0.0.0")
HTTP_PORT = int(os.getenv("dramatiq_prom_port", "9191"))


class HealthMiddleware(Middleware):
    @property
    def forks(self) -> list[Callable[[], int]]:
        return [_run_exposition_server]


class _handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status": "ok"}')

    def log_message(self, format: str, *args: Any) -> None:
        log.debug(format, *args)


def _run_exposition_server() -> int:
    log.debug("Starting exposition server...")

    address = (HTTP_HOST, HTTP_PORT)
    httpd = HTTPServer(address, _handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log.debug("Stopping exposition server...")
        httpd.shutdown()

    return 0
