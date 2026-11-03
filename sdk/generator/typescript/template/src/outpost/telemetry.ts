import {
  ProtobufMetricsSerializer,
  ProtobufTraceSerializer,
} from "@opentelemetry/otlp-transformer";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  AggregationTemporality,
  AggregationType,
  type InstrumentType,
  MeterProvider,
  PeriodicExportingMetricReader,
  type PushMetricExporter,
  type ResourceMetrics,
  type ViewOptions,
} from "@opentelemetry/sdk-metrics";
import {
  AlwaysOnSampler,
  BatchSpanProcessor,
  TracerProvider,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace";

import type { ClientBase } from "../base";

import { VERSION } from "../version";

export const TELEMETRY_ENV = "POLAR_OUTPOST_TELEMETRY";
const FORWARDED_HEADERS = ["Authorization", "Polar-Organization"];
const EXPORT_INTERVAL = 30_000;
export const METRIC_VIEWS: ViewOptions[] = [
  {
    instrumentName: "outpost.ingest.duration",
    aggregation: { type: AggregationType.EXPONENTIAL_HISTOGRAM },
  },
  {
    instrumentName: "outpost.read.duration",
    aggregation: { type: AggregationType.EXPONENTIAL_HISTOGRAM },
  },
];
type ExportResult = Parameters<Parameters<SpanExporter["export"]>[1]>[0];

export const isTelemetryEnabled = (telemetry: boolean): boolean =>
  telemetry && process.env[TELEMETRY_ENV] !== "0";

// The OTLP exporter merges OTEL_EXPORTER_OTLP_HEADERS into its requests:
// the application's own exporter credentials would reach Polar.
const post = (
  url: string,
  headers: Headers,
  body: Uint8Array | undefined,
  resultCallback: (result: ExportResult) => void,
): void => {
  if (!body) return resultCallback({ code: 1 });
  fetch(url, {
    method: "POST",
    headers,
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(10_000),
  })
    .then((response) => resultCallback({ code: response.ok ? 0 : 1 }))
    .catch((error: unknown) =>
      resultCallback({
        code: 1,
        error: error instanceof Error ? error : new Error(String(error)),
      }),
    );
};

export class RelaySpanExporter implements SpanExporter {
  constructor(
    private readonly url: string,
    private readonly headers: Headers,
  ) {}

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    post(this.url, this.headers, ProtobufTraceSerializer.serializeRequest(spans), resultCallback);
  }

  async shutdown(): Promise<void> {}
}

export class RelayMetricExporter implements PushMetricExporter {
  constructor(
    private readonly url: string,
    private readonly headers: Headers,
  ) {}

  export(metrics: ResourceMetrics, resultCallback: (result: ExportResult) => void): void {
    post(
      this.url,
      this.headers,
      ProtobufMetricsSerializer.serializeRequest(metrics),
      resultCallback,
    );
  }

  selectAggregationTemporality(_instrument: InstrumentType): AggregationTemporality {
    return AggregationTemporality.DELTA;
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}

const relayTarget = (
  client: Pick<ClientBase, "buildRequest">,
  path: string,
): [url: string, headers: Headers] => {
  const [url, request] = client.buildRequest("POST", path);
  const source = new Headers(request.headers);
  const headers = new Headers({ "Content-Type": "application/x-protobuf" });
  for (const name of FORWARDED_HEADERS) {
    const value = source.get(name);
    if (value !== null) headers.set(name, value);
  }
  return [url, headers];
};

const resource = () =>
  resourceFromAttributes({
    "service.name": "outpost",
    "service.version": VERSION,
    "telemetry.sdk.language": "nodejs",
  });

export const createTracerProvider = (client: Pick<ClientBase, "buildRequest">): TracerProvider => {
  const [url, headers] = relayTarget(client, "/v1/outpost/telemetry");
  return new TracerProvider({
    resource: resource(),
    sampler: new AlwaysOnSampler(),
    spanProcessors: [new BatchSpanProcessor({ exporter: new RelaySpanExporter(url, headers) })],
  });
};

export const createMeterProvider = (client: Pick<ClientBase, "buildRequest">): MeterProvider => {
  const [url, headers] = relayTarget(client, "/v1/outpost/telemetry/metrics");
  return new MeterProvider({
    resource: resource(),
    views: METRIC_VIEWS,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new RelayMetricExporter(url, headers),
        exportIntervalMillis: EXPORT_INTERVAL,
      }),
    ],
  });
};
