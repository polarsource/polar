import os
from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING, Literal

import httpx
import logfire
from fastapi import FastAPI
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.trace.sampling import (
    ALWAYS_OFF,
    ALWAYS_ON,
    ParentBased,
    Sampler,
    SamplingResult,
)

if TYPE_CHECKING:
    from opentelemetry.context import Context
    from opentelemetry.trace import Link, SpanKind
    from opentelemetry.trace.span import TraceState
    from opentelemetry.util.types import Attributes


from polar.config import settings
from polar.kit.db.postgres import Engine

Matcher = Callable[[str, "Attributes | None"], bool]


class IgnoreSampler(Sampler):
    def __init__(self, matchers: Sequence[Matcher]) -> None:
        super().__init__()
        self.matchers = matchers

    def should_sample(
        self,
        parent_context: "Context | None",
        trace_id: int,
        name: str,
        kind: "SpanKind | None" = None,
        attributes: "Attributes | None" = None,
        links: Sequence["Link"] | None = None,
        trace_state: "TraceState | None" = None,
    ) -> SamplingResult:
        sampler = ALWAYS_ON

        for matcher in self.matchers:
            if matcher(name, attributes):
                sampler = ALWAYS_OFF
                break

        return sampler.should_sample(
            parent_context,
            trace_id,
            name,
            kind,
            attributes,
            links,
            trace_state,
        )

    def get_description(self) -> str:
        return "IgnoreSampler"


def _healthz_matcher(name: str, attributes: "Attributes | None") -> bool:
    return attributes is not None and attributes.get("http.route") == "/healthz"


def _worker_health_matcher(name: str, attributes: "Attributes | None") -> bool:
    lower_name = name.lower()
    return lower_name.startswith("recording health:") or lower_name.startswith(
        "health check successful"
    )


def configure_logfire(service_name: Literal["server", "worker"]) -> None:
    if settings.is_testing():
        return

    logfire.configure(
        send_to_logfire="if-token-present",
        token=settings.LOGFIRE_TOKEN,
        service_name=service_name,
        service_version=os.environ.get("RELEASE_VERSION", "development"),
        console=False,
        sampling=logfire.SamplingOptions(
            head=ParentBased(IgnoreSampler((_healthz_matcher, _worker_health_matcher))),
        ),
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

    logfire.instrument_fastapi(app)


def instrument_sqlalchemy(engine: Engine) -> None:
    if settings.is_testing():
        return

    SQLAlchemyInstrumentor().instrument(engine=engine)


def instrument_redis() -> None:
    if settings.is_testing():
        return

    logfire.instrument_redis()


__all__ = [
    "configure_logfire",
    "instrument_fastapi",
    "instrument_sqlalchemy",
    "instrument_redis",
]
