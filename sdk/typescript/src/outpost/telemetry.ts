import { SpanStatusCode } from "@opentelemetry/api";
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
// Set on the spans a sample keeps: each stands for this many spans without an error or a drift.
export const SAMPLE_RATE_ATTRIBUTE = "outpost.sample_rate";

export const isTelemetryEnabled = (telemetry: boolean): boolean =>
  telemetry && process.env[TELEMETRY_ENV] !== "0";

/** The serialized exports an instance holds until it hands them to the shared Redis. */
export class Outbox {
  spans: Uint8Array[] = [];
  metrics: Uint8Array[] = [];
}

const kept = (span: ReadableSpan): boolean =>
  span.attributes[SAMPLE_RATE_ATTRIBUTE] !== undefined ||
  span.status.code === SpanStatusCode.ERROR ||
  span.attributes["outpost.snapshot.delta"] === true;

export class OutboxSpanExporter implements SpanExporter {
  constructor(private readonly outbox: Outbox) {}

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    const exported = spans.filter(kept);
    const body = exported.length ? ProtobufTraceSerializer.serializeRequest(exported) : undefined;
    if (body) this.outbox.spans.push(body);
    resultCallback({ code: 0 });
  }

  async shutdown(): Promise<void> {}
}

export class OutboxMetricExporter implements PushMetricExporter {
  constructor(private readonly outbox: Outbox) {}

  export(metrics: ResourceMetrics, resultCallback: (result: ExportResult) => void): void {
    const body = ProtobufMetricsSerializer.serializeRequest(metrics);
    if (body) this.outbox.metrics.push(body);
    resultCallback({ code: 0 });
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

/**
 * Sends serialized exports in one request: protobuf messages concatenate into one. The OTLP
 * exporters would merge OTEL_EXPORTER_OTLP_HEADERS and send the application's credentials to Polar.
 */
export const relay = async (
  client: Pick<ClientBase, "buildRequest">,
  path: string,
  body: Uint8Array,
): Promise<number> => {
  const [url, headers] = relayTarget(client, path);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(10_000),
  });
  return response.status;
};

const resource = () =>
  resourceFromAttributes({
    "service.name": "outpost",
    "service.version": VERSION,
    "telemetry.sdk.language": "nodejs",
  });

export const createTracerProvider = (outbox: Outbox): TracerProvider =>
  new TracerProvider({
    resource: resource(),
    sampler: new AlwaysOnSampler(),
    spanProcessors: [new BatchSpanProcessor({ exporter: new OutboxSpanExporter(outbox) })],
  });

export const createMeterProvider = (outbox: Outbox): MeterProvider =>
  new MeterProvider({
    resource: resource(),
    views: METRIC_VIEWS,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OutboxMetricExporter(outbox),
        exportIntervalMillis: EXPORT_INTERVAL,
      }),
    ],
  });
