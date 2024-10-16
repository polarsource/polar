import os
from typing import Literal

import httpx
import logfire
from fastapi import FastAPI
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

from polar.config import settings
from polar.kit.db.postgres import Engine


def configure_logfire(service_name: Literal["server", "worker"]) -> None:
    if settings.is_testing():
        return

    logfire.configure(
        send_to_logfire="if-token-present",
        token=settings.LOGFIRE_TOKEN,
        project_name=settings.LOGFIRE_PROJECT_NAME,
        service_name=service_name,
        service_version=os.environ.get("RELEASE_VERSION", "development"),
        console=False,
    )


def instrument_httpx(client: httpx.AsyncClient | httpx.Client | None = None) -> None:
    if settings.is_testing():
        return

    if client:
        HTTPXClientInstrumentor().instrument_client(client)
    else:
        HTTPXClientInstrumentor().instrument()


def instrument_fastapi(app: FastAPI) -> None:
    if settings.is_testing():
        return

    logfire.instrument_fastapi(
        app,
        excluded_urls=(
            "/healthz$",
            "/readyz$",
        ),
    )


def instrument_sqlalchemy(engine: Engine) -> None:
    if settings.is_testing():
        return

    SQLAlchemyInstrumentor().instrument(engine=engine)


__all__ = [
    "configure_logfire",
    "instrument_fastapi",
    "instrument_sqlalchemy",
]
