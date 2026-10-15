import { ProtobufTraceSerializer } from "@opentelemetry/otlp-transformer";
import { resourceFromAttributes } from "@opentelemetry/resources";
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

export const isTelemetryEnabled = (telemetry: boolean): boolean =>
  telemetry && process.env[TELEMETRY_ENV] !== "0";

// The OTLP exporter merges OTEL_EXPORTER_OTLP_HEADERS into its requests:
// the application's own exporter credentials would reach Polar.
export class RelaySpanExporter implements SpanExporter {
  constructor(
    private readonly url: string,
    private readonly headers: Headers,
  ) {}

  export(spans: ReadableSpan[], resultCallback: Parameters<SpanExporter["export"]>[1]): void {
    const body = ProtobufTraceSerializer.serializeRequest(spans);
    if (!body) return resultCallback({ code: 1 });
    fetch(this.url, {
      method: "POST",
      headers: this.headers,
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
  }

  async shutdown(): Promise<void> {}
}

export const createTracerProvider = (client: Pick<ClientBase, "buildRequest">): TracerProvider => {
  const [url, request] = client.buildRequest("POST", "/v1/outpost/telemetry");
  const source = new Headers(request.headers);
  const headers = new Headers({ "Content-Type": "application/x-protobuf" });
  for (const name of FORWARDED_HEADERS) {
    const value = source.get(name);
    if (value !== null) headers.set(name, value);
  }
  return new TracerProvider({
    resource: resourceFromAttributes({
      "service.name": "outpost",
      "service.version": VERSION,
      "telemetry.sdk.language": "nodejs",
    }),
    sampler: new AlwaysOnSampler(),
    spanProcessors: [new BatchSpanProcessor({ exporter: new RelaySpanExporter(url, headers) })],
  });
};
