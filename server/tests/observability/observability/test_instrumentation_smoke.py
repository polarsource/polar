from importlib import import_module

import httpx2
import logfire
import pytest
from fastapi import APIRouter, FastAPI
from logfire.testing import CaptureLogfire, TestExporter
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import SpanKind

from polar.logfire import instrument_fastapi, instrument_httpx
from polar.observability.http_telemetry import HttpURLSpanProcessor


@pytest.mark.anyio
async def test_instrument_fastapi(
    capfire: CaptureLogfire,
) -> None:
    leaf = APIRouter()

    @leaf.get("/ping")
    async def ping() -> dict[str, bool]:
        return {"ok": True}

    mid = APIRouter()
    mid.include_router(leaf, prefix="/leaf")
    app = FastAPI()
    app.include_router(mid, prefix="/v1")

    instrument_fastapi(app)  # same call as polar/app.py:264

    transport = httpx2.ASGITransport(app=app)
    async with httpx2.AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        full_match = await client.get("/v1/leaf/ping")
        """The wrong-method request exercises partial route matching,
        the only path that catches instrumentation breaking against FastAPI internals."""
        partial_match = await client.post("/v1/leaf/ping")

    assert full_match.status_code == 200
    assert partial_match.status_code == 405

    routes = {
        span.attributes.get("http.route")
        for span in capfire.exporter.exported_spans
        if span.attributes is not None
    }
    assert "/v1/leaf/ping" in routes


@pytest.mark.anyio
async def test_instrument_fastapi_host_routed_app_hides_path_values() -> None:
    exporter = TestExporter()
    logfire.configure(
        send_to_logfire=False,
        console=False,
        additional_span_processors=[
            HttpURLSpanProcessor(),
            SimpleSpanProcessor(exporter),
        ],
    )

    host_app = FastAPI()

    @host_app.get("/{client_secret}")
    async def redirect(client_secret: str) -> dict[str, bool]:
        return {"ok": True}

    app = FastAPI()
    app.host("buy.example.com", host_app)
    instrument_fastapi(app)

    transport = httpx2.ASGITransport(app=app)
    async with httpx2.AsyncClient(
        transport=transport, base_url="http://buy.example.com"
    ) as client:
        response = await client.get("/polar_cl_secret?customer_email=a@example.com")

    assert response.status_code == 200
    spans = exporter.exported_spans
    assert any(
        span.attributes and span.attributes.get("http.route") == "/{client_secret}"
        for span in spans
    )
    for span in spans:
        serialized = f"{span.name} {dict(span.attributes or {})}"
        assert "polar_cl_secret" not in serialized
        assert "a@example.com" not in serialized


@pytest.mark.anyio
@pytest.mark.parametrize("module_name", ["httpx", "httpx2"])
async def test_instrument_http_clients_hides_request_values(module_name: str) -> None:
    http = import_module(module_name)
    core = import_module("httpcore2" if module_name == "httpx2" else "httpcore")
    exporter = TestExporter()
    logfire.configure(
        send_to_logfire=False,
        console=False,
        additional_span_processors=[
            HttpURLSpanProcessor(),
            SimpleSpanProcessor(exporter),
        ],
    )
    instrument_httpx()
    response_bytes = b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n"
    transport = http.HTTPTransport()
    transport._pool._network_backend = core.MockBackend([response_bytes])
    with http.Client(transport=transport) as client:
        response = client.get("https://example.com/private-token?email=a@example.com")
        assert response.status_code == 200

    async_transport = http.AsyncHTTPTransport()
    async_transport._pool._network_backend = core.AsyncMockBackend([response_bytes])
    async with http.AsyncClient(transport=async_transport) as client:
        response = await client.get(
            "https://example.com/private-token?email=a@example.com"
        )
        assert response.status_code == 200

    spans = [span for span in exporter.exported_spans if span.kind == SpanKind.CLIENT]
    assert (
        len(
            [
                span
                for span in spans
                if (span.attributes or {}).get("logfire.span_type") != "pending_span"
            ]
        )
        == 2
    )
    for span in spans:
        serialized = f"{span.name} {dict(span.attributes or {})}"
        assert "private-token" not in serialized
        assert "a@example.com" not in serialized
