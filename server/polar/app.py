from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import TypedDict

import structlog
from fastapi import Depends, FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import BaseRoute

from polar import receivers, worker  # noqa
from polar.api import router
from polar.config import settings
from polar.exception_handlers import (
    polar_exception_handler,
    polar_redirection_exception_handler,
)
from polar.exceptions import PolarError, PolarRedirectionError
from polar.health.endpoints import router as health_router
from polar.kit.db.postgres import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_sessionmaker,
)
from polar.logging import Logger
from polar.logging import configure as configure_logging
from polar.middlewares import LogCorrelationIdMiddleware
from polar.postgres import create_engine
from polar.posthog import configure_posthog
from polar.sentry import configure_sentry, set_sentry_user
from polar.tags.api import Tags

log: Logger = structlog.get_logger()


def configure_cors(app: FastAPI) -> None:
    if not settings.CORS_ORIGINS:
        return

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def generate_unique_openapi_id(route: APIRoute) -> str:
    return f"{route.tags[0]}:{route.name}"


class State(TypedDict):
    engine: AsyncEngine
    sessionmaker: async_sessionmaker[AsyncSession]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[State]:
    async with worker.lifespan():
        engine = create_engine("app")
        sessionmaker = create_sessionmaker(engine)

        log.info("Polar API started")

        yield {"engine": engine, "sessionmaker": sessionmaker}

        await engine.dispose()

        log.info("Polar API stopped")


def create_app() -> FastAPI:
    app = FastAPI(
        generate_unique_id_function=generate_unique_openapi_id,
        lifespan=lifespan,
        dependencies=[Depends(set_sentry_user)],
    )
    configure_cors(app)

    app.add_middleware(LogCorrelationIdMiddleware)

    app.add_exception_handler(
        PolarRedirectionError,
        polar_redirection_exception_handler,  # type: ignore
    )
    app.add_exception_handler(PolarError, polar_exception_handler)  # type: ignore

    # /healthz and /readyz
    app.include_router(health_router)

    app.include_router(router)

    return app


configure_logging()
configure_posthog()
configure_sentry()

log.info("Starting Polar API")
app = create_app()


def configure_openapi() -> None:
    show_all_routes = settings.is_development()

    def show(r: BaseRoute) -> bool:
        if show_all_routes:
            return True

        if isinstance(r, APIRoute):
            if Tags.PUBLIC in r.tags:
                return True

        return False

    def format(r: BaseRoute) -> BaseRoute:
        if isinstance(r, APIRoute):
            # remove public/internal from tags
            r.tags = [
                t for t in r.tags if t is not Tags.PUBLIC and t is not Tags.INTERNAL
            ]
        return r

    openapi_schema = get_openapi(
        title="Polar API",
        version="0.1.0",
        openapi_version="3.0.3",
        description="""
Welcome to the **Polar API** for [polar.sh](https://polar.sh).

The Public API is currently a [work in progress](https://github.com/polarsource/polar/issues/834) and is in active development. 🚀

#### Authentication

Use a [Personal Access Token](https://polar.sh/settings) and send it in the `Authorization` header on the format `Bearer [YOUR_TOKEN]`.

#### Feedback

If you have any feedback or comments, reach out in the [Polar API-issue](https://github.com/polarsource/polar/issues/834), or reach out on the Polar Discord server.

We'd love to see what you've built with the API and to get your thoughts on how we can make the API better!

#### Connecting

The Polar API is online at `https://api.polar.sh`.
""",  # noqa: E501
        routes=[format(r) for r in app.routes if show(r)],
        servers=[{"url": "https://api.polar.sh"}],
    )
    openapi_schema["info"]["x-logo"] = {
        "url": "https://blog.polar.sh/content/images/2023/07/Frame-647--1-.png"
    }
    app.openapi_schema = openapi_schema


configure_openapi()
