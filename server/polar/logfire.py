import os
from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING, Any, Literal, cast

import httpx
import logfire
from fastapi import FastAPI
from logfire.sampling import SpanLevel
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.trace import SpanProcessor
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import (
    ALWAYS_OFF,
    ALWAYS_ON,
    ParentBased,
    Sampler,
    SamplingResult,
)

from polar.observability.s3_span_exporter import S3SpanExporter

if TYPE_CHECKING:
    from opentelemetry.context import Context
    from opentelemetry.trace import Link, SpanKind
    from opentelemetry.trace.span import TraceState
    from opentelemetry.util.types import Attributes

from polar.config import settings
from polar.kit.db.postgres import Engine
from polar.observability.otel_prometheus import PrometheusMeterProvider

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


class LevelSampler(Sampler):
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

        if attributes:
            span_level = attributes.get("logfire.level_num")
            if span_level and SpanLevel(cast(int, span_level)) < cast(
                logfire.LevelName, settings.LOG_LEVEL.lower()
            ):
                sampler = ALWAYS_OFF

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
        return "LevelSampler"


def _scrubbing_callback(match: logfire.ScrubMatch) -> Any | None:
    # Don't scrub auth subject in log messages
    if match.path == ("attributes", "subject"):
        return match.value
    return None


def configure_logfire(service_name: Literal["server", "worker"]) -> None:
    resolved_service_name = os.environ.get("RENDER_SERVICE_NAME", service_name)

    additional_span_processors: list[SpanProcessor] = []
    if settings.S3_LOGS_BUCKET_NAME is not None:
        additional_span_processors.append(
            BatchSpanProcessor(
                S3SpanExporter(
                    bucket_name=settings.S3_LOGS_BUCKET_NAME,
                    service_name=resolved_service_name,
                    endpoint_url=settings.S3_ENDPOINT_URL,
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_REGION,
                ),
                schedule_delay_millis=60_000,
            )
        )

    logfire.configure(
        send_to_logfire="if-token-present",
        token=settings.LOGFIRE_TOKEN,
        environment=settings.ENV,
        service_name=resolved_service_name,
        service_version=os.environ.get("RELEASE_VERSION", "development"),
        code_source=logfire.CodeSource(
            repository="https://github.com/polarsource/polar",
            revision=os.environ.get("RELEASE_VERSION", "main"),
            root_path="server",
        ),
        console=False,
        sampling=logfire.SamplingOptions.level_or_duration(
            head=ParentBased(
                IgnoreSampler((_healthz_matcher, _worker_health_matcher)),
                local_parent_sampled=LevelSampler(),
            ),
            level_threshold=cast(logfire.LevelName, settings.LOG_LEVEL.lower()),
        ),
        scrubbing=logfire.ScrubbingOptions(callback=_scrubbing_callback),
        additional_span_processors=additional_span_processors or None,
    )


def instrument_httpx(client: httpx.AsyncClient | httpx.Client | None = None) -> None:
    if client:
        HTTPXClientInstrumentor().instrument_client(client)
    else:
        HTTPXClientInstrumentor().instrument()


def instrument_fastapi(app: FastAPI) -> None:
    logfire.instrument_fastapi(app, capture_headers=True)


_meter_provider = PrometheusMeterProvider()


def instrument_sqlalchemy(engines: Sequence[Engine]) -> None:
    logfire.instrument_sqlalchemy(engines=engines, meter_provider=_meter_provider)


__all__ = [
    "configure_logfire",
    "instrument_fastapi",
    "instrument_sqlalchemy",
]
