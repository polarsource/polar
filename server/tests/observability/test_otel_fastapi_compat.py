"""Regression tests for OpenTelemetry/Logfire + FastAPI integration.

A FastAPI upgrade combined with an incompatible
``opentelemetry-python-contrib`` release broke route dispatch in production
because the OTel ASGI middleware raised inside the request lifecycle (see
https://github.com/open-telemetry/opentelemetry-python-contrib/issues/4699).
That incident was not caught by existing tests because the rest of the suite
disables instrumentation or mocks at boundaries above the middleware.

These tests exercise a *real* FastAPI app instrumented with
``logfire.instrument_fastapi(..., capture_headers=True)`` — matching
production wiring — and assert both that requests succeed end-to-end and
that spans are actually emitted. An ``InMemorySpanExporter`` is attached to
the already-configured global TracerProvider so nothing is sent upstream.
"""

from collections.abc import AsyncGenerator, Generator

import httpx
import logfire
import pytest
import pytest_asyncio
from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
    InMemorySpanExporter,
)


@pytest.fixture(scope="module")
def span_exporter() -> Generator[InMemorySpanExporter, None, None]:
    """Attach an InMemorySpanExporter to the global TracerProvider.

    ``polar.app`` calls ``configure_logfire("server")`` at import time, which
    sets up the global TracerProvider (a logfire ``ProxyTracerProvider``).
    We piggy-back on that provider so the instrumentation under test runs in
    its production configuration; we just add a synchronous exporter that
    keeps spans in memory instead of shipping them anywhere.
    """
    exporter = InMemorySpanExporter()
    processor = SimpleSpanProcessor(exporter)
    tracer_provider = trace.get_tracer_provider()
    tracer_provider.add_span_processor(processor)
    try:
        yield exporter
    finally:
        processor.shutdown()


@pytest.fixture
def mini_app() -> FastAPI:
    """A minimal FastAPI app instrumented exactly like the production app.

    We intentionally do **not** reuse ``polar.app.app``: that app pulls in
    DB/Redis/Minio middleware which the observability conftest stubs out
    only for autouse fixtures, not for request dispatch. A mini app keeps
    the test focused on the OTel/FastAPI seam.
    """
    app = FastAPI()

    @app.get("/ping")
    async def ping() -> dict[str, bool]:
        return {"pong": True}

    @app.get("/items/{item_id}")
    async def get_item(item_id: str) -> dict[str, str]:
        return {"item_id": item_id}

    logfire.instrument_fastapi(app, capture_headers=True)
    return app


@pytest_asyncio.fixture
async def mini_client(mini_app: FastAPI) -> AsyncGenerator[httpx.AsyncClient, None]:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=mini_app), base_url="http://test"
    ) as client:
        yield client


@pytest.fixture(autouse=True)
def clear_spans(span_exporter: InMemorySpanExporter) -> Generator[None, None, None]:
    span_exporter.clear()
    yield
    span_exporter.clear()


def _route_spans(
    exporter: InMemorySpanExporter, method: str, route: str
) -> list[object]:
    return [
        span
        for span in exporter.get_finished_spans()
        if (span.attributes or {}).get("http.method") == method
        and (span.attributes or {}).get("http.route") == route
    ]


class TestOTelFastAPICompat:
    @pytest.mark.asyncio
    async def test_request_succeeds_with_otel_instrumentation(
        self, mini_client: httpx.AsyncClient
    ) -> None:
        """OTel/Logfire ASGI middleware must not crash route dispatch.

        Regression for the incompatibility between
        ``opentelemetry-instrumentation-asgi`` and newer FastAPI/Starlette
        versions that surfaced as ``500`` responses (or raised exceptions)
        for every request.
        """
        response = await mini_client.get("/ping")

        assert response.status_code == 200
        assert response.json() == {"pong": True}

    @pytest.mark.asyncio
    async def test_span_emitted_with_http_route(
        self,
        mini_client: httpx.AsyncClient,
        span_exporter: InMemorySpanExporter,
    ) -> None:
        """Instrumented requests must produce a span tagged with the route.

        Asserting on ``http.route`` (templated path) rather than ``http.target``
        guards against a regression where the FastAPI integration silently
        stops resolving the matched route — which would leave us unable to
        aggregate metrics or filter traces by endpoint in production.
        """
        await mini_client.get("/items/abc-123")

        matching = _route_spans(span_exporter, method="GET", route="/items/{item_id}")
        assert len(matching) == 1, (
            f"Expected one span for GET /items/{{item_id}}, "
            f"got spans: {[s.name for s in span_exporter.get_finished_spans()]}"
        )

    @pytest.mark.asyncio
    async def test_span_has_status_and_method_attributes(
        self,
        mini_client: httpx.AsyncClient,
        span_exporter: InMemorySpanExporter,
    ) -> None:
        """Spans must carry the core HTTP attributes Logfire dashboards rely on.

        ``http.method`` and ``http.status_code`` are the two attributes our
        operational dashboards (latency, error rate) group by. A silent
        regression that dropped them — e.g. an API shift in
        ``opentelemetry-instrumentation-asgi`` — would empty the dashboards
        even though spans still flow.
        """
        response = await mini_client.get("/ping")
        assert response.status_code == 200

        spans = _route_spans(span_exporter, method="GET", route="/ping")
        assert spans, "expected a span for GET /ping"
        attributes = dict(spans[0].attributes or {})
        assert attributes.get("http.method") == "GET"
        assert attributes.get("http.status_code") == 200

    @pytest.mark.asyncio
    async def test_request_headers_are_captured(
        self,
        mini_client: httpx.AsyncClient,
        span_exporter: InMemorySpanExporter,
    ) -> None:
        """``capture_headers=True`` must keep working after dependency bumps.

        Header capture is what powers debugging of mobile-client and
        client-version issues from traces. If a future upgrade flipped this
        off, traces would silently lose that context.
        """
        await mini_client.get("/ping", headers={"User-Agent": "regression-test/1.0"})

        spans = _route_spans(span_exporter, method="GET", route="/ping")
        assert spans, "expected a span for GET /ping"
        attributes = dict(spans[0].attributes or {})
        user_agent = attributes.get("http.request.header.user_agent")
        assert user_agent is not None
        # The OTel ASGI instrumentation records headers as a tuple of values.
        assert "regression-test/1.0" in tuple(user_agent)
