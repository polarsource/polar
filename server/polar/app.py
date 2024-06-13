import contextlib
from collections.abc import AsyncIterator
from os import environ
from typing import TypedDict

import structlog
from fastapi import FastAPI
from fastapi.routing import APIRoute

from polar import receivers, worker  # noqa
from polar.api import router
from polar.config import settings
from polar.exception_handlers import add_exception_handlers
from polar.health.endpoints import router as health_router
from polar.kit.cors.cors import CallbackCORSMiddleware
from polar.kit.cors.custom_domain_cors import is_allowed_custom_domain
from polar.kit.db.postgres import (
    AsyncEngine,
    AsyncSessionMaker,
    Engine,
    SyncSessionMaker,
    create_async_sessionmaker,
    create_sync_sessionmaker,
)
from polar.logfire import (
    configure_logfire,
    instrument_fastapi,
    instrument_httpx,
    instrument_sqlalchemy,
)
from polar.logging import Logger
from polar.logging import configure as configure_logging
from polar.middlewares import (
    FlushEnqueuedWorkerJobsMiddleware,
    LogCorrelationIdMiddleware,
    XForwardedHostMiddleware,
)
from polar.oauth2.endpoints.well_known import router as well_known_router
from polar.oauth2.exception_handlers import OAuth2Error, oauth2_error_exception_handler
from polar.openapi import OPENAPI_PARAMETERS
from polar.postgres import create_async_engine, create_sync_engine
from polar.posthog import configure_posthog
from polar.sentry import configure_sentry
from polar.worker import ArqRedis
from polar.worker import lifespan as worker_lifespan

log: Logger = structlog.get_logger()


def configure_cors(app: FastAPI) -> None:
    if not settings.CORS_ORIGINS:
        return

    app.add_middleware(
        CallbackCORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        is_allowed_origin_hook=is_allowed_custom_domain,
    )


def generate_unique_openapi_id(route: APIRoute) -> str:
    return f"{route.tags[0]}:{route.name}"


class State(TypedDict):
    async_engine: AsyncEngine
    async_sessionmaker: AsyncSessionMaker
    sync_engine: Engine
    sync_sessionmaker: SyncSessionMaker
    arq_pool: ArqRedis


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[State]:
    log.info("Starting Polar API")

    async with worker_lifespan() as arq_pool:
        async_engine = create_async_engine("app")
        async_sessionmaker = create_async_sessionmaker(async_engine)
        instrument_sqlalchemy(async_engine.sync_engine)

        sync_engine = create_sync_engine("app")
        sync_sessionmaker = create_sync_sessionmaker(sync_engine)
        instrument_sqlalchemy(sync_engine)

        log.info("Polar API started")

        yield {
            "async_engine": async_engine,
            "async_sessionmaker": async_sessionmaker,
            "sync_engine": sync_engine,
            "sync_sessionmaker": sync_sessionmaker,
            "arq_pool": arq_pool,
        }

        await async_engine.dispose()
        sync_engine.dispose()

        log.info("Polar API stopped")


def create_app() -> FastAPI:
    app = FastAPI(
        generate_unique_id_function=generate_unique_openapi_id,
        lifespan=lifespan,
        **OPENAPI_PARAMETERS,
    )
    configure_cors(app)

    app.add_middleware(FlushEnqueuedWorkerJobsMiddleware)
    app.add_middleware(
        XForwardedHostMiddleware,
        trusted_hosts=environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1"),
    )
    app.add_middleware(LogCorrelationIdMiddleware)

    add_exception_handlers(app)
    app.add_exception_handler(OAuth2Error, oauth2_error_exception_handler)  # pyright: ignore

    # /.well-known
    app.include_router(well_known_router)

    # /healthz and /readyz
    app.include_router(health_router)

    app.include_router(router)
    return app


configure_sentry()
configure_logfire("server")
configure_logging(logfire=True)
configure_posthog()

app = create_app()
instrument_fastapi(app)
instrument_httpx()
