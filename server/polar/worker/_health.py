import asyncio
import contextlib
import os
from collections.abc import AsyncGenerator, Callable, Mapping
from datetime import timedelta
from typing import Any

import structlog
import uvicorn
from dramatiq.middleware import Middleware
from redis import RedisError
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from polar.config import settings
from polar.kit.db.postgres import AsyncSessionMaker, create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.postgres import create_async_engine, create_async_read_engine
from polar.redis import Redis, create_redis
from polar.webhook.repository import WebhookEventRepository

log: Logger = structlog.get_logger()

HTTP_HOST = os.getenv("dramatiq_prom_host", "0.0.0.0")
HTTP_PORT = int(os.getenv("dramatiq_prom_port", "9191"))


class HealthMiddleware(Middleware):
    @property
    def forks(self) -> list[Callable[[], int]]:
        return [_run_exposition_server]


async def health(request: Request) -> JSONResponse:
    try:
        redis: Redis = request.state.redis
        await redis.ping()
    except RedisError as e:
        raise HTTPException(status_code=503, detail="Redis is not available") from e

    return JSONResponse({"status": "ok"})


UNDELIVERED_WEBHOOKS_MINIMUM_AGE = timedelta(minutes=5)
UNDELIVERED_WEBHOOKS_ALERT_THRESHOLD = 10


async def webhooks(request: Request) -> JSONResponse:
    async_sessionmaker: AsyncSessionMaker = request.state.async_sessionmaker
    async with async_sessionmaker() as session:
        repository = WebhookEventRepository(session)
        undelivered_webhooks = await repository.get_all_undelivered(
            older_than=utc_now() - UNDELIVERED_WEBHOOKS_MINIMUM_AGE
        )
        if len(undelivered_webhooks) > UNDELIVERED_WEBHOOKS_ALERT_THRESHOLD:
            return JSONResponse(
                {
                    "status": "error",
                    "undelivered_webhooks": len(undelivered_webhooks),
                },
                status_code=503,
            )

    return JSONResponse({"status": "ok"})


@contextlib.asynccontextmanager
async def lifespan(app: Starlette) -> AsyncGenerator[Mapping[str, Any]]:
    if settings.is_read_replica_configured():
        async_engine = create_async_read_engine("worker")
    else:
        async_engine = create_async_engine("worker")
    async_sessionmaker = create_async_sessionmaker(async_engine)
    redis = await create_redis("worker")
    yield {
        "redis": redis,
        "async_sessionmaker": async_sessionmaker,
    }
    await redis.close()
    await async_engine.dispose()


def create_app() -> Starlette:
    routes = [
        Route("/", health, methods=["GET"]),
        Route("/webhooks", webhooks, methods=["GET"]),
    ]
    return Starlette(routes=routes, lifespan=lifespan)


def _run_exposition_server() -> int:
    log.debug("Starting exposition server...")
    app = create_app()
    config = uvicorn.Config(
        app, host=HTTP_HOST, port=HTTP_PORT, log_level="error", access_log=False
    )
    server = uvicorn.Server(config)
    try:
        server.run()
    except asyncio.CancelledError:
        pass

    return 0
