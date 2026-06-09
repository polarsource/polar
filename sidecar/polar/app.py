import asyncio
import logging
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
from polar.customer_meter import merge_customer_meter, snapshot_from_response
from polar.db import engine, get_db_session, init_db
from polar.poll import run_poll_loop
from polar.repository import CustomerMeterRepository, EventRepository
from polar.sync import run_flush_loop
from polar.validation import validate_event

log = logging.getLogger("polar.sidecar.app")

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
    poll_task = asyncio.create_task(run_poll_loop(BASE_URL))
    try:
        yield
    finally:
        flush_task.cancel()
        poll_task.cancel()
        with suppress(asyncio.CancelledError):
            await flush_task
        with suppress(asyncio.CancelledError):
            await poll_task
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


def _upstream_unavailable(status_code: int) -> bool:
    """Polar is unreachable rather than answering — fall back to the cache."""
    return status_code >= 500 or status_code in (408, 429)


async def _cache_meters(
    session: AsyncSession,
    repository: CustomerMeterRepository,
    items: list[dict[str, Any]],
) -> None:
    """Snapshot upstream meters into the cache. Best-effort: a cache write failure
    must not break a read that upstream already answered."""
    try:
        for item in items:
            await repository.upsert(snapshot_from_response(item, datetime.now(UTC)))
        await session.commit()
    except Exception:
        log.exception("failed to cache customer meters")
        await session.rollback()


async def _serve_meter_from_cache(
    id: str, events: EventRepository, cache: CustomerMeterRepository
) -> Response:
    cached = await cache.get_by_id(id)
    if cached is None:
        raise HTTPException(
            status_code=503,
            detail="Polar is unreachable and this customer meter is not cached.",
        )
    return JSONResponse(await merge_customer_meter(events, cached.snapshot))


async def _serve_list_from_cache(
    request: Request, events: EventRepository, cache: CustomerMeterRepository
) -> Response:
    external_customer_id = request.query_params.get("external_customer_id")
    customer_id = request.query_params.get("customer_id")
    if external_customer_id is not None:
        cached = await cache.get_by_external_customer_id(external_customer_id)
    elif customer_id is not None:
        cached = await cache.get_by_customer_id(customer_id)
    else:
        cached = await cache.get_all()
    items = [await merge_customer_meter(events, meter.snapshot) for meter in cached]
    return JSONResponse(
        {"items": items, "pagination": {"total_count": len(items), "max_page": 1}}
    )


@app.get("/v1/customer-meters/")
async def list_customer_meters(
    request: Request, session: AsyncSession = Depends(get_db_session)
) -> Response:
    """Merge the local delta into the upstream list, caching each meter; serve from
    the cache when Polar is unreachable."""
    events = EventRepository(session)
    cache = CustomerMeterRepository(session)
    try:
        upstream = await _forward(request)
    except httpx.RequestError:
        return await _serve_list_from_cache(request, events, cache)
    if _upstream_unavailable(upstream.status_code):
        return await _serve_list_from_cache(request, events, cache)
    if upstream.status_code != 200:
        return _proxied_response(upstream)
    payload = upstream.json()
    await _cache_meters(session, cache, payload["items"])
    payload["items"] = [
        await merge_customer_meter(events, item) for item in payload["items"]
    ]
    return JSONResponse(payload)


@app.get("/v1/customer-meters/{id}")
async def get_customer_meter(
    id: str, request: Request, session: AsyncSession = Depends(get_db_session)
) -> Response:
    """Merge the local delta into the upstream meter, caching it; serve from the
    cache when Polar is unreachable."""
    events = EventRepository(session)
    cache = CustomerMeterRepository(session)
    try:
        upstream = await _forward(request)
    except httpx.RequestError:
        return await _serve_meter_from_cache(id, events, cache)
    if _upstream_unavailable(upstream.status_code):
        return await _serve_meter_from_cache(id, events, cache)
    if upstream.status_code != 200:
        return _proxied_response(upstream)
    item = upstream.json()
    await _cache_meters(session, cache, [item])
    return JSONResponse(await merge_customer_meter(events, item))


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def passthrough(path: str, request: Request) -> Response:
    """Fallback that passes any other request through to the Polar API."""
    return _proxied_response(await _forward(request))
