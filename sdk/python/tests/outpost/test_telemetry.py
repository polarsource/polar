from opentelemetry.proto.collector.metrics.v1.metrics_service_pb2 import (
    ExportMetricsServiceRequest,
)
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.metrics.v1.metrics_pb2 import AggregationTemporality
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import StatusCode

from polar.outpost.telemetry import (
    SAMPLE_RATE_ATTRIBUTE,
    Outbox,
    OutboxSpanExporter,
    create_meter_provider,
)


def test_keeps_the_spans_with_an_error_a_drift_or_the_sample_rate() -> None:
    outbox = Outbox()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(OutboxSpanExporter(outbox)))
    tracer = provider.get_tracer("test")
    tracer.start_span("outpost.routine").end()
    tracer.start_span("outpost.sampled", attributes={SAMPLE_RATE_ATTRIBUTE: 10}).end()
    tracer.start_span(
        "outpost.drift", attributes={"outpost.snapshot.delta": True}
    ).end()
    failed = tracer.start_span("outpost.failed")
    failed.set_status(StatusCode.ERROR)
    failed.end()
    provider.shutdown()

    # Each export stays its own message; concatenated, they read as one.
    spans, _ = outbox.take()
    request = ExportTraceServiceRequest()
    request.ParseFromString(b"".join(spans))
    names = {
        span.name
        for resource_spans in request.resource_spans
        for scope_spans in resource_spans.scope_spans
        for span in scope_spans.spans
    }
    assert names == {"outpost.sampled", "outpost.drift", "outpost.failed"}


def test_keeps_metrics_in_the_outbox_as_deltas() -> None:
    outbox = Outbox()
    provider = create_meter_provider(outbox)
    provider.get_meter("test").create_counter("outpost.test").add(1)
    provider.shutdown()

    _, metrics = outbox.take()
    request = ExportMetricsServiceRequest()
    request.ParseFromString(b"".join(metrics))
    metric = request.resource_metrics[0].scope_metrics[0].metrics[0]
    assert metric.name == "outpost.test"
    assert metric.sum.aggregation_temporality == AggregationTemporality.Value(
        "AGGREGATION_TEMPORALITY_DELTA"
    )
