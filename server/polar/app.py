import contextlib
from collections.abc import AsyncIterator
from typing import TypedDict

import structlog
from fastapi import FastAPI
from fastapi.routing import APIRoute

from polar import receivers, worker  # noqa
from polar.api import router
from polar.config import settings
from polar.exception_handlers import add_exception_handlers
from polar.health.endpoints import router as health_router
from polar.kit.cors import CORSConfig, CORSMatcherMiddleware, Scope
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
    PathRewriteMiddleware,
    SandboxResponseHeaderMiddleware,
)
from polar.oauth2.endpoints.well_known import router as well_known_router
from polar.oauth2.exception_handlers import OAuth2Error, oauth2_error_exception_handler
from polar.openapi import OPENAPI_PARAMETERS, APITag, set_openapi_generator
from polar.postgres import create_async_engine, create_sync_engine
from polar.posthog import configure_posthog
from polar.sentry import configure_sentry
from polar.webhook.webhooks import document_webhooks
from polar.worker import ArqRedis
from polar.worker import lifespan as worker_lifespan

log: Logger = structlog.get_logger()


def configure_cors(app: FastAPI) -> None:
    configs: list[CORSConfig] = []

    # Polar frontend CORS configuration
    if settings.CORS_ORIGINS:

        def polar_frontend_matcher(origin: str, scope: Scope) -> bool:
            return origin in settings.CORS_ORIGINS

        polar_frontend_config = CORSConfig(
            polar_frontend_matcher,
            allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
            allow_credentials=True,  # Cookies are allowed, but only there!
            allow_methods=["*"],
            allow_headers=["*"],
        )
        configs.append(polar_frontend_config)

    # External API calls CORS configuration
    api_config = CORSConfig(
        lambda origin, scope: True,
        allow_origins=["*"],
        allow_credentials=False,  # No cookies allowed
        allow_methods=["*"],
        allow_headers=["Authorization"],  # Allow Authorization header to pass tokens
    )
    configs.append(api_config)

    app.add_middleware(CORSMatcherMiddleware, configs=configs)


def generate_unique_openapi_id(route: APIRoute) -> str:
    parts = [str(tag) for tag in route.tags if tag not in APITag] + [route.name]
    return ":".join(parts)


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

    app.add_middleware(PathRewriteMiddleware, pattern=r"^/api/v1", replacement="/v1")
    app.add_middleware(FlushEnqueuedWorkerJobsMiddleware)
    app.add_middleware(LogCorrelationIdMiddleware)
    if settings.is_sandbox():
        app.add_middleware(SandboxResponseHeaderMiddleware)

    add_exception_handlers(app)
    app.add_exception_handler(OAuth2Error, oauth2_error_exception_handler)  # pyright: ignore

    # /.well-known
    app.include_router(well_known_router)

    # /healthz and /readyz
    app.include_router(health_router)

    app.include_router(router)
    document_webhooks(app)

    return app


configure_sentry()
configure_logfire("server")
configure_logging(logfire=True)
configure_posthog()

app = create_app()
set_openapi_generator(app)
instrument_fastapi(app)
instrument_httpx()
