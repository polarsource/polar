import asyncio
import contextlib
import os
from collections.abc import AsyncGenerator, Callable, Mapping
from datetime import timedelta
from typing import Any

import logfire
import structlog
import uvicorn
from dramatiq.middleware import Middleware
from redis import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from polar.external_event.repository import ExternalEventRepository
from polar.kit.db.postgres import AsyncSessionMaker, create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.logfire import configure_logfire
from polar.logging import Logger
from polar.logging import configure as configure_logging
from polar.postgres import AsyncEngine, create_async_engine
from polar.redis import Redis, create_redis
from polar.webhook.repository import WebhookEventRepository

log: Logger = structlog.get_logger()

HTTP_HOST = os.getenv("dramatiq_prom_host", "0.0.0.0")
HTTP_PORT = int(os.getenv("dramatiq_prom_port", "9191"))

_heartbeat_checker: Callable[[], bool] | None = None


def set_heartbeat_checker(checker: Callable[[], bool]) -> None:
    global _heartbeat_checker
    _heartbeat_checker = checker


class HealthMiddleware(Middleware):
    def __init__(self, *, database: bool = True) -> None:
        self._database = database

    @property
    def forks(self) -> list[Callable[[], int]]:
        if self._database:
            return [_run_exposition_server]
        return [_run_exposition_server_without_db]


async def health(request: Request) -> JSONResponse:
    try:
        redis: Redis = request.state.redis
        await redis.ping()
    except RedisError as e:
        raise HTTPException(status_code=503, detail="Redis is not available") from e

    async_sessionmaker: AsyncSessionMaker | None = getattr(
        request.state, "async_sessionmaker", None
    )
    if async_sessionmaker is not None:
        try:
            async with async_sessionmaker() as session:
                await session.execute(text("SELECT 1"))
        except SQLAlchemyError as e:
            raise HTTPException(
                status_code=503, detail="Database is not available"
            ) from e

    if _heartbeat_checker is not None and not _heartbeat_checker():
        raise HTTPException(status_code=503, detail="Scheduler heartbeat is stale")

    return JSONResponse({"status": "ok"})


UNDELIVERED_WEBHOOKS_MINIMUM_AGE = timedelta(minutes=5)
UNDELIVERED_WEBHOOKS_MAXIMUM_AGE = timedelta(hours=6)
UNDELIVERED_WEBHOOKS_ALERT_THRESHOLD = 10

UNHANDLED_EXTERNAL_EVENTS_MINIMUM_AGE = timedelta(minutes=5)
UNHANDLED_EXTERNAL_EVENTS_ALERT_THRESHOLD = 10


async def webhooks(request: Request) -> JSONResponse:
    async_sessionmaker: AsyncSessionMaker = request.state.async_sessionmaker
    async with async_sessionmaker() as session:
        repository = WebhookEventRepository(session)
        undelivered_webhooks = await repository.get_all_undelivered(
            older_than=utc_now() - UNDELIVERED_WEBHOOKS_MINIMUM_AGE,
            newer_than=utc_now() - UNDELIVERED_WEBHOOKS_MAXIMUM_AGE,
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


async def external_events(request: Request) -> JSONResponse:
    async_sessionmaker: AsyncSessionMaker = request.state.async_sessionmaker
    async with async_sessionmaker() as session:
        repository = ExternalEventRepository(session)
        unhandled_events = await repository.get_all_unhandled(
            older_than=utc_now() - UNHANDLED_EXTERNAL_EVENTS_MINIMUM_AGE
        )
        if len(unhandled_events) > UNHANDLED_EXTERNAL_EVENTS_ALERT_THRESHOLD:
            return JSONResponse(
                {
                    "status": "error",
                    "unhandled_external_events": len(unhandled_events),
                },
                status_code=503,
            )

    return JSONResponse({"status": "ok"})


def _create_lifespan(
    *, database: bool
) -> Callable[[Starlette], contextlib.AbstractAsyncContextManager[Mapping[str, Any]]]:
    @contextlib.asynccontextmanager
    async def lifespan(app: Starlette) -> AsyncGenerator[Mapping[str, Any]]:
        redis = create_redis("worker")
        state: dict[str, Any] = {"redis": redis}

        async_engine: AsyncEngine | None = None
        if database:
            async_engine = create_async_engine("worker")
            state["async_sessionmaker"] = create_async_sessionmaker(async_engine)

        yield state

        await redis.close()
        if async_engine is not None:
            await async_engine.dispose()

    return lifespan


async def handle_server_error(request: Request, exc: Exception) -> JSONResponse:
    logfire.exception(f"Worker health server error on {request.url.path}")
    return JSONResponse({"status": "error"}, status_code=500)


def create_app(*, database: bool = True) -> Starlette:
    routes = [Route("/", health, methods=["GET"])]
    # The webhooks and external-events probes query PostgreSQL; only expose them
    # when the worker has a database.
    if database:
        routes += [
            Route("/webhooks", webhooks, methods=["GET"]),
            Route("/unhandled-external-events", external_events, methods=["GET"]),
        ]
    return Starlette(
        routes=routes,
        lifespan=_create_lifespan(database=database),
        exception_handlers={Exception: handle_server_error},
    )


def _run_server(*, database: bool) -> int:
    log.debug("Starting exposition server...")
    configure_logfire("worker")
    configure_logging(logfire=True)
    app = create_app(database=database)
    config = uvicorn.Config(
        app, host=HTTP_HOST, port=HTTP_PORT, log_level="error", access_log=False
    )
    server = uvicorn.Server(config)
    try:
        server.run()
    except asyncio.CancelledError:
        pass

    return 0


def _run_exposition_server() -> int:
    return _run_server(database=True)


def _run_exposition_server_without_db() -> int:
    return _run_server(database=False)
