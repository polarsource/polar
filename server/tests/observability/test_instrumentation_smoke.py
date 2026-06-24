import httpx
import pytest
from fastapi import APIRouter, FastAPI

from polar.logfire import instrument_fastapi


@pytest.mark.asyncio
async def test_instrument_fastapi_resolves_nested_routes() -> None:
    """Guard against FastAPI <-> OpenTelemetry instrumentation skew.

    OTel names each server span by walking ``app.routes`` at *request* time
    (``_get_route_details``). A breaking change in how FastAPI stores routes
    (e.g. 0.137's tree with ``_IncludedRouter`` nodes) makes that walk raise
    mid-request instead of failing at import — so it only shows up once a real
    request flows through the *instrumented*, nested router tree.
    """
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
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as client:
        response = await client.get("/v1/leaf/ping")

    assert response.status_code == 200
    assert response.json() == {"ok": True}
