import http.server
import queue
import threading
import typing

import httpx
import pytest
from opentelemetry.proto.collector.metrics.v1.metrics_service_pb2 import (
    ExportMetricsServiceRequest,
)
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.metrics.v1.metrics_pb2 import AggregationTemporality

from polar.outpost.telemetry import create_meter_provider, create_tracer_provider

Request = tuple[str, dict[str, str], bytes]


@pytest.fixture
def relay(
    monkeypatch: pytest.MonkeyPatch,
) -> typing.Iterator[tuple[httpx.AsyncClient, queue.Queue[Request]]]:
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_HEADERS", "x-vendor-key=secret")
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_COMPRESSION", "gzip")
    requests: queue.Queue[Request] = queue.Queue()

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
    yield client, requests
    server.shutdown()


def test_relay_ignores_otlp_environment(
    relay: tuple[httpx.AsyncClient, queue.Queue[Request]],
) -> None:
    client, requests = relay
    provider = create_tracer_provider(client)
    provider.get_tracer("test").start_span("outpost.test").end()
    provider.shutdown()

    path, headers, body = requests.get(timeout=5)
    assert path == "/v1/outpost/telemetry"
    assert headers["authorization"] == "Bearer test-token"
    assert headers["content-type"] == "application/x-protobuf"
    assert "x-vendor-key" not in headers
    request = ExportTraceServiceRequest()
    request.ParseFromString(body)
    assert request.resource_spans[0].scope_spans[0].spans[0].name == "outpost.test"


def test_relays_metrics_to_the_metrics_endpoint(
    relay: tuple[httpx.AsyncClient, queue.Queue[Request]],
) -> None:
    client, requests = relay
    provider = create_meter_provider(client)
    provider.get_meter("test").create_counter("outpost.test").add(1)
    provider.shutdown()

    path, headers, body = requests.get(timeout=5)
    assert path == "/v1/outpost/telemetry/metrics"
    assert headers["authorization"] == "Bearer test-token"
    assert headers["content-type"] == "application/x-protobuf"
    assert "x-vendor-key" not in headers
    request = ExportMetricsServiceRequest()
    request.ParseFromString(body)
    metric = request.resource_metrics[0].scope_metrics[0].metrics[0]
    assert metric.name == "outpost.test"
    assert metric.sum.aggregation_temporality == AggregationTemporality.Value(
        "AGGREGATION_TEMPORALITY_DELTA"
    )
