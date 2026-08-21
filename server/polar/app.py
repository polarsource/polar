import contextlib
from collections.abc import AsyncIterator
from typing import TypedDict

import structlog
from fastapi import FastAPI

from polar import worker  # noqa
from polar.api import router
from polar.auth.exception_handlers import (
    PolarAuthRedirectionError,
    auth_redirection_error_exception_handler,
)
from polar.auth.middlewares import AuthSubjectMiddleware
from polar.backoffice import app as backoffice_app
from polar.checkout import ip_geolocation
from polar.checkout_link.app import app as checkout_link_redirect_app
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
from polar.kit.versioning import VERSION_HEADER, add_versioned_routers
from polar.logfire import (
    configure_logfire,
    instrument_fastapi,
    instrument_httpx,
    instrument_sqlalchemy,
)
from polar.logging import Logger
from polar.logging import configure as configure_logging
from polar.middlewares import (
    CacheControlMiddleware,
    FlushEnqueuedWorkerJobsMiddleware,
    LogCorrelationIdMiddleware,
    MaxBodySizeMiddleware,
    OperationalErrorMiddleware,
    PathRewriteMiddleware,
    RootPathMiddleware,
    SandboxResponseHeaderMiddleware,
)
from polar.oauth2.endpoints.well_known import router as well_known_router
from polar.oauth2.exception_handlers import OAuth2Error, oauth2_error_exception_handler
from polar.observability.http_middleware import HttpMetricsMiddleware
from polar.observability.memory_profile import (
    start_memory_profiler,
    stop_memory_profiler,
)
from polar.observability.remote_write import (
    start_remote_write_pusher,
    stop_remote_write_pusher,
)
from polar.observability.slo import start_slo_metrics, stop_slo_metrics
from polar.postgres import (
    AsyncSessionMiddleware,
    create_async_engine,
    create_async_read_engine,
    create_sync_engine,
)
from polar.posthog import configure_posthog
from polar.redis import Redis, create_redis
from polar.sentry import configure_sentry
from polar.version import CURRENT_API_VERSION, VERSIONS
from polar.webhook.webhooks import get_webhook_routes

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
        allow_headers=["Authorization", VERSION_HEADER],
        expose_headers=[VERSION_HEADER],
    )
    configs.append(api_config)

    app.add_middleware(CORSMatcherMiddleware, configs=configs)


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

    # Start memory profiler (if configured)
    profiler_enabled = start_memory_profiler()
    if profiler_enabled:
        log.info("memory_profile_enabled")

    # Start HTTP metrics pusher (if configured)
    # Use include_queue_metrics=False since queue metrics are worker-specific
    metrics_enabled = start_remote_write_pusher(include_queue_metrics=False)
    if metrics_enabled:
        log.info("prometheus_remote_write_enabled")

    # Initialize SLO target metrics for critical endpoints (refreshed every 5 minutes)
    start_slo_metrics()

    async_engine = async_read_engine = create_async_engine("app")
    async_sessionmaker = async_read_sessionmaker = create_async_sessionmaker(
        async_engine
    )
    instrument_engines = [async_engine.sync_engine]

    if settings.is_read_replica_configured():
        async_read_engine = create_async_read_engine("app")
        async_read_sessionmaker = create_async_sessionmaker(async_read_engine)
        instrument_engines.append(async_read_engine.sync_engine)

    sync_engine = create_sync_engine("app")
    sync_sessionmaker = create_sync_sessionmaker(sync_engine)
    instrument_engines.append(sync_engine)
    instrument_sqlalchemy(instrument_engines)

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

    # Stop background threads
    stop_memory_profiler()
    stop_slo_metrics()
    stop_remote_write_pusher()

    await redis.close(True)
    rate_limit_redis = getattr(app.state, "rate_limit_redis", None)
    if rate_limit_redis is not None:
        await rate_limit_redis.close(True)
    await async_engine.dispose()
    if async_read_engine is not async_engine:
        await async_read_engine.dispose()
    sync_engine.dispose()
    if ip_geolocation_client is not None:
        ip_geolocation_client.close()

    log.info("Polar API stopped")


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan, openapi_url=None)

    app.add_middleware(OperationalErrorMiddleware)
    if settings.is_sandbox():
        app.add_middleware(SandboxResponseHeaderMiddleware)
    app.add_middleware(CacheControlMiddleware)
    if not settings.is_testing():
        rate_limit_redis = create_redis("rate-limit")
        app.state.rate_limit_redis = rate_limit_redis
        app.add_middleware(AuthSubjectMiddleware, redis=rate_limit_redis)
        app.add_middleware(FlushEnqueuedWorkerJobsMiddleware)
        app.add_middleware(AsyncSessionMiddleware)
        app.add_middleware(rate_limit.get_middleware, redis=rate_limit_redis)
    app.add_middleware(PathRewriteMiddleware, pattern=r"^/api/v1", replacement="/v1")
    if settings.is_vercel():
        # The app origin mounts the API at /api (api.* hosts serve it
        # unprefixed), so prefixed requests must generate prefixed URLs.
        app.add_middleware(RootPathMiddleware, prefix="/api")
    app.add_middleware(LogCorrelationIdMiddleware)
    app.add_middleware(MaxBodySizeMiddleware, limit=settings.API_MAX_REQUEST_BODY_SIZE)
    if not settings.is_testing():
        app.add_middleware(HttpMetricsMiddleware)

    configure_cors(app)

    add_exception_handlers(app)
    app.add_exception_handler(OAuth2Error, oauth2_error_exception_handler)
    app.add_exception_handler(
        PolarAuthRedirectionError, auth_redirection_error_exception_handler
    )

    # /.well-known
    app.include_router(well_known_router)

    # /healthz
    app.include_router(health_router)

    if settings.BACKOFFICE_HOST is None:
        app.mount("/backoffice", backoffice_app)
    else:
        app.host(settings.BACKOFFICE_HOST, backoffice_app)

    if settings.CHECKOUT_LINK_HOST is not None:
        app.host(settings.CHECKOUT_LINK_HOST, checkout_link_redirect_app)

    add_versioned_routers(
        app,
        router,
        get_webhook_routes(),
        VERSIONS,
        CURRENT_API_VERSION,
    )

    return app


configure_sentry()
configure_logfire("server")
configure_logging(logfire=True)
configure_posthog()

app = create_app()
instrument_fastapi(app)
instrument_httpx()
