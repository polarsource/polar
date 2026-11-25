import type { ReadableSpan } from "@opentelemetry/sdk-trace";

import { DataPointType, type DataPoint, type ResourceMetrics } from "@opentelemetry/sdk-metrics";
import { Pipeline, Redis } from "ioredis";
import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ClientBase, PolarError } from "../base";
import { UnknownMeterError } from "../metering/errors";
import { NotReadyError } from "./index";
import { createPolar } from "../{{ (ir.versions[-2] | default(ir.versions[0])).version }}/client";
import { Outpost, outpost, type OutpostOptions, isSampled } from "./client";
import { MissingExternalIdError, PolarOutpostError, UnavailableRedisError } from "./errors";
import { decodeState } from "./state";
import { BUCKET_SIZE, getBucketStart, type Reducer } from "./reducer";
import { APPLY_SNAPSHOT_SCRIPT, CONFIRM_SCRIPT } from "./scripts";
import { SAMPLE_RATE_ATTRIBUTE, TELEMETRY_ENV } from "./telemetry";
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
let configurationRequests = 0;
let configurationStatus = 200;
// The telemetry relays Polar received: their path and body.
const telemetryRequests: { path: string; body: string }[] = [];
let telemetryStatus = 200;
let telemetryDelay = 0;
let telemetryAnswered = 0;
let configurationDelay = 0;
const changeRequests: (string | null)[] = [];
let changesStatus = 200;
let changesDelay = 0;
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
// Each identity asked for, and the size of each meter usage request.
const meterUsageRequests: Record<string, unknown>[] = [];
const meterUsageBatches: number[] = [];
// The most meter usage requests Polar held at once.
let meterUsageInFlight = 0;
let meterUsageMostInFlight = 0;
let meterUsageStatus = 200;
// Meter usage requests that fail with a 503 before Polar answers again.
let meterUsageFailures = 0;
// Each ingest request's events, and the statuses Polar answers the next ones with.
const ingestRequests: Record<string, unknown>[][] = [];
let ingestStatuses: number[] = [];
// The external ids of the events Polar's validation refuses, naming each by its index.
let ingestRefused = new Set<string>();
let ingestDelay = 0;
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

const respond = (response: ServerResponse, body: unknown, status = 200, headers = {}): void => {
  response.writeHead(status, { "Content-Type": "application/json", ...headers });
  response.end(JSON.stringify(body));
};

// Polar's side of Outpost: the configuration, the snapshots, the confirmations and the changes.
const answer = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  // Each organization's token: organizations can share a Redis.
  const token = request.headers.authorization;
  expect(["Bearer test-token", "Bearer other-token", "Bearer org-2-token"]).toContain(token);
  expect(request.headers["polar-organization"]).toBe("org");
  let data = "";
  for await (const chunk of request) data += chunk;
  const body = data && request.headers["content-type"]?.includes("json") ? JSON.parse(data) : undefined;
  if (refuseConnections) return respond(response, {}, 401);
  const url = new URL(request.url!, "http://polar");
  switch (`${request.method} ${url.pathname}`) {
    case "GET /v1/outpost/configuration": {
      configurationRequests += 1;
      if (configurationStatus !== 200) return respond(response, {}, configurationStatus);
      const configuration = {
        organization_id: token === "Bearer org-2-token" ? "org-2" : organization,
        reducers,
      };
      setTimeout(() => respond(response, configuration), configurationDelay);
      return;
    }
    case "POST /v1/outpost/telemetry":
    case "POST /v1/outpost/telemetry/metrics":
      telemetryRequests.push({ path: url.pathname, body: data });
      setTimeout(() => {
        telemetryAnswered += 1;
        respond(response, {}, telemetryStatus);
      }, telemetryDelay);
      return;
    case "POST /v1/outpost/meter-usage": {
      const identities: Record<string, unknown>[] = body.identities;
      meterUsageRequests.push(...identities);
      meterUsageBatches.push(identities.length);
      if (meterUsageStatus !== 200) return respond(response, {}, meterUsageStatus);
      if (meterUsageFailures > 0) {
        meterUsageFailures -= 1;
        return respond(response, {}, 503);
      }
      if (!snapshot) return respond(response, []);
      let delay = 0;
      const payloads = identities.map(({ reducer_id, ...requested }) => {
        const reducerId = reducer_id as string;
        const kind = reducers.find((reducer) => reducer.id === reducerId)?.kind;
        const { delay: wait = 0, ...override } = reducerSnapshots[reducerId] ?? {};
        delay = Math.max(delay, wait);
        return {
          customer_exists: true,
          ...snapshot,
          ...(kind === "credit" && creditSnapshot(credited, snapshot!.version as number)),
          customer_id: null,
          external_customer_id: null,
          ...requested,
          reducer_id: reducerId,
          ...override,
        };
      });
      meterUsageMostInFlight = Math.max(meterUsageMostInFlight, ++meterUsageInFlight);
      setTimeout(() => {
        meterUsageInFlight -= 1;
        respond(response, payloads);
      }, delay);
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
    case "POST /v1/events/ingest": {
      ingestRequests.push(body.events);
      const refused = (body.events as { external_id: string }[]).flatMap((event, index) =>
        ingestRefused.has(event.external_id)
          ? [{ type: "value_error", loc: ["body", "events", index, "timestamp"], msg: "Refused" }]
          : [],
      );
      if (refused.length)
        return respond(response, { error: "RequestValidationError", detail: refused }, 422);
      const status = ingestStatuses.shift() ?? 200;
      setTimeout(
        () =>
          respond(
            response,
            { inserted: body.events.length, duplicates: 0 },
            status,
            status === 429 ? { "Retry-After": "30" } : {},
          ),
        ingestDelay,
      );
      return;
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
      setTimeout(() => respond(response, page), changesDelay);
      return;
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
  configurationRequests = 0;
  configurationStatus = 200;
  telemetryRequests.length = 0;
  telemetryStatus = 200;
  telemetryDelay = 0;
  telemetryAnswered = 0;
  configurationDelay = 0;
  changeRequests.length = 0;
  changesStatus = 200;
  changesDelay = 0;
  meterUsageRequests.length = 0;
  meterUsageBatches.length = 0;
  meterUsageMostInFlight = 0;
  meterUsageStatus = 200;
  meterUsageFailures = 0;
  credited = 100;
  reducerSnapshots = {};
  ingested = new Set();
  answerConfirm = true;
  confirmSnapshot = undefined;
  confirmRequests.length = 0;
  ingestRequests.length = 0;
  ingestStatuses = [];
  ingestRefused = new Set();
  ingestDelay = 0;
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
  "reads %s at once, on the writer and on its peers",
  async (func, expected) => {
    reducers[0].aggregation = func === "count" ? { func } : { func, property: "tokens" };
    await seed();
    const reader = await start();
    await reader.actor(customer);
    const writer = await start();
    await ingest(writer, -2);
    await ingest(writer, 4);
    expect((await writer.meter(meter))?.consumed_units).toBe(expected);
    expect((await reader.meter(meter))?.balance).toBe(100 - expected);
  },
);

it("talks to Redis over one connection", async () => {
  const clients = async () => ((await redis.client("LIST")) as string).trim().split("\n").length;
  const before = await clients();
  await start();
  expect(await clients()).toBe(before + 1);
});

it("reads another instance's write at once, with no message to wait for", async () => {
  await seed();
  const [writer, reader] = [await start(), await start()];
  expect(await reader.meter(meter)).toMatchObject({ consumed_units: 10 });
  await ingest(writer, 5);
  expect(await reader.meter(meter)).toMatchObject({ consumed_units: 15 });
});

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
    await redis.hset(`outpost:v1:${organization}:state:external:alice:tokens-${i}`, "cold_until", bucket);
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
      await redis.hget(`outpost:v1:${organization}:state:external:alice:tokens-${i}`, `bucket:${bucket}:count`),
    ).toBe("1");
  }
  if (fail) {
    await redis.hset(`outpost:v1:${organization}:state:external:alice:tokens-1`, `bucket:${bucket}:sum`, "invalid");
    execute.mockClear();
    await expect(ingest(outpost, 2)).rejects.toBeInstanceOf(UnavailableRedisError);
    expect(execute).toHaveBeenCalledOnce();
    for (const i of [0, 2]) {
      expect(await outpost.meter({ ...customer, meter_id: `meter-${i}` })).toMatchObject({
        consumed_units: 5,
        balance: -5,
      });
      expect(
        await redis.hget(`outpost:v1:${organization}:state:external:alice:tokens-${i}`, `bucket:${bucket}:sum`),
      ).toBe("5");
    }
  }
});

it("reports a missing customer snapshot and an unknown meter", async () => {
  const outpost = await start();
  await ingest(outpost, 3);
  const notReady = outpost.meter(meter);
  await expect(notReady).rejects.toBeInstanceOf(NotReadyError);
  await expect(notReady).rejects.toBeInstanceOf(PolarOutpostError);
  await expect(notReady).rejects.toThrow("snapshot is not ready");
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
  const pending = `pending:${bucket - BUCKET_SIZE}:count`;
  expect(await redis.hget(key, pending)).toBe("1");
  ingested = new Set([late.external_id]);
  snapshot = { ...snapshot, version: 1791807000000002, count: 3, sum: 8 + 999, max: 999 };
  await deliver(writer, snapshot);
  await vi.waitFor(async () => expect(await redis.hget(key, pending)).toBeNull());
  expect((await writer.meter(meter))?.balance).toBe(89 - 999);
});

it("pulls a snapshot once for the whole fleet", async () => {
  await seed();
  const fleet = await Promise.all([start(), start(), start()]);
  for (const outpost of fleet) await outpost.actor(customer);
  changeRequests.length = 0;
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
  for (const outpost of fleet) expect((await outpost.meter(meter))?.consumed_units).toBe(8);
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

it("serves a state a reset left unconfirmed while Polar confirms it", async () => {
  await seed();
  const outpost = await start();
  await outpost.actor(customer);
  snapshot = aliceSnapshot;
  resetChanges = true;
  await outpost["pull"]();
  expect(meterUsageBatches).toEqual([]);
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(3));
  await outpost.flush();
  const asked = meterUsageBatches.length;
  await outpost.meter(meter);
  await outpost.flush();
  expect(meterUsageBatches).toHaveLength(asked);
});

it("asks Polar again for a snapshot it asked for before a reset", async () => {
  const outpost = await start();
  snapshot = aliceSnapshot;
  reducerSnapshots = { tokens: { delay: 100 } };
  const asked = () => meterUsageRequests.filter(({ reducer_id }) => reducer_id === "tokens").length;
  const read = outpost.actor(customer);
  await vi.waitFor(() => expect(asked()).toBe(1));
  resetChanges = true;
  await outpost["pull"]();
  await read;
  await outpost.flush();
  await outpost.meter(meter);
  await outpost.flush();
  expect(asked()).toBe(2);
});

it("releases an older flush when a newer one starts", async () => {
  const outpost = await start();
  snapshot = aliceSnapshot;
  reducerSnapshots = { tokens: { delay: 500 } };
  const read = outpost.actor(customer);
  await vi.waitFor(() => expect(meterUsageRequests).not.toHaveLength(0));
  const older = outpost.flush().then(() => "released");
  const newer = outpost.flush().then(() => "delivered");
  const waiting = new Promise((resolve) => setTimeout(() => resolve("waiting"), 100));
  expect(await Promise.race([older, waiting])).toBe("released");
  expect(await Promise.race([newer, waiting])).toBe("waiting");
  await read;
  expect(await newer).toBe("delivered");
});

it("reads a customer Polar no longer knows after a reset as unknown", async () => {
  await seed();
  const outpost = await start();
  await outpost.actor(customer);
  snapshot = { ...aliceSnapshot, customer_exists: false };
  resetChanges = true;
  await outpost["pull"]();
  await vi.waitFor(async () => expect(await outpost.meter(meter)).toBeNull());
});

it("asks Polar again on the next read for a state it could not revalidate", async () => {
  await seed();
  const outpost = await start();
  await outpost.actor(customer);
  meterUsageStatus = 503;
  resetChanges = true;
  await outpost["pull"]();
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  await outpost.flush();
  meterUsageStatus = 200;
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

it("reads the configuration another instance kept in Redis, without asking Polar", async () => {
  await start();
  await start();
  expect(configurationRequests).toBe(1);
});

it("reloads the configuration another instance pulled", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const puller = await start();
  const other = await start();
  reducers = [...reducers, { ...reducers[0], id: "requests", meter_ids: ["requests"] }];
  configurationChanged = true;
  await puller["pull"]();
  vi.advanceTimersByTime(30_000);
  snapshot = aliceSnapshot;
  expect(await other.meter({ ...customer, meter_id: "requests" })).not.toBeNull();
  expect(configurationRequests).toBe(2);
});

it("reloads a configuration another instance pulled while this one started", async () => {
  await start();
  const outpost = new Outpost(redisServer.socket, { client: core, snapshotTimeout: 100 });
  outposts.push(outpost);
  const configure = outpost["configure"].bind(outpost);
  outpost["configure"] = async (...args: Parameters<typeof configure>) => {
    const configured = await configure(...args);
    if (args.length) return configured;
    // Another instance pulls a new configuration before this one reads the pull hash.
    reducers = [...reducers, { ...reducers[0], id: "requests", meter_ids: ["requests"] }];
    const pulled = JSON.stringify({ organization_id: organization, reducers });
    const [stored] = await redis.keys("outpost:v1:configuration:*");
    await redis.set(stored, pulled);
    await redis.set(`outpost:v1:${organization}:configuration`, pulled);
    await redis.hincrby(`outpost:v1:${organization}:pull`, "configuration", 1);
    return configured;
  };
  await outpost.start();
  snapshot = aliceSnapshot;
  expect(await outpost.meter({ ...customer, meter_id: "requests" })).not.toBeNull();
});

it("keeps its configuration while the stored one is gone, without asking Polar", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  await seed();
  const outpost = await start();
  const [stored] = await redis.keys("outpost:v1:configuration:*");
  await redis.del(stored, `outpost:v1:${organization}:configuration`);
  await redis.hincrby(`outpost:v1:${organization}:pull`, "configuration", 1);
  configurationStatus = 503;
  vi.advanceTimersByTime(30_000);
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  await outpost.flush();
  expect(configurationRequests).toBe(1);
});

it("keeps the organization's configuration a pull wrote while another instance started", async () => {
  const puller = await start();
  configurationDelay = 100;
  const starting = start({
    client: new ClientBase({ ...core["options"], accessToken: "other-token" }),
  });
  await vi.waitFor(() => expect(configurationRequests).toBe(2));
  configurationDelay = 0;
  reducers = [...reducers, { ...reducers[0], id: "requests", meter_ids: ["requests"] }];
  configurationChanged = true;
  await puller["pull"]();
  await starting;
  const stored = JSON.parse((await redis.get(`outpost:v1:${organization}:configuration`))!);
  expect(stored.reducers.map((reducer: Reducer) => reducer.id)).toContain("requests");
});

it("reloads a configuration another token of the organization pulled", async () => {
  const puller = await start();
  const other = await start({
    client: new ClientBase({ ...core["options"], accessToken: "other-token" }),
  });
  reducers = [...reducers, { ...reducers[0], id: "requests", meter_ids: ["requests"] }];
  configurationChanged = true;
  await puller["pull"]();
  snapshot = aliceSnapshot;
  expect(await other.meter({ ...customer, meter_id: "requests" })).not.toBeNull();
});

it("sends the fleet's telemetry in one relay of each kind after a pull", async () => {
  const fleet = await Promise.all(Array.from({ length: 3 }, () => start()));
  for (const [index, outpost] of fleet.entries()) {
    outpost["telemetryBuffer"].spans.push(Buffer.from(`spans-${index};`));
    outpost["telemetryBuffer"].metrics.push(Buffer.from(`metrics-${index};`));
    await outpost.flushTelemetry();
  }
  await fleet[0]["pull"]();
  await fleet[0].flush();
  expect(telemetryRequests).toEqual([
    { path: "/v1/outpost/telemetry", body: "spans-0;spans-1;spans-2;" },
    { path: "/v1/outpost/telemetry/metrics", body: "metrics-0;metrics-1;metrics-2;" },
  ]);
});

it("keeps the fleet's telemetry for the next pull when Polar fails the relay", async () => {
  const outpost = await start();
  outpost["telemetryBuffer"].spans.push(Buffer.from("spans;"));
  outpost["telemetryBuffer"].metrics.push(Buffer.from("metrics;"));
  await outpost.flushTelemetry();
  telemetryStatus = 503;
  await outpost["pull"]();
  await outpost.flush();
  telemetryStatus = 200;
  telemetryRequests.length = 0;
  await outpost["pull"]();
  await outpost.flush();
  expect(telemetryRequests).toEqual([
    { path: "/v1/outpost/telemetry", body: "spans;" },
    { path: "/v1/outpost/telemetry/metrics", body: "metrics;" },
  ]);
});

it("lets a read that waits for a pull go before the telemetry relay ends", async () => {
  await seed();
  const outpost = await start({ snapshotTimeout: 2_000 });
  outpost["telemetryBuffer"].spans.push(Buffer.from("spans;"));
  await outpost.flushTelemetry();
  telemetryDelay = 500;
  const started = performance.now();
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  expect(performance.now() - started).toBeLessThan(300);
  await outpost.flush();
  expect(telemetryRequests).toHaveLength(1);
});

it("keeps the exports written while a relay is in flight", async () => {
  const outpost = await start();
  outpost["telemetryBuffer"].spans.push(...Array.from({ length: 1000 }, (_, index) => Buffer.from(`old-${index};`)));
  await outpost.flushTelemetry();
  telemetryDelay = 200;
  const pulling = outpost["pull"]();
  await vi.waitFor(() => expect(telemetryRequests).toHaveLength(1));
  outpost["telemetryBuffer"].spans.push(Buffer.from("new;"));
  await outpost.flushTelemetry();
  await pulling;
  await outpost.flush();
  expect(await redis.lrange(`outpost:v1:${organization}:telemetry:spans`, 0, -1)).toEqual(["new;"]);
});

it("waits in flush for the relay a pull in flight starts", async () => {
  const outpost = await start();
  outpost["telemetryBuffer"].spans.push(Buffer.from("spans;"));
  await outpost.flushTelemetry();
  telemetryDelay = 200;
  void outpost["pull"]();
  await outpost.flush();
  expect(telemetryAnswered).toBe(1);
});

it("keeps its telemetry for the next flush when Redis fails the write", async () => {
  const outpost = await start();
  const spans = `outpost:v1:${organization}:telemetry:spans`;
  vi.spyOn(outpost["redis"]!, "outpostPushTelemetry").mockRejectedValueOnce(
    new Error("Connection is closed."),
  );
  outpost["telemetryBuffer"].spans.push(Buffer.from("spans;"));
  await outpost.flushTelemetry();
  expect(await redis.llen(spans)).toBe(0);
  await outpost.flushTelemetry();
  expect(await redis.lrange(spans, 0, -1)).toEqual(["spans;"]);
});

it("marks the spans its sample keeps with the sample rate", async () => {
  snapshot = aliceSnapshot;
  const outpost = await start();
  await outpost.meter(meter);
  expect(exported.length).toBeGreaterThan(0);
  for (const span of exported)
    expect(span.attributes[SAMPLE_RATE_ATTRIBUTE]).toBe(
      isSampled(span.spanContext().traceId) ? 10 : undefined,
    );
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

it("applies a pulled page's customers side by side", async () => {
  const outpost = await start();
  const customers = Array.from({ length: 10 }, (_, index) => `customer-${index}`);
  const stateKey = (id: string) => `outpost:v1:${organization}:state:external:${id}:tokens`;
  for (const id of customers) await redis.hset(stateKey(id), "cold:sum", 0);
  const receive = outpost["receiveSnapshot"].bind(outpost);
  outpost["receiveSnapshot"] = async (...args: Parameters<typeof receive>) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return receive(...args);
  };
  const started = performance.now();
  await deliver(
    outpost,
    ...customers.map((id) => ({
      external_customer_id: id,
      customer_id: null,
      reducer_id: "tokens",
      cold_until: bucket,
      version: 1791807000000001,
      count: 1,
      sum: 1,
      min: 1,
      max: 1,
    })),
  );
  expect(performance.now() - started).toBeLessThan(250);
  for (const id of customers) expect(await redis.hget(stateKey(id), "cold:sum")).toBe("1");
});

it("waits for a stale pull at most its snapshot timeout, then reads Redis", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  snapshot = aliceSnapshot;
  const outpost = await start();
  await outpost.meter(meter);
  outpost["pullChanges"] = () => new Promise<void>((resolve) => setTimeout(resolve, 2_000));
  vi.advanceTimersByTime(60_000);
  const started = performance.now();
  expect((await outpost.meter(meter))?.consumed_units).toBe(3);
  expect(performance.now() - started).toBeLessThan(1_000);
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

it("waits for a backoff another instance set", async () => {
  const outpost = await start();
  changeRequests.length = 0;
  await redis.hset(`outpost:v1:${organization}:pull`, "retry_at", Date.now() + 1_000);
  await outpost["pull"]();
  expect(changeRequests).toHaveLength(0);
});

it("changes nothing for an older snapshot or one already applied", async () => {
  await seed();
  await applySnapshot("external:alice:tokens", bucket, 2, 2, 8, 3, 5);
  expect(await applySnapshot("external:alice:tokens", bucket, 1, 1, 1, 1, 1)).toEqual([]);
  expect(await applySnapshot("external:alice:tokens", bucket, 3, 2, 8, 3, 5)).toEqual([]);
  expect(await redis.hmget(key, "cold:sum", "snapshot_version")).toEqual(["8", "3"]);
  expect(await applySnapshot("external:alice:tokens", bucket, 4, 3, 9, 3, 5)).not.toEqual([]);
});

it("reads again once Redis reconnects", async () => {
  await seed();
  const outpost = await start();
  await outpost.actor(customer);
  const primary = outpost["redis"]!;
  const reconnect = once(primary, "ready");
  primary.disconnect(true);
  await redis.hset(key, "cold:sum", 20);
  await reconnect;
  expect((await outpost.meter(meter))?.consumed_units).toBe(20);
});

it("closes the Redis connection it owns", async () => {
  const outpost = await start();
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
  expect(meterUsageRequests.map((request) => request.reducer_id).sort()).toEqual([
    "credits",
    "tokens",
  ]);
});

it("keeps the cold-fetch lock another instance took once its own expired", async () => {
  snapshot = aliceSnapshot;
  reducerSnapshots = { tokens: { delay: 100 } };
  const outpost = await start({ snapshotTimeout: 1_000 });
  const lock = `outpost:v1:${organization}:cold:lock`;
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
  const second = await start({
    client: new ClientBase({ ...core["options"], accessToken: "org-2-token" }),
  });
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
  expect((await first.meter(meter))?.consumed_units).toBe(120);
  expect((await first.meter({ ...customer, meter_id: "shared" }))?.credited_units).toBe(200);
  expect(
    (await first.meter({ ...customer, meter_id: "average-meter" }))?.consumed_units,
  ).toBeCloseTo(120 / 22);
  expect(
    await redis.hmget(key, ...["count", "sum", "min", "max"].map((name) => `bucket:${bucket}:${name}`)),
  ).toEqual(["20", "100", "2", "8"]);
  await first.flush();
  await first.track({
    ...customer,
    name: "api",
    external_id: eventId(),
    timestamp: "2026-10-12T12:05:00Z",
    metadata: { tokens: 4 },
  });
  await applySnapshot("external:alice:tokens", bucket + BUCKET_SIZE, 21, 22, 120, 2, 15);
  await applySnapshot("external:alice:credits", 21, 21, 2, 150, 50, 100);
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
  await outpost["receiveSnapshot"]({ ...snapshot, customer_exists: true, customer_id: "alice", sum: 999 } as never, false, null);
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  await outpost["receiveSnapshot"]({ ...snapshot, customer_exists: true, version: 1791807000000001, sum: 999 } as never, false, null);
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  await outpost["receiveSnapshot"]({
        ...snapshot,
        customer_exists: true,
        version: 1791807000000003,
        count: 0,
        sum: 0,
        min: null,
        max: null,
      } as never, false, null);
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
  await outpost.flush();
  await outpost.track({
    ...customer,
    name: "api",
    external_id: eventId(),
    timestamp: "2026-10-12T12:05:00Z",
    metadata: { tokens: 4 },
  });
  await outpost["receiveSnapshot"]({
        ...snapshot,
        customer_exists: true,
        cold_until: bucket + 1,
        version: 1791807000000002,
        count: 1,
        sum: 2,
        min: 2,
        max: 2,
      } as never, false, null);
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
  expect((await outpost.meter(meter))?.consumed_units).toBe(100);
});

it("counts a late write into a cold bucket", async () => {
  const outpost = await warm();
  await seal(bucket + BUCKET_SIZE);
  await outpost.track(usage("late", 5));
  expect((await outpost.meter(meter))?.consumed_units).toBe(5);
});

it("counts an event from before 1970", async () => {
  const outpost = await warm();
  await outpost.track({ ...usage("old", 5), timestamp: "1969-12-31T23:59:59Z" });
  expect((await outpost.meter(meter))?.consumed_units).toBe(5);
});

it("keeps the pending extrema of the events still pending", async () => {
  reducers[0].aggregation = { func: "max", property: "tokens" };
  const outpost = await warm();
  const events = [usage("low", 3), usage("high", 9), usage("mid", 5)];
  for (const event of events) await outpost.track(event);
  expect(await redis.hget(key, `pending:${bucket}:min`)).toBe("3");
  expect(await redis.hget(key, `pending:${bucket}:max`)).toBe("9");
  ingested = new Set(["high", "low"]);
  snapshot = { ...sealing(2, 12), min: 3, max: 9 };
  await deliver(outpost, snapshot);
  await vi.waitFor(async () => expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("1"));
  expect(await redis.hget(key, `pending:${bucket}:min`)).toBe("5");
  expect(await redis.hget(key, `pending:${bucket}:max`)).toBe("5");
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("1");
});

it("settles an event once however many times CONFIRM names it", async () => {
  const outpost = await warm();
  const events = [usage("event-0", 10), usage("event-1", 10)];
  for (const event of events) await outpost.track(event);
  const outbox = `outpost:v1:${organization}:outbox`;
  const pending = `outpost:v1:${organization}:pending:external:alice:tokens:${bucket}`;
  await redis.eval(CONFIRM_SCRIPT, 4, outbox, outbox, key, pending, "", "", 0, 0, bucket, 2, "event-0", "event-0");
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("1");
  expect(await redis.hget(key, `pending:${bucket}:sum`)).toBe("10");
});

it("settles a hot bucket's events on Polar's receipt", async () => {
  const outpost = await warm();
  const events = [usage("event-0", 10), usage("event-1", 10)];
  for (const event of events) await outpost.track(event);
  await outpost.flush();
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
  await outpost.flush();
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("2");
  expect((await outpost.meter(meter))?.consumed_units).toBe(20);
  ingested = new Set(["event-0", "event-1"]);
  snapshot = { ...sealing(2, 20), cold_until: bucket + 2 * BUCKET_SIZE, version: 1791807000000006 };
  await deliver(outpost, snapshot);
  await vi.waitFor(async () => expect(await redis.hget(key, `pending:${bucket}:count`)).toBeNull());
  expect((await outpost.meter(meter))?.consumed_units).toBe(20);
});

// The events Outpost queued for Polar, as Polar ingests them.
const queued = async (): Promise<unknown[]> =>
  (await redis.xrange("outpost:v1:org-1:outbox", "-", "+")).map(([, fields]) =>
    JSON.parse(fields[1]),
  );

it("queues a tracked event for Polar", async () => {
  const outpost = await warm();
  await outpost.track(usage("event-1", 10));
  expect(await queued()).toEqual([usage("event-1", 10)]);
});

it("queues an event once however many times it is tracked", async () => {
  const outpost = await warm();
  await outpost.track(usage("same", 10));
  await outpost.track(usage("same", 10));
  expect(await queued()).toEqual([usage("same", 10)]);
});

it("queues an event once when two meters count it", async () => {
  reducers = [...reducers, { ...reducers[0], id: "requests", meter_ids: ["requests"] }];
  const outpost = await warm();
  await outpost.track(usage("event-1", 10));
  expect(await queued()).toEqual([usage("event-1", 10)]);
});

it("queues an event no meter counts", async () => {
  reducers = [
    {
      ...reducers[0],
      filter: {
        conjunction: "and",
        clauses: [{ property: "name", operator: "eq", value: "other" }],
      },
    },
    reducers[1],
  ];
  const outpost = await warm();
  await outpost.track(usage("event-1", 10));
  expect(await queued()).toEqual([usage("event-1", 10)]);
});

// The external_ids Polar received, request by request.
const delivered = () => ingestRequests.map((events) => events.map((event) => event.external_id));

it("delivers what it queued on its own, without a flush", async () => {
  const outpost = await warm();
  await outpost.track(usage("event-0", 10));
  await vi.waitFor(() => expect(delivered()).toEqual([["event-0"]]), { timeout: 3000 });
});

it("delivers the stream to Polar in batches of a thousand, whichever instance flushes", async () => {
  const outposts = [await warm(), await start()];
  for (let index = 0; index < 2500; index += 1)
    await outposts[index % 2].track(usage(`event-${index}`, 1));
  await Promise.all(outposts.map((outpost) => outpost.flush()));
  // The periodic drain may send part of the stream while it is written.
  expect(Math.max(...ingestRequests.map((events) => events.length))).toBe(1000);
  expect(new Set(delivered().flat()).size).toBe(2500);
  expect(await redis.xlen("outpost:v1:org-1:outbox")).toBe(0);
});

it("settles the events Polar received and reports them", async () => {
  const onDelivered = vi.fn();
  const outpost = await warm({ onDelivered });
  const events = [usage("event-0", 10), usage("event-1", 10)];
  for (const event of events) await outpost.track(event);
  await outpost.flush();
  expect(ingestRequests).toEqual([events]);
  expect(onDelivered).toHaveBeenCalledWith(events);
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBeNull();
  expect((await outpost.meter(meter))?.consumed_units).toBe(20);
});

const BACKOFF = "outpost:v1:org-1:outbox:backoff";

it("keeps a batch Polar fails to take, and the fleet waits before sending it again", async () => {
  const [outpost, other] = [await warm(), await start()];
  await outpost.track(usage("event-0", 10));
  ingestStatuses = [503];
  const failed = Date.now();
  await outpost.flush();
  expect(await queued()).toEqual([usage("event-0", 10)]);
  expect(Number(await redis.hget(BACKOFF, "retry_at"))).toBeGreaterThanOrEqual(failed + 1000);
  await other.track(usage("event-1", 10));
  await other.flush();
  expect(ingestRequests).toHaveLength(1);
  await redis.hset(BACKOFF, "retry_at", 0);
  await outpost.flush();
  expect(delivered()).toEqual([["event-0"], ["event-0"], ["event-1"]]);
  expect(await redis.xlen("outpost:v1:org-1:outbox")).toBe(0);
  expect(await redis.exists(BACKOFF)).toBe(0);
});

it("sends a batch that failed on another slot again once the backoff ends", async () => {
  const outpost = await warm();
  clearInterval(outpost["drainTimer"]);
  // Two full batches: two flushers, and Polar fails both.
  await Promise.all(
    Array.from({ length: 2000 }, (_, index) => outpost.track(usage(`event-${index}`, 1))),
  );
  ingestStatuses = [503, 503];
  await outpost.flush();
  expect(ingestRequests).toHaveLength(2);
  await redis.hset(BACKOFF, "retry_at", 0);
  // Nothing new waits, so the next drain starts one flusher: it sends both batches.
  await outpost.flush();
  expect(new Set(delivered().flat()).size).toBe(2000);
  expect(await redis.xlen("outpost:v1:org-1:outbox")).toBe(0);
});

it("waits as long as a Polar that rate-limits it asks", async () => {
  const outpost = await warm();
  await outpost.track(usage("event-0", 10));
  ingestStatuses = [429];
  const failed = Date.now();
  await outpost.flush();
  const retryAt = Number(await redis.hget(BACKOFF, "retry_at"));
  expect(retryAt).toBeGreaterThanOrEqual(failed + 30_000);
  expect(retryAt).toBeLessThanOrEqual(Date.now() + 30_000);
});

it("counts the failures flushers meet during one wait as one, and keeps the longest wait", async () => {
  const outpost = await warm();
  const failed = Date.now();
  const backOff = (first: number) => outpost["backOff"](BACKOFF, { first, max: 60_000 });
  await Promise.all(Array.from({ length: 8 }, () => backOff(1000)));
  expect(Number(await redis.hget(BACKOFF, "retry_at"))).toBeLessThan(failed + 2000);
  await backOff(30_000);
  await backOff(1000);
  expect(Number(await redis.hget(BACKOFF, "retry_at"))).toBeGreaterThanOrEqual(failed + 30_000);
});

it("keeps a backoff another flusher set while this one delivered", async () => {
  const later = Date.now() + 60_000;
  const outpost = await warm({
    onDelivered: async () => {
      await redis.hset(BACKOFF, "retry_at", later);
    },
  });
  await redis.hset(BACKOFF, { failures: 1, retry_at: 1 });
  await outpost.track(usage("event-0", 10));
  await outpost.flush();
  expect(await redis.hget(BACKOFF, "retry_at")).toBe(String(later));
});

it.each([
  ["event", '{"external_id":"unreadable","ratio":NaN}'],
  ["event", '{"external_id":"unreadable","ratio":1e999}'],
  ["other", "unreadable"],
])("skips an outbox entry it cannot read (%s %s), and delivers the rest", async (field, value) => {
  const outpost = await warm();
  await redis.xadd("outpost:v1:org-1:outbox", "*", field, value);
  await outpost.track(usage("event-0", 10));
  await outpost.flush();
  expect(delivered()).toEqual([["event-0"]]);
  expect(await redis.xlen("outpost:v1:org-1:outbox")).toBe(0);
});

it("delivers an event another SDK queued in a form it cannot parse", async () => {
  const outpost = await warm();
  // Another SDK takes a timestamp this one refuses.
  const foreign = { ...usage("foreign", 10), timestamp: "2026-10-12 12:00:00.123456+00" };
  await redis.xadd("outpost:v1:org-1:outbox", "*", "event", JSON.stringify(foreign));
  await outpost.track(usage("event-0", 10));
  await outpost.flush();
  expect(delivered()).toEqual([["foreign", "event-0"]]);
  expect(await redis.xlen("outpost:v1:org-1:outbox")).toBe(0);
});

it("drops only the events Polar names when it refuses a batch, and delivers the rest", async () => {
  const [onDelivered, onDropped] = [vi.fn(), vi.fn()];
  const outpost = await warm({ onDelivered, onDropped });
  const events = [usage("event-0", 10), usage("refused", 10), usage("event-1", 10)];
  for (const event of events) await outpost.track(event);
  ingestRefused = new Set(["refused"]);
  await outpost.flush();
  expect(delivered()).toEqual([
    ["event-0", "refused", "event-1"],
    ["event-0", "event-1"],
  ]);
  expect(onDropped).toHaveBeenCalledWith([events[1]], "permanent_error");
  expect(onDelivered).toHaveBeenCalledWith([events[0], events[2]]);
  expect(await redis.xlen("outpost:v1:org-1:outbox")).toBe(0);
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBeNull();
});

it("drops a batch Polar refuses, settles its events and reports them", async () => {
  const onDropped = vi.fn();
  const outpost = await warm({ onDropped });
  const events = [usage("event-0", 10), usage("event-1", 10)];
  for (const event of events) await outpost.track(event);
  ingestStatuses = [422];
  await outpost.flush();
  expect(onDropped).toHaveBeenCalledWith(events, "permanent_error");
  expect(await redis.xlen("outpost:v1:org-1:outbox")).toBe(0);
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBeNull();
  await outpost.flush();
  expect(ingestRequests).toHaveLength(1);
});

it("takes back the batch of a flusher that died on the next drain once it sat idle long enough", async () => {
  const outpost = await warm();
  await outpost.track(usage("event-0", 10));
  // A flusher read the batch and froze before Polar answered.
  const stream = "outpost:v1:org-1:outbox";
  const read = await redis.xreadgroup("GROUP", "polar", "frozen", "STREAMS", stream, ">");
  const [[, entries]] = read as [string, [string, string[]][]][];
  await outpost.flush();
  expect(ingestRequests).toHaveLength(0);
  await redis.xclaim(stream, "polar", "frozen", 0, ...entries.map(([id]) => id), "IDLE", 60_000);
  await outpost.track(usage("event-1", 10));
  await outpost.flush();
  expect(delivered().flat().sort()).toEqual(["event-0", "event-1"]);
  expect(await redis.xlen(stream)).toBe(0);
});

it("sends only full batches while another flusher delivers, and the rest once none does", async () => {
  const outpost = await warm();
  const stream = "outpost:v1:org-1:outbox";
  await outpost.track(usage("event-0", 10));
  // Another flusher holds a batch in flight.
  await redis.xreadgroup("GROUP", "polar", "other", "STREAMS", stream, ">");
  for (let index = 1; index <= 1_001; index += 1) await outpost.track(usage(`event-${index}`, 1));
  await outpost.flush();
  expect(delivered().map((ids) => ids.length)).toEqual([1000]);
  // The other flusher delivered its batch.
  const [[entry]] = await redis.xrange(stream, "-", "+", "COUNT", 1);
  await redis.xack(stream, "polar", entry);
  await redis.xdel(stream, entry);
  await outpost.flush();
  expect(delivered().map((ids) => ids.length)).toEqual([1000, 1]);
  expect(delivered()[1]).toEqual(["event-1001"]);
});

it("delivers what another instance queued while it flushed", async () => {
  const [first, second] = [await warm(), await start()];
  await first.track(usage("event-0", 10));
  ingestDelay = 100;
  const flushing = first.flush();
  await vi.waitFor(() => expect(ingestRequests).toHaveLength(1));
  await second.track(usage("event-1", 10));
  await second.flush();
  await flushing;
  expect(delivered().flat().sort()).toEqual(["event-0", "event-1"]);
  expect(await redis.xlen("outpost:v1:org-1:outbox")).toBe(0);
});

it("hands its slot over a few seconds into a drain a flush waits on, while the fleet writes", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const [first, second] = [await warm(), await start()];
  await first.track(usage("event-0", 10));
  ingestDelay = 40;
  let writing = true;
  // Another instance queues events during each of the flusher's ingest round trips.
  const writer = (async () => {
    for (let index = 0; writing; index += 1) {
      await second.track(usage(`other-${index}`, 1));
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  })();
  try {
    let flushed = false;
    void first.flush().then(() => (flushed = true));
    await vi.waitFor(() => expect(ingestRequests.length).toBeGreaterThan(2));
    vi.advanceTimersByTime({{ outpost_constants.flush_tenure }});
    await vi.waitFor(() => expect(flushed).toBe(true), { timeout: 2_000 });
  } finally {
    writing = false;
    await writer;
  }
  expect(delivered().flat()).toContain("event-0");
});

it("ignores a duplicate external_id", async () => {
  const outpost = await warm();
  await outpost.track(usage("same", 10));
  await outpost.track(usage("same", 10));
  expect((await outpost.meter(meter))?.consumed_units).toBe(10);
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBe("1");
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

it("asks Polar again at the next read about a snapshot it did not confirm in time", async () => {
  const outpost = await warm({ confirmTimeout: 50 });
  for (let i = 0; i < 3; i++) await outpost.track(usage(`event-${i}`, 10));
  answerConfirm = false;
  snapshot = sealing(3, 30);
  await deliver(outpost, snapshot!);
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(60));
  // No change of this customer follows, so no pull brings its snapshot back: its reads do.
  answerConfirm = true;
  ingested = new Set(["event-0", "event-1", "event-2"]);
  await vi.waitFor(async () => expect((await outpost.meter(meter))?.consumed_units).toBe(30));
  expect(await redis.hget(key, `pending:${bucket}:count`)).toBeNull();
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
  await outpost.meter(meter);
  expect(exported.map((span) => span.name)).toContain("outpost.snapshot.received");
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
      "outpost.snapshot.received",
      "outpost.pull",
      "outpost.redis.disconnect",
    ]),
  );
  expect(
    exported
      .filter((span) => span.name === "outpost.redis.connect")
      .map((span) => span.attributes["outpost.redis.connection"]),
  ).toEqual(["primary"]);
  for (const span of exported.filter((span) => span.name !== "outpost.redis.connect"))
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
  await expect(outpost.actor(customer)).rejects.toBeInstanceOf(PolarOutpostError);
  expect(outpost.connected).toBe(false);
});

it("resumes once a pull succeeds after Polar refused one", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const outpost = await start();
  refuseConnections = true;
  await outpost["pull"]();
  await expect(outpost.track(usage(eventId(), 1))).rejects.toThrow("refused");
  refuseConnections = false;
  // Once the pull's backoff ends, a call on the failed instance starts the next pull.
  vi.advanceTimersByTime(60_000);
  await vi.waitFor(() => outpost.track(usage(eventId(), 1)));
  expect(outpost.connected).toBe(true);
});

it.each([
  [422, false],
  [429, true],
])("fails when Polar rejects a pull with %i unless it only slows it down", async (status, connected) => {
  const outpost = await start();
  changesStatus = status;
  await outpost["pull"]();
  expect(outpost.connected).toBe(connected);
});

it("fails to start when Polar refuses Outpost", async () => {
  refuseConnections = true;
  await expect(start()).rejects.toThrow("refused");
});

it("starts once Redis accepts the connection it first closed", async () => {
  const connect = Redis.prototype.connect;
  const attempts = vi
    .spyOn(Redis.prototype, "connect")
    .mockRejectedValueOnce(new Error("Connection is closed."))
    .mockImplementation(function (this: Redis, ...args: Parameters<typeof connect>) {
      return connect.apply(this, args);
    });
  const outpost = await start();
  expect(outpost.connected).toBe(true);
  expect(attempts).toHaveBeenCalledTimes(2);
});

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
  const [[failed]] = applySnapshot.mock.calls;
  expect(applySnapshot.mock.calls.filter(([stateKey]) => stateKey === failed)).toHaveLength(2);
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
  await expect(outpost.actor(customer)).rejects.toThrow();
  // Every later call fails with one Outpost error, which names what stopped the instance.
  const stopped = (failure: unknown) =>
    failure instanceof PolarOutpostError && failure.cause === error;
  await expect(outpost.meter(meter)).rejects.toSatisfy(stopped);
  await expect(ingest(outpost, 5)).rejects.toSatisfy(stopped);
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
  const pending = await redis.ttl(`outpost:v1:${organization}:pending:external:alice:tokens:${bucket}`);
  expect(pending).toBeGreaterThan(0);
  expect(pending).toBeLessThanOrEqual(3_900);
  await redis.expire(key, 60);
  await outpost.flush();
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

it("asks Polar in one request for the cold customers the whole fleet reads", async () => {
  snapshot = aliceSnapshot;
  const fleet = await Promise.all(Array.from({ length: 3 }, () => start({ snapshotTimeout: 1_000 })));
  await fleet[0]["pull"]();
  await Promise.all(
    ["alice", "bob", "carol"].map((id, index) =>
      fleet[index].meter({ external_customer_id: id, meter_id: "meter" }),
    ),
  );
  expect(meterUsageBatches).toEqual([6]);
});

it("asks Polar again for a batch of cold customers a passing error failed", async () => {
  snapshot = aliceSnapshot;
  const outpost = await start({ snapshotTimeout: 2_000 });
  await outpost["pull"]();
  meterUsageFailures = 1;
  expect((await outpost.meter(meter))?.consumed_units).toBe(3);
  expect(meterUsageBatches).toEqual([2, 2]);
});

it("applies the cold customers it asked Polar for side by side", async () => {
  snapshot = aliceSnapshot;
  const outpost = await start({ snapshotTimeout: 2_000 });
  await outpost["pull"]();
  const receive = outpost["receiveSnapshot"].bind(outpost);
  let applying = 0;
  let most = 0;
  outpost["receiveSnapshot"] = async (...args: Parameters<typeof receive>) => {
    most = Math.max(most, ++applying);
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      return await receive(...args);
    } finally {
      applying -= 1;
    }
  };
  const read = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      outpost.meter({ external_customer_id: `customer-${index}`, meter_id: "meter" }),
    ),
  );
  expect(most).toBeGreaterThan(1);
  expect(read.every((value) => value !== null)).toBe(true);
});

it("lets go of a pull only once every snapshot of its page is done", async () => {
  const outpost = await start();
  const stateKey = (id: string) => `outpost:v1:${organization}:state:external:${id}:tokens`;
  for (const id of ["failing", "slow"]) await redis.hset(stateKey(id), "cold:sum", 0);
  let finished = false;
  const receive = outpost["receiveSnapshot"].bind(outpost);
  outpost["receiveSnapshot"] = async (...args: Parameters<typeof receive>) => {
    if (args[0].external_customer_id === "failing") throw new PolarError("Polar is down");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const applied = await receive(...args);
    finished = true;
    return applied;
  };
  await deliver(
    outpost,
    ...["failing", "slow"].map((id) => ({ ...aliceSnapshot, external_customer_id: id })),
  );
  expect(finished).toBe(true);
});

it("asks Polar for a few batches of cold customers at once", async () => {
  snapshot = aliceSnapshot;
  reducerSnapshots = { tokens: { delay: 100 } };
  const outpost = await start({ snapshotTimeout: 2_000 });
  await outpost["pull"]();
  await Promise.all(
    Array.from({ length: 300 }, (_, index) =>
      outpost.meter({ external_customer_id: `customer-${index}`, meter_id: "meter" }),
    ),
  );
  expect(meterUsageBatches.sort((a, b) => b - a)).toEqual([500, 100]);
  expect(meterUsageMostInFlight).toBe(2);
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
  // A balance without its credits would read as overdrawn: the read fails instead.
  [500, null, "not_ready"],
])(
  "waits for the credit snapshot of the meter it reads (delay %i ms)",
  async (delay, credits, outcome) => {
    await redis.hset(key, { cold_until: bucket, "cold:count": 1, "cold:sum": 3 });
    snapshot = aliceSnapshot;
    reducerSnapshots = { credits: { delay } };
    const outpost = await start();
    const read = outpost.meter(meter);
    if (credits === null) await expect(read).rejects.toThrow("snapshot is not ready");
    else expect((await read)?.credited_units).toBe(credits);
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

it("reads a customer a pull found before its miss backs off", async () => {
  await seed();
  const outpost = await start();
  await redis.hset(
    `outpost:v1:${organization}:missing:external:alice:tokens`,
    "retry_at",
    Date.now() + 60_000,
  );
  expect(await outpost.meter(meter)).toBeNull();
  await deliver(outpost, aliceSnapshot);
  expect((await outpost.meter(meter))?.consumed_units).toBe(3);
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
  outpost["receiveSnapshot"]({
        ...customer,
        customer_id: null,
        customer_exists: true,
        reducer_id: "credits",
        ...creditSnapshot(units, version),
      } as never, false, null);

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
  const pipeline = outpost["redis"]!.pipeline();
  vi.spyOn(outpost["redis"]!, "pipeline").mockReturnValue(pipeline);
  const write = vi.spyOn(pipeline, "exec").mockRejectedValue(redisError);
  vi.spyOn(outpost["redis"]!, "outpostReadStates").mockRejectedValue(redisError);
  const readError = outpost.meter(meter);
  await expect(readError).rejects.toBeInstanceOf(UnavailableRedisError);
  await expect(readError).rejects.toMatchObject({ cause: redisError });
  expect(await readOutcomes(outpost)).toEqual([["meter", "redis_unavailable"]]);
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
  outpost["redis"]!.disconnect();
  await vi.waitFor(() => expect(outpost.connected).toBe(false));
  const started = performance.now();
  await expect(
    outpost.meter({ external_customer_id: "bob", meter_id: "meter" }),
  ).rejects.toBeInstanceOf(UnavailableRedisError);
  expect(performance.now() - started).toBeLessThan(500);
  expect(await readOutcomes(outpost)).toEqual([["meter", "redis_unavailable"]]);
});

it("delivers each event once, through Outpost, when the client factory starts it", async () => {
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
    const metering = polar.metering({ outpost: outpost({ redisUrl: redisServer.socket }) });
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
  expect(() => decodeState(["cold:sum", value])).toThrow();
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
    for (const [field, value] of Object.entries(stored))
      expect([field, Number(value)]).toEqual([field, JSON.parse(value)]);
  }
});

describe("Redis cost", () => {
  // What Outpost cost Redis while `run` ran: the commands its connections sent, as Redis Cloud
  // counts its ops (a script once, whatever it runs), and the bytes each way.
  const redisCost = async (run: () => Promise<unknown>) => {
    const self = String(await redis.client("ID"));
    const traffic = async () => {
      let sent = 0;
      let received = 0;
      for (const line of ((await redis.client("LIST")) as string).trim().split("\n")) {
        const fields = Object.fromEntries(
          line
            .split(" ")
            .map((pair) => [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)]),
        );
        if (fields.id === self || fields.flags.includes("O")) continue;
        sent += Number(fields["tot-net-in"]);
        received += Number(fields["tot-net-out"]);
      }
      return { sent, received };
    };
    const monitor = await redis.monitor();
    const commands: Record<string, number> = {};
    monitor.on("monitor", (_time: string, args: string[], source: string) => {
      const command = args[0].toLowerCase();
      if (source !== "lua" && command !== "client")
        commands[command] = (commands[command] ?? 0) + 1;
    });
    const before = await traffic();
    await run();
    const after = await traffic();
    await new Promise((resolve) => setTimeout(resolve, 50));
    monitor.disconnect();
    // A copy: the monitor may report the next commands before its connection closes.
    return {
      commands: { ...commands },
      sent: after.sent - before.sent,
      received: after.received - before.received,
    };
  };
  // Telemetry relays its exports through Redis after a pull: only its own test counts them.
  const quiet = (options: Partial<OutpostOptions> = {}) => start({ telemetry: false, ...options });
  const event = () => ({
    ...customer,
    name: "api_call",
    external_id: eventId(),
    timestamp,
    metadata: { tokens: 1 },
  });

  it("reads a meter in one command, only the statistics it adds up", async () => {
    await seed();
    const outpost = await quiet();
    await outpost.meter(meter);
    const cost = await redisCost(() => outpost.meter(meter));
    expect(cost.commands).toEqual({ evalsha: 1 });
    expect(cost.received).toBeLessThanOrEqual(170);
  });

  it("reads none of the statistics the meter's total leaves out", async () => {
    await seed();
    // Five cold buckets Polar has counted, two of them with events it has not confirmed yet, and
    // a hot one: the read takes the sums of the hot bucket and of the unconfirmed events.
    for (let index = 1; index <= 5; index += 1) {
      const start = bucket - index * BUCKET_SIZE;
      await redis.hset(key, { [`bucket:${start}:count`]: 1, [`bucket:${start}:sum`]: 1, [`bucket:${start}:min`]: 1, [`bucket:${start}:max`]: 1 });
      if (index <= 2)
        await redis.hset(key, { [`pending:${start}:count`]: 1, [`pending:${start}:sum`]: 2, [`pending:${start}:min`]: 2, [`pending:${start}:max`]: 2 });
    }
    await redis.hset(key, { [`bucket:${bucket}:count`]: 1, [`bucket:${bucket}:sum`]: 5, [`bucket:${bucket}:min`]: 5, [`bucket:${bucket}:max`]: 5 });
    const outpost = await quiet();
    expect((await outpost.meter(meter))?.consumed_units).toBe(10 + 2 * 2 + 5);
    const cost = await redisCost(() => outpost.meter(meter));
    expect(cost.received).toBeLessThanOrEqual(330);
  });

  it("tracks an event in one command", async () => {
    await seed();
    const outpost = await quiet();
    await outpost.track(event());
    expect((await redisCost(() => outpost.track(event()))).commands).toEqual({ evalsha: 1 });
  });

  it("flushes a thousand events in as many commands as one", async () => {
    await seed();
    const outpost = await quiet();
    const flushCost = async (events: number) => {
      for (let index = 0; index < events; index += 1) await outpost.track(event());
      const { commands } = await redisCost(() => outpost.flush());
      expect(await redis.xlen("outpost:v1:org-1:outbox")).toBe(0);
      return commands;
    };
    await flushCost(1);
    expect(await flushCost(1000)).toEqual(await flushCost(1));
  });

  it("flushes twenty concurrent requests for the commands of one, and one more look at most", async () => {
    await seed();
    const outpost = await quiet();
    await deliver(outpost);
    await outpost.track(event());
    await outpost.flush();
    const flushCost = async (concurrent: number) => {
      await outpost.track(event());
      const { commands } = await redisCost(() =>
        Promise.all(Array.from({ length: concurrent }, () => outpost.flush())),
      );
      return commands;
    };
    const { evalsha: once, ...single } = await flushCost(1);
    const { evalsha: concurrent, ...twenty } = await flushCost(20);
    // The flushes of one instance share its drain, which looks once more for their events.
    expect(twenty).toEqual(single);
    expect(concurrent - once).toBeLessThanOrEqual(1);
  });

  it("tracks and flushes in one command while another instance drains the stream", async () => {
    await seed();
    const [first, second] = [await quiet(), await quiet()];
    await deliver(first);
    await deliver(second);
    const queued = event();
    await first.track(queued);
    // A duplicate queues nothing: it loads the script on the second instance's connection.
    await second.track(queued);
    // Polar holds the first instance's batch past the measure, which counts every connection.
    ingestDelay = 1_000;
    const draining = first.flush();
    await vi.waitFor(() => expect(ingestRequests).toHaveLength(1));
    const cost = await redisCost(async () => {
      await second.track(event());
      await second.flush();
    });
    // The instance draining reads the stream again once it lets go of its slot.
    expect(cost.commands).toEqual({ evalsha: 1 });
    await draining;
    expect(ingestRequests.flat()).toHaveLength(2);
  });

  it("warms a known customer over eleven reducers in one command, readiness alone", async () => {
    reducers = [
      ...Array.from(
        { length: 10 },
        (_, index): Reducer => ({
          ...reducers[0],
          id: `tokens-${index}`,
          meter_ids: [`meter-${index}`],
        }),
      ),
      reducers[1],
    ];
    snapshot = aliceSnapshot;
    const outpost = await quiet();
    await outpost.actor({ external_customer_id: "bob" });
    await outpost.actor(customer);
    const cost = await redisCost(() => outpost.actor(customer));
    expect(cost.commands).toEqual({ evalsha: 1 });
    expect(cost.received).toBeLessThanOrEqual(620);
  });

  it("pulls and applies a snapshot in six commands, two of them the snapshot's", async () => {
    await seed();
    const outpost = await quiet();
    await outpost.meter(meter);
    changes.push({ ...aliceSnapshot, version: 1791807000000004 });
    await outpost["pull"]();
    changes.push(aliceSnapshot);
    expect((await redisCost(() => outpost["pull"]())).commands).toEqual({
      hget: 2,
      set: 1,
      evalsha: 3,
    });
  });

  it("applies each snapshot of a page in two commands", async () => {
    const customers = ["alice", "bob", "carol"];
    for (const name of customers)
      await redis.hset(`outpost:v1:${organization}:state:external:${name}:tokens`, "cold_until", bucket);
    const outpost = await quiet();
    changes.push({ ...aliceSnapshot, version: 1791807000000004 });
    await outpost["pull"]();
    changes.push(...customers.map((name) => ({ ...aliceSnapshot, external_customer_id: name })));
    expect((await redisCost(() => outpost["pull"]())).commands).toEqual({
      hget: 2,
      set: 1,
      evalsha: 1 + 2 * customers.length,
    });
  });

  it("lets the instances that lose the pull go on without polling its lock", async () => {
    const fleet = await Promise.all([quiet(), quiet(), quiet()]);
    // Due, not stale: no read waits for the pull. A stale one still makes the losers wait.
    await redis.hset(`outpost:v1:${organization}:pull`, "pulled_at", Date.now() - 31_000);
    changesDelay = 200;
    const cost = await redisCost(() => Promise.all(fleet.map((outpost) => outpost["refresh"]())));
    expect(cost.commands.set).toBe(3);
    expect(cost.commands.exists).toBeUndefined();
  });

  it("measures the size of Redis from the instance that pulled alone", async () => {
    const fleet = await Promise.all([start(), start(), start()]);
    const cost = await redisCost(() => Promise.all(fleet.map((outpost) => outpost["pull"]())));
    expect([cost.commands.info, cost.commands.dbsize]).toEqual([1, 1]);
  });

  it("pushes an instance's telemetry in one command", async () => {
    const outpost = await start();
    const push = (name: string) => {
      outpost["telemetryBuffer"].spans.push(Buffer.from(`${name}-span;`));
      outpost["telemetryBuffer"].metrics.push(Buffer.from(`${name}-metric;`));
      return outpost["pushTelemetry"]();
    };
    await push("first");
    expect((await redisCost(() => push("second"))).commands).toEqual({ evalsha: 1 });
    for (const kind of ["span", "metric"])
      expect(await redis.lrange(`outpost:v1:${organization}:telemetry:${kind}s`, 0, -1)).toEqual([
        `first-${kind};`,
        `second-${kind};`,
      ]);
  });

  it("lets the readers of a cold customer wait on its fetch, then read it once", async () => {
    snapshot = aliceSnapshot;
    reducerSnapshots = { tokens: { delay: 200 }, credits: { delay: 200 } };
    const [first, second] = await Promise.all([
      quiet({ snapshotTimeout: 1_000 }),
      quiet({ snapshotTimeout: 1_000 }),
    ]);
    await first.actor({ external_customer_id: "bob" });
    await second.actor({ external_customer_id: "bob" });
    const cost = await redisCost(() => Promise.all([first.meter(meter), second.meter(meter)]));
    // ioredis sends a script's first call on a connection as EVAL.
    expect((cost.commands.evalsha ?? 0) + (cost.commands.eval ?? 0)).toBeLessThanOrEqual(10);
    expect(cost.commands.exists).toBeLessThanOrEqual(2 * (200 / 25 + 2));
  });
});
