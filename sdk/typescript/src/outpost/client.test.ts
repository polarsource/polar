import type { ReadableSpan } from "@opentelemetry/sdk-trace";

import { DataPointType, type DataPoint, type ResourceMetrics } from "@opentelemetry/sdk-metrics";
import { Pipeline, Redis } from "ioredis";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { createPolar } from "../2026-10/client";
import { ClientBase } from "../base";
import { UnknownMeterError } from "../metering/errors";
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
const key = "outpost:v1:org-1:state:external:alice:tokens";
const creditKey = "outpost:v1:org-1:state:external:alice:credits";
let redisServer: RedisServer;
let redis: Redis;
let server: Server;
let core: ClientBase;
let reducers: Reducer[];
let snapshot: Record<string, unknown> | undefined;
let refuseConnections = false;
// The organization Polar configures the next Outpost with: it namespaces its Redis keys.
let organization = "org-1";
// Polar's change log: the next pull of any instance takes them.
let changes: Record<string, unknown>[] = [];
let resetChanges = false;
let configurationChanged = false;
const changeRequests: (string | null)[] = [];
let changesStatus = 200;
let cursor = 0;
// Each reducer's snapshot: `snapshot` for a usage reducer, the credits granted at its version for a
// credit reducer, with the reducer's override on top.
let credited = 100;
let reducerSnapshots: Record<string, Record<string, unknown> & { delay?: number }> = {};
// The events Polar counted: a confirm request is answered with the ids among them and the
// snapshot read with them, `snapshot` unless overridden.
let ingested = new Set<string>();
let answerConfirm = true;
let confirmSnapshot: Record<string, unknown> | undefined;
const confirmRequests: Record<string, unknown>[] = [];
const meterUsageRequests: Record<string, unknown>[] = [];
const outposts: Outpost[] = [];

const creditReducer = (id: string, meterId: string): Reducer => ({
  id,
  kind: "credit",
  meter_ids: [meterId],
  filter: {
    conjunction: "and",
    clauses: [
      { property: "source", operator: "eq", value: "system" },
      { property: "name", operator: "eq", value: "meter.credited" },
      { property: "metadata.meter_id", operator: "eq", value: meterId },
    ],
  },
  aggregation: { func: "sum", property: "units" },
});
// Polar's totals of every credit granted up to the version: their cutoff is the version.
const creditSnapshot = (units: number, version: number) => ({
  cold_until: version,
  version,
  count: 1,
  sum: units,
  min: units,
  max: units,
});
const applySnapshot = (
  identity: string,
  coldUntil: number,
  version: number,
  count: number,
  sum: number,
  min: number | "" = "",
  max: number | "" = "",
) =>
  redis.eval(
    APPLY_SNAPSHOT_SCRIPT,
    1,
    `outpost:v1:${organization}:state:${identity}`,
    identity,
    `outpost:v1:${organization}:0:updates`,
    "epoch",
    coldUntil,
    version,
    count,
    sum,
    min,
    max,
  );

beforeAll(async () => {
  redisServer = await startRedisServer();
  redis = new Redis(redisServer.socket);
  await once(redis, "ready");
  server = createServer((request, response) => {
    void answer(request, response);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (typeof address === "string" || !address) throw new Error("Missing server address");
  core = new ClientBase({
    baseUrl: `http://127.0.0.1:${address.port}`,
    accessToken: "test-token",
    version: "2026-10",
    organizationId: "org",
  });
});

const respond = (response: ServerResponse, body: unknown, status = 200): void => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
};

// Polar's side of Outpost: the configuration, the snapshots, the confirmations and the changes.
const answer = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  expect(request.headers.authorization).toBe("Bearer test-token");
  expect(request.headers["polar-organization"]).toBe("org");
  let data = "";
  for await (const chunk of request) data += chunk;
  const body = data ? JSON.parse(data) : undefined;
  if (refuseConnections) return respond(response, {}, 401);
  const url = new URL(request.url!, "http://polar");
  switch (`${request.method} ${url.pathname}`) {
    case "GET /v1/outpost/configuration":
      return respond(response, { organization_id: organization, reducers });
    case "POST /v1/outpost/meter-usage": {
      meterUsageRequests.push(body);
      if (!snapshot) return respond(response, []);
      const reducerId: string = body.reducer_id;
      const kind = reducers.find((reducer) => reducer.id === reducerId)?.kind;
      const { delay = 0, ...override } = reducerSnapshots[reducerId] ?? {};
      const payload = {
        customer_exists: true,
        ...snapshot,
        ...(kind === "credit" && creditSnapshot(credited, snapshot.version as number)),
        reducer_id: reducerId,
        ...override,
      };
      setTimeout(() => respond(response, [payload]), delay);
      return;
    }
    case "POST /v1/outpost/confirm": {
      confirmRequests.push(body);
      // Unanswered: the client gives up after its confirm timeout.
      if (!answerConfirm) return;
      const { ids, ...payload } = body;
      const { delay: _delay, ...override } = reducerSnapshots[payload.reducer_id] ?? {};
      return respond(response, {
        customer_id: null,
        external_customer_id: null,
        ...payload,
        ids: ids.filter((id: string) => ingested.has(id)),
        snapshot: {
          customer_exists: true,
          ...(confirmSnapshot ?? snapshot),
          reducer_id: payload.reducer_id,
          ...override,
        },
      });
    }
    case "GET /v1/outpost/changes": {
      changeRequests.push(url.searchParams.get("cursor"));
      if (changesStatus !== 200) return respond(response, {}, changesStatus);
      const page = {
        changes: changes.splice(0).map((change) => ({ customer_exists: true, ...change })),
        cursor: `${++cursor}-0`,
        has_more: false,
        reset: resetChanges,
        configuration_changed: configurationChanged,
        next_poll_in: 30,
      };
      resetChanges = false;
      configurationChanged = false;
      return respond(response, page);
    }
  }
  respond(response, {}, 404);
};

beforeEach(async () => {
  await redis.flushdb();
  reducers = [
    {
      id: "tokens",
      kind: "usage",
      meter_ids: ["meter"],
      filter: { conjunction: "and", clauses: [] },
      aggregation: { func: "sum", property: "tokens" },
    },
    creditReducer("credits", "meter"),
  ];
  snapshot = undefined;
  refuseConnections = false;
  organization = "org-1";
  changes = [];
  resetChanges = false;
  configurationChanged = false;
  changeRequests.length = 0;
  changesStatus = 200;
  meterUsageRequests.length = 0;
  credited = 100;
  reducerSnapshots = {};
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
  server.closeAllConnections();
});

afterAll(async () => {
  redis?.disconnect();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
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
// Adds snapshots to Polar's changes and pulls them.
const deliver = async (outpost: Outpost, ...payloads: Record<string, unknown>[]): Promise<void> => {
  changes.push(...payloads);
  await outpost["pull"]();
};
const seed = async (cold = 10): Promise<void> => {
  await redis.hset(key, {
    cold_until: bucket,
    "cold:count": cold,
    "cold:sum": cold,
    "cold:min": cold,
    "cold:max": cold,
  });
  await redis.hset(creditKey, { cold_until: bucket, "cold:count": 1, "cold:sum": 100 });
};
const tokensSnapshotSpan = () =>
  exported.find(
    (span) =>
      span.name === "outpost.snapshot.received" &&
      span.attributes["outpost.reducer_id"] === "tokens",
  );
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

it("keeps an instance ID while started", async () => {
  const outpost = await start();
  await ingest(outpost, 3);
  expect(outpost.connectionId).toMatch(/^[0-9a-f-]{36}$/);
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
  for (let i = 0; i < bucketCount; i++)
    await redis.hset(
      `outpost:v1:${organization}:state:external:alice:tokens-${i}`,
      "cold_until",
      bucket,
    );
  const outpost = await start();
  const execute = vi.spyOn(Pipeline.prototype, "exec");
  await ingest(outpost, 3);
  expect(execute).toHaveBeenCalledOnce();
  for (let i = 0; i < bucketCount; i++) {
    expect(await outpost.meter({ ...customer, meter_id: `meter-${i}` })).toMatchObject({
      consumed_units: 3,
      balance: -3,
    });
    expect(
      await redis.hget(
        `outpost:v1:${organization}:state:external:alice:tokens-${i}`,
        `bucket:${bucket}:count`,
      ),
    ).toBe("1");
  }
  if (fail) {
    outpost["channel"] = "outpost:test:unsubscribed";
    await redis.hset(
      `outpost:v1:${organization}:state:external:alice:tokens-1`,
      `bucket:${bucket}:sum`,
      "invalid",
    );
    await expect(ingest(outpost, 2)).rejects.toBeInstanceOf(UnavailableRedisError);
    expect(execute).toHaveBeenCalledTimes(2);
    for (const i of [0, 2]) {
      expect(await outpost.meter({ ...customer, meter_id: `meter-${i}` })).toMatchObject({
        consumed_units: 5,
        balance: -5,
      });
      expect(
        await redis.hget(
          `outpost:v1:${organization}:state:external:alice:tokens-${i}`,
          `bucket:${bucket}:sum`,
        ),
      ).toBe("5");
    }
  }
});

it("reports a missing customer snapshot and an unknown meter", async () => {
  const outpost = await start();
  expect(await ingest(outpost, 3)).toBeUndefined();
  await expect(outpost.meter(meter)).rejects.toThrow("snapshot is not ready");
  await expect(outpost.meter({ ...customer, meter_id: "unknown" })).rejects.toThrow(
    UnknownMeterError,
  );
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
    reducer_id: "tokens",
    cold_until: bucket,
    version: 1791807000000001,
    count: 2,
    sum: 8,
    min: 3,
    max: 5,
  };
  const writer = await start();
  await deliver(writer, snapshot);
  await vi.waitFor(async () => expect((await reader.meter(meter))?.balance).toBe(89));
  expect(await redis.hexists(key, `bucket:${bucket - BUCKET_SIZE}:sum`)).toBe(0);
  await applySnapshot("external:alice:tokens", bucket - BUCKET_SIZE, 1, 1, 1, 1, 1);
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

it("publishes a customer's states on its own channel, which only its readers follow", async () => {
  await seed();
  const outpost = await start();
  await outpost.actor(customer);
  const fleet = redis.duplicate();
  const own = redis.duplicate();
  const fleetStates: unknown[] = [];
  const ownStates: unknown[] = [];
  fleet.on("message", (_channel, data) => {
    if ("customer" in JSON.parse(data)) fleetStates.push(data);
  });
  own.on("message", (_channel, data) => ownStates.push(data));
  await fleet.subscribe(`outpost:v1:${organization}:0:updates`);
  await own.subscribe(`outpost:v1:${organization}:0:updates:external:alice:tokens`);
  await ingest(outpost, 1);
  await vi.waitFor(() => expect(ownStates.length).toBeGreaterThan(0));
  expect(fleetStates).toHaveLength(0);
  fleet.disconnect();
  own.disconnect();
});

// The full states published on the updates channel until `drain`, which publishes a marker
// after everything already sent.
const listenStates = async () => {
  const listener = redis.duplicate();
  const states: unknown[] = [];
  let onDrained = () => {};
  listener.on("pmessage", (_pattern, _channel, data) => {
    const update = JSON.parse(data);
    if (update.customer === "drained") onDrained();
    else if ("state" in update) states.push(update);
  });
  await listener.psubscribe(`outpost:v1:${organization}:0:updates*`);
  const drain = async () => {
    const drained = new Promise<void>((resolve) => (onDrained = resolve));
    await redis.publish(
      `outpost:v1:${organization}:0:updates`,
      JSON.stringify({ customer: "drained", bucket: [] }),
    );
    await drained;
    return states;
  };
  return { drain, close: () => listener.disconnect() };
};

it("pulls a snapshot once for the whole fleet", async () => {
  await seed();
  const fleet = await Promise.all([start(), start(), start()]);
  for (const outpost of fleet) await outpost.actor(customer);
  changeRequests.length = 0;
  const listener = await listenStates();
  changes.push({
    ...customer,
    customer_id: null,
    reducer_id: "tokens",
    cold_until: bucket,
    version: 1791807000000001,
    count: 2,
    sum: 8,
    min: 3,
    max: 5,
  });
  await Promise.all(fleet.map((outpost) => outpost["pull"]()));
  expect(changeRequests).toHaveLength(1);
  expect(await listener.drain()).toHaveLength(1);
  expect(await redis.hget(key, "revision")).toBe("1");
  for (const outpost of fleet)
    await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(8));
  listener.close();
});

it("moves the cursor once a page is applied, and pulls the next page from it", async () => {
  const outpost = await start();
  await outpost["pull"]();
  expect(await redis.hget(`outpost:v1:${organization}:pull`, "cursor")).toBe(`${cursor}-0`);
  const applied = `${cursor}-0`;
  await seed();
  vi.spyOn(outpost["redis"]!, "outpostApplySnapshot").mockRejectedValueOnce(
    new Error("Command timed out"),
  );
  changes.push(aliceSnapshot);
  await outpost["pull"]();
  expect(await redis.hget(`outpost:v1:${organization}:pull`, "cursor")).toBe(applied);
  // Once the backoff ends, Polar serves the same change again from the same cursor.
  await redis.hdel(`outpost:v1:${organization}:pull`, "retry_at");
  changes.push(aliceSnapshot);
  await outpost["pull"]();
  expect(changeRequests.at(-1)).toBe(applied);
  expect(await redis.hget(key, "cold:sum")).toBe("3");
  expect(await redis.hget(`outpost:v1:${organization}:pull`, "cursor")).toBe(`${cursor}-0`);
});

it("skips a pulled snapshot of a customer nobody reads", async () => {
  const outpost = await start();
  await deliver(outpost, { ...aliceSnapshot });
  expect(await redis.exists(key)).toBe(0);
});

it("drops every snapshot once Polar's changes went past their retention", async () => {
  await seed();
  const outpost = await start();
  await outpost.actor(customer);
  resetChanges = true;
  await outpost["pull"]();
  expect(await redis.hget(key, "cold_until")).toBeNull();
  snapshot = aliceSnapshot;
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(3));
});

it("fetches the configuration again when Polar changed it", async () => {
  const outpost = await start();
  reducers = [...reducers, { ...reducers[0], id: "requests", meter_ids: ["requests"] }];
  configurationChanged = true;
  await outpost["pull"]();
  snapshot = aliceSnapshot;
  expect(await outpost.meter({ ...customer, meter_id: "requests" })).not.toBeNull();
});

it("pulls in the background once due, and waits for it once stale", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  snapshot = aliceSnapshot;
  const outpost = await start();
  await outpost.meter(meter);
  changeRequests.length = 0;
  vi.advanceTimersByTime(30_000);
  await outpost.meter(meter);
  await outpost.flush();
  expect(changeRequests).toHaveLength(1);
  vi.advanceTimersByTime(60_000);
  await outpost.meter(meter);
  expect(changeRequests).toHaveLength(2);
  expect(outpost["pulling"]).toBeUndefined();
});

it("backs off after a failed pull, and serves reads meanwhile", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  snapshot = aliceSnapshot;
  const outpost = await start();
  expect((await outpost.meter(meter))?.consumed_units).toBe(3);
  changeRequests.length = 0;
  changesStatus = 503;
  vi.advanceTimersByTime(60_000);
  expect((await outpost.meter(meter))?.consumed_units).toBe(3);
  expect(changeRequests).toHaveLength(1);
  // Within the backoff, a read neither waits for nor starts a pull.
  expect((await outpost.meter(meter))?.consumed_units).toBe(3);
  expect(changeRequests).toHaveLength(1);
  vi.advanceTimersByTime(1_000);
  expect((await outpost.meter(meter))?.consumed_units).toBe(3);
  await outpost["pulling"];
  expect(changeRequests).toHaveLength(2);
  // The second failure waits twice as long.
  vi.advanceTimersByTime(1_000);
  expect((await outpost.meter(meter))?.consumed_units).toBe(3);
  expect(changeRequests).toHaveLength(2);
  vi.advanceTimersByTime(1_000);
  changesStatus = 200;
  expect((await outpost.meter(meter))?.consumed_units).toBe(3);
  await outpost["pulling"];
  expect(changeRequests).toHaveLength(3);
  expect(outpost.connected).toBe(true);
});

it("holds the whole fleet back after a failed pull, and stops reads waiting for the next", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  snapshot = aliceSnapshot;
  const [first, second] = await Promise.all([start(), start()]);
  for (const outpost of [first, second]) await outpost.meter(meter);
  changeRequests.length = 0;
  changesStatus = 503;
  vi.advanceTimersByTime(60_000);
  await first["pull"]();
  expect(changeRequests).toHaveLength(1);
  await vi.waitFor(() => expect(second["pullRetryAt"]).toBeGreaterThan(Date.now()));
  // Another instance, and one that starts meanwhile, wait for the same backoff.
  const third = await start();
  for (const outpost of [second, third])
    expect((await outpost.meter(meter))?.consumed_units).toBe(3);
  expect(changeRequests).toHaveLength(1);
  // Once it ends, a read starts the next pull without waiting for it.
  vi.advanceTimersByTime(1_000);
  const pull = vi.spyOn(second as never, "pull");
  expect((await second.meter(meter))?.consumed_units).toBe(3);
  expect(pull).toHaveBeenCalledOnce();
  expect(second["pulling"]).toBeDefined();
});

it("waits for a backoff whose message it missed", async () => {
  const outpost = await start();
  changeRequests.length = 0;
  await redis.hset(`outpost:v1:${organization}:pull`, "retry_at", Date.now() + 1_000);
  await outpost["pull"]();
  expect(changeRequests).toHaveLength(0);
});

it("publishes nothing for an older snapshot or one already applied", async () => {
  await seed();
  await applySnapshot("external:alice:tokens", bucket, 2, 2, 8, 3, 5);
  const listener = await listenStates();
  await applySnapshot("external:alice:tokens", bucket, 1, 1, 1, 1, 1);
  await applySnapshot("external:alice:tokens", bucket, 3, 2, 8, 3, 5);
  expect(await listener.drain()).toHaveLength(0);
  expect(await redis.hmget(key, "revision", "cold:sum", "snapshot_version")).toEqual([
    "1",
    "8",
    "3",
  ]);
  await applySnapshot("external:alice:tokens", bucket, 4, 3, 9, 3, 5);
  expect(await listener.drain()).toHaveLength(1);
  listener.close();
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

it("follows its customers' updates again after a reconnect", async () => {
  await seed();
  const reader = await start();
  const writer = await start();
  await reader.actor(customer);
  const subscriber = reader["subscriber"]!;
  const reconnect = once(subscriber, "ready");
  subscriber.disconnect(true);
  await reconnect;
  expect((await reader.meter(meter))?.consumed_units).toBe(10);
  await ingest(writer, 3);
  await vi.waitFor(async () => expect((await reader.meter(meter))?.consumed_units).toBe(13));
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

it("asks Polar for a customer only while the shared Redis has no snapshot of it", async () => {
  snapshot = aliceSnapshot;
  const first = await start({ snapshotTimeout: 1_000 });
  expect((await first.meter(meter))?.consumed_units).toBe(3);
  const second = await start();
  expect((await second.meter(meter))?.consumed_units).toBe(3);
  expect(meterUsageRequests.map((request) => request.reducer_id)).toEqual(["tokens", "credits"]);
});

it("keeps the cold-fetch lock another instance took once its own expired", async () => {
  snapshot = aliceSnapshot;
  reducerSnapshots = { tokens: { delay: 100 } };
  const outpost = await start({ snapshotTimeout: 1_000 });
  const lock = `outpost:v1:${organization}:fetch:external:alice:tokens`;
  const read = outpost.meter(meter);
  await vi.waitFor(async () => expect(await redis.exists(lock)).toBe(1));
  await redis.set(lock, "other");
  expect((await read)?.consumed_units).toBe(3);
  await vi.waitFor(() => expect(outpost["requesting"].size).toBe(0));
  expect(await redis.get(lock)).toBe("other");
});

it("keeps two organizations apart on one Redis", async () => {
  await seed();
  const first = await start();
  await first.actor(customer);
  organization = "org-2";
  const second = await start();
  resetChanges = true;
  await second["pull"]();
  expect(await redis.hget(key, "cold_until")).toBe(String(bucket));
  expect(await redis.hget("outpost:v1:org-1:pull", "cursor")).not.toBeNull();
  expect(await redis.hget("outpost:v1:org-2:pull", "cursor")).not.toBe(
    await redis.hget("outpost:v1:org-1:pull", "cursor"),
  );
  expect((await first.meter(meter))?.consumed_units).toBe(10);
});

it("lets one instance of the fleet ask Polar for a cold customer", async () => {
  snapshot = aliceSnapshot;
  reducerSnapshots = { tokens: { delay: 100 }, credits: { delay: 100 } };
  const fleet = await Promise.all(
    Array.from({ length: 3 }, () => start({ snapshotTimeout: 1_000 })),
  );
  const read = await Promise.all(fleet.map((outpost) => outpost.meter(meter)));
  expect(read.map((value) => value?.consumed_units)).toEqual([3, 3, 3]);
  expect(meterUsageRequests).toHaveLength(2);
});

it("ships the Outpost entrypoint for both ESM and CommonJS", async () => {
  const esm = await import(import.meta.resolve("@polar-sh/sdk/outpost"));
  const cjs = createRequire(import.meta.url)("@polar-sh/sdk/outpost");
  expect(esm.Outpost).toBeTypeOf("function");
  expect(cjs.Outpost).toBeTypeOf("function");
});

it("keeps reducer cutoffs and meter credits independent under concurrent writes", async () => {
  reducers[0].meter_ids!.push("shared");
  reducers.push(creditReducer("shared-credits", "shared"), {
    id: "average",
    kind: "usage",
    meter_ids: ["average-meter"],
    filter: { conjunction: "and", clauses: [] },
    aggregation: { func: "avg", property: "tokens" },
  });
  const averageKey = `outpost:v1:${organization}:state:external:alice:average`;
  await applySnapshot("external:alice:tokens", bucket, 20, 2, 20, 5, 15);
  await applySnapshot("external:alice:average", bucket, 20, 2, 20, 5, 15);
  // Same cutoff, older version: Polar's previous totals.
  await applySnapshot("external:alice:tokens", bucket, 19, 1, 999, 999, 999);
  await applySnapshot("external:alice:credits", 20, 20, 1, 100, 100, 100);
  await applySnapshot("external:alice:shared-credits", 19, 19, 1, 200, 200, 200);
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
  await applySnapshot("external:alice:tokens", bucket + BUCKET_SIZE, 21, 22, 120, 2, 15);
  await applySnapshot("external:alice:credits", 21, 21, 2, 150, 50, 100);
  await first["synchronize"]();
  // Every event in the bucket is confirmed: Polar counts it, the local copy is gone.
  expect(await redis.hget(key, `bucket:${bucket}:sum`)).toBeNull();
  expect(await redis.hget(averageKey, `bucket:${bucket}:sum`)).toBe("100");
  expect((await first.meter(meter))?.balance).toBe(26);
  expect(
    (await first.meter({ ...customer, meter_id: "average-meter" }))?.consumed_units,
  ).toBeCloseTo(124 / 23);
  expect((await first.meter({ ...customer, meter_id: "shared" }))?.credited_units).toBe(200);
  expect(await redis.exists(`outpost:v1:${organization}:state:customer:alice:tokens`)).toBe(0);
});

it("orders same-cutoff corrections at microsecond precision and keeps null extrema", async () => {
  snapshot = {
    ...customer,
    customer_id: null,
    reducer_id: "tokens",
    cold_until: bucket,
    version: 1791807000000002,
    count: 2,
    sum: 10,
    min: 3,
    max: 7,
  };
  const outpost = await start();
  await outpost.actor(customer);
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(10));
  await outpost["receiveSnapshot"](
    { ...snapshot, customer_exists: true, customer_id: "alice", sum: 999 } as never,
    false,
  );
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  await outpost["receiveSnapshot"](
    { ...snapshot, customer_exists: true, version: 1791807000000001, sum: 999 } as never,
    false,
  );
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  await outpost["receiveSnapshot"](
    {
      ...snapshot,
      customer_exists: true,
      version: 1791807000000003,
      count: 0,
      sum: 0,
      min: null,
      max: null,
    } as never,
    false,
  );
  expect((await outpost.meter(meter))?.consumed_units).toBe(0);
  expect(await redis.hget(key, "cold:min")).toBeNull();
  expect(await redis.hget(key, "cold:max")).toBeNull();
});

it("preserves microsecond cutoffs and counts a late write as pending", async () => {
  snapshot = {
    ...customer,
    customer_id: null,
    reducer_id: "tokens",
    cold_until: bucket,
    version: 1791807000000001,
    count: 0,
    sum: 0,
    min: null,
    max: null,
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
  await outpost["receiveSnapshot"](
    {
      ...snapshot,
      customer_exists: true,
      cold_until: bucket + 1,
      version: 1791807000000002,
      count: 1,
      sum: 2,
      min: 2,
      max: 2,
    } as never,
    false,
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
  await applySnapshot("external:alice:tokens", cutoff, cutoff + 1, count, sum);
};
const usage = (id: string, tokens: number) => ({
  ...customer,
  external_id: id,
  name: "api_call",
  timestamp,
  metadata: { tokens },
});
const warm = async (options: Partial<OutpostOptions> = {}): Promise<Outpost> => {
  await seed(0);
  const outpost = await start(options);
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
  await redis.hset(
    `outpost:v1:${organization}:pending:external:alice:tokens:${bucket}`,
    "old",
    '["1","7","7","7"]',
  );
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
  reducer_id: "tokens",
  cold_until: bucket + BUCKET_SIZE,
  version: 1791807000000005,
  count,
  sum,
  min: count ? 10 : null,
  max: count ? 10 : null,
});

it("settles the pending events the snapshot counts, and keeps the rest", async () => {
  const outpost = await warm();
  const events = Array.from({ length: 10 }, (_, i) => usage(`event-${i}`, 10));
  for (const event of events) await outpost.track(event);
  ingested = new Set(["event-0", "event-1", "event-2", "event-3"]);
  snapshot = sealing(4, 40);
  await deliver(outpost, snapshot!);
  await vi.waitFor(async () => expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("6"));
  expect((await outpost.meter(meter))?.consumed_units).toBe(100);
  expect(await redis.hget(key, "cold:count")).toBe("4");
  expect(confirmRequests).toEqual([
    {
      reducer_id: "tokens",
      external_customer_id: "alice",
      bucket_start: bucket,
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
  await deliver(outpost, snapshot!);
  await vi.waitFor(async () => expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("5"));
  expect(await redis.hget(key, "cold:count")).toBe("5");
  expect(await redis.hget(key, "snapshot_version")).toBe("1791807000000006");
  expect((await outpost.meter(meter))?.consumed_units).toBe(100);
});

it("drops a cold bucket once Polar confirmed every pending event", async () => {
  const outpost = await warm();
  const events = Array.from({ length: 3 }, (_, i) => usage(`event-${i}`, 10));
  for (const event of events) await outpost.track(event);
  ingested = new Set(events.map((event) => event.external_id));
  snapshot = sealing(3, 30);
  await deliver(outpost, snapshot!);
  await vi.waitFor(async () => expect(await redis.hget(key, `bucket:${bucket}:sum`)).toBeNull());
  expect(await redis.hget(key, `pending:${bucket}:sum`)).toBeNull();
  expect((await outpost.meter(meter))?.consumed_units).toBe(30);
});

it("reports the local value as it was before the confirmed events settled", async () => {
  const outpost = await warm();
  const events = [usage("event-0", 10), usage("event-1", 10)];
  for (const event of events) await outpost.track(event);
  await seal(bucket + BUCKET_SIZE);
  ingested = new Set(events.map((event) => event.external_id));
  snapshot = { ...sealing(2, 20), cold_until: bucket + 2 * BUCKET_SIZE, version: 1791807000000006 };
  await deliver(outpost, snapshot!);
  const confirming = () =>
    exported.find(
      (span) =>
        span.name === "outpost.snapshot.received" &&
        span.attributes["outpost.pending.asked"] !== undefined,
    );
  await vi.waitFor(() => expect(confirming()).toBeDefined());
  expect(confirming()!.attributes).toMatchObject({
    "outpost.local.cold_until": bucket + BUCKET_SIZE,
    "outpost.local.count": 2,
    "outpost.local.sum": 20,
    "outpost.pending.confirmed": 2,
    "outpost.snapshot.delta": false,
  });
});

it("applies a credit snapshot without asking Polar to confirm anything", async () => {
  const outpost = await warm();
  const events = [usage("event-0", 10), usage("event-1", 10)];
  for (const event of events) await outpost.track(event);
  ingested = new Set(events.map((event) => event.external_id));
  snapshot = sealing(2, 20);
  await deliver(outpost, snapshot!, {
    ...customer,
    customer_id: null,
    reducer_id: "credits",
    ...creditSnapshot(80, snapshot!.version as number),
  });
  await vi.waitFor(async () => expect(await redis.hget(creditKey, "cold:sum")).toBe("80"));
  await vi.waitFor(async () => expect(await redis.hget(key, "cold:sum")).toBe("20"));
  expect(confirmRequests.map((request) => request.reducer_id)).toEqual(["tokens"]);
});

it("applies a snapshot Polar did not confirm in time, keeping its events pending", async () => {
  const outpost = await warm({ confirmTimeout: 50 });
  for (let i = 0; i < 3; i++) await outpost.track(usage(`event-${i}`, 10));
  answerConfirm = false;
  snapshot = sealing(3, 30);
  await deliver(outpost, snapshot!);
  // The read moves once the snapshot applied and reached the cache: Polar's 30 plus the 30 pending.
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(60));
  expect(confirmRequests).toHaveLength(1);
  expect(await redis.hget(key, "cold:count")).toBe("3");
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("3");
});

it("keeps the pull lock while a page outlasts its TTL", async () => {
  const outpost = await warm({ confirmTimeout: 150 });
  for (let i = 0; i < 3; i++) await outpost.track(usage(`event-${i}`, 10));
  answerConfirm = false;
  const redisClient = outpost["redis"]!;
  const set = redisClient.set.bind(redisClient);
  vi.spyOn(redisClient, "set").mockImplementation(((lock: string, token: string) =>
    set(lock, token, "PX", 200, "NX")) as never);
  // Each snapshot waits for its confirm: the page outlasts the lock.
  await deliver(outpost, sealing(3, 30), sealing(3, 30), sealing(3, 30));
  expect(await redis.hget(`outpost:v1:${organization}:pull`, "cursor")).toBe(`${cursor}-0`);
});

it("asks for a bucket's pending events a thousand at a time", async () => {
  const outpost = await warm();
  for (let i = 0; i < 1_001; i++) await outpost.track(usage(`event-${i}`, 1));
  snapshot = sealing(0, 0);
  await deliver(outpost, snapshot!);
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
    reducer_id: "tokens",
    cold_until: bucket,
    version: 1791807000000003,
    count: 0,
    sum: 0,
    min: null,
    max: null,
  };
  const outpost = await start();
  const connectionId = outpost.connectionId;
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
      "outpost.snapshot.received",
      "outpost.pull",
      "outpost.sync",
      "outpost.redis.disconnect",
    ]),
  );
  expect(
    exported
      .filter((span) => span.name === "outpost.redis.connect")
      .map((span) => span.attributes["outpost.redis.connection"]),
  ).toEqual(["primary", "subscriber"]);
  const beforeConnection = ["outpost.redis.connect", "outpost.redis.subscribe"];
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
      reducer_id: "tokens",
      cold_until: bucket,
      version: 1791807000000004,
      count: 2,
      sum: snapshotSum,
      min: 3,
      max: snapshotMax,
    };
    const outpost = await start();
    await deliver(outpost, snapshot);
    await vi.waitFor(() => expect(tokensSnapshotSpan()).toBeDefined());
    const span = tokensSnapshotSpan()!;
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
    reducer_id: "tokens",
    cold_until: bucket,
    version: 1791807000000004,
    count: 3,
    sum: 10,
    min: 2,
    max: 5,
  };
  const outpost = await start();
  await deliver(outpost, snapshot);
  await vi.waitFor(() => expect(tokensSnapshotSpan()).toBeDefined());
  const span = tokensSnapshotSpan()!;
  expect(span.attributes).toMatchObject({
    "outpost.local.cold_until": bucket - BUCKET_SIZE,
    "outpost.local.count": 3,
    "outpost.local.sum": 10,
    "outpost.local.min": 2,
    "outpost.local.max": 5,
    "outpost.snapshot.delta": false,
  });
});

it("fails when Polar refuses a pull", async () => {
  const outpost = await start();
  refuseConnections = true;
  await outpost["pull"]();
  await expect(outpost.actor(customer)).rejects.toThrow("refused");
  expect(outpost.connected).toBe(false);
});

it.each([
  [422, false],
  [429, true],
])(
  "fails when Polar rejects a pull with %i unless it only slows it down",
  async (status, connected) => {
    const outpost = await start();
    changesStatus = status;
    await outpost["pull"]();
    expect(outpost.connected).toBe(connected);
  },
);

it("fails to start when Polar refuses Outpost", async () => {
  refuseConnections = true;
  await expect(start()).rejects.toThrow("refused");
});

it("fails to start without Redis instead of hanging", async () => {
  const outpost = new Outpost(`${redisServer.socket}.missing`, { client: core });
  await expect(outpost.start()).rejects.toThrow();
}, 10_000);

const aliceSnapshot = {
  ...customer,
  customer_id: null,
  reducer_id: "tokens",
  cold_until: bucket,
  version: 1791807000000005,
  count: 1,
  sum: 3,
  min: 3,
  max: 3,
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
  await outpost.actor(customer);
  // The snapshot can take longer than the test's snapshotTimeout to arrive after a reconnection.
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(3));
  await ingest(outpost, 5);
  expect((await outpost.meter(meter))?.consumed_units).toBe(8);
  expect((await outpost.meter(meter))?.balance).toBe(92);
  expect(outpost.connected).toBe(true);
  expect(applySnapshot.mock.calls.filter(([stateKey]) => stateKey === key)).toHaveLength(2);
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
});

it("gives the state a day to live, refreshed by each read, write and confirmation", async () => {
  snapshot = aliceSnapshot;
  const outpost = await start();
  await outpost.actor(customer);
  expect((await outpost.meter(meter))?.balance).toBe(97);
  const ttl = await redis.ttl(key);
  expect(ttl).toBeGreaterThan(0);
  expect(ttl).toBeLessThanOrEqual(86_400);
  await redis.expire(key, 60);
  const settled = usage(eventId(), 3);
  await outpost.track(settled);
  expect(await redis.ttl(key)).toBeGreaterThan(60);
  const pending = await redis.ttl(
    `outpost:v1:${organization}:pending:external:alice:tokens:${bucket}`,
  );
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
  expect((await outpost.meter(meter))?.balance).toBe(97);
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
  expect((await outpost.meter(meter))?.balance).toBe(97);
  expect(setTimeout).not.toHaveBeenCalled();
});

it("refuses to read a meter Outpost does not know", async () => {
  const outpost = await start();
  await expect(outpost.meter({ ...customer, meter_id: "other" })).rejects.toThrow(
    UnknownMeterError,
  );
  expect(await readOutcomes(outpost)).toEqual([["meter", "unknown_meter"]]);
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
  [50, 100, "ready"],
  [500, 0, "not_ready"],
])(
  "waits for the credit snapshot of the meter it reads (delay %i ms)",
  async (delay, credits, outcome) => {
    snapshot = aliceSnapshot;
    reducerSnapshots = { credits: { delay } };
    const outpost = await start();
    expect((await outpost.meter(meter))?.credited_units).toBe(credits);
    expect(await readOutcomes(outpost)).toEqual([["meter", outcome]]);
  },
);

it("reads the value of a customer created after a miss", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  snapshot = { ...aliceSnapshot, customer_exists: false };
  const outpost = await start();
  expect(await outpost.meter(meter)).toBeNull();
  snapshot = aliceSnapshot;
  vi.advanceTimersByTime(1_000);
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.balance).toBe(97));
});

it("asks Polar about a customer it does not know once per backoff, for the whole fleet", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  snapshot = { ...aliceSnapshot, customer_exists: false };
  const [first, second] = await Promise.all([start(), start()]);
  expect(await first.meter(meter)).toBeNull();
  const asked = meterUsageRequests.length;
  // The other instance knows at once, and neither asks again before the backoff ends.
  expect(await second.meter(meter)).toBeNull();
  expect(await first.meter(meter)).toBeNull();
  expect(meterUsageRequests).toHaveLength(asked);
  vi.advanceTimersByTime(1_000);
  expect(await second.meter(meter)).toBeNull();
  expect(meterUsageRequests).toHaveLength(2 * asked);
  // The second miss waits twice as long.
  vi.advanceTimersByTime(1_000);
  expect(await first.meter(meter)).toBeNull();
  expect(meterUsageRequests).toHaveLength(2 * asked);
});

const receiveCredits = (outpost: Outpost, units: number, version: number) =>
  outpost["receiveSnapshot"](
    {
      ...customer,
      customer_id: null,
      customer_exists: true,
      reducer_id: "credits",
      ...creditSnapshot(units, version),
    } as never,
    false,
  );

it("reads the balance as the credits less the usage", async () => {
  snapshot = aliceSnapshot;
  credited = 250;
  const outpost = await start();
  await outpost.actor(customer);
  await ingest(outpost, 5);
  expect(await outpost.meter(meter)).toEqual({
    ...meter,
    consumed_units: 8,
    credited_units: 250,
    balance: 242,
  });
});

it("updates the balance from a credit snapshot alone", async () => {
  snapshot = aliceSnapshot;
  const outpost = await start();
  await outpost.actor(customer);
  expect((await outpost.meter(meter))?.balance).toBe(97);
  await receiveCredits(outpost, 150, aliceSnapshot.version + 1);
  expect((await outpost.meter(meter))?.balance).toBe(147);
  expect(await redis.hget(key, "cold:sum")).toBe("3");
});

it("ignores a credit snapshot older than the one applied", async () => {
  snapshot = aliceSnapshot;
  const outpost = await start();
  await outpost.actor(customer);
  expect((await outpost.meter(meter))?.credited_units).toBe(100);
  await receiveCredits(outpost, 999, aliceSnapshot.version - 1);
  expect((await outpost.meter(meter))?.credited_units).toBe(100);
});

it("reads no credits for a meter without a credit reducer", async () => {
  reducers = reducers.filter((reducer) => reducer.kind === "usage");
  snapshot = aliceSnapshot;
  const outpost = await start();
  expect(await outpost.meter(meter)).toMatchObject({ credited_units: 0, balance: -3 });
  expect(await readOutcomes(outpost)).toEqual([["meter", "ready"]]);
});

it("never counts a local event in a credit reducer", async () => {
  await seed();
  const outpost = await start();
  await outpost.track({
    ...customer,
    name: "meter.credited",
    external_id: eventId(),
    timestamp,
    metadata: { meter_id: "meter", units: 50, tokens: 2 },
  });
  expect(await outpost.meter(meter)).toMatchObject({ consumed_units: 12, credited_units: 100 });
  expect(Object.keys(await redis.hgetall(creditKey))).not.toContainEqual(
    expect.stringMatching(/^(bucket|pending):/),
  );
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
  // Bob's update goes to bob's channel, which the reader does not follow.
  await vi.waitFor(() => expect(reader["syncReceived"]).toBe(1));
  exported.length = 0;
  await reader.flushTelemetry();
  await reader.flushTelemetry();
  expect(
    exported.filter((span) => span.name === "outpost.sync").map((span) => span.attributes),
  ).toEqual([
    {
      "outpost.connection_id": reader.connectionId,
      "outpost.sync.received": 1,
      "outpost.sync.applied": 1,
    },
  ]);
});

it("does not split a message in flight across sync reports", async () => {
  const writer = await start();
  const reader = await start();
  await reader.actor(customer);
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
      "outpost.connection_id": reader.connectionId,
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
  const polarFetch = globalThis.fetch;
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation((input, init) =>
      String(input).includes("/v1/events/ingest")
        ? Promise.resolve(new Response('{"inserted":1,"duplicates":0}'))
        : polarFetch(input, init),
    );
  const ingested = () =>
    fetch.mock.calls.filter(([input]) => String(input).includes("/v1/events/ingest"));
  await seed();
  const [baseUrl] = core.buildRequest("GET", "");
  const polar = createPolar({ baseUrl, accessToken: "test-token", organizationId: "org" });
  const reader = await start();
  {
    const metering = polar.metering({ outpost: { redisUrl: redisServer.socket } });
    try {
      await metering.track({
        ...customer,
        name: "api",
        external_id: eventId(),
        timestamp,
        metadata: { tokens: 2 },
      });
      expect((await reader.meter(meter))?.consumed_units).toBe(12);
      expect(ingested()).toHaveLength(0);
    } finally {
      await metering.close();
    }
  }
  expect(ingested()).toHaveLength(1);
});

it.each(["abc", "Infinity", "NaN", "1e999"])("rejects the stored value %j", (value) => {
  expect(() => decodeState(["epoch", "epoch", "revision", "1", "cold:sum", value])).toThrow();
});

// Fails the day a write stores a value that JSON and Number don't read the same way.
it("stores values that parse the same with and without JSON", async () => {
  snapshot = {
    ...customer,
    customer_id: null,
    reducer_id: "tokens",
    cold_until: bucket,
    version: 1791807000000001,
    count: 3,
    sum: 0.30000000000000004,
    min: -1e-7,
    max: 1e21,
  };
  credited = 2 ** 53 + 2;
  const outpost = await start();
  await outpost.actor(customer);
  for (const stateKey of [key, creditKey])
    await vi.waitFor(async () => expect(await redis.hexists(stateKey, "cold:sum")).toBe(1));
  for (const tokens of [0, -0, 1, -2, 0.1, 0.2, 1e-7, 1e21, 2 ** 53, -1.5e300])
    await ingest(outpost, tokens);
  for (const stateKey of [key, creditKey]) {
    const stored = await redis.hgetall(stateKey);
    delete stored.epoch;
    for (const [field, value] of Object.entries(stored))
      expect([field, Number(value)]).toEqual([field, JSON.parse(value)]);
  }
});
