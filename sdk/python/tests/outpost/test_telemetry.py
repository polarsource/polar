import http.server
import queue
import threading
import typing

import httpx
import pytest
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)

from polar.outpost.telemetry import create_tracer_provider


def test_relay_ignores_otlp_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_HEADERS", "x-vendor-key=secret")
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_COMPRESSION", "gzip")
    requests: queue.Queue[tuple[str, dict[str, str], bytes]] = queue.Queue()

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            body = self.rfile.read(int(self.headers["Content-Length"]))
            headers = {key.lower(): value for key, value in self.headers.items()}
            requests.put((self.path, headers, body))
            self.send_response(200)
            self.end_headers()

        def log_message(self, format: str, *args: typing.Any) -> None:
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    client = httpx.AsyncClient(
        base_url=f"http://127.0.0.1:{server.server_port}",
        headers={"Authorization": "Bearer test-token"},
    )

    provider = create_tracer_provider(client)
    provider.get_tracer("test").start_span("outpost.test").end()
    provider.shutdown()
    server.shutdown()

    path, headers, body = requests.get(timeout=5)
    assert path == "/v1/outpost/telemetry"
    assert headers["authorization"] == "Bearer test-token"
    assert headers["content-type"] == "application/x-protobuf"
    assert "x-vendor-key" not in headers
    request = ExportTraceServiceRequest()
    request.ParseFromString(body)
    assert request.resource_spans[0].scope_spans[0].spans[0].name == "outpost.test"
