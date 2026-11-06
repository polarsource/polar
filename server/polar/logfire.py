import os
import re
import traceback
from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING, Any, Literal, cast

import httpx
import logfire
from fastapi import FastAPI, Request, WebSocket
from logfire.sampling import SpanLevel
from logfire.types import ExceptionCallbackHelper
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.trace import Event, ReadableSpan, Span, SpanProcessor
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import (
    ALWAYS_OFF,
    ALWAYS_ON,
    ParentBased,
    Sampler,
    SamplingResult,
)
from opentelemetry.trace import Status
from starlette.routing import Host

from polar.observability.http_telemetry import HttpURLSpanProcessor, server_request_hook
from polar.observability.s3_span_exporter import S3SpanExporter

if TYPE_CHECKING:
    from opentelemetry.context import Context
    from opentelemetry.trace import Link, SpanKind
    from opentelemetry.trace.span import TraceState
    from opentelemetry.util.types import Attributes

from polar.config import settings
from polar.kit.aws import get_credentials
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
    return lower_name.startswith(("recording health:", "health check successful"))


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


# Logfire leaves `exception.message` unscrubbed. Redact addresses and bound
# query parameters in place so the constraint name stays visible.
_EMAIL_RE = re.compile(r"(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}(?![\w.-])")
_SQL_PARAMETERS_RE = re.compile(r"\[parameters:.*?(?=\n\(|\Z)", re.DOTALL)
_EXCEPTION_MESSAGE_KEYS = ("exception.message",)
_EXCEPTION_STACKTRACE_KEYS = ("exception.stacktrace",)


def _redact_exception_text(value: str) -> str:
    value = _SQL_PARAMETERS_RE.sub("[parameters: [Redacted]]", value)
    return _EMAIL_RE.sub("[Redacted]", value)


def _scrub_recorded_exception(helper: ExceptionCallbackHelper) -> None:
    helper.event_attributes["exception.message"] = _redact_exception_text(
        str(helper.exception)
    )
    helper.event_attributes["exception.stacktrace"] = _redact_exception_text(
        "".join(traceback.format_exception(helper.exception))
    )


class _ExceptionMessageSpanProcessor(SpanProcessor):
    """Scrub exception text that instrumentation records without Logfire's callback.

    SQLAlchemy sets the span status description to ``str(exception)``, which
    includes the Postgres detail and bound parameters, and never calls
    ``record_exception``.
    """

    def on_end(self, span: ReadableSpan) -> None:
        _scrub_span_status(span)
        _scrub_span_events(span)


def _scrub_span_status(span: ReadableSpan) -> None:
    description = span.status.description
    if not description:
        return
    redacted = _redact_exception_text(description)
    if redacted == description:
        return
    cast(Any, span)._status = Status(span.status.status_code, redacted)


def _scrub_span_events(span: ReadableSpan) -> None:
    events: list[Event] = []
    changed = False
    for event in span.events:
        attributes = event.attributes
        if not attributes:
            events.append(event)
            continue
        updated, event_changed = _redact_exception_attributes(dict(attributes))
        changed = changed or event_changed
        events.append(
            Event(name=event.name, attributes=updated, timestamp=event.timestamp)
            if event_changed
            else event
        )
    if changed:
        cast(Any, span)._events = events


def _redact_exception_attributes(
    attributes: dict[str, Any],
) -> tuple[dict[str, Any], bool]:
    changed = False
    for key in (*_EXCEPTION_MESSAGE_KEYS, *_EXCEPTION_STACKTRACE_KEYS):
        value = attributes.get(key)
        if not isinstance(value, str):
            continue
        redacted = _redact_exception_text(value)
        if redacted != value:
            attributes[key] = redacted
            changed = True
    return attributes, changed


def _scrubbing_callback(match: logfire.ScrubMatch) -> Any | None:
    if match.path in (
        # Task names are operational labels, even when they contain "email" or "auth".
        ("attributes", "actor"),
        ("attributes", "actor_name"),
        ("attributes", "message", "actor_name"),
        ("message", "actor"),
        ("message", "actor_name"),
        # Don't scrub auth subject in log messages
        ("attributes", "subject"),
        # Don't scrub thread stacks from the event loop watchdog — they contain
        # "session" via SQLAlchemy frames which triggers the default scrubber,
        # but these are stack traces, not secrets.
        ("attributes", "thread_stacks"),
        ("attributes", "event_loop_stack"),
        ("attributes", "asyncio_tasks"),
    ):
        return match.value
    return None


class PidSpanProcessor(SpanProcessor):
    def on_start(self, span: Span, parent_context: "Context | None" = None) -> None:
        span.set_attribute("process.pid", os.getpid())

    def on_end(self, span: ReadableSpan) -> None:
        pass

    def shutdown(self) -> None:
        pass

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return True


def _detect_platform() -> str | None:
    if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return "aws"
    if os.environ.get("RENDER") or os.environ.get("RENDER_SERVICE_NAME"):
        return "render"
    if settings.is_vercel():
        return "vercel"
    return None


def configure_logfire(service_name: Literal["server", "worker"]) -> None:
    resolved_service_name = os.environ.get(
        "SERVICE_NAME", os.environ.get("RENDER_SERVICE_NAME", service_name)
    )

    resource_attributes: dict[str, str] = {}
    platform = _detect_platform()
    if platform is not None:
        resource_attributes["deployment.platform"] = platform
    render_instance_id = os.environ.get("RENDER_INSTANCE_ID")
    if render_instance_id:
        resource_attributes["service.instance.id"] = render_instance_id

    additional_span_processors: list[SpanProcessor] = [
        _ExceptionMessageSpanProcessor(),
        HttpURLSpanProcessor(),
        PidSpanProcessor(),
    ]
    if settings.S3_LOGS_BUCKET_NAME is not None:
        access_key_id, secret_access_key = get_credentials()
        additional_span_processors.append(
            BatchSpanProcessor(
                S3SpanExporter(
                    bucket_name=settings.S3_LOGS_BUCKET_NAME,
                    service_name=resolved_service_name,
                    endpoint_url=settings.S3_ENDPOINT_URL,
                    aws_access_key_id=access_key_id,
                    aws_secret_access_key=secret_access_key,
                    region_name=settings.AWS_REGION,
                    scrub_patterns=[
                        r"email",
                        r"user[._]?name",
                        r"full[._]?name",
                        r"first[._]?name",
                        r"last[._]?name",
                        r"phone",
                        r"address",
                        r"ip_?address",
                        r"cookie",
                        r"^http\.url$",
                    ],
                ),
                max_export_batch_size=2048,
                schedule_delay_millis=60_000,
            )
        )

    logfire.configure(
        send_to_logfire="if-token-present",
        token=settings.LOGFIRE_TOKEN,
        environment=settings.ENV,
        service_name=resolved_service_name,
        service_version=os.environ.get("RELEASE_VERSION", "development"),
        resource_attributes=resource_attributes or None,
        inspect_arguments=False,
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
        advanced=logfire.AdvancedOptions(
            exception_callback=_scrub_recorded_exception,
        ),
        scrubbing=logfire.ScrubbingOptions(
            callback=_scrubbing_callback,
            # Logfire's defaults cover secrets, keys and credentials, but not
            # access and refresh tokens.
            extra_patterns=[
                r"access_?token",
                r"refresh_?token",
                # Share boundary checks to avoid repeating them for every scanned character.
                (
                    r'(?:^|[._"])(?:'
                    r"(?:customer_?)?email|"
                    r"(?:to|from|reply_to)_email_addr|"
                    r"(?:user|full|first|last)[._]?name|"
                    r"phone|address|ip_?address"
                    r')(?=$|")'
                ),
            ],
        ),
        additional_span_processors=additional_span_processors or None,
    )


def instrument_httpx(client: httpx.AsyncClient | httpx.Client | None = None) -> None:
    if client:
        HTTPXClientInstrumentor().instrument_client(client)
    else:
        HTTPXClientInstrumentor().instrument()


def _request_attributes_mapper(
    request: Request | WebSocket, attributes: dict[str, Any]
) -> dict[str, Any] | None:
    errors = attributes["errors"]
    if not errors:
        return None
    return {
        "fastapi.validation_error_count": len(errors),
        "fastapi.validation_error_types": [error["type"] for error in errors],
    }


def instrument_fastapi(app: FastAPI) -> None:
    for route in app.routes:
        if isinstance(route, Host) and isinstance(route.app, FastAPI):
            instrument_fastapi(route.app)
    logfire.instrument_fastapi(
        app,
        capture_headers=False,
        request_attributes_mapper=_request_attributes_mapper,
        server_request_hook=server_request_hook,
        # Empty lists fall back to OTEL environment settings; match no headers instead.
        http_capture_headers_server_request=[r"(?!)"],
        http_capture_headers_server_response=[r"(?!)"],
    )


_meter_provider = PrometheusMeterProvider()


def instrument_sqlalchemy(engines: Sequence[Engine]) -> None:
    logfire.instrument_sqlalchemy(engines=engines, meter_provider=_meter_provider)


__all__ = [
    "configure_logfire",
    "instrument_fastapi",
    "instrument_sqlalchemy",
]
