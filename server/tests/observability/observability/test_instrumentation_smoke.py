import httpx
import logfire
import pytest
from fastapi import APIRouter, FastAPI
from logfire.testing import CaptureLogfire, TestExporter
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from polar.logfire import instrument_fastapi
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

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
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

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
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
