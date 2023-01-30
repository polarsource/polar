import structlog
from fastapi import FastAPI

from polar.api import router
from polar.logging import configure as configure_logging

log = structlog.get_logger()


def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    return app


configure_logging()
log.info("Starting Polar API")
app = create_app()
