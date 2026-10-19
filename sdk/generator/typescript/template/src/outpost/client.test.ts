import type { ReadableSpan } from "@opentelemetry/sdk-trace";

import { Pipeline, Redis } from "ioredis";
import { once } from "node:events";
import { createRequire } from "node:module";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";

import { createPolar } from "../{{ (ir.versions[-2] | default(ir.versions[0])).version }}/client";
import { ClientBase } from "../base";
import { Outpost, type OutpostOptions, UnavailableRedisError } from "./client";
import { BUCKET_SIZE, getBucketStart, type Reducer } from "./reducer";
import { APPLY_SNAPSHOT_SCRIPT } from "./scripts";
import { TELEMETRY_ENV } from "./telemetry";
import { startRedisServer, type RedisServer } from "./testing";

const { exported } = vi.hoisted(() => ({ exported: [] as ReadableSpan[] }));
vi.mock("./telemetry", async (importOriginal) => {
  const { SimpleSpanProcessor, TracerProvider } = await import("@opentelemetry/sdk-trace");
  return {
    ...(await importOriginal<typeof import("./telemetry")>()),
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
  };
});

const timestamp = "2026-10-12T12:00:00Z";
const bucket = getBucketStart(Date.parse(timestamp) * 1000);
const customer = { external_customer_id: "alice" };
const meter = { ...customer, meter_id: "meter" };
const key = "outpost:state:external:alice:tokens";
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
  exported.length = 0;
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
const readOutcomes = () =>
  exported
    .filter((span) => ["outpost.actor", "outpost.customer_meter"].includes(span.name))
    .map((span) => [span.name, span.attributes["outpost.read.outcome"]]);
const ingest = (outpost: Outpost, tokens: number) =>
  outpost.ingest({ ...customer, name: "api_call", timestamp, metadata: { tokens } });

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
    await redis.hset(`outpost:state:external:alice:tokens-${i}`, {
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
      await redis.hget(`outpost:state:external:alice:tokens-${i}`, `bucket:${bucket}:count`),
    ).toBe("1");
  }
  if (fail) {
    outpost["channel"] = "outpost:test:unsubscribed";
    await redis.hset("outpost:state:external:alice:tokens-1", `bucket:${bucket}:sum`, "invalid");
    await expect(ingest(outpost, 2)).rejects.toBeInstanceOf(UnavailableRedisError);
    expect(execute).toHaveBeenCalledTimes(2);
    for (const i of [0, 2]) {
      expect(await outpost.meter({ ...customer, meter_id: `meter-${i}` })).toMatchObject({
        consumed_units: 5,
        balance: 95,
      });
      expect(
        await redis.hget(`outpost:state:external:alice:tokens-${i}`, `bucket:${bucket}:sum`),
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

it("propagates snapshots, removes cold buckets, and rejects older cutoffs", async () => {
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
    "outpost:0:updates",
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
  await writer.ingest({
    ...customer,
    name: "api",
    timestamp: "2026-10-12T11:55:00Z",
    metadata: { tokens: 999 },
  });
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
  const averageKey = "outpost:state:external:alice:average";
  await redis.eval(
    APPLY_SNAPSHOT_SCRIPT,
    1,
    key,
    "external:alice:tokens",
    "outpost:0:updates",
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
    "outpost:0:updates",
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
    "outpost:0:updates",
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
  await Promise.all(
    [first, second].map(async (writer, index) => {
      for (let i = 0; i < 10; i++) await ingest(writer, index ? 8 : 2);
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
  await first.ingest({
    ...customer,
    name: "api",
    timestamp: "2026-10-12T12:05:00Z",
    metadata: { tokens: 4 },
  });
  await redis.eval(
    APPLY_SNAPSHOT_SCRIPT,
    1,
    key,
    "external:alice:tokens",
    "outpost:0:updates",
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
  expect(await redis.hget(key, `bucket:${bucket}:sum`)).toBeNull();
  expect(await redis.hget(averageKey, `bucket:${bucket}:sum`)).toBe("100");
  expect((await first.meter(meter))?.balance).toBe(26);
  expect(
    (await first.meter({ ...customer, meter_id: "average-meter" }))?.consumed_units,
  ).toBeCloseTo(124 / 23);
  expect((await first.meter({ ...customer, meter_id: "shared" }))?.credited_units).toBe(200);
  expect(await redis.exists("outpost:state:customer:alice:tokens")).toBe(0);
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

it("preserves microsecond cutoffs when removing and rejecting local buckets", async () => {
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
  await ingest(outpost, 2);
  await outpost.ingest({
    ...customer,
    name: "api",
    timestamp: "2026-10-12T12:05:00Z",
    metadata: { tokens: 4 },
  });
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
  expect((await outpost.meter(meter))?.consumed_units).toBe(6);
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

  expect(new Set(exported.map((span) => span.name))).toEqual(
    new Set([
      "outpost.redis.connect",
      "outpost.redis.subscribe",
      "outpost.websocket.connect",
      "outpost.ingest",
      "outpost.customer_meter",
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

it("waits for the first snapshot on a cold read", async () => {
  snapshot = aliceSnapshot;
  const outpost = await start();
  await outpost.actor(customer);
  expect((await outpost.meter(meter))?.balance).toBe(7);
  expect(readOutcomes()).toEqual([
    ["outpost.actor", "ready"],
    ["outpost.customer_meter", "ready"],
  ]);
});

it("reads null for a meter Outpost does not know", async () => {
  const outpost = await start();
  expect(await outpost.meter({ ...customer, meter_id: "other" })).toBeNull();
  expect(readOutcomes()).toEqual([["outpost.customer_meter", "unknown_meter"]]);
});

it("reports reads without configuration as not ready", async () => {
  const outpost = await start();
  const timedOut = new Error("Outpost operation timed out");
  outpost["waitConfigured"] = () => Promise.reject(timedOut);
  await expect(outpost.actor(customer)).rejects.toBe(timedOut);
  await expect(outpost.meter(meter)).rejects.toBe(timedOut);
  expect(readOutcomes()).toEqual([
    ["outpost.actor", "not_ready"],
    ["outpost.customer_meter", "not_ready"],
  ]);
});

it("reads null for a customer Polar does not know", async () => {
  snapshot = { ...aliceSnapshot, customer_exists: false };
  const outpost = await start();
  await outpost.actor(customer);
  expect(await outpost.meter(meter)).toBeNull();
  expect(readOutcomes()).toEqual([
    ["outpost.actor", "unknown_customer"],
    ["outpost.customer_meter", "unknown_customer"],
  ]);
});

it("reports a read whose snapshot never arrives as not ready", async () => {
  const outpost = await start();
  await outpost.actor(customer);
  await expect(outpost.meter(meter)).rejects.toThrow("snapshot is not ready");
  expect(readOutcomes()).toEqual([
    ["outpost.actor", "not_ready"],
    ["outpost.customer_meter", "not_ready"],
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
    expect(readOutcomes()).toEqual([["outpost.customer_meter", outcome]]);
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
    { ...customer, name: "api_call", timestamp, metadata: { tokens: 1 } },
    { external_customer_id: "bob", name: "api_call", timestamp, metadata: { tokens: 1 } },
  ])
    await writer.ingest(event);
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
  expect(readOutcomes()).toEqual([["outpost.customer_meter", "redis_unavailable"]]);
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
  expect(readOutcomes()).toEqual([["outpost.customer_meter", "redis_unavailable"]]);
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
    await using ingestion = await polar
      .ingestion({ outpost: { redisUrl: redisServer.socket } })
      .start();
    await ingestion.ingest({ ...customer, name: "api", timestamp, metadata: { tokens: 2 } });
    expect((await reader.meter(meter))?.consumed_units).toBe(12);
    expect(fetch).not.toHaveBeenCalled();
  }
  expect(fetch).toHaveBeenCalledOnce();
});
