import structlog
from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from polar import receivers  # noqa
from polar.api import router
from polar.config import settings
from polar.logging import configure as configure_logging

log = structlog.get_logger()


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


def create_app() -> FastAPI:
    app = FastAPI(generate_unique_id_function=generate_unique_openapi_id)
    configure_cors(app)
    app.include_router(router)
    return app


configure_logging()
log.info("Starting Polar API")
app = create_app()
