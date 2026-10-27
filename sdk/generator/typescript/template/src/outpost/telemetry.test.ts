import type { AddressInfo } from "node:net";

import { AggregationTemporality, InstrumentType, MeterProvider } from "@opentelemetry/sdk-metrics";
import { TracerProvider } from "@opentelemetry/sdk-trace";
import { once } from "node:events";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { afterEach, expect, it, vi } from "vitest";

import { ClientBase } from "../base";
import { VERSION } from "../version";
import { RelayMetricExporter, createMeterProvider, createTracerProvider } from "./telemetry";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("relays spans without reading OTEL_EXPORTER_OTLP_*", async () => {
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

  const provider: TracerProvider = createTracerProvider(client);
  provider.getTracer("test").startSpan("outpost.test").end();
  await provider.shutdown();
  server.close();

  const [request] = requests;
  expect(request.url).toBe("/v1/outpost/telemetry");
  expect(request.headers.authorization).toBe("Bearer test-token");
  expect(request.headers["content-type"]).toBe("application/x-protobuf");
  expect(request.headers["x-vendor-key"]).toBeUndefined();
  expect(request.body.toString()).toContain("outpost.test");
  expect(request.body.toString()).toContain(VERSION);
});

it("relays metrics to the metrics endpoint", async () => {
  vi.stubEnv("OTEL_EXPORTER_OTLP_HEADERS", "x-vendor-key=secret");
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

  const provider: MeterProvider = createMeterProvider(client);
  provider.getMeter("test").createCounter("outpost.test").add(1);
  await provider.shutdown();
  server.close();

  const [request] = requests;
  expect(request.url).toBe("/v1/outpost/telemetry/metrics");
  expect(request.headers.authorization).toBe("Bearer test-token");
  expect(request.headers["content-type"]).toBe("application/x-protobuf");
  expect(request.headers["x-vendor-key"]).toBeUndefined();
  expect(request.body.toString()).toContain("outpost.test");
  expect(request.body.toString()).toContain(VERSION);
});

it("exports metrics as deltas", () => {
  const exporter = new RelayMetricExporter("http://127.0.0.1", new Headers());
  for (const instrument of [InstrumentType.COUNTER, InstrumentType.HISTOGRAM])
    expect(exporter.selectAggregationTemporality(instrument)).toBe(AggregationTemporality.DELTA);
});
