import contextlib
from collections.abc import AsyncIterator
from typing import TypedDict

import structlog
from fastapi import FastAPI
from fastapi.routing import APIRoute

from polar import worker  # noqa
from polar.api import router
from polar.auth.middlewares import AuthSubjectMiddleware
from polar.checkout import ip_geolocation
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
from polar.postgres import (
    AsyncSessionMiddleware,
    create_async_engine,
    create_async_read_engine,
    create_sync_engine,
)
from polar.posthog import configure_posthog
from polar.redis import Redis, create_redis
from polar.sentry import configure_sentry
from polar.web_backoffice import app as backoffice_app
from polar.webhook.webhooks import document_webhooks

from . import rate_limit

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
    async_read_engine: AsyncEngine
    async_read_sessionmaker: AsyncSessionMaker
    sync_engine: Engine
    sync_sessionmaker: SyncSessionMaker

    redis: Redis
    ip_geolocation_client: ip_geolocation.IPGeolocationClient | None


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[State]:
    log.info("Starting Polar API")

    async_engine = async_read_engine = create_async_engine("app")
    async_sessionmaker = async_read_sessionmaker = create_async_sessionmaker(
        async_engine
    )
    instrument_sqlalchemy(async_engine.sync_engine)

    if settings.is_read_replica_configured():
        async_read_engine = create_async_read_engine("app")
        async_read_sessionmaker = create_async_sessionmaker(async_read_engine)
        instrument_sqlalchemy(async_read_engine.sync_engine)

    sync_engine = create_sync_engine("app")
    sync_sessionmaker = create_sync_sessionmaker(sync_engine)
    instrument_sqlalchemy(sync_engine)

    redis = create_redis("app")

    try:
        ip_geolocation_client = ip_geolocation.get_client()
    except FileNotFoundError:
        log.info(
            "IP geolocation database not found. "
            "Checkout won't automatically geolocate IPs."
        )
        ip_geolocation_client = None

    log.info("Polar API started")

    yield {
        "async_engine": async_engine,
        "async_sessionmaker": async_sessionmaker,
        "async_read_engine": async_read_engine,
        "async_read_sessionmaker": async_read_sessionmaker,
        "sync_engine": sync_engine,
        "sync_sessionmaker": sync_sessionmaker,
        "redis": redis,
        "ip_geolocation_client": ip_geolocation_client,
    }

    await redis.close(True)
    await async_engine.dispose()
    if async_read_engine is not async_engine:
        await async_read_engine.dispose()
    sync_engine.dispose()
    if ip_geolocation_client is not None:
        ip_geolocation_client.close()

    log.info("Polar API stopped")


def create_app() -> FastAPI:
    app = FastAPI(
        generate_unique_id_function=generate_unique_openapi_id,
        lifespan=lifespan,
        **OPENAPI_PARAMETERS,
    )

    if settings.is_sandbox():
        app.add_middleware(SandboxResponseHeaderMiddleware)
    if not settings.is_testing():
        app.add_middleware(rate_limit.get_middleware)
        app.add_middleware(AuthSubjectMiddleware)
        app.add_middleware(FlushEnqueuedWorkerJobsMiddleware)
        app.add_middleware(AsyncSessionMiddleware)
    app.add_middleware(PathRewriteMiddleware, pattern=r"^/api/v1", replacement="/v1")
    app.add_middleware(LogCorrelationIdMiddleware)

    configure_cors(app)

    add_exception_handlers(app)
    app.add_exception_handler(OAuth2Error, oauth2_error_exception_handler)  # pyright: ignore

    # /.well-known
    app.include_router(well_known_router)

    # /healthz
    app.include_router(health_router)

    app.mount("/backoffice", backoffice_app)

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
