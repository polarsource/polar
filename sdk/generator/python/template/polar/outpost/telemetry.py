import collections.abc
import os
import threading
import typing

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
from opentelemetry.trace import StatusCode

from polar import __version__

TELEMETRY_ENV = "POLAR_OUTPOST_TELEMETRY"
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


# Set on the spans a sample keeps: each stands for this many spans without an error or
# a drift.
SAMPLE_RATE_ATTRIBUTE = "outpost.sample_rate"


def is_telemetry_enabled(telemetry: bool) -> bool:
    return telemetry and os.environ.get(TELEMETRY_ENV) != "0"


class Outbox:
    """The serialized exports an instance holds until it hands them to the shared
    Redis. The exporters fill it from their own threads."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.spans: list[bytes] = []
        self.metrics: list[bytes] = []

    def add(self, kind: typing.Literal["spans", "metrics"], body: bytes) -> None:
        with self._lock:
            getattr(self, kind).append(body)

    def take(self) -> tuple[list[bytes], list[bytes]]:
        with self._lock:
            spans, self.spans = self.spans, []
            metrics, self.metrics = self.metrics, []
        return spans, metrics

    def put_back(self, spans: list[bytes], metrics: list[bytes], cap: int) -> None:
        """Exports the shared Redis did not take wait for the next flush, the newest at
        most."""
        with self._lock:
            self.spans = (spans + self.spans)[-cap:]
            self.metrics = (metrics + self.metrics)[-cap:]


def _kept(span: ReadableSpan) -> bool:
    attributes = span.attributes or {}
    return (
        attributes.get(SAMPLE_RATE_ATTRIBUTE) is not None
        or span.status.status_code == StatusCode.ERROR
        or attributes.get("outpost.snapshot.delta") is True
    )


class OutboxSpanExporter(SpanExporter):
    def __init__(self, outbox: Outbox) -> None:
        self._outbox = outbox

    def export(self, spans: collections.abc.Sequence[ReadableSpan]) -> SpanExportResult:
        if kept := [span for span in spans if _kept(span)]:
            self._outbox.add("spans", encode_spans(kept).SerializeToString())
        return SpanExportResult.SUCCESS


class OutboxMetricExporter(MetricExporter):
    def __init__(self, outbox: Outbox) -> None:
        self._outbox = outbox
        MetricExporter.__init__(
            self,
            preferred_temporality={
                Counter: AggregationTemporality.DELTA,
                Histogram: AggregationTemporality.DELTA,
            },
        )

    def export(
        self,
        metrics_data: MetricsData,
        timeout_millis: float = 10_000,
        **kwargs: typing.Any,
    ) -> MetricExportResult:
        self._outbox.add("metrics", encode_metrics(metrics_data).SerializeToString())
        return MetricExportResult.SUCCESS

    def force_flush(self, timeout_millis: float = 10_000) -> bool:
        return True

    def shutdown(self, timeout_millis: float = 30_000, **kwargs: typing.Any) -> None:
        pass


def _resource() -> Resource:
    return Resource(
        {
            "service.name": "outpost",
            "service.version": __version__,
            "telemetry.sdk.language": "python",
        }
    )


def create_tracer_provider(outbox: Outbox) -> TracerProvider:
    provider = TracerProvider(resource=_resource(), sampler=ALWAYS_ON)
    provider.add_span_processor(BatchSpanProcessor(OutboxSpanExporter(outbox)))
    return provider


def create_meter_provider(outbox: Outbox) -> MeterProvider:
    exporter = OutboxMetricExporter(outbox)
    reader = PeriodicExportingMetricReader(
        exporter, export_interval_millis=EXPORT_INTERVAL_MILLIS
    )
    return MeterProvider(
        metric_readers=[reader], resource=_resource(), views=METRIC_VIEWS
    )
