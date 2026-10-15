import collections.abc
import os

import httpx
from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    SpanExporter,
    SpanExportResult,
)
from opentelemetry.sdk.trace.sampling import ALWAYS_ON

from polar import __version__

TELEMETRY_ENV = "POLAR_OUTPOST_TELEMETRY"
FORWARDED_HEADERS = ("Authorization", "Polar-Organization")


def is_telemetry_enabled(telemetry: bool) -> bool:
    return telemetry and os.environ.get(TELEMETRY_ENV) != "0"


class RelaySpanExporter(SpanExporter):
    # The OTLP exporter merges OTEL_EXPORTER_OTLP_HEADERS into its requests:
    # the application's own exporter credentials would reach Polar.

    def __init__(self, url: str, headers: dict[str, str]) -> None:
        self._url = url
        self._client = httpx.Client(
            headers={**headers, "Content-Type": "application/x-protobuf"},
            timeout=10.0,
        )

    def export(self, spans: collections.abc.Sequence[ReadableSpan]) -> SpanExportResult:
        try:
            response = self._client.post(
                self._url, content=encode_spans(spans).SerializeToString()
            )
        except httpx.HTTPError:
            return SpanExportResult.FAILURE
        if not response.is_success:
            return SpanExportResult.FAILURE
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        self._client.close()


def create_tracer_provider(client: httpx.AsyncClient) -> TracerProvider:
    exporter = RelaySpanExporter(
        str(client.base_url.join("/v1/outpost/telemetry")),
        {
            name: client.headers[name]
            for name in FORWARDED_HEADERS
            if name in client.headers
        },
    )
    provider = TracerProvider(
        resource=Resource(
            {
                "service.name": "outpost",
                "service.version": __version__,
                "telemetry.sdk.language": "python",
            }
        ),
        sampler=ALWAYS_ON,
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    return provider
