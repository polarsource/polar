import os

import httpx
from opentelemetry.exporter.otlp.proto.http import Compression
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import ALWAYS_ON

from polar import __version__

TELEMETRY_ENV = "POLAR_OUTPOST_TELEMETRY"
FORWARDED_HEADERS = ("Authorization", "Polar-Organization")


def is_telemetry_enabled(telemetry: bool) -> bool:
    return telemetry and os.environ.get(TELEMETRY_ENV) != "0"


def create_tracer_provider(client: httpx.AsyncClient) -> TracerProvider:
    exporter = OTLPSpanExporter(
        endpoint=str(client.base_url.join("/v1/outpost/telemetry")),
        headers={
            name: client.headers[name]
            for name in FORWARDED_HEADERS
            if name in client.headers
        },
        compression=Compression.NoCompression,
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
