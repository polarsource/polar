from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, Response

from polar.config import get_base_url
from polar.db import engine, init_db

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
    try:
        yield
    finally:
        await app.state.client.aclose()
        await engine.dispose()


app = FastAPI(title="Polar Sidecar", lifespan=lifespan)


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
