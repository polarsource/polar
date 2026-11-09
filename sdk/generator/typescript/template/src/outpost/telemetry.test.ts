import type { AddressInfo } from "node:net";

import { SpanStatusCode } from "@opentelemetry/api";
import { AggregationTemporality, InstrumentType } from "@opentelemetry/sdk-metrics";
import { SimpleSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import { once } from "node:events";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { afterEach, expect, it, vi } from "vitest";

import { ClientBase } from "../base";
import { VERSION } from "../version";
import {
  createMeterProvider,
  Outbox,
  OutboxMetricExporter,
  OutboxSpanExporter,
  relay,
  SAMPLE_RATE_ATTRIBUTE,
} from "./telemetry";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("relays a body without reading OTEL_EXPORTER_OTLP_*", async () => {
  vi.stubEnv("OTEL_EXPORTER_OTLP_HEADERS", "x-vendor-key=secret");
  vi.stubEnv("OTEL_EXPORTER_OTLP_COMPRESSION", "gzip");
  const requests: { url?: string; headers: IncomingHttpHeaders; body: Buffer }[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      requests.push({ url: request.url, headers: request.headers, body: Buffer.concat(chunks) });
      response.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const client = new ClientBase({
    baseUrl: `http://127.0.0.1:${port}`,
    accessToken: "test-token",
    version: "2026-10",
  });

  expect(await relay(client, "/v1/outpost/telemetry", Buffer.from("spans"))).toBe(200);
  server.close();

  const [request] = requests;
  expect(request.url).toBe("/v1/outpost/telemetry");
  expect(request.headers.authorization).toBe("Bearer test-token");
  expect(request.headers["content-type"]).toBe("application/x-protobuf");
  expect(request.headers["x-vendor-key"]).toBeUndefined();
  expect(request.body.toString()).toBe("spans");
});

it("keeps the spans with an error, a drift or the sample rate", async () => {
  const outbox = new Outbox();
  const provider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter: new OutboxSpanExporter(outbox) })],
  });
  const tracer = provider.getTracer("test");
  tracer.startSpan("outpost.routine").end();
  tracer.startSpan("outpost.sampled", { attributes: { [SAMPLE_RATE_ATTRIBUTE]: 10 } }).end();
  tracer.startSpan("outpost.drift", { attributes: { "outpost.snapshot.delta": true } }).end();
  const failed = tracer.startSpan("outpost.failed");
  failed.setStatus({ code: SpanStatusCode.ERROR });
  failed.end();
  await provider.shutdown();

  const exported = Buffer.concat(outbox.spans).toString();
  for (const name of ["outpost.sampled", "outpost.drift", "outpost.failed"])
    expect(exported).toContain(name);
  expect(exported).not.toContain("outpost.routine");
});

it("keeps metrics in the outbox", async () => {
  const outbox = new Outbox();
  const provider = createMeterProvider(outbox);
  provider.getMeter("test").createCounter("outpost.test").add(1);
  await provider.shutdown();

  const exported = Buffer.concat(outbox.metrics).toString();
  expect(exported).toContain("outpost.test");
  expect(exported).toContain(VERSION);
});

it("exports metrics as deltas", () => {
  const exporter = new OutboxMetricExporter(new Outbox());
  for (const instrument of [InstrumentType.COUNTER, InstrumentType.HISTOGRAM])
    expect(exporter.selectAggregationTemporality(instrument)).toBe(AggregationTemporality.DELTA);
});
