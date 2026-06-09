import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from polar_sdk.models import EventsIngest, EventsIngestResponse
from sqlalchemy.ext.asyncio import AsyncSession

from polar.config import get_base_url
from polar.customer_meter import merge_customer_meter
from polar.db import engine, get_db_session, init_db
from polar.repository import EventRepository
from polar.sync import run_flush_loop
from polar.validation import validate_event

BASE_URL = get_base_url()

# Hop-by-hop headers that must not be forwarded when proxying.
HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await init_db()
    app.state.client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)
    flush_task = asyncio.create_task(run_flush_loop(BASE_URL))
    try:
        yield
    finally:
        flush_task.cancel()
        with suppress(asyncio.CancelledError):
            await flush_task
        await app.state.client.aclose()
        await engine.dispose()


app = FastAPI(title="Polar Sidecar", lifespan=lifespan)


@app.post(
    "/v1/events/ingest", summary="Ingest Events", response_model=EventsIngestResponse
)
async def ingest_events(
    ingest: EventsIngest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> EventsIngestResponse:
    """Buffer ingested events locally; the sync loop forwards them upstream."""
    raw = await request.json()
    errors: list[dict[str, Any]] = []
    for index, event in enumerate(ingest.events):
        errors.extend(validate_event(index, event))
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    timestamp = datetime.now(UTC).isoformat()
    bodies: list[dict[str, Any]] = []
    for raw_event in raw["events"]:
        body: dict[str, Any] = {**raw_event}
        body.setdefault("timestamp", timestamp)
        bodies.append(body)
    repository = EventRepository(session)
    inserted, duplicates = await repository.buffer(bodies)
    await session.commit()
    return EventsIngestResponse(inserted=inserted, duplicates=duplicates)


async def _forward(request: Request) -> httpx.Response:
    client: httpx.AsyncClient = request.app.state.client
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in HOP_BY_HOP
    }
    return await client.request(
        request.method,
        request.url.path,
        params=request.query_params,
        headers=headers,
        content=await request.body(),
    )


def _proxied_response(upstream: httpx.Response) -> Response:
    headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in HOP_BY_HOP
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=headers,
    )


@app.get("/v1/customer-meters/")
async def list_customer_meters(
    request: Request, session: AsyncSession = Depends(get_db_session)
) -> Response:
    """Pass through the upstream list, merging the local delta into each meter."""
    upstream = await _forward(request)
    if upstream.status_code != 200:
        return _proxied_response(upstream)
    payload = upstream.json()
    repository = EventRepository(session)
    payload["items"] = [
        await merge_customer_meter(repository, item) for item in payload["items"]
    ]
    return JSONResponse(payload)


@app.get("/v1/customer-meters/{id}")
async def get_customer_meter(
    id: str, request: Request, session: AsyncSession = Depends(get_db_session)
) -> Response:
    """Pass through the upstream meter, merging in the local delta."""
    upstream = await _forward(request)
    if upstream.status_code != 200:
        return _proxied_response(upstream)
    repository = EventRepository(session)
    merged = await merge_customer_meter(repository, upstream.json())
    return JSONResponse(merged)


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def passthrough(path: str, request: Request) -> Response:
    """Fallback that passes any other request through to the Polar API."""
    return _proxied_response(await _forward(request))
