import type { ReadableSpan } from "@opentelemetry/sdk-trace";

import { DataPointType, type DataPoint, type ResourceMetrics } from "@opentelemetry/sdk-metrics";
import { Pipeline, Redis } from "ioredis";
import { once } from "node:events";
import { createRequire } from "node:module";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";

import { createPolar } from "../2026-10/client";
import { ClientBase } from "../base";
import {
  decodeState,
  MissingExternalIdError,
  Outpost,
  type OutpostOptions,
  PolarOutpostError,
  UnavailableRedisError,
} from "./client";
import { BUCKET_SIZE, getBucketStart, type Reducer } from "./reducer";
import { APPLY_SNAPSHOT_SCRIPT } from "./scripts";
import { TELEMETRY_ENV } from "./telemetry";
import { startRedisServer, type RedisServer } from "./testing";

const { exported, metrics } = vi.hoisted(() => ({
  exported: [] as ReadableSpan[],
  metrics: [] as ResourceMetrics[],
}));
vi.mock("./telemetry", async (importOriginal) => {
  const { SimpleSpanProcessor, TracerProvider } = await import("@opentelemetry/sdk-trace");
  const { MeterProvider, PeriodicExportingMetricReader } =
    await import("@opentelemetry/sdk-metrics");
  const actual = await importOriginal<typeof import("./telemetry")>();
  return {
    ...actual,
    createTracerProvider: () =>
      new TracerProvider({
        spanProcessors: [
          new SimpleSpanProcessor({
            exporter: {
              export: (spans, resultCallback) => {
                exported.push(...spans);
                resultCallback({ code: 0 });
              },
              shutdown: async () => {},
            },
          }),
        ],
      }),
    createMeterProvider: () =>
      new MeterProvider({
        views: actual.METRIC_VIEWS,
        readers: [
          new PeriodicExportingMetricReader({
            exporter: {
              export: (resourceMetrics, resultCallback) => {
                metrics.push(resourceMetrics);
                resultCallback({ code: 0 });
              },
              forceFlush: async () => {},
              shutdown: async () => {},
            },
            exportIntervalMillis: 60_000,
          }),
        ],
      }),
  };
});
const dataPoints = (name: string) =>
  metrics
    .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
    .flatMap((scopeMetrics) => scopeMetrics.metrics)
    .filter((metric) => metric.descriptor.name === name)
    .flatMap((metric): DataPoint<unknown>[] => metric.dataPoints);

const timestamp = "2026-10-12T12:00:00Z";
const bucket = getBucketStart(Date.parse(timestamp) * 1000);
const customer = { external_customer_id: "alice" };
let sequence = 0;
const eventId = () => `event-${++sequence}`;
const meter = { ...customer, meter_id: "meter" };
const key = "outpost:v1:state:external:alice:tokens";
const connectionId = "5b6e1f0c-8f4c-4d2a-9a51-3c7d2e8b1f60";
let redisServer: RedisServer;
let redis: Redis;
let server: WebSocketServer;
let core: ClientBase;
let reducers: Reducer[];
let snapshot: Record<string, unknown> | undefined;
let delayConfiguration = false;
let refuseConnections = false;
let meterSnapshots: Record<string, { credited_units: number; delay: number }> = {};
// The events Polar counted: a confirm request is answered with the ids among them and the
// snapshot read with them, `snapshot` unless overridden.
let ingested = new Set<string>();
let answerConfirm = true;
let confirmSnapshot: Record<string, unknown> | undefined;
const confirmRequests: Record<string, unknown>[] = [];
const connections: WebSocket[] = [];
const outposts: Outpost[] = [];

beforeAll(async () => {
  redisServer = await startRedisServer();
  redis = new Redis(redisServer.socket);
  await once(redis, "ready");
  server = new WebSocketServer({
    port: 0,
    host: "127.0.0.1",
    path: "/v1/outpost/",
    verifyClient: (_info, callback) => callback(!refuseConnections, 401),
  });
  await once(server, "listening");
  const address = server.address();
  if (typeof address === "string" || !address) throw new Error("Missing WebSocket address");
  core = new ClientBase({
    baseUrl: `http://127.0.0.1:${address.port}`,
    accessToken: "test-token",
    version: "2026-10",
    organizationId: "org",
  });
  server.on("connection", (ws, request) => {
    expect(request.headers.authorization).toBe("Bearer test-token");
    expect(request.headers["polar-organization"]).toBe("org");
    connections.push(ws);
    ws.send(JSON.stringify({ type: "connection", payload: { id: connectionId } }));
    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "configuration" && !delayConfiguration)
        ws.send(JSON.stringify({ type: "configuration", payload: { reducers } }));
      if (message.type === "meter_usage" && snapshot) {
        const meterId: string = message.payload.meter_id;
        const { delay = 0, ...override } = meterSnapshots[meterId] ?? {};
        const payload = { customer_exists: true, ...snapshot, meter_id: meterId, ...override };
        setTimeout(() => ws.send(JSON.stringify({ type: "meter_usage", payload })), delay);
      }
      if (message.type === "confirm") {
        confirmRequests.push(message.payload);
        const { meter_id, ids, ...payload } = message.payload;
        const { delay: _delay, ...override } = meterSnapshots[meter_id] ?? {};
        if (answerConfirm)
          ws.send(
            JSON.stringify({
              type: "confirmed",
              payload: {
                customer_id: null,
                external_customer_id: null,
                ...payload,
                ids: ids.filter((id: string) => ingested.has(id)),
                snapshot: {
                  customer_exists: true,
                  ...(confirmSnapshot ?? snapshot),
                  meter_id,
                  ...override,
                },
              },
            }),
          );
      }
    });
  });
});

beforeEach(async () => {
  await redis.flushdb();
  reducers = [
    {
      id: "tokens",
      meter_ids: ["meter"],
      filter: { conjunction: "and", clauses: [] },
      aggregation: { func: "sum", property: "tokens" },
    },
  ];
  snapshot = undefined;
  delayConfiguration = false;
  refuseConnections = false;
  meterSnapshots = {};
  ingested = new Set();
  answerConfirm = true;
  confirmSnapshot = undefined;
  confirmRequests.length = 0;
  exported.length = 0;
  metrics.length = 0;
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  await Promise.all(outposts.splice(0).map((outpost) => outpost.close()));
  connections.length = 0;
});

afterAll(async () => {
  redis?.disconnect();
  for (const ws of server?.clients ?? []) ws.terminate();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (redisServer) await redisServer.stop();
});

const start = async (options: Partial<OutpostOptions> = {}): Promise<Outpost> => {
  const outpost = new Outpost(redisServer.socket, {
    client: core,
    snapshotTimeout: 100,
    ...options,
  });
  outposts.push(outpost);
  return outpost.start();
};
const seed = async (cold = 10): Promise<void> => {
  await redis.hset(key, {
    cold_until: bucket,
    "cold:count": cold,
    "cold:sum": cold,
    "cold:min": cold,
    "cold:max": cold,
    "credited:meter": 100,
  });
};
const readOutcomes = async (outpost: Outpost) => {
  await outpost.flushTelemetry();
  return dataPoints("outpost.read.duration").map(({ attributes }) => [
    attributes["outpost.read.operation"],
    attributes["outpost.read.outcome"],
  ]);
};
const ingest = (outpost: Outpost, tokens: number) =>
  outpost.track({
    ...customer,
    name: "api_call",
    external_id: eventId(),
    timestamp,
    metadata: { tokens },
  });

it.each([
  ["count", 12],
  ["sum", 12],
  ["min", -2],
  ["max", 10],
  ["avg", 1],
] as const)(
  "synchronizes %s with immediate writer reads and asynchronous peer reads",
  async (func, expected) => {
    reducers[0].aggregation = func === "count" ? { func } : { func, property: "tokens" };
    await seed();
    const reader = await start();
    await reader.actor(customer);
    const writer = await start();
    await ingest(writer, -2);
    await ingest(writer, 4);
    expect((await writer.meter(meter))?.consumed_units).toBe(expected);
    await vi.waitFor(async () =>
      expect((await reader.meter(meter))?.consumed_units).toBe(expected),
    );
    const commands = vi.spyOn(Redis.prototype, "sendCommand");
    expect((await reader.meter(meter))?.balance).toBe(100 - expected);
    expect(commands).not.toHaveBeenCalled();
  },
);

it("rejects an event without an external_id", async () => {
  const outpost = await start();
  await expect(outpost.track({ ...customer, name: "api_call", timestamp })).rejects.toThrow(
    MissingExternalIdError,
  );
});

it("retains the connection ID while connected", async () => {
  const outpost = await start();
  await ingest(outpost, 3);
  expect(outpost.connectionId).toBe(connectionId);
  await outpost.close();
  expect(outpost.connectionId).toBeUndefined();
});

it.each([
  [0, false],
  [3, false],
  [3, true],
] as const)("pipelines %i bucket writes (failure: %s)", async (bucketCount, fail) => {
  const reducer = reducers[0];
  reducers = Array.from({ length: bucketCount }, (_, i) => ({
    ...reducer,
    id: `tokens-${i}`,
    meter_ids: [`meter-${i}`],
  }));
  for (let i = 0; i < bucketCount; i++) {
    await redis.hset(`outpost:v1:state:external:alice:tokens-${i}`, {
      cold_until: bucket,
      [`credited:meter-${i}`]: 100,
    });
  }
  const outpost = await start();
  const execute = vi.spyOn(Pipeline.prototype, "exec");
  await ingest(outpost, 3);
  expect(execute).toHaveBeenCalledOnce();
  for (let i = 0; i < bucketCount; i++) {
    expect(await outpost.meter({ ...customer, meter_id: `meter-${i}` })).toMatchObject({
      consumed_units: 3,
      balance: 97,
    });
    expect(
      await redis.hget(`outpost:v1:state:external:alice:tokens-${i}`, `bucket:${bucket}:count`),
    ).toBe("1");
  }
  if (fail) {
    outpost["channel"] = "outpost:test:unsubscribed";
    await redis.hset("outpost:v1:state:external:alice:tokens-1", `bucket:${bucket}:sum`, "invalid");
    await expect(ingest(outpost, 2)).rejects.toBeInstanceOf(UnavailableRedisError);
    expect(execute).toHaveBeenCalledTimes(2);
    for (const i of [0, 2]) {
      expect(await outpost.meter({ ...customer, meter_id: `meter-${i}` })).toMatchObject({
        consumed_units: 5,
        balance: 95,
      });
      expect(
        await redis.hget(`outpost:v1:state:external:alice:tokens-${i}`, `bucket:${bucket}:sum`),
      ).toBe("5");
    }
  }
});

it("handles configuration asynchronously and reports a missing customer snapshot", async () => {
  delayConfiguration = true;
  const outpost = await start();
  const result = ingest(outpost, 3);
  for (const ws of connections)
    ws.send(JSON.stringify({ type: "configuration", payload: { reducers } }));
  expect(await result).toBeUndefined();
  await expect(outpost.meter(meter)).rejects.toThrow("snapshot is not ready");
  expect(await outpost.meter({ ...customer, meter_id: "unknown" })).toBeNull();
});

it("propagates snapshots, rejects older cutoffs, and counts a late write until Polar confirms it", async () => {
  await seed();
  await redis.hset(key, {
    [`bucket:${bucket - BUCKET_SIZE}:sum`]: 99,
    [`bucket:${bucket}:sum`]: 3,
  });
  const reader = await start();
  await reader.actor(customer);
  snapshot = {
    ...customer,
    customer_id: null,
    meter_id: "meter",
    cold_until: bucket,
    version: 1791807000000001,
    count: 2,
    sum: 8,
    min: 3,
    max: 5,
    credited_units: 100,
  };
  const writer = await start();
  await writer.actor(customer);
  await vi.waitFor(async () => expect((await reader.meter(meter))?.balance).toBe(89));
  expect(await redis.hexists(key, `bucket:${bucket - BUCKET_SIZE}:sum`)).toBe(0);
  await redis.eval(
    APPLY_SNAPSHOT_SCRIPT,
    1,
    key,
    "external:alice:tokens",
    "outpost:v1:0:updates",
    "unused",
    bucket - BUCKET_SIZE,
    1,
    "meter",
    1,
    1,
    1,
    1,
    1,
  );
  expect(await redis.hget(key, "cold:sum")).toBe("8");
  const late = {
    ...customer,
    name: "api",
    external_id: eventId(),
    timestamp: "2026-10-12T11:55:00Z",
    metadata: { tokens: 999 },
  };
  await writer.track(late);
  expect((await writer.meter(meter))?.balance).toBe(89 - 999);
  await writer.confirm([late]);
  expect((await writer.meter(meter))?.balance).toBe(89);
});

it("ignores old revisions above JS integer precision and reloads on an epoch change", async () => {
  await seed();
  await redis.hset(key, { epoch: "first", revision: "9007199254740993" });
  const outpost = await start();
  await ingest(outpost, 3);
  const oldState = await redis.hgetall(key);
  const receive = outpost["receiveRedis"].bind(outpost);
  await receive(
    JSON.stringify({
      customer: "external:alice:tokens",
      state: Object.entries({
        ...oldState,
        revision: "9007199254740993",
        "cold:sum": "1",
      }).flat(),
    }),
  );
  expect((await outpost.meter(meter))?.consumed_units).toBe(13);
  await redis.del(key);
  await seed(20);
  await ingest(outpost, 2);
  await receive(
    JSON.stringify({ customer: "external:alice:tokens", state: Object.entries(oldState).flat() }),
  );
  expect((await outpost.meter(meter))?.consumed_units).toBe(22);
});

it("applies another instance's bucket updates and reloads after a missed revision", async () => {
  await seed();
  const reader = await start();
  const writer = await start();
  await reader.actor(customer);
  await ingest(writer, 3);
  await vi.waitFor(async () => expect((await reader.meter(meter))?.consumed_units).toBe(13));
  await redis.hset(key, "cold:sum", 20);
  await redis.hincrby(key, "revision", 1);
  await ingest(writer, 2);
  await vi.waitFor(async () => expect((await reader.meter(meter))?.consumed_units).toBe(25));
});

it("repairs a missed notification on periodic refresh", async () => {
  await seed();
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const outpost = await start();
  await outpost.actor(customer);
  await redis.hset(key, "cold:sum", 20);
  await redis.hincrby(key, "revision", 1);
  await vi.advanceTimersByTimeAsync(30_000);
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(20));
});

it("invalidates cached state on subscriber loss and reloads after reconnect", async () => {
  await seed();
  const outpost = await start();
  await outpost.actor(customer);
  const subscriber = outpost["subscriber"]!;
  const primary = outpost["redis"]!;
  const reconnect = once(subscriber, "ready");
  const primaryReconnect = once(primary, "ready");
  const closed = once(subscriber, "close");
  primary.disconnect(true);
  subscriber.disconnect(true);
  await closed;
  expect(outpost["cache"].get("external:alice:tokens")?.state).toBeUndefined();
  await redis.hset(key, "cold:sum", 20);
  await Promise.all([reconnect, primaryReconnect]);
  expect((await outpost.meter(meter))?.consumed_units).toBe(20);
});

it("reloads evicted customers and closes owned connections", async () => {
  await seed();
  const outpost = await start({ snapshotTimeout: 0 });
  await outpost.actor(customer);
  for (let i = 0; i < 1024; i++) await outpost.actor({ external_customer_id: `customer-${i}` });
  expect(outpost["cache"].size).toBe(1024);
  await redis.hset(key, "cold:sum", 20);
  expect((await outpost.meter(meter))?.consumed_units).toBe(20);
  const ownedRedis = outpost["redis"]!;
  await outpost.close();
  expect(ownedRedis.status).toBe("end");
  await expect(outpost.actor(customer)).rejects.toThrow("start()");
});

it("ships the Outpost entrypoint for both ESM and CommonJS", async () => {
  const esm = await import(import.meta.resolve("@polar-sh/sdk/outpost"));
  const cjs = createRequire(import.meta.url)("@polar-sh/sdk/outpost");
  expect(esm.Outpost).toBeTypeOf("function");
  expect(cjs.Outpost).toBeTypeOf("function");
});

it("keeps reducer cutoffs and meter credits independent under concurrent writes", async () => {
  reducers[0].meter_ids!.push("shared");
  reducers.push({
    id: "average",
    meter_ids: ["average-meter"],
    filter: { conjunction: "and", clauses: [] },
    aggregation: { func: "avg", property: "tokens" },
  });
  const averageKey = "outpost:v1:state:external:alice:average";
  await redis.eval(
    APPLY_SNAPSHOT_SCRIPT,
    1,
    key,
    "external:alice:tokens",
    "outpost:v1:0:updates",
    "epoch",
    bucket,
    20,
    "meter",
    100,
    2,
    20,
    5,
    15,
  );
  await redis.eval(
    APPLY_SNAPSHOT_SCRIPT,
    1,
    averageKey,
    "external:alice:average",
    "outpost:v1:0:updates",
    "epoch",
    bucket,
    20,
    "average-meter",
    100,
    2,
    20,
    5,
    15,
  );
  await redis.eval(
    APPLY_SNAPSHOT_SCRIPT,
    1,
    key,
    "external:alice:tokens",
    "outpost:v1:0:updates",
    "epoch",
    bucket,
    19,
    "shared",
    200,
    1,
    999,
    999,
    999,
  );
  const first = await start();
  const second = await start();
  await first.actor(customer);
  await second.actor(customer);
  const events = [2, 8].map((tokens) => Array.from({ length: 10 }, () => usage(eventId(), tokens)));
  await Promise.all(
    [first, second].map(async (writer, index) => {
      for (const event of events[index]) await writer.track(event);
    }),
  );
  await first["synchronize"]();
  expect((await first.meter(meter))?.consumed_units).toBe(120);
  expect((await first.meter({ ...customer, meter_id: "shared" }))?.credited_units).toBe(200);
  expect(
    (await first.meter({ ...customer, meter_id: "average-meter" }))?.consumed_units,
  ).toBeCloseTo(120 / 22);
  expect(first["cache"].get("external:alice:tokens")?.state?.buckets.get(bucket)).toEqual({
    count: 20,
    sum: 100,
    min: 2,
    max: 8,
  });
  await first.track({
    ...customer,
    name: "api",
    external_id: eventId(),
    timestamp: "2026-10-12T12:05:00Z",
    metadata: { tokens: 4 },
  });
  await first.confirm(events.flat());
  await redis.eval(
    APPLY_SNAPSHOT_SCRIPT,
    1,
    key,
    "external:alice:tokens",
    "outpost:v1:0:updates",
    "epoch",
    bucket + BUCKET_SIZE,
    21,
    "meter",
    150,
    22,
    120,
    2,
    15,
  );
  await first["synchronize"]();
  // Every event in the bucket is confirmed: Polar counts it, the local copy is gone.
  expect(await redis.hget(key, `bucket:${bucket}:sum`)).toBeNull();
  expect(await redis.hget(averageKey, `bucket:${bucket}:sum`)).toBe("100");
  expect((await first.meter(meter))?.balance).toBe(26);
  expect(
    (await first.meter({ ...customer, meter_id: "average-meter" }))?.consumed_units,
  ).toBeCloseTo(124 / 23);
  expect((await first.meter({ ...customer, meter_id: "shared" }))?.credited_units).toBe(200);
  expect(await redis.exists("outpost:v1:state:customer:alice:tokens")).toBe(0);
});

it("orders same-cutoff corrections at microsecond precision and keeps null extrema", async () => {
  snapshot = {
    ...customer,
    customer_id: null,
    meter_id: "meter",
    cold_until: bucket,
    version: 1791807000000002,
    count: 2,
    sum: 10,
    min: 3,
    max: 7,
    credited_units: 100,
  };
  const outpost = await start();
  await outpost.actor(customer);
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(10));
  await outpost["receiveWebsocket"](
    JSON.stringify({
      type: "meter_usage",
      payload: { ...snapshot, customer_exists: true, customer_id: "alice", sum: 999 },
    }),
  );
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  await outpost["receiveWebsocket"](
    JSON.stringify({
      type: "meter_usage",
      payload: { ...snapshot, customer_exists: true, version: 1791807000000001, sum: 999 },
    }),
  );
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  await outpost["receiveWebsocket"](
    JSON.stringify({
      type: "meter_usage",
      payload: {
        ...snapshot,
        customer_exists: true,
        version: 1791807000000003,
        count: 0,
        sum: 0,
        min: null,
        max: null,
      },
    }),
  );
  expect((await outpost.meter(meter))?.consumed_units).toBe(0);
  expect(await redis.hget(key, "cold:min")).toBeNull();
  expect(await redis.hget(key, "cold:max")).toBeNull();
});

it("preserves microsecond cutoffs and counts a late write as pending", async () => {
  snapshot = {
    ...customer,
    customer_id: null,
    meter_id: "meter",
    cold_until: bucket,
    version: 1791807000000001,
    count: 0,
    sum: 0,
    min: null,
    max: null,
    credited_units: 100,
  };
  const outpost = await start();
  await outpost.actor(customer);
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(0));
  const settled = usage(eventId(), 2);
  await outpost.track(settled);
  await outpost.track({
    ...customer,
    name: "api",
    external_id: eventId(),
    timestamp: "2026-10-12T12:05:00Z",
    metadata: { tokens: 4 },
  });
  await outpost.confirm([settled]);
  await outpost["receiveWebsocket"](
    JSON.stringify({
      type: "meter_usage",
      payload: {
        ...snapshot,
        customer_exists: true,
        cold_until: bucket + 1,
        version: 1791807000000002,
        count: 1,
        sum: 2,
        min: 2,
        max: 2,
      },
    }),
  );
  expect((await outpost.meter(meter))?.consumed_units).toBe(6);
  expect(await redis.hget(key, "cold_until")).toBe(String(bucket + 1));
  expect(await redis.hget(key, `bucket:${bucket}:sum`)).toBeNull();
  expect(await redis.hget(key, `bucket:${bucket + BUCKET_SIZE}:sum`)).toBe("4");
  await ingest(outpost, 999);
  expect((await outpost.meter(meter))?.consumed_units).toBe(6 + 999);
});

// Polar seals a bucket with what it has ingested so far; the local events it has not received
// yet stay counted as pending until Polar confirms them (PLR-329).
const seal = async (cutoff: number, count = 0, sum = 0): Promise<void> => {
  await redis.eval(
    APPLY_SNAPSHOT_SCRIPT,
    1,
    key,
    "external:alice:tokens",
    "outpost:v1:0:updates",
    "epoch",
    cutoff,
    cutoff + 1,
    "meter",
    100,
    count,
    sum,
    "",
    "",
  );
};
const usage = (id: string, tokens: number) => ({
  ...customer,
  external_id: id,
  name: "api_call",
  timestamp,
  metadata: { tokens },
});
const warm = async (): Promise<Outpost> => {
  await seed(0);
  const outpost = await start();
  await outpost.actor(customer);
  return outpost;
};

it("keeps local events Polar has not ingested when their bucket goes cold", async () => {
  const outpost = await warm();
  for (let i = 0; i < 10; i++) await outpost.track(usage(`event-${i}`, 10));
  expect((await outpost.meter(meter))?.consumed_units).toBe(100);
  await seal(bucket + BUCKET_SIZE);
  await outpost["synchronize"]();
  expect((await outpost.meter(meter))?.consumed_units).toBe(100);
});

it("counts a late write into a cold bucket", async () => {
  const outpost = await warm();
  await seal(bucket + BUCKET_SIZE);
  await outpost["synchronize"]();
  await outpost.track(usage("late", 5));
  expect((await outpost.meter(meter))?.consumed_units).toBe(5);
});

it("confirms the events Polar ingested and keeps the rest pending", async () => {
  const outpost = await warm();
  const events = Array.from({ length: 10 }, (_, i) => usage(`event-${i}`, 10));
  for (const event of events) await outpost.track(event);
  await outpost.confirm(events.slice(0, 4));
  await seal(bucket + BUCKET_SIZE, 4, 40);
  await outpost["synchronize"]();
  expect((await outpost.meter(meter))?.consumed_units).toBe(100);
  expect(await redis.hget(key, `bucket:${bucket}:count`)).toBe("10");
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("6");
});

it("keeps the pending extrema of the events still pending", async () => {
  reducers[0].aggregation = { func: "max", property: "tokens" };
  const outpost = await warm();
  const events = [usage("low", 3), usage("high", 9), usage("mid", 5)];
  for (const event of events) await outpost.track(event);
  expect(await redis.hget(key, `pending:${bucket}:min`)).toBe("3");
  expect(await redis.hget(key, `pending:${bucket}:max`)).toBe("9");
  await outpost.confirm([events[1], events[0]]);
  expect(await redis.hget(key, `pending:${bucket}:min`)).toBe("5");
  expect(await redis.hget(key, `pending:${bucket}:max`)).toBe("5");
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("1");
});

it("settles an event once however many times a confirmation names it", async () => {
  const outpost = await warm();
  const events = [usage("event-0", 10), usage("event-1", 10)];
  for (const event of events) await outpost.track(event);
  await outpost.confirm([events[0], events[0]]);
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("1");
  expect(await redis.hget(key, `pending:${bucket}:sum`)).toBe("10");
});

it("settles an event the previous SDK version left pending", async () => {
  const outpost = await warm();
  await outpost.track(usage("new", 10));
  // What WRITE_BUCKET used to store per event: count, sum, min and max, as strings.
  await redis.hset(`outpost:v1:pending:external:alice:tokens:${bucket}`, "old", '["1","7","7","7"]');
  await redis.hincrby(key, `pending:${bucket}:count`, 1);
  await redis.hincrbyfloat(key, `pending:${bucket}:sum`, 7);
  await outpost.confirm([usage("old", 7)]);
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("1");
  expect(await redis.hget(key, `pending:${bucket}:sum`)).toBe("10");
});

it("settles a hot bucket's events on Polar's receipt", async () => {
  const outpost = await warm();
  const events = [usage("event-0", 10), usage("event-1", 10)];
  for (const event of events) await outpost.track(event);
  await outpost.acknowledge(events);
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBeNull();
  expect(await redis.hget(key, `bucket:${bucket}:count`)).toBe("2");
  expect((await outpost.meter(meter))?.consumed_units).toBe(20);
});

it("keeps a cold bucket's events pending on Polar's receipt until a snapshot counts them", async () => {
  const outpost = await warm();
  const events = [usage("event-0", 10), usage("event-1", 10)];
  for (const event of events) await outpost.track(event);
  await seal(bucket + BUCKET_SIZE);
  // Received is not counted: the snapshot that sealed the bucket did not have them.
  await outpost.acknowledge(events);
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("2");
  await outpost["synchronize"]();
  expect((await outpost.meter(meter))?.consumed_units).toBe(20);
  await outpost.confirm(events);
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBeNull();
  expect((await outpost.meter(meter))?.consumed_units).toBe(0);
});

it("ignores a duplicate external_id", async () => {
  const outpost = await warm();
  await outpost.track(usage("same", 10));
  await outpost.track(usage("same", 10));
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("1");
});

it("drops a cold bucket once every event is confirmed", async () => {
  const outpost = await warm();
  const events = [usage("event-1", 10), usage("event-2", 10)];
  for (const event of events) await outpost.track(event);
  await outpost.confirm(events);
  await seal(bucket + BUCKET_SIZE, 2, 20);
  await outpost["synchronize"]();
  expect((await outpost.meter(meter))?.consumed_units).toBe(20);
  expect(await redis.hget(key, `bucket:${bucket}:sum`)).toBeNull();
  expect(await redis.hget(key, `pending:${bucket}:sum`)).toBeNull();
});

// Before applying a snapshot that seals a bucket, the client asks Polar which of the bucket's
// pending events the snapshot counts, and settles those in the same transaction (PLR-330).
const sealing = (count: number, sum: number) => ({
  ...customer,
  customer_id: null,
  meter_id: "meter",
  cold_until: bucket + BUCKET_SIZE,
  version: 1791807000000005,
  count,
  sum,
  min: count ? 10 : null,
  max: count ? 10 : null,
  credited_units: 100,
});

it("settles the pending events the snapshot counts, and keeps the rest", async () => {
  const outpost = await warm();
  const events = Array.from({ length: 10 }, (_, i) => usage(`event-${i}`, 10));
  for (const event of events) await outpost.track(event);
  ingested = new Set(["event-0", "event-1", "event-2", "event-3"]);
  snapshot = sealing(4, 40);
  const other = await start();
  await other.actor(customer);
  await vi.waitFor(async () => expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("6"));
  expect((await other.meter(meter))?.consumed_units).toBe(100);
  expect(await redis.hget(key, "cold:count")).toBe("4");
  expect(confirmRequests).toEqual([
    {
      reducer_id: "tokens",
      external_customer_id: "alice",
      bucket_start: bucket,
      meter_id: "meter",
      ids: events.map((event) => event.external_id),
    },
  ]);
});

it("applies the snapshot Polar read with its confirmation, not the one that asked", async () => {
  const outpost = await warm();
  const events = Array.from({ length: 10 }, (_, i) => usage(`event-${i}`, 10));
  for (const event of events) await outpost.track(event);
  snapshot = sealing(4, 40);
  // Polar stored one more event by the time it answers: both its snapshot and the confirmation
  // count it.
  ingested = new Set(["event-0", "event-1", "event-2", "event-3", "event-4"]);
  confirmSnapshot = { ...sealing(5, 50), version: 1791807000000006 };
  const other = await start();
  await other.actor(customer);
  await vi.waitFor(async () => expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("5"));
  expect(await redis.hget(key, "cold:count")).toBe("5");
  expect(await redis.hget(key, "snapshot_version")).toBe("1791807000000006");
  expect((await other.meter(meter))?.consumed_units).toBe(100);
});

it("drops a cold bucket once Polar confirmed every pending event", async () => {
  const outpost = await warm();
  const events = Array.from({ length: 3 }, (_, i) => usage(`event-${i}`, 10));
  for (const event of events) await outpost.track(event);
  ingested = new Set(events.map((event) => event.external_id));
  snapshot = sealing(3, 30);
  const other = await start();
  await other.actor(customer);
  await vi.waitFor(async () => expect(await redis.hget(key, `bucket:${bucket}:sum`)).toBeNull());
  expect(await redis.hget(key, `pending:${bucket}:sum`)).toBeNull();
  expect((await other.meter(meter))?.consumed_units).toBe(30);
});

it("confirms once per meter of a reducer and applies each meter's snapshot", async () => {
  reducers[0].meter_ids = ["meter", "other"];
  // Credits the warmup did not seed, so each meter's snapshot has to land.
  meterSnapshots = {
    meter: { credited_units: 80, delay: 0 },
    other: { credited_units: 50, delay: 0 },
  };
  const outpost = await warm();
  const events = [usage("event-0", 10), usage("event-1", 10)];
  for (const event of events) await outpost.track(event);
  ingested = new Set(events.map((event) => event.external_id));
  snapshot = sealing(2, 20);
  const other = await start();
  await other.actor(customer);
  await vi.waitFor(async () => expect(await redis.hget(key, "credited:other")).toBe("50"));
  expect(await redis.hget(key, "credited:meter")).toBe("80");
  expect(confirmRequests.map((request) => request.meter_id).sort()).toEqual(["meter", "other"]);
});

it("applies a snapshot Polar did not confirm in time, keeping its events pending", async () => {
  const outpost = await warm();
  for (let i = 0; i < 3; i++) await outpost.track(usage(`event-${i}`, 10));
  answerConfirm = false;
  snapshot = sealing(3, 30);
  const other = await start({ confirmTimeout: 50 });
  await other.actor(customer);
  // The read moves once the snapshot applied and reached the cache: Polar's 30 plus the 30 pending.
  await vi.waitFor(async () => expect((await other.meter(meter))?.consumed_units).toBe(60));
  expect(confirmRequests).toHaveLength(1);
  expect(await redis.hget(key, "cold:count")).toBe("3");
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("3");
});

it("asks for a bucket's pending events a thousand at a time", async () => {
  const outpost = await warm();
  for (let i = 0; i < 1_001; i++) await outpost.track(usage(`event-${i}`, 1));
  snapshot = sealing(0, 0);
  const other = await start();
  await other.actor(customer);
  await vi.waitFor(() => expect(confirmRequests).toHaveLength(2));
  expect(confirmRequests.map((request) => (request.ids as string[]).length)).toEqual([1_000, 1]);
});

it("forgets pending events an hour after Polar sealed their bucket", async () => {
  const outpost = await warm();
  await outpost.track(usage("lost", 10));
  await seal(bucket + BUCKET_SIZE + 3_600_000_000);
  await outpost["synchronize"]();
  expect((await outpost.meter(meter))?.consumed_units).toBe(0);
  expect(await redis.hget(key, `bucket:${bucket}:sum`)).toBeNull();
});

it("sends telemetry spans tagged with the connection ID", async () => {
  snapshot = {
    ...customer,
    customer_id: null,
    meter_id: "meter",
    cold_until: bucket,
    version: 1791807000000003,
    count: 0,
    sum: 0,
    min: null,
    max: null,
    credited_units: 10,
  };
  const outpost = await start();
  await vi.waitFor(() => expect(outpost.connectionId).toBe(connectionId));
  await ingest(outpost, 3);
  await vi.waitFor(() => {
    expect(exported.map((span) => span.name)).toContain("outpost.snapshot.received");
    expect(outpost["syncReceived"]).toBeGreaterThan(0);
  });
  await outpost.meter(meter);
  await outpost.close();

  expect(dataPoints("outpost.ingest.buckets")).toMatchObject([{ value: 1 }]);
  expect(dataPoints("outpost.ingest.duration")).toMatchObject([
    { attributes: { "outpost.outcome": "ok" }, value: { count: 1 } },
  ]);
  for (const name of ["outpost.ingest.duration", "outpost.read.duration"])
    expect(
      metrics
        .flatMap((resourceMetrics) => resourceMetrics.scopeMetrics)
        .flatMap((scopeMetrics) => scopeMetrics.metrics)
        .find((metric) => metric.descriptor.name === name)?.dataPointType,
    ).toBe(DataPointType.EXPONENTIAL_HISTOGRAM);
  expect(new Set(exported.map((span) => span.name))).toEqual(
    new Set([
      "outpost.redis.connect",
      "outpost.redis.subscribe",
      "outpost.websocket.connect",
      "outpost.snapshot.received",
      "outpost.sync",
      "outpost.websocket.disconnect",
      "outpost.redis.disconnect",
    ]),
  );
  expect(
    exported
      .filter((span) => span.name === "outpost.redis.connect")
      .map((span) => span.attributes["outpost.redis.connection"]),
  ).toEqual(["primary", "subscriber"]);
  const beforeConnection = [
    "outpost.redis.connect",
    "outpost.redis.subscribe",
    "outpost.websocket.connect",
  ];
  for (const span of exported.filter((span) => !beforeConnection.includes(span.name)))
    expect(span.attributes["outpost.connection_id"]).toBe(connectionId);
});

it.each([
  ["option", false, undefined],
  ["environment", true, "0"],
] as const)("turns telemetry off through the %s", async (_, telemetry, environment) => {
  if (environment !== undefined) vi.stubEnv(TELEMETRY_ENV, environment);
  const outpost = new Outpost(redisServer.socket, {
    client: core,
    telemetry,
    snapshotTimeout: 100,
  });
  outposts.push(outpost);
  await outpost.start();
  await ingest(outpost, 3);
  await outpost.flushTelemetry();
  await outpost.close();
  expect(exported).toEqual([]);
  expect(metrics).toEqual([]);
});

it.each([
  [8, 5, false],
  [9, 6, true],
] as const)(
  "reports the local value a snapshot replaces (sum %d, max %d, delta %s)",
  async (snapshotSum, snapshotMax, delta) => {
    await redis.hset(key, {
      cold_until: bucket - BUCKET_SIZE,
      "cold:count": 1,
      "cold:sum": 5,
      "cold:min": 5,
      "cold:max": 5,
      [`bucket:${bucket - BUCKET_SIZE}:count`]: 1,
      [`bucket:${bucket - BUCKET_SIZE}:sum`]: 3,
      [`bucket:${bucket - BUCKET_SIZE}:min`]: 3,
      [`bucket:${bucket - BUCKET_SIZE}:max`]: 3,
    });
    snapshot = {
      ...customer,
      customer_id: null,
      meter_id: "meter",
      cold_until: bucket,
      version: 1791807000000004,
      count: 2,
      sum: snapshotSum,
      min: 3,
      max: snapshotMax,
      credited_units: 10,
    };
    const outpost = await start();
    await outpost.actor(customer);
    await vi.waitFor(() =>
      expect(exported.map((span) => span.name)).toContain("outpost.snapshot.received"),
    );

    const span = exported.find((span) => span.name === "outpost.snapshot.received")!;
    expect(span.attributes).toMatchObject({
      "outpost.customer": "external:alice",
      "outpost.local.cold_until": bucket - BUCKET_SIZE,
      "outpost.local.count": 2,
      "outpost.local.sum": 8,
      "outpost.local.min": 3,
      "outpost.local.max": 5,
      "outpost.snapshot.sum": snapshotSum,
      "outpost.snapshot.delta": delta,
    });
  },
);

it("reports a bucket already cold by its pending part only", async () => {
  await redis.hset(key, {
    cold_until: bucket - BUCKET_SIZE,
    "cold:count": 1,
    "cold:sum": 5,
    "cold:min": 5,
    "cold:max": 5,
    // Already cold, kept for one unconfirmed event: the local read adds that event only.
    [`bucket:${bucket - 2 * BUCKET_SIZE}:count`]: 3,
    [`bucket:${bucket - 2 * BUCKET_SIZE}:sum`]: 9,
    [`bucket:${bucket - 2 * BUCKET_SIZE}:min`]: 2,
    [`bucket:${bucket - 2 * BUCKET_SIZE}:max`]: 4,
    [`pending:${bucket - 2 * BUCKET_SIZE}:count`]: 1,
    [`pending:${bucket - 2 * BUCKET_SIZE}:sum`]: 2,
    [`pending:${bucket - 2 * BUCKET_SIZE}:min`]: 2,
    [`pending:${bucket - 2 * BUCKET_SIZE}:max`]: 2,
    [`bucket:${bucket - BUCKET_SIZE}:count`]: 1,
    [`bucket:${bucket - BUCKET_SIZE}:sum`]: 3,
    [`bucket:${bucket - BUCKET_SIZE}:min`]: 3,
    [`bucket:${bucket - BUCKET_SIZE}:max`]: 3,
  });
  snapshot = {
    ...customer,
    customer_id: null,
    meter_id: "meter",
    cold_until: bucket,
    version: 1791807000000004,
    count: 3,
    sum: 10,
    min: 2,
    max: 5,
    credited_units: 10,
  };
  const outpost = await start();
  await outpost.actor(customer);
  await vi.waitFor(() =>
    expect(exported.map((span) => span.name)).toContain("outpost.snapshot.received"),
  );

  const span = exported.find((span) => span.name === "outpost.snapshot.received")!;
  expect(span.attributes).toMatchObject({
    "outpost.local.cold_until": bucket - BUCKET_SIZE,
    "outpost.local.count": 3,
    "outpost.local.sum": 10,
    "outpost.local.min": 2,
    "outpost.local.max": 5,
    "outpost.snapshot.delta": false,
  });
});

it("reconnects the WebSocket and keeps serving from Redis", async () => {
  const outpost = await start();
  connections[0].terminate();
  expect(await ingest(outpost, 3)).toBeUndefined();
  await vi.waitFor(() => expect(connections).toHaveLength(2), { timeout: 3_000 });
  await vi.waitFor(() => expect(outpost.connectionId).toBe(connectionId));
  expect(outpost.connected).toBe(true);
  expect(await ingest(outpost, 3)).toBeUndefined();
});

it("fails when Polar refuses the reconnection", async () => {
  const outpost = await start();
  refuseConnections = true;
  connections[0].terminate();
  await vi.waitFor(() => expect(outpost.actor(customer)).rejects.toThrow("refused"), {
    timeout: 3_000,
  });
  expect(outpost.connected).toBe(false);
});

it("fails to start without Redis instead of hanging", async () => {
  const outpost = new Outpost(`${redisServer.socket}.missing`, { client: core });
  await expect(outpost.start()).rejects.toThrow();
}, 10_000);

const aliceSnapshot = {
  ...customer,
  customer_id: null,
  meter_id: "meter",
  cold_until: bucket,
  version: 1791807000000005,
  count: 1,
  sum: 3,
  min: 3,
  max: 3,
  credited_units: 10,
};

it.each([
  Object.assign(new Error("getaddrinfo EAI_AGAIN redis.test"), { code: "EAI_AGAIN" }),
  Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }),
  Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
  new Error("Command timed out"),
  new Error("Connection is closed."),
  new Error("Stream isn't writeable and enableOfflineQueue options is false"),
  Object.assign(new Error("Reached the max retries per request limit"), {
    name: "MaxRetriesPerRequestError",
  }),
])("recovers from a snapshot Redis failure: %s", async (error) => {
  snapshot = aliceSnapshot;
  const outpost = await start();
  const applySnapshot = vi
    .spyOn(outpost["redis"]!, "outpostApplySnapshot")
    .mockRejectedValueOnce(error);
  await outpost.actor(customer);
  await vi.waitFor(() => expect(connections).toHaveLength(2), { timeout: 3_000 });
  await outpost.actor(customer);
  // The snapshot can take longer than the test's snapshotTimeout to arrive after a reconnection.
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(3));
  await ingest(outpost, 5);
  expect((await outpost.meter(meter))?.consumed_units).toBe(8);
  expect((await outpost.meter(meter))?.balance).toBe(2);
  expect(outpost.connected).toBe(true);
  expect(applySnapshot).toHaveBeenCalledTimes(2);
});

it.each([
  new Error("WRONGPASS invalid username-password pair"),
  new Error("NOAUTH Authentication required"),
  new Error("NOPERM this user has no permissions"),
  new TypeError("Invalid snapshot"),
  new Error("Unexpected failure"),
])("keeps snapshot authentication and unrelated errors fatal: %s", async (error) => {
  snapshot = aliceSnapshot;
  const outpost = await start();
  vi.spyOn(outpost["redis"]!, "outpostApplySnapshot").mockRejectedValueOnce(error);
  await outpost.actor(customer);
  await vi.waitFor(() => expect(outpost.meter(meter)).rejects.toBe(error));
  await expect(ingest(outpost, 5)).rejects.toBe(error);
  expect(outpost.connected).toBe(false);
  expect(connections).toHaveLength(1);
});

it("gives the state a day to live, refreshed by each read, write and confirmation", async () => {
  snapshot = aliceSnapshot;
  const outpost = await start();
  await outpost.actor(customer);
  expect((await outpost.meter(meter))?.balance).toBe(7);
  const ttl = await redis.ttl(key);
  expect(ttl).toBeGreaterThan(0);
  expect(ttl).toBeLessThanOrEqual(86_400);
  await redis.expire(key, 60);
  const settled = usage(eventId(), 3);
  await outpost.track(settled);
  expect(await redis.ttl(key)).toBeGreaterThan(60);
  const pending = await redis.ttl(`outpost:v1:pending:external:alice:tokens:${bucket}`);
  expect(pending).toBeGreaterThan(0);
  expect(pending).toBeLessThanOrEqual(3_900);
  await redis.expire(key, 60);
  await outpost.confirm([settled]);
  expect(await redis.ttl(key)).toBeGreaterThan(60);
});

it("waits for the first snapshot on a cold read", async () => {
  snapshot = aliceSnapshot;
  const outpost = await start();
  await outpost.actor(customer);
  expect((await outpost.meter(meter))?.balance).toBe(7);
  expect(await readOutcomes(outpost)).toEqual([
    ["actor", "ready"],
    ["meter", "ready"],
  ]);
});

it("arms no timer on a warm read", async () => {
  snapshot = aliceSnapshot;
  const outpost = await start();
  await outpost.actor(customer);
  await outpost.meter(meter);
  const setTimeout = vi.spyOn(globalThis, "setTimeout");
  expect((await outpost.meter(meter))?.balance).toBe(7);
  expect(setTimeout).not.toHaveBeenCalled();
});

it("reads null for a meter Outpost does not know", async () => {
  const outpost = await start();
  expect(await outpost.meter({ ...customer, meter_id: "other" })).toBeNull();
  expect(await readOutcomes(outpost)).toEqual([["meter", "unknown_meter"]]);
});

it("reports reads without configuration as not ready", async () => {
  delayConfiguration = true;
  const outpost = await start();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const reads = [outpost.actor(customer), outpost.meter(meter)].map((read) =>
    expect(read).rejects.toThrow("timed out"),
  );
  await vi.advanceTimersByTimeAsync(5_000);
  await Promise.all(reads);
  expect(await readOutcomes(outpost)).toEqual([
    ["actor", "not_ready"],
    ["meter", "not_ready"],
  ]);
});

it("reports a failed read as an error", async () => {
  const outpost = await start();
  outpost["failure"] = new PolarOutpostError("Outpost stopped");
  await expect(outpost.meter(meter)).rejects.toThrow("Outpost stopped");
  expect(await readOutcomes(outpost)).toEqual([["meter", "error"]]);
});

it("reads null for a customer Polar does not know", async () => {
  snapshot = { ...aliceSnapshot, customer_exists: false };
  const outpost = await start();
  await outpost.actor(customer);
  expect(await outpost.meter(meter)).toBeNull();
  expect(await readOutcomes(outpost)).toEqual([
    ["actor", "unknown_customer"],
    ["meter", "unknown_customer"],
  ]);
});

it("reports a read whose snapshot never arrives as not ready", async () => {
  const outpost = await start();
  await outpost.actor(customer);
  await expect(outpost.meter(meter)).rejects.toThrow("snapshot is not ready");
  expect(await readOutcomes(outpost)).toEqual([
    ["actor", "not_ready"],
    ["meter", "not_ready"],
  ]);
});

it.each([
  [50, 200, "ready"],
  [500, 0, "not_ready"],
])(
  "waits for the snapshot of the meter it reads (delay %i ms)",
  async (delay, credited, outcome) => {
    reducers[0].meter_ids = ["meter", "shared"];
    snapshot = aliceSnapshot;
    meterSnapshots = {
      meter: { credited_units: 100, delay: 0 },
      shared: { credited_units: 200, delay },
    };
    const outpost = await start();
    expect((await outpost.meter({ ...customer, meter_id: "shared" }))?.credited_units).toBe(
      credited,
    );
    expect(await readOutcomes(outpost)).toEqual([["meter", outcome]]);
  },
);

it("reads the value of a customer created after a miss", async () => {
  snapshot = { ...aliceSnapshot, customer_exists: false };
  const outpost = await start();
  expect(await outpost.meter(meter)).toBeNull();
  snapshot = aliceSnapshot;
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.balance).toBe(7));
});

it("reports sync counts when telemetry is flushed", async () => {
  const writer = await start();
  const reader = await start();
  await reader.actor(customer);
  for (const event of [
    { ...customer, name: "api_call", external_id: eventId(), timestamp, metadata: { tokens: 1 } },
    {
      external_customer_id: "bob",
      name: "api_call",
      external_id: eventId(),
      timestamp,
      metadata: { tokens: 1 },
    },
  ])
    await writer.track(event);
  await vi.waitFor(() => expect(reader["syncReceived"]).toBe(2));
  exported.length = 0;
  await reader.flushTelemetry();
  await reader.flushTelemetry();
  expect(
    exported.filter((span) => span.name === "outpost.sync").map((span) => span.attributes),
  ).toEqual([
    {
      "outpost.connection_id": connectionId,
      "outpost.sync.received": 2,
      "outpost.sync.applied": 1,
    },
  ]);
});

it("does not split a message in flight across sync reports", async () => {
  const writer = await start();
  const reader = await start();
  let receiving = false;
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  reader["receiveState"] = async () => {
    receiving = true;
    await released;
    return true;
  };
  await ingest(writer, 1);
  await vi.waitFor(() => expect(receiving).toBe(true));
  await reader.flushTelemetry();
  release();
  await vi.waitFor(() => expect(reader["syncApplied"]).toBe(1));
  exported.length = 0;
  await reader.flushTelemetry();
  expect(
    exported.filter((span) => span.name === "outpost.sync").map((span) => span.attributes),
  ).toEqual([
    {
      "outpost.connection_id": connectionId,
      "outpost.sync.received": 1,
      "outpost.sync.applied": 1,
    },
  ]);
});

it("flushes buffered telemetry on demand", async () => {
  const outpost = await start();
  const forceFlush = vi.spyOn(outpost["tracerProvider"]!, "forceFlush");
  await outpost.flushTelemetry();
  expect(forceFlush).toHaveBeenCalledOnce();
});

it("raises Outpost errors when Redis fails", async () => {
  snapshot = aliceSnapshot;
  const outpost = await start();
  const redisError = new Error("Connection is closed.");
  const read = vi.spyOn(outpost["redis"]!, "outpostReadState").mockRejectedValue(redisError);
  const readError = outpost.meter(meter);
  await expect(readError).rejects.toBeInstanceOf(UnavailableRedisError);
  await expect(readError).rejects.toMatchObject({ cause: redisError });
  expect(await readOutcomes(outpost)).toEqual([["meter", "redis_unavailable"]]);
  read.mockRestore();
  const pipeline = outpost["redis"]!.pipeline();
  vi.spyOn(outpost["redis"]!, "pipeline").mockReturnValue(pipeline);
  const write = vi.spyOn(pipeline, "exec").mockRejectedValue(redisError);
  const writeError = ingest(outpost, 3);
  await expect(writeError).rejects.toBeInstanceOf(UnavailableRedisError);
  await expect(writeError).rejects.toMatchObject({ cause: redisError });
  expect(write).toHaveBeenCalled();
});

it("raises an Outpost error when Redis is unavailable at startup", async () => {
  const outpost = new Outpost(`${redisServer.socket}.missing`, { client: core });
  await expect(outpost.start()).rejects.toBeInstanceOf(UnavailableRedisError);
}, 10_000);

it("fails fast while Redis is unavailable", async () => {
  const outpost = await start();
  outpost["subscriber"]!.disconnect();
  await vi.waitFor(() => expect(outpost["isSynced"]).toBe(false));
  expect(outpost.connected).toBe(false);
  const started = performance.now();
  await expect(
    outpost.meter({ external_customer_id: "bob", meter_id: "meter" }),
  ).rejects.toBeInstanceOf(UnavailableRedisError);
  expect(performance.now() - started).toBeLessThan(500);
  expect(await readOutcomes(outpost)).toEqual([["meter", "redis_unavailable"]]);
});

it("composes buffered Polar delivery with Outpost through the client factory", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response('{"inserted":1,"duplicates":0}'));
  await seed();
  const [baseUrl] = core.buildRequest("GET", "");
  const polar = createPolar({ baseUrl, accessToken: "test-token", organizationId: "org" });
  const reader = await start();
  {
    await using metering = await polar
      .metering({ outpost: { redisUrl: redisServer.socket } })
      .start();
    await metering.track({
      ...customer,
      name: "api",
      external_id: eventId(),
      timestamp,
      metadata: { tokens: 2 },
    });
    expect((await reader.meter(meter))?.consumed_units).toBe(12);
    expect(fetch).not.toHaveBeenCalled();
  }
  expect(fetch).toHaveBeenCalledOnce();
});

it.each(["abc", "Infinity", "NaN", "1e999"])("rejects the stored value %j", (value) => {
  expect(() => decodeState(["epoch", "epoch", "revision", "1", "cold:sum", value])).toThrow();
});

// Fails the day a write stores a value that JSON and Number don't read the same way.
it("stores values that parse the same with and without JSON", async () => {
  snapshot = {
    ...customer,
    customer_id: null,
    meter_id: "meter",
    cold_until: bucket,
    version: 1791807000000001,
    count: 3,
    sum: 0.30000000000000004,
    min: -1e-7,
    max: 1e21,
    credited_units: 2 ** 53 + 2,
  };
  const outpost = await start();
  await outpost.actor(customer);
  await vi.waitFor(async () => expect(await redis.hexists(key, "cold:sum")).toBe(1));
  for (const tokens of [0, -0, 1, -2, 0.1, 0.2, 1e-7, 1e21, 2 ** 53, -1.5e300])
    await ingest(outpost, tokens);
  const stored = await redis.hgetall(key);
  delete stored.epoch;
  for (const [field, value] of Object.entries(stored))
    expect([field, Number(value)]).toEqual([field, JSON.parse(value)]);
});
