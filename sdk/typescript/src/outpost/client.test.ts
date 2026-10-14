import { Redis } from "ioredis";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, access, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";

import type { EventsIngest } from "../2026-04/models";

import { ClientBase } from "../base";
import { Outpost } from "./client";
import { BUCKET_SIZE, getBucketStart, type Reducer } from "./reducer";
import { APPLY_SNAPSHOT_SCRIPT } from "./scripts";

const timestamp = "2026-10-12T12:00:00Z";
const bucket = getBucketStart(Date.parse(timestamp) * 1000);
const customer = { external_customer_id: "alice" };
const meter = { ...customer, meter_id: "meter" };
const key = "outpost:state:external:alice:tokens";
let directory: string;
let redisProcess: ChildProcess;
let redis: Redis;
let server: WebSocketServer;
let core: ClientBase;
let reducers: Reducer[];
let snapshot: Record<string, unknown> | undefined;
let delayConfiguration = false;
const connections: WebSocket[] = [];
const outposts: Outpost[] = [];

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "polar-outpost-"));
  const socket = join(directory, "redis.sock");
  redisProcess = spawn(
    "redis-server",
    ["--port", "0", "--unixsocket", socket, "--save", "", "--appendonly", "no"],
    { stdio: "ignore" },
  );
  let startupError: Error | undefined;
  redisProcess.on("error", (error) => {
    startupError = error;
  });
  await vi.waitFor(async () => {
    if (startupError) throw startupError;
    await access(socket);
  });
  redis = new Redis(socket);
  await once(redis, "ready");
  server = new WebSocketServer({ port: 0, host: "127.0.0.1", path: "/v1/outpost/" });
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
    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "configuration" && !delayConfiguration)
        ws.send(JSON.stringify({ type: "configuration", payload: { reducers } }));
      if (message.type === "meter_usage" && snapshot)
        ws.send(JSON.stringify({ type: "meter_usage", payload: snapshot }));
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
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await Promise.all(outposts.splice(0).map((outpost) => outpost.close()));
  connections.length = 0;
});

afterAll(async () => {
  redis?.disconnect();
  for (const ws of server?.clients ?? []) ws.terminate();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (redisProcess?.pid) {
    const exited = once(redisProcess, "exit");
    redisProcess.kill();
    await exited;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

const start = async (): Promise<Outpost> => {
  const outpost = new Outpost(join(directory, "redis.sock"), { client: core });
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
const ingest = (outpost: Outpost, tokens: number) => {
  const payload: EventsIngest = {
    events: [{ ...customer, name: "api_call", timestamp, metadata: { tokens } }],
  };
  return outpost.ingest(payload);
};

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
    expect((await writer.customerMeter(meter))?.consumed_units).toBe(expected);
    await vi.waitFor(async () =>
      expect((await reader.customerMeter(meter))?.consumed_units).toBe(expected),
    );
    const commands = vi.spyOn(Redis.prototype, "sendCommand");
    expect((await reader.customerMeter(meter))?.balance).toBe(100 - expected);
    expect(commands).not.toHaveBeenCalled();
  },
);

it("handles configuration asynchronously and reports a missing customer snapshot", async () => {
  delayConfiguration = true;
  const outpost = await start();
  const result = ingest(outpost, 3);
  for (const ws of connections)
    ws.send(JSON.stringify({ type: "configuration", payload: { reducers } }));
  expect(await result).toEqual({ inserted: 1, duplicates: 0 });
  await expect(outpost.customerMeter(meter)).rejects.toThrow("snapshot is not ready");
  expect(await outpost.customerMeter({ ...customer, meter_id: "unknown" })).toBeNull();
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
  await vi.waitFor(async () => expect((await reader.customerMeter(meter))?.balance).toBe(89));
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
    events: [
      { ...customer, name: "api", timestamp: "2026-10-12T11:55:00Z", metadata: { tokens: 999 } },
    ],
  });
  expect((await writer.customerMeter(meter))?.balance).toBe(89);
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
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(13);
  await redis.del(key);
  await seed(20);
  await ingest(outpost, 2);
  await receive(
    JSON.stringify({ customer: "external:alice:tokens", state: Object.entries(oldState).flat() }),
  );
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(22);
});

it("repairs a missed notification on periodic refresh", async () => {
  await seed();
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const outpost = await start();
  await outpost.actor(customer);
  await redis.hset(key, "cold:sum", 20);
  await redis.hincrby(key, "revision", 1);
  await vi.advanceTimersByTimeAsync(30_000);
  await vi.waitFor(async () =>
    expect((await outpost.customerMeter(meter))?.consumed_units).toBe(20),
  );
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
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(20);
});

it("reloads evicted customers and closes owned connections", async () => {
  await seed();
  const outpost = await start();
  await outpost.actor(customer);
  for (let i = 0; i < 1024; i++) await outpost.actor({ external_customer_id: `customer-${i}` });
  expect(outpost["cache"].size).toBe(1024);
  await redis.hset(key, "cold:sum", 20);
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(20);
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
  expect((await first.customerMeter(meter))?.consumed_units).toBe(120);
  expect((await first.customerMeter({ ...customer, meter_id: "shared" }))?.credited_units).toBe(
    200,
  );
  expect(
    (await first.customerMeter({ ...customer, meter_id: "average-meter" }))?.consumed_units,
  ).toBeCloseTo(120 / 22);
  expect(first["cache"].get("external:alice:tokens")?.state?.buckets.get(bucket)).toEqual({
    count: 20,
    sum: 100,
    min: 2,
    max: 8,
  });
  await first.ingest({
    events: [
      { ...customer, name: "api", timestamp: "2026-10-12T12:05:00Z", metadata: { tokens: 4 } },
    ],
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
  expect((await first.customerMeter(meter))?.balance).toBe(26);
  expect(
    (await first.customerMeter({ ...customer, meter_id: "average-meter" }))?.consumed_units,
  ).toBeCloseTo(124 / 23);
  expect((await first.customerMeter({ ...customer, meter_id: "shared" }))?.credited_units).toBe(
    200,
  );
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
  await vi.waitFor(async () =>
    expect((await outpost.customerMeter(meter))?.consumed_units).toBe(10),
  );
  await outpost["receiveWebsocket"](
    JSON.stringify({
      type: "meter_usage",
      payload: { ...snapshot, customer_id: "alice", sum: 999 },
    }),
  );
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(10);
  await outpost["receiveWebsocket"](
    JSON.stringify({
      type: "meter_usage",
      payload: { ...snapshot, version: 1791807000000001, sum: 999 },
    }),
  );
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(10);
  await outpost["receiveWebsocket"](
    JSON.stringify({
      type: "meter_usage",
      payload: {
        ...snapshot,
        version: 1791807000000003,
        count: 0,
        sum: 0,
        min: null,
        max: null,
      },
    }),
  );
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(0);
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
  await vi.waitFor(async () =>
    expect((await outpost.customerMeter(meter))?.consumed_units).toBe(0),
  );
  await ingest(outpost, 2);
  await outpost.ingest({
    events: [
      { ...customer, name: "api", timestamp: "2026-10-12T12:05:00Z", metadata: { tokens: 4 } },
    ],
  });
  await outpost["receiveWebsocket"](
    JSON.stringify({
      type: "meter_usage",
      payload: {
        ...snapshot,
        cold_until: bucket + 1,
        version: 1791807000000002,
        count: 1,
        sum: 2,
        min: 2,
        max: 2,
      },
    }),
  );
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(6);
  expect(await redis.hget(key, "cold_until")).toBe(String(bucket + 1));
  expect(await redis.hget(key, `bucket:${bucket}:sum`)).toBeNull();
  expect(await redis.hget(key, `bucket:${bucket + BUCKET_SIZE}:sum`)).toBe("4");
  await ingest(outpost, 999);
  expect((await outpost.customerMeter(meter))?.consumed_units).toBe(6);
});
