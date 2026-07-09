import httpx
import pytest
from fastapi import APIRouter, FastAPI
from logfire.testing import CaptureLogfire

from polar.logfire import instrument_fastapi


@pytest.mark.asyncio
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
