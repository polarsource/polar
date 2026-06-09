import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from polar_sdk.models import EventsIngest, EventsIngestResponse

from polar.config import get_base_url
from polar.db import async_session, engine, init_db
from polar.repository import EventRepository
from polar.sync import run_flush_loop

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
async def ingest_events(ingest: EventsIngest, request: Request) -> EventsIngestResponse:
    """Buffer ingested events locally; the sync loop forwards them upstream."""
    raw = await request.json()
    timestamp = datetime.now(UTC).isoformat()
    errors: list[dict[str, Any]] = []
    bodies: list[dict[str, Any]] = []
    for index, event in enumerate(raw["events"]):
        external_id = event.get("external_id")
        if not isinstance(external_id, str) or not external_id:
            errors.append(
                {
                    "type": "missing",
                    "loc": ["body", "events", index, "external_id"],
                    "msg": "external_id is required.",
                    "input": external_id,
                }
            )
            continue
        body: dict[str, Any] = {**event}
        body.setdefault("timestamp", timestamp)
        bodies.append(body)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    async with async_session() as session:
        repository = EventRepository(session)
        inserted, duplicates = await repository.buffer(bodies)
        await session.commit()
    return EventsIngestResponse(inserted=inserted, duplicates=duplicates)


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def passthrough(path: str, request: Request) -> Response:
    """Fallback that passes any other request through to the Polar API."""
    client: httpx.AsyncClient = request.app.state.client
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in HOP_BY_HOP
    }
    upstream = await client.request(
        request.method,
        f"/{path}",
        params=request.query_params,
        headers=headers,
        content=await request.body(),
    )
    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in HOP_BY_HOP
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
    )
