import collections.abc
import os
from typing import Any

import httpx
from opentelemetry.exporter.otlp.proto.common.metrics_encoder import encode_metrics
from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
from opentelemetry.sdk.metrics import Counter, Histogram, MeterProvider
from opentelemetry.sdk.metrics.export import (
    AggregationTemporality,
    MetricExporter,
    MetricExportResult,
    MetricsData,
    PeriodicExportingMetricReader,
)
from opentelemetry.sdk.metrics.view import ExponentialBucketHistogramAggregation, View
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
EXPORT_INTERVAL_MILLIS = 30_000
METRIC_VIEWS = [
    View(
        instrument_name="outpost.ingest.duration",
        aggregation=ExponentialBucketHistogramAggregation(),
    ),
    View(
        instrument_name="outpost.read.duration",
        aggregation=ExponentialBucketHistogramAggregation(),
    ),
]


def is_telemetry_enabled(telemetry: bool) -> bool:
    return telemetry and os.environ.get(TELEMETRY_ENV) != "0"


class _Relay:
    # The OTLP exporters merge OTEL_EXPORTER_OTLP_HEADERS into their requests:
    # the application's own exporter credentials would reach Polar.

    def __init__(self, url: str, headers: dict[str, str]) -> None:
        self._url = url
        self._client = httpx.Client(
            headers={**headers, "Content-Type": "application/x-protobuf"},
            timeout=10.0,
        )

    def _post(self, body: bytes) -> bool:
        try:
            response = self._client.post(self._url, content=body)
        except httpx.HTTPError:
            return False
        return response.is_success

    def _close(self) -> None:
        self._client.close()


class RelaySpanExporter(_Relay, SpanExporter):
    def export(self, spans: collections.abc.Sequence[ReadableSpan]) -> SpanExportResult:
        if self._post(encode_spans(spans).SerializeToString()):
            return SpanExportResult.SUCCESS
        return SpanExportResult.FAILURE

    def shutdown(self) -> None:
        self._close()


class RelayMetricExporter(_Relay, MetricExporter):
    def __init__(self, url: str, headers: dict[str, str]) -> None:
        _Relay.__init__(self, url, headers)
        MetricExporter.__init__(
            self,
            preferred_temporality={
                Counter: AggregationTemporality.DELTA,
                Histogram: AggregationTemporality.DELTA,
            },
        )

    def export(
        self, metrics_data: MetricsData, timeout_millis: float = 10_000, **kwargs: Any
    ) -> MetricExportResult:
        if self._post(encode_metrics(metrics_data).SerializeToString()):
            return MetricExportResult.SUCCESS
        return MetricExportResult.FAILURE

    def force_flush(self, timeout_millis: float = 10_000) -> bool:
        return True

    def shutdown(self, timeout_millis: float = 30_000, **kwargs: Any) -> None:
        self._close()


def _relay_target(client: httpx.AsyncClient, path: str) -> tuple[str, dict[str, str]]:
    return str(client.base_url.join(path)), {
        name: client.headers[name]
        for name in FORWARDED_HEADERS
        if name in client.headers
    }


def _resource() -> Resource:
    return Resource(
        {
            "service.name": "outpost",
            "service.version": __version__,
            "telemetry.sdk.language": "python",
        }
    )


def create_tracer_provider(client: httpx.AsyncClient) -> TracerProvider:
    exporter = RelaySpanExporter(*_relay_target(client, "/v1/outpost/telemetry"))
    provider = TracerProvider(resource=_resource(), sampler=ALWAYS_ON)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    return provider


def create_meter_provider(client: httpx.AsyncClient) -> MeterProvider:
    exporter = RelayMetricExporter(
        *_relay_target(client, "/v1/outpost/telemetry/metrics")
    )
    reader = PeriodicExportingMetricReader(
        exporter, export_interval_millis=EXPORT_INTERVAL_MILLIS
    )
    return MeterProvider(
        metric_readers=[reader], resource=_resource(), views=METRIC_VIEWS
    )
